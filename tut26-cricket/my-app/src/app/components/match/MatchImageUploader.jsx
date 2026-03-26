"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowLeft,
  FaArrowRight,
  FaImage,
  FaPlus,
  FaShieldAlt,
  FaTimes,
  FaTrash,
} from "react-icons/fa";
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

function normalizeExistingImages(existingImages = [], fallbackUrl = "") {
  const normalized = Array.isArray(existingImages)
    ? existingImages
        .filter((image) => image?.url)
        .map((image, index) => ({
          id: String(image.id || `image-${index + 1}`),
          url: String(image.url || "").trim(),
          uploadedAt: image.uploadedAt || null,
          uploadedBy: image.uploadedBy || "",
        }))
        .filter((image) => image.url)
    : [];

  if (normalized.length) {
    return normalized;
  }

  const safeFallbackUrl = String(fallbackUrl || "").trim();
  if (!safeFallbackUrl) {
    return [];
  }

  return [
    {
      id: "cover",
      url: safeFallbackUrl,
      uploadedAt: null,
      uploadedBy: "",
    },
  ];
}

function deriveDefaultUploadPlan({ appendOnUpload = false, existingCount = 0 }) {
  if (appendOnUpload || existingCount === 0) {
    return "append";
  }

  return "replace";
}

function getPlannedGalleryCount({
  existingImageCount = 0,
  selectedCount = 0,
  uploadPlan = "append",
  targetImageId = "",
}) {
  const existingCount = Math.max(0, Number(existingImageCount || 0));
  const nextSelectedCount = Math.max(0, Number(selectedCount || 0));

  if (!nextSelectedCount) {
    return existingCount;
  }

  if (uploadPlan === "replace" && targetImageId) {
    return Math.max(existingCount, 1) + Math.max(0, nextSelectedCount - 1);
  }

  return existingCount + nextSelectedCount;
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
      <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-white/12 bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
        New {index + 1}
      </div>
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

function GalleryImageTile({
  item,
  index,
  total,
  isActive,
  disabled,
  onActivate,
  onMove,
  onRemove,
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-[22px] border bg-black/20 transition ${
        isActive
          ? "border-cyan-300/26 shadow-[0_16px_34px_rgba(8,145,178,0.14)]"
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
          alt={`Gallery image ${index + 1}`}
          className="aspect-square w-full object-cover"
        />
      </button>

      <div className="pointer-events-none absolute left-2 top-2 rounded-full border border-white/12 bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/82">
        #{index + 1}
      </div>

      <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.94))] px-2 pb-2 pt-10">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onMove(item.id, -1);
              }}
              disabled={disabled || index === 0}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-black/70 text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={`Move image ${index + 1} earlier`}
            >
              <FaArrowLeft className="text-[11px]" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onMove(item.id, 1);
              }}
              disabled={disabled || index === total - 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-black/70 text-white transition hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={`Move image ${index + 1} later`}
            >
              <FaArrowRight className="text-[11px]" />
            </button>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemove(item.id);
            }}
            disabled={disabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-300/16 bg-rose-500/14 text-rose-100 transition hover:bg-rose-500/22 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`Remove image ${index + 1}`}
          >
            <FaTrash className="text-[11px]" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MatchImageUploader({
  matchId,
  existingImages = [],
  existingImageUrl,
  existingImageCount = 0,
  targetImageId = "",
  appendOnUpload = false,
  onUploaded,
  onComplete,
  onSkip,
  title = "Add Match Image",
  description = "",
  primaryLabel = "Upload Image",
  secondaryLabel = "Skip for Now",
}) {
  const normalizedExistingImages = useMemo(
    () => normalizeExistingImages(existingImages, existingImageUrl),
    [existingImageUrl, existingImages],
  );
  const defaultUploadPlan = useMemo(
    () =>
      deriveDefaultUploadPlan({
        appendOnUpload,
        existingCount: normalizedExistingImages.length || existingImageCount,
      }),
    [appendOnUpload, existingImageCount, normalizedExistingImages.length],
  );

  const [galleryItems, setGalleryItems] = useState(normalizedExistingImages);
  const [selectedItems, setSelectedItems] = useState([]);
  const [activeItemId, setActiveItemId] = useState("");
  const [activeExistingId, setActiveExistingId] = useState(
    targetImageId || normalizedExistingImages[0]?.id || "",
  );
  const [uploadPlan, setUploadPlan] = useState(defaultUploadPlan);
  const [pin, setPin] = useState("");
  const [submitMode, setSubmitMode] = useState("");
  const [pendingProtectedAction, setPendingProtectedAction] = useState(null);
  const [error, setError] = useState("");
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState("");
  const inputRef = useRef(null);
  const pinInputRef = useRef(null);
  const browseModeRef = useRef("replace");
  const selectedItemsRef = useRef([]);
  const lastAutoActionKeyRef = useRef("");

  const selectedFiles = useMemo(
    () => selectedItems.map((item) => item.file),
    [selectedItems],
  );
  const activeItem =
    selectedItems.find((item) => item.id === activeItemId) ||
    selectedItems[0] ||
    null;
  const activeExistingItem =
    galleryItems.find((item) => item.id === activeExistingId) ||
    galleryItems[0] ||
    null;
  const currentPreview = activeItem?.url || activeExistingItem?.url || "";
  const replaceTargetId =
    uploadPlan === "replace"
      ? activeExistingItem?.id || targetImageId || galleryItems[0]?.id || ""
      : "";
  const plannedGalleryCount = getPlannedGalleryCount({
    existingImageCount: galleryItems.length || existingImageCount,
    selectedCount: selectedItems.length,
    uploadPlan,
    targetImageId: replaceTargetId,
  });
  const uploadNeedsPin = plannedGalleryCount > 1;
  const isSubmitting =
    submitMode === "upload" ||
    submitMode === "remove" ||
    submitMode === "reorder";

  useEffect(() => {
    setGalleryItems(normalizedExistingImages);
    setActiveExistingId((current) => {
      if (
        current &&
        normalizedExistingImages.some((image) => image.id === current)
      ) {
        return current;
      }

      if (
        targetImageId &&
        normalizedExistingImages.some((image) => image.id === targetImageId)
      ) {
        return targetImageId;
      }

      return normalizedExistingImages[0]?.id || "";
    });
  }, [normalizedExistingImages, targetImageId]);

  useEffect(() => {
    if (!selectedItems.length) {
      setActiveItemId("");
      setUploadPlan(defaultUploadPlan);
      return;
    }

    const activeExists = selectedItems.some((item) => item.id === activeItemId);
    if (!activeExists) {
      setActiveItemId(selectedItems[0].id);
    }
  }, [activeItemId, defaultUploadPlan, selectedItems]);

  useEffect(() => {
    selectedItemsRef.current = selectedItems;
  }, [selectedItems]);

  useEffect(() => {
    if (!showPinPrompt) {
      lastAutoActionKeyRef.current = "";
    }
  }, [showPinPrompt]);

  useEffect(() => {
    return () => {
      revokePreviewItems(selectedItemsRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showPinPrompt) {
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
    setUploadStatusText("");
    setShowPinPrompt(false);
    setPendingProtectedAction(null);
    setSubmitMode("");
    lastAutoActionKeyRef.current = "";
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
      setUploadPlan(
        browseModeRef.current === "replace"
          ? galleryItems.length > 0
            ? "replace"
            : "append"
          : "append",
      );
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
  };

  const syncGalleryFromPayload = useCallback(
    (payload, { preferredImageId = "" } = {}) => {
      const nextImages = normalizeExistingImages(
        payload?.matchImages,
        payload?.matchImageUrl,
      );

      setGalleryItems(nextImages);
      setActiveExistingId((current) => {
        const nextPreferred = preferredImageId || current;
        if (
          nextPreferred &&
          nextImages.some((image) => image.id === nextPreferred)
        ) {
          return nextPreferred;
        }

        return nextImages[0]?.id || "";
      });
      onUploaded?.(payload);
    },
    [onUploaded],
  );

  const requestProtectedAction = useCallback((action) => {
    setPin("");
    setError("");
    setPendingProtectedAction(action);
    setShowPinPrompt(true);
    lastAutoActionKeyRef.current = "";
  }, []);

  const closeProtectedActionPrompt = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    setShowPinPrompt(false);
    setPendingProtectedAction(null);
    setPin("");
    setError("");
    lastAutoActionKeyRef.current = "";
  }, [isSubmitting]);

  const executeUpload = useCallback(
    async (pinOverride = "") => {
      if (!selectedFiles.length || isSubmitting) {
        return;
      }

      const submittedPin = String(pinOverride || pin || "").trim();
      if (uploadNeedsPin && submittedPin.length !== 4) {
        requestProtectedAction({ type: "upload" });
        return;
      }

      setSubmitMode("upload");
      setShowPinPrompt(
        (current) => current || uploadNeedsPin || Boolean(submittedPin),
      );
      setError("");
      try {
        let latestPayload = null;
        const totalUploads = selectedFiles.length;

        for (const [index, selectedFile] of selectedFiles.entries()) {
          setUploadStatusText(
            totalUploads > 1
              ? `Preparing ${index + 1}/${totalUploads}...`
              : "Preparing...",
          );
          const compressedFile = await compressMatchImage(selectedFile);

          setUploadStatusText(
            totalUploads > 1
              ? `Uploading ${index + 1}/${totalUploads}...`
              : "Uploading...",
          );
          const formData = new FormData();
          formData.append("image", compressedFile);
          formData.append("plannedTotalCount", String(plannedGalleryCount));

          if (submittedPin) {
            formData.append("pin", submittedPin);
          }

          if (replaceTargetId && index === 0) {
            formData.append("imageId", replaceTargetId);
          }

          if (!replaceTargetId || index > 0) {
            formData.append("append", "1");
          }

          const response = await fetch(`/api/matches/${matchId}/image`, {
            method: "POST",
            body: formData,
          });

          const payload = await response.json().catch(() => ({}));
          if (!response.ok) {
            if (response.status === 401) {
              setPin("");
              requestProtectedAction({ type: "upload" });
              throw new Error("Enter the 4-digit umpire PIN to save this gallery.");
            }
            throw new Error(payload.message || "Image upload failed.");
          }

          latestPayload = payload;
        }

        resetSelectedFiles();
        syncGalleryFromPayload(latestPayload, {
          preferredImageId: replaceTargetId || activeExistingItem?.id || "",
        });
        onComplete?.("upload", latestPayload);
      } catch (caughtError) {
        setError(caughtError.message || "Image upload failed.");
      } finally {
        setUploadStatusText("");
        setSubmitMode("");
      }
    },
    [
      activeExistingItem?.id,
      isSubmitting,
      matchId,
      pin,
      plannedGalleryCount,
      replaceTargetId,
      requestProtectedAction,
      resetSelectedFiles,
      selectedFiles,
      syncGalleryFromPayload,
      onComplete,
      uploadNeedsPin,
    ],
  );

  const executeRemoveImage = useCallback(
    async (imageId, pinOverride = "") => {
      if (!imageId || isSubmitting) {
        return;
      }

      setSubmitMode("remove");
      setError("");

      try {
        const response = await fetch(`/api/matches/${matchId}/image`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: String(imageId || "").trim(),
            pin: String(pinOverride || pin || "").trim(),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) {
            setPin("");
            requestProtectedAction({ type: "remove", imageId });
            throw new Error("Enter the 4-digit umpire PIN to remove this image.");
          }
          throw new Error(payload.message || "Could not remove this image.");
        }

        resetSelectedFiles();
        syncGalleryFromPayload(payload, {
          preferredImageId:
            galleryItems.find((image) => image.id !== imageId)?.id || "",
        });
      } catch (caughtError) {
        setError(caughtError.message || "Could not remove this image.");
      } finally {
        setSubmitMode("");
      }
    },
    [
      galleryItems,
      isSubmitting,
      matchId,
      pin,
      requestProtectedAction,
      resetSelectedFiles,
      syncGalleryFromPayload,
    ],
  );

  const executeReorderImages = useCallback(
    async (nextImageIds, focusImageId, pinOverride = "") => {
      if (!nextImageIds?.length || isSubmitting) {
        return;
      }

      setSubmitMode("reorder");
      setError("");

      try {
        const response = await fetch(`/api/matches/${matchId}/image`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageIds: nextImageIds,
            pin: String(pinOverride || pin || "").trim(),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) {
            setPin("");
            requestProtectedAction({
              type: "reorder",
              imageIds: nextImageIds,
              focusImageId,
            });
            throw new Error("Enter the 4-digit umpire PIN to reorder this gallery.");
          }
          throw new Error(payload.message || "Could not update the gallery order.");
        }

        setPendingProtectedAction(null);
        setShowPinPrompt(false);
        setPin("");
        lastAutoActionKeyRef.current = "";
        syncGalleryFromPayload(payload, { preferredImageId: focusImageId });
      } catch (caughtError) {
        setError(caughtError.message || "Could not update the gallery order.");
      } finally {
        setSubmitMode("");
      }
    },
    [isSubmitting, matchId, pin, requestProtectedAction, syncGalleryFromPayload],
  );

  useEffect(() => {
    if (!showPinPrompt || isSubmitting || pin.length !== 4 || !pendingProtectedAction) {
      return;
    }

    const autoKey = JSON.stringify({
      pin,
      type: pendingProtectedAction.type,
      imageId: pendingProtectedAction.imageId || "",
      imageIds: pendingProtectedAction.imageIds || [],
    });

    if (lastAutoActionKeyRef.current === autoKey) {
      return;
    }

    lastAutoActionKeyRef.current = autoKey;
    const timer = window.setTimeout(() => {
      if (pendingProtectedAction.type === "upload") {
        void executeUpload(pin);
        return;
      }

      if (pendingProtectedAction.type === "remove") {
        void executeRemoveImage(pendingProtectedAction.imageId, pin);
        return;
      }

      if (pendingProtectedAction.type === "reorder") {
        void executeReorderImages(
          pendingProtectedAction.imageIds,
          pendingProtectedAction.focusImageId,
          pin,
        );
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    executeRemoveImage,
    executeReorderImages,
    executeUpload,
    isSubmitting,
    pendingProtectedAction,
    pin,
    showPinPrompt,
  ]);

  const handleUpload = useCallback(() => {
    void executeUpload();
  }, [executeUpload]);

  const handleRemoveExistingImage = useCallback(
    (imageId) => {
      void executeRemoveImage(imageId);
    },
    [executeRemoveImage],
  );

  const handleMoveExistingImage = useCallback(
    (imageId, direction) => {
      const currentIndex = galleryItems.findIndex((image) => image.id === imageId);
      const nextIndex = currentIndex + direction;

      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= galleryItems.length
      ) {
        return;
      }

      const nextImages = [...galleryItems];
      const [movedImage] = nextImages.splice(currentIndex, 1);
      nextImages.splice(nextIndex, 0, movedImage);

      void executeReorderImages(
        nextImages.map((image) => image.id),
        imageId,
      );
    },
    [executeReorderImages, galleryItems],
  );

  const helperText =
    description || "Add, sort, or remove images.";
  const showGallerySection = galleryItems.length > 0;
  const showSelectedSection = selectedItems.length > 0;
  const showReplaceButton = showGallerySection || showSelectedSection;
  const pinPromptCopy =
    pendingProtectedAction?.type === "remove"
      ? "Enter PIN to remove."
      : pendingProtectedAction?.type === "reorder"
      ? "Enter PIN to save order."
      : "Enter PIN to upload.";

  return (
    <section className="rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.08),transparent_28%),linear-gradient(180deg,rgba(18,18,22,0.98),rgba(8,8,12,0.99))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] ring-1 ring-white/5 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/12 text-lg text-amber-300 shadow-[0_12px_28px_rgba(245,158,11,0.12)]">
            <FaImage />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-400">{helperText}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {showGallerySection ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
              {galleryItems.length} image{galleryItems.length === 1 ? "" : "s"}
            </span>
          ) : null}
          {showSelectedSection ? (
            <span className="rounded-full border border-emerald-300/18 bg-emerald-500/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              {selectedItems.length} selected
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
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.92))] px-4 pb-4 pt-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/12 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80">
                  {activeItem ? "Selected" : "Cover"}
                </span>
                {plannedGalleryCount > 1 ? (
                  <span className="rounded-full border border-white/12 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/72">
                    {plannedGalleryCount} total
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
            <h4 className="mt-4 text-lg font-semibold text-white">No images yet</h4>
            <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-400">
              Choose one to start.
            </p>
          </div>
        )}
      </div>

      {showGallerySection ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Gallery
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {galleryItems.map((item, index) => (
              <GalleryImageTile
                key={item.id}
                item={item}
                index={index}
                total={galleryItems.length}
                isActive={item.id === activeExistingItem?.id && !activeItem}
                disabled={isSubmitting}
                onActivate={setActiveExistingId}
                onMove={handleMoveExistingImage}
                onRemove={handleRemoveExistingImage}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showSelectedSection ? (
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
          onClick={() => openFilePicker(showReplaceButton ? "replace" : "append")}
          className="press-feedback inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
        >
          <FaImage className="text-xs" />
          <span>{showReplaceButton ? "Replace" : "Choose images"}</span>
        </button>
        <button
          type="button"
          onClick={() => openFilePicker("append")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/16 bg-amber-400/10 px-4 py-3.5 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/14"
        >
          <FaPlus className="text-xs" />
          Add more
        </button>
      </div>

      <input
        ref={inputRef}
        id={`match-image-upload-${matchId}`}
        type="file"
        multiple
        accept={getAcceptedMatchImageTypes()}
        onChange={handleSelectFile}
        className="hidden"
      />

      {error && !showPinPrompt ? (
        <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <LoadingButton
          onClick={handleUpload}
          disabled={!selectedItems.length}
          loading={submitMode === "upload"}
          pendingLabel={uploadStatusText || "Uploading..."}
          className="inline-flex w-full items-center justify-center rounded-full bg-[linear-gradient(90deg,#10b981_0%,#059669_100%)] px-5 py-3.5 font-semibold text-black shadow-[0_16px_36px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-1"
        >
          {selectedItems.length > 1
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

      <AnimatePresence>
        {showPinPrompt ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/82 px-4 py-6 backdrop-blur-sm"
            onClick={closeProtectedActionPrompt}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 360, damping: 28 }}
              className="relative w-full max-w-sm overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,22,28,0.98),rgba(8,8,12,0.98))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.52)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.10),transparent_28%)]" />
              <button
                type="button"
                onClick={closeProtectedActionPrompt}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                aria-label="Close PIN dialog"
              >
                <FaTimes />
              </button>

              <div className="relative">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/12 text-xl text-amber-300 shadow-[0_12px_24px_rgba(245,158,11,0.12)]">
                  <FaShieldAlt />
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white">
                  Umpire PIN
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-400">
                  {pinPromptCopy}
                </p>

                <div className="mt-6">
                  <label
                    htmlFor={`match-image-pin-${matchId}`}
                    className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                  >
                    4-digit PIN
                  </label>
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
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-amber-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(251,191,36,0.08)]"
                  />
                </div>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                ) : null}

                <p className="mt-4 text-xs text-zinc-500">
                  Upload starts as soon as the PIN is complete.
                </p>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
