"use client";

import { useEffect, useMemo, useState } from "react";
import { FaImage } from "react-icons/fa";
import { getAcceptedMatchImageTypes, compressMatchImage } from "./match-image-client";
import PinPad from "../shared/PinPad";

export default function MatchImageUploader({
  matchId,
  existingImageUrl,
  onUploaded,
  onSkip,
  title = "Add Match Image",
  description = "Upload a team photo, ground shot, or poster. JPG, PNG, or WEBP only.",
  primaryLabel = "Upload Image",
  secondaryLabel = "Skip For Now",
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [pin, setPin] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

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
      setError("Please choose a JPG, PNG, or WEBP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Please choose an image under 10 MB before compression.");
      return;
    }

    setError("");
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile || isUploading) return;
    if (!pin.trim()) {
      setError("Enter the admin PIN to upload an image.");
      return;
    }

    setIsUploading(true);
    setError("");

    try {
      const compressedFile = await compressMatchImage(selectedFile);
      const formData = new FormData();
      formData.append("image", compressedFile);
      formData.append("pin", pin.trim());

      const response = await fetch(`/api/matches/${matchId}/image`, {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || "Image upload failed.");
      }

      setSelectedFile(null);
      setPreviewUrl("");
      setPin("");
      onUploaded?.(payload);
    } catch (caughtError) {
      const message =
        /pin/i.test(caughtError.message || "")
          ? "Wrong PIN. You can continue without an image."
          : caughtError.message;
      setError(message);
      setPin("");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="bg-zinc-900/70 ring-1 ring-white/10 rounded-3xl p-5 sm:p-6 shadow-xl">
      <div className="flex items-start gap-4 mb-5">
        <div className="h-11 w-11 rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center text-xl shrink-0">
          <FaImage />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <p className="text-sm text-zinc-400 mt-1">{description}</p>
        </div>
      </div>

      {currentPreview && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentPreview}
            alt="Selected match"
            className="w-full max-h-72 object-cover"
          />
        </div>
      )}

      <div className="space-y-4">
        <input
          type="file"
          accept={getAcceptedMatchImageTypes()}
          onChange={handleSelectFile}
          className="block w-full text-sm text-zinc-300 file:mr-4 file:rounded-full file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-700"
        />
        <label className="block space-y-2">
          <span className="text-xs uppercase tracking-wider text-zinc-400">
            Admin PIN
          </span>
          <PinPad
            value={pin}
            onChange={(nextPin) => {
              setPin(nextPin);
              if (error) {
                setError("");
              }
            }}
            onSubmit={handleUpload}
            length={4}
            submitLabel={primaryLabel}
            isSubmitting={isUploading}
            submitDisabled={!selectedFile}
          />
        </label>
        <p className="text-xs text-zinc-500">
          Images are optional, compressed before upload, and require the admin PIN every time.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {onSkip && (
          <button
            onClick={onSkip}
            className="rounded-full border border-white/10 px-5 py-3 font-semibold text-zinc-200 hover:bg-white/5 transition"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </section>
  );
}
