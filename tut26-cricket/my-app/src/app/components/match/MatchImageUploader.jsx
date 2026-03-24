"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaImage, FaPlus, FaShieldAlt, FaTimes } from "react-icons/fa";
import LoadingButton from "../shared/LoadingButton";
import {
  compressMatchImage,
  getAcceptedMatchImageTypes,
} from "./match-image-client";

const MAX_SELECTED_IMAGES = 10;

function createSelectionId(file) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createPreviewItems(files) {
  return files.map((file) => ({
    id: createSelectionId(file),
    file,
    url: URL.createObjectURL(file),
  }));
}

function revokePreviewItems(items) {
  items.forEach((item) => {
    if (item?.url) {
      URL.revokeObjectURL(item.url);
    }
  });
}

function normalizeSelectedFiles(files) {
  const nextFiles = Array.from(files || []);

  for (const file of nextFiles) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      throw new Error("Use JPG, PNG, or WebP images only.");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Use images under 10 MB before compression.");
    }
  }

  return nextFiles;
}

function getPlannedGalleryCount({
  existingImageCount = 0,
  selectedCount = 0,
  appendOnUpload = false,
  targetImageId = "",
}) {
  const existingCount = Math.max(0, Number(existingImageCount || 0));
  const nextSelectedCount = Math.max(0, Number(selectedCount || 0));

  if (!nextSelectedCount) {
    return existingCount;
  }

  if (appendOnUpload) {
    return existingCount + nextSelectedCount;
  }

  if (targetImageId) {
    return Math.max(existingCount, 1) + Math.max(0, nextSelectedCount - 1);
  }

  if (existingCount > 0) {
    return Math.max(existingCount, nextSelectedCount);
  }

  return nextSelectedCount;
}

