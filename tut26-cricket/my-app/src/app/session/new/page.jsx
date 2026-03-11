"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowRight, FaImage, FaPen } from "react-icons/fa";
import ImagePinModal from "../../components/shared/ImagePinModal";
import StepFlow from "../../components/shared/StepFlow";
import {
  compressMatchImage,
  getAcceptedMatchImageTypes,
} from "../../components/match/match-image-client";

const PENDING_SESSION_IMAGE_KEY = "gv-pending-session-image";
const getDraftTokenKey = (sessionId) => `session_${sessionId}_draftToken`;

export default function NewSessionPage() {
  const [name, setName] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const router = useRouter();

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFileName("");
      setPreviewUrl("");
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(PENDING_SESSION_IMAGE_KEY);
      }
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG, or WEBP image.");
      return;
    }

    setError("");
    setPendingImageFile(file);
    setIsPinModalOpen(true);
    event.target.value = "";
  };

  const handleConfirmImagePin = async (pin) => {
    if (!pendingImageFile) {
      throw new Error("Choose a picture first.");
    }

    const response = await fetch("/api/media/pin-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "Incorrect PIN.");
    }

    const compressedFile = await compressMatchImage(pendingImageFile);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not prepare the image."));
      reader.readAsDataURL(compressedFile);
    });

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(
        PENDING_SESSION_IMAGE_KEY,
        JSON.stringify({
          fileName: compressedFile.name,
          type: compressedFile.type,
          dataUrl,
        })
      );
    }

    setSelectedFileName(pendingImageFile.name);
    setPreviewUrl(dataUrl);
    setPendingImageFile(null);
    setIsPinModalOpen(false);
  };

  const handleContinueWithoutImage = () => {
    setPendingImageFile(null);
    setSelectedFileName("");
    setPreviewUrl("");
    setIsPinModalOpen(false);
    setError("");
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_SESSION_IMAGE_KEY);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const createSession = async () => {
    setError("");

    if (!name.trim()) {
      setError("Please enter a session name.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const errData = await res
          .json()
          .catch(() => ({ message: "An unknown error occurred." }));
        throw new Error(errData.message || "Failed to create session.");
      }

      const session = await res.json();
      if (typeof window !== "undefined" && session?.draftToken && session?._id) {
        window.sessionStorage.setItem(
          getDraftTokenKey(session._id),
          String(session.draftToken)
        );
      }
      router.push(`/teams/${session._id}`);
    } catch (caughtError) {
      setError(caughtError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_32%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.12),transparent_30%),linear-gradient(180deg,#050505_0%,#0b0b11_52%,#050505_100%)] px-4 py-10 text-zinc-200">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 text-center">
          <StepFlow currentStep={1} />
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(8,8,10,0.98))] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-sm sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_26%)]" />
          <div className="relative">
            <h1 className="text-center text-4xl font-black leading-[0.98] text-white sm:text-5xl">
              Create New
              <span className="mt-1 block text-white">Session</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xs text-center text-sm leading-6 text-zinc-400">
              Name the match to continue.
            </p>

            <div className="mt-8 space-y-5">
              <div>
                <label
                  htmlFor="session-name"
                  className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                >
                  Session Name
                </label>
                <div className="group relative">
                  <FaPen className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-amber-300" />
                  <input
                    id="session-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Game 1, finals, or practice"
                    autoComplete="off"
                    spellCheck={false}
                    className="session-form-input w-full rounded-2xl border border-white/8 bg-white/[0.04] py-4 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-zinc-500 focus:border-amber-400/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_4px_rgba(251,191,36,0.08)]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="session-image"
                  className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                >
                  Cover Image
                </label>
                <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="flex flex-col items-center gap-3 rounded-[20px] border border-white/8 bg-black/20 px-4 py-4 text-center">
                    <label
                      htmlFor="session-image"
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                    >
                      <FaImage className="text-zinc-400" />
                      Upload picture
                    </label>
                    {selectedFileName ? (
                      <div className="w-full min-w-0">
                        <p className="truncate text-sm text-zinc-400">
                          {selectedFileName}
                        </p>
                      </div>
                    ) : null}
                    <input
                      ref={fileInputRef}
                      id="session-image"
                      type="file"
                      accept={getAcceptedMatchImageTypes()}
                      onChange={handleSelectImage}
                      className="hidden"
                    />
                  </div>
                  <p className="mt-3 pl-1 text-xs font-medium text-zinc-500">Optional</p>
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="Selected cover preview"
                      className="mt-4 h-32 w-full rounded-[20px] border border-white/8 object-cover"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
                {error}
              </div>
            )}

            <button
              onClick={createSession}
              disabled={saving}
              className="btn-ui btn-ui-primary mt-8 w-full rounded-2xl px-6 py-4 text-lg font-semibold"
            >
              {saving ? "Creating..." : "Next: Select Teams"}
              {!saving && <FaArrowRight />}
            </button>

            <div className="mt-6 text-center">
              <Link
                href="/"
                className="text-sm text-zinc-400 transition hover:text-white"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
      <ImagePinModal
        isOpen={isPinModalOpen}
        title="Upload picture"
        subtitle="Enter the 4-digit PIN before adding a session cover image."
        confirmLabel="Use this picture"
        showContinueWithout={true}
        onConfirm={handleConfirmImagePin}
        onContinueWithout={handleContinueWithoutImage}
        onClose={handleContinueWithoutImage}
      />
    </main>
  );
}
