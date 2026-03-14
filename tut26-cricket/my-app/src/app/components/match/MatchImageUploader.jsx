"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaImage } from "react-icons/fa";
import ImagePinModal from "../shared/ImagePinModal";
import { getAcceptedMatchImageTypes, compressMatchImage } from "./match-image-client";

export default function MatchImageUploader({
  matchId,
  existingImageUrl,
  onUploaded,
  onSkip,
  title = "Add Match Image",
  description = "Upload a team photo, ground shot, or poster. JPG, PNG, or WebP only.",
  primaryLabel = "Upload Image",
  secondaryLabel = "Skip for Now",
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [pendingPinFile, setPendingPinFile] = useState(null);
  const [pin, setPin] = useState("");
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const inputRef = useRef(null);

  const currentPreview = useMemo(
    () => previewUrl || existingImageUrl || "",
    [existingImageUrl, previewUrl]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleSelectFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Please choose an image under 10 MB before compression.");
      return;
    }

    setError("");
    setPendingPinFile(file);
    setIsPinModalOpen(true);
    event.target.value = "";
  };

  const handleConfirmPin = async (nextPin) => {
    if (!pendingPinFile) {
      throw new Error("Choose an image first.");
    }

    const response = await fetch("/api/media/pin-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: nextPin }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "Incorrect PIN.");
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPin(nextPin);
    setSelectedFile(pendingPinFile);
    setPreviewUrl(URL.createObjectURL(pendingPinFile));
    setPendingPinFile(null);
    setIsPinModalOpen(false);
  };

  const handleContinueWithout = () => {
    setPendingPinFile(null);
    setSelectedFile(null);
    setPin("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");
    }
    setIsPinModalOpen(false);
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onSkip?.();
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setError("");

    try {
      const compressedFile = await compressMatchImage(selectedFile);
      const formData = new FormData();
      formData.append("image", compressedFile);
      formData.append("pin", pin);

      const response = await fetch(`/api/matches/${matchId}/image`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Image upload failed.");
      }

      setSelectedFile(null);
      setPin("");
      setPreviewUrl("");
      onUploaded?.(payload);
    } catch (caughtError) {
      setError(caughtError.message || "Image upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,14,0.98))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.38)] ring-1 ring-white/5 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/12 text-lg text-amber-300 shadow-[0_12px_28px_rgba(245,158,11,0.12)]">
          <FaImage />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm leading-5 text-zinc-400">{description}</p>
        </div>
      </div>

      {currentPreview && (
        <div className="mb-4 overflow-hidden rounded-[22px] border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPreview}
            alt="Selected match"
            className="max-h-56 w-full object-cover sm:max-h-64"
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="rounded-[22px] border border-white/8 bg-black/20 p-3">
          <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-zinc-400">
              <FaImage />
            </span>
            <label
              htmlFor={`match-image-upload-${matchId}`}
              className="inline-flex shrink-0 cursor-pointer items-center rounded-full bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
            >
              Choose file
            </label>
            <div className="min-w-0 flex-1 text-sm text-zinc-400">
              <p className="truncate">
                {selectedFile?.name || "No image selected"}
              </p>
            </div>
            <input
              ref={inputRef}
              id={`match-image-upload-${matchId}`}
              type="file"
              accept={getAcceptedMatchImageTypes()}
              onChange={handleSelectFile}
              className="hidden"
            />
          </div>
        </div>
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full rounded-full bg-[linear-gradient(90deg,#10b981_0%,#059669_100%)] px-5 py-3 font-semibold text-black shadow-[0_16px_36px_rgba(16,185,129,0.22)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : primaryLabel}
        </button>
        <p className="text-xs text-zinc-500">
          Images are optional and compressed before upload.
        </p>
        {error ? (
          <p className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {onSkip && (
          <button
            onClick={onSkip}
            className="rounded-full border border-white/10 px-5 py-2.5 font-semibold text-zinc-200 transition hover:bg-white/5"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
      <ImagePinModal
        isOpen={isPinModalOpen}
        title={existingImageUrl ? "Replace Image" : "Add Image"}
        subtitle="Enter the 4-digit PIN before using this match image."
        confirmLabel="Use this image"
        showContinueWithout={true}
        onConfirm={handleConfirmPin}
        onContinueWithout={handleContinueWithout}
        onClose={handleContinueWithout}
      />
    </section>
  );
}