function SelectedImageTile({
  item,
  index,
  isActive,
  onActivate,
  onRemove,
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-[20px] border transition ${
        isActive
          ? "border-emerald-300/30 shadow-[0_14px_30px_rgba(16,185,129,0.14)]"
          : "border-white/10"
      }`}
    >
      <button
        type="button"
        onClick={() => onActivate(item.id)}
        className="block w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={`Selected image ${index + 1}`}
          className="aspect-square w-full object-cover"
        />
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onRemove(item.id);
        }}
        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-black/65 text-white transition hover:bg-black/80"
        aria-label={`Remove image ${index + 1}`}
      >
        <FaTimes className="text-xs" />
      </button>
    </div>
  );
}

export default function MatchImageUploader({
  matchId,
  existingImageUrl,
  existingImageCount = 0,
  targetImageId = "",
  appendOnUpload = false,
  onUploaded,
  onSkip,
  title = "Add Match Image",
  primaryLabel = "Upload Image",
  secondaryLabel = "Skip for Now",
}) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeItemId, setActiveItemId] = useState("");
  const [pin, setPin] = useState("");
  const [submitMode, setSubmitMode] = useState("");
  const [error, setError] = useState("");
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const inputRef = useRef(null);
  const pinInputRef = useRef(null);
  const browseModeRef = useRef("replace");
  const selectedItemsRef = useRef([]);
  const lastAutoSubmittedPinRef = useRef("");

  const selectedFiles = useMemo(
    () => selectedItems.map((item) => item.file),
    [selectedItems],
  );
  const activeItem =
    selectedItems.find((item) => item.id === activeItemId) ||
    selectedItems[0] ||
    null;
  const currentPreview = activeItem?.url || existingImageUrl || "";
  const plannedGalleryCount = getPlannedGalleryCount({
    existingImageCount,
    selectedCount: selectedItems.length,
    appendOnUpload,
    targetImageId,
  });
  const uploadNeedsPin = plannedGalleryCount > 1;
  const canRemoveCurrentImage = Boolean(existingImageUrl);
  const isSubmitting = submitMode === "upload" || submitMode === "remove";

  useEffect(() => {
    if (!selectedItems.length) {
      setActiveItemId("");
      return;
    }

    const activeExists = selectedItems.some((item) => item.id === activeItemId);
    if (!activeExists) {
      setActiveItemId(selectedItems[0].id);
    }
  }, [activeItemId, selectedItems]);

  useEffect(() => {
    selectedItemsRef.current = selectedItems;
  }, [selectedItems]);

  useEffect(() => {
    if (!uploadNeedsPin || submitMode !== "upload") {
      setShowPinPrompt(false);
      setPin("");
      lastAutoSubmittedPinRef.current = "";
    }
  }, [submitMode, uploadNeedsPin]);

  useEffect(() => {
    return () => {
      revokePreviewItems(selectedItemsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showPinPrompt || submitMode !== "upload") {
      return;
    }

    const timer = window.setTimeout(() => {
      pinInputRef.current?.focus();
      pinInputRef.current?.select();
    }, 20);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showPinPrompt, submitMode]);

  const replaceSelectedItems = (nextItemsOrUpdater) => {
    setSelectedItems((current) => {
      const nextItems =
        typeof nextItemsOrUpdater === "function"
          ? nextItemsOrUpdater(current)
          : nextItemsOrUpdater;
      const nextIds = new Set(nextItems.map((item) => item.id));

      current.forEach((item) => {
        if (!nextIds.has(item.id) && item.url) {
          URL.revokeObjectURL(item.url);
        }
      });

      return nextItems;
    });
  };

  const resetSelectedFiles = useCallback(() => {
    replaceSelectedItems([]);
    setPin("");
    setError("");
    setShowPinPrompt(false);
    setSubmitMode("");
    lastAutoSubmittedPinRef.current = "";
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const openFilePicker = (mode = "replace") => {
    browseModeRef.current = mode;
    inputRef.current?.click();
  };

  const handleSelectFile = (event) => {
    try {
      const nextFiles = normalizeSelectedFiles(event.target.files);
      if (!nextFiles.length) {
        return;
      }

      const nextTotal =
        (browseModeRef.current === "append" ? selectedItems.length : 0) +
        nextFiles.length;
      if (nextTotal > MAX_SELECTED_IMAGES) {
        throw new Error(`Add up to ${MAX_SELECTED_IMAGES} images at a time.`);
      }

      replaceSelectedItems((current) => {
        const preparedItems = createPreviewItems(nextFiles);
        return browseModeRef.current === "append"
          ? [...current, ...preparedItems]
          : preparedItems;
      });
      setError("");
    } catch (caughtError) {
      setError(caughtError.message || "Could not prepare these images.");
    } finally {
      event.target.value = "";
    }
  };

  const handleRemoveSelectedItem = (itemId) => {
    replaceSelectedItems((current) =>
      current.filter((item) => item.id !== itemId),
    );
    setError("");
    if (selectedItems.length <= 1) {
      setShowPinPrompt(false);
      setPin("");
    }
  };

  const handleUpload = useCallback(async () => {
    if (!selectedFiles.length || isSubmitting) {
      return;
    }

    if (uploadNeedsPin && pin.length !== 4) {
      setSubmitMode("upload");
      setShowPinPrompt(true);
      setError("");
      lastAutoSubmittedPinRef.current = "";
      return;
    }

    setSubmitMode("upload");
    setError("");

    try {
      let latestPayload = null;
      const submittedPin = String(pin || "").trim();
      const compressedFiles = await Promise.all(
        selectedFiles.map((selectedFile) => compressMatchImage(selectedFile)),
      );

      for (const [index, compressedFile] of compressedFiles.entries()) {
        const formData = new FormData();
        formData.append("image", compressedFile);
        formData.append("plannedTotalCount", String(plannedGalleryCount));

        if (submittedPin) {
          formData.append("pin", submittedPin);
        }

        const shouldReplaceCurrent = Boolean(targetImageId) && index === 0;
        if (shouldReplaceCurrent) {
          formData.append("imageId", targetImageId);
        }

        if (appendOnUpload || index > 0) {
          formData.append("append", "1");
        }

        const response = await fetch(`/api/matches/${matchId}/image`, {
          method: "POST",
          body: formData,
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) {
            setShowPinPrompt(true);
            setPin("");
            lastAutoSubmittedPinRef.current = "";
            throw new Error("Enter the 4-digit umpire PIN to upload images.");
          }
          throw new Error(payload.message || "Image upload failed.");
        }

        latestPayload = payload;
      }

      resetSelectedFiles();
      onUploaded?.(latestPayload);
    } catch (caughtError) {
      setError(caughtError.message || "Image upload failed.");
    } finally {
      setSubmitMode("");
    }
  }, [
    appendOnUpload,
    isSubmitting,
    matchId,
    onUploaded,
    pin,
    plannedGalleryCount,
    resetSelectedFiles,
    selectedFiles,
    targetImageId,
    uploadNeedsPin,
  ]);

  useEffect(() => {
    if (
      !showPinPrompt ||
      submitMode !== "upload" ||
      isSubmitting ||
      pin.length !== 4
    ) {
      return;
    }

    if (lastAutoSubmittedPinRef.current === pin) {
      return;
    }

    lastAutoSubmittedPinRef.current = pin;
    const timer = window.setTimeout(() => {
      void handleUpload();
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [handleUpload, isSubmitting, pin, showPinPrompt, submitMode]);

  const handleRemoveCurrentImage = async () => {
    if (!canRemoveCurrentImage || isSubmitting) {
      return;
    }

    setSubmitMode("remove");
    setError("");

    try {
      const response = await fetch(`/api/matches/${matchId}/image`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: String(targetImageId || "").trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Could not remove the current image.");
      }

      resetSelectedFiles();
      onUploaded?.(payload);
    } catch (caughtError) {
      setError(caughtError.message || "Could not remove the current image.");
    } finally {
      setSubmitMode("");
    }
  };

  return (
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.99))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] ring-1 ring-white/5 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/12 text-lg text-amber-300 shadow-[0_12px_28px_rgba(245,158,11,0.12)]">
            <FaImage />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs text-zinc-400">
              1 image uploads now. 2+ images ask for the umpire PIN.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {canRemoveCurrentImage ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              Current
            </span>
          ) : null}
          {selectedItems.length > 0 ? (
            <span className="rounded-full border border-emerald-300/18 bg-emerald-500/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {selectedItems.length} ready
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        {currentPreview ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPreview}
              alt="Selected match preview"
              className="max-h-[260px] w-full object-cover sm:max-h-[320px]"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.9))] px-4 pb-4 pt-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/12 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                  {selectedItems.length > 0 ? "Ready" : "Current"}
                </span>
                {Math.max(existingImageCount, plannedGalleryCount) > 1 ? (
                  <span className="rounded-full border border-white/12 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/72">
                    Gallery {Math.max(existingImageCount, plannedGalleryCount)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[220px] flex-col items-center justify-center px-5 py-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-white/[0.05] text-zinc-300">
              <FaImage className="text-lg" />
            </div>
            <h4 className="mt-4 text-lg font-semibold text-white">Add images</h4>
            <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-400">
              Pick one or build a gallery.
            </p>
          </div>
        )}
      </div>

      {selectedItems.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Selected
            </p>
            <button
              type="button"
              onClick={resetSelectedFiles}
              className="text-xs font-semibold text-zinc-400 transition hover:text-white"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {selectedItems.map((item, index) => (
              <SelectedImageTile
                key={item.id}
                item={item}
                index={index}
                isActive={item.id === activeItem?.id}
                onActivate={setActiveItemId}
                onRemove={handleRemoveSelectedItem}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() =>
            openFilePicker(
              selectedItems.length > 0 || canRemoveCurrentImage
                ? "replace"
                : "replace",
            )
          }
          className="press-feedback inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
        >
          <FaImage className="text-xs" />
          <span>
            {selectedItems.length > 0 || canRemoveCurrentImage
              ? "Replace"
              : "Choose images"}
          </span>
        </button>
        {selectedItems.length > 0 || canRemoveCurrentImage ? (
          <button
            type="button"
            onClick={() => openFilePicker("append")}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/16 bg-amber-400/10 px-4 py-3.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/14"
          >
            <FaPlus className="text-xs" />
            Add more
          </button>
        ) : null}
      </div>

      {canRemoveCurrentImage && !selectedItems.length ? (
        <button
          type="button"
          onClick={handleRemoveCurrentImage}
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/14 bg-rose-500/8 px-4 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-500/12"
        >
          <FaTimes className="text-xs" />
          Remove image
        </button>
      ) : null}

      <input
        ref={inputRef}
        id={`match-image-upload-${matchId}`}
        type="file"
        multiple
        accept={getAcceptedMatchImageTypes()}
        onChange={handleSelectFile}
        className="hidden"
      />

      {showPinPrompt && submitMode === "upload" ? (
        <div className="mt-4 rounded-[24px] border border-amber-300/16 bg-[linear-gradient(180deg,rgba(250,204,21,0.08),rgba(255,255,255,0.03))] p-4 shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/14 text-amber-300">
              <FaShieldAlt className="text-sm" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-300/82">
                Umpire PIN
              </p>
              <p className="mt-1 text-sm text-zinc-300">
                Enter it once for this upload.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={pinInputRef}
              id={`match-image-pin-${matchId}`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={pin}
              onChange={(event) => {
                setPin(event.target.value.replace(/\D/g, "").slice(0, 4));
                if (error) {
                  setError("");
                }
              }}
              placeholder="0000"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-base font-semibold tracking-[0.32em] text-white outline-none transition placeholder:tracking-[0.32em] placeholder:text-zinc-500 focus:border-amber-400/28 focus:bg-white/[0.08] sm:max-w-[220px]"
            />
            <p className="text-xs leading-5 text-zinc-400">
              Same PIN as umpire mode.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <LoadingButton
          onClick={handleUpload}
          disabled={!selectedItems.length || (showPinPrompt && pin.length !== 4)}
          loading={isSubmitting}
          pendingLabel={submitMode === "remove" ? "Removing..." : "Uploading..."}
          className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,#10b981_0%,#059669_100%)] px-5 py-3.5 font-semibold text-black shadow-[0_16px_36px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
        >
          {uploadNeedsPin && !showPinPrompt
            ? "Continue"
            : showPinPrompt
            ? "Waiting for PIN"
            : selectedItems.length > 1
            ? `${primaryLabel} (${selectedItems.length})`
            : primaryLabel}
        </LoadingButton>
        {onSkip ? (
          <button
            type="button"
            onClick={onSkip}
            className="press-feedback rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
