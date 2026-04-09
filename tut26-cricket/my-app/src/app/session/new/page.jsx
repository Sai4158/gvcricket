"use client";

/**
 * File overview:
 * Purpose: Renders the App Router page entry for Session.
 * Main exports: NewSessionPage.
 * Major callers: Next.js App Router.
 * Side effects: reads or writes browser storage.
 * Read next: ../../../../docs/ONBOARDING.md
 */

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaArrowRight, FaImage, FaPen } from "react-icons/fa";
import ImagePinModal from "../../components/shared/ImagePinModal";
import LoadingButton from "../../components/shared/LoadingButton";
import PendingLink from "../../components/shared/PendingLink";
import StepFlow from "../../components/shared/StepFlow";
import LiquidSportText from "../../components/home/LiquidSportText";
import { verifyImageActionPin } from "../../lib/image-pin-client";
import {
  clearPendingSessionImage,
  getPendingSessionImage,
  clearPendingSessionImageNotice,
  setPendingSessionImageNotice,
  PENDING_SESSION_IMAGE_KEY,
  uploadSessionImageFileToDraftSession,
  uploadStoredPendingSessionImageToDraftSession,
} from "../../lib/pending-session-image";
import {
  compressMatchImage,
  getAcceptedMatchImageTypes,
} from "../../components/match/match-image-client";

const getDraftTokenKey = (sessionId) => `session_${sessionId}_draftToken`;
const IMAGE_UPLOAD_TIMEOUT_MS = 45000;
const IMAGE_UPLOAD_FALLBACK_NOTICE =
  "Match image could not upload yet. Match setup can continue.";

export default function NewSessionPage() {
  const [name, setName] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState("Creating...");
  const [error, setError] = useState("");
  const [pendingImageFile, setPendingImageFile] = useState(null);
  const [preparedImageFile, setPreparedImageFile] = useState(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const fileInputRef = useRef(null);
  const router = useRouter();

  const handleSelectImage = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFileName("");
      setPreviewUrl("");
      setPreparedImageFile(null);
      clearPendingSessionImage();
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPG, PNG, or WebP image.");
      return;
    }

    setError("");
    setPendingImageFile(file);
    setIsPinModalOpen(true);
    event.target.value = "";
  };

  const handleConfirmImagePin = async (pin) => {
    if (!pendingImageFile) {
      throw new Error("Choose an image first.");
    }

    await verifyImageActionPin({
      pin,
      usesManagePin: false,
    });

    const compressedFile = await compressMatchImage(pendingImageFile);
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not prepare the image."));
      reader.readAsDataURL(compressedFile);
    });

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(
          PENDING_SESSION_IMAGE_KEY,
          JSON.stringify({
            fileName: compressedFile.name,
            type: compressedFile.type,
            dataUrl,
          })
        );
      } catch {
        // Keep the selected file in memory even if sessionStorage is full.
      }
    }

    setSelectedFileName(pendingImageFile.name);
    setPreviewUrl(dataUrl);
    setPreparedImageFile(compressedFile);
    setPendingImageFile(null);
    setIsPinModalOpen(false);
  };

  const handleContinueWithoutImage = () => {
    setPendingImageFile(null);
    setSelectedFileName("");
    setPreviewUrl("");
    setPreparedImageFile(null);
    setIsPinModalOpen(false);
    setError("");
    clearPendingSessionImage();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadPendingImageBeforeContinue = async (session) => {
    if (!session?.draftToken || !session?._id || typeof window === "undefined") {
      return;
    }

    const storedPendingImage = getPendingSessionImage();
    if (!(preparedImageFile instanceof File) && !storedPendingImage?.dataUrl) {
      return;
    }

    let lastError = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, IMAGE_UPLOAD_TIMEOUT_MS);

      try {
        setSavingLabel(attempt === 0 ? "Saving image..." : "Retrying image...");
        if (preparedImageFile instanceof File) {
          await uploadSessionImageFileToDraftSession({
            sessionId: String(session._id),
            draftToken: String(session.draftToken),
            file: preparedImageFile,
            signal: controller.signal,
          });
          clearPendingSessionImage();
          setPreparedImageFile(null);
          return;
        }

        const didUpload = await uploadStoredPendingSessionImageToDraftSession({
          sessionId: String(session._id),
          draftToken: String(session.draftToken),
          signal: controller.signal,
        });

        if (didUpload) {
          return;
        }
      } catch (caughtError) {
        lastError = caughtError;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    throw new Error(
      lastError?.message || "Could not save the match image. Try again."
    );
  };

  const createSession = async () => {
    setError("");

    if (!name.trim()) {
      setError("Please enter a session name.");
      return;
    }

    setSaving(true);
    setSavingLabel("Creating...");

    let createdSession = null;

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const errData = await res
          .json()
          .catch(() => ({ message: "Something went wrong." }));
        throw new Error(errData.message || "Could not create the session.");
      }

      const session = await res.json();
      createdSession = session;
      if (typeof window !== "undefined" && session?.draftToken && session?._id) {
        window.sessionStorage.setItem(
          getDraftTokenKey(session._id),
          String(session.draftToken)
        );
      }

      try {
        await uploadPendingImageBeforeContinue(session);
        clearPendingSessionImageNotice(session._id);
      } catch (imageUploadError) {
        setPendingSessionImageNotice(
          session._id,
          imageUploadError?.message || IMAGE_UPLOAD_FALLBACK_NOTICE
        );
      }

      router.push(`/teams/${session._id}`);
    } catch (caughtError) {
      if (
        createdSession?._id &&
        createdSession?.draftToken &&
        typeof window !== "undefined"
      ) {
        window.sessionStorage.removeItem(getDraftTokenKey(createdSession._id));
        clearPendingSessionImageNotice(createdSession._id);
        void fetch(`/api/sessions/${createdSession._id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draftToken: String(createdSession.draftToken),
          }),
          keepalive: true,
        }).catch(() => {});
      }
      setError(caughtError.message);
    } finally {
      setSaving(false);
      setSavingLabel("Creating...");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.14),transparent_22%),radial-gradient(circle_at_50%_35%,rgba(244,114,182,0.1),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_24%),linear-gradient(180deg,#050505_0%,#0b0b11_52%,#050505_100%)] px-4 py-10 text-zinc-200">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-5 flex items-center justify-start">
          <PendingLink
            href="/"
            pendingLabel="Opening home..."
            className="btn-ui-icon"
            aria-label="Go back"
          >
            <FaArrowLeft size={18} />
          </PendingLink>
        </div>

        <div className="mb-5 text-center">
          <StepFlow currentStep={1} />
        </div>

        <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(8,8,10,0.98))] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-sm sm:p-8">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/60 via-35% via-amber-200/55 to-transparent" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-28 rounded-b-[36px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_38%,transparent_78%)] blur-2xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.1),transparent_34%),radial-gradient(circle_at_18%_38%,rgba(34,211,238,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.1),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.08),transparent_22%)]" />
          <div className="pointer-events-none absolute inset-y-12 left-0 w-px bg-gradient-to-b from-transparent via-cyan-300/14 to-transparent" />
          <div className="pointer-events-none absolute inset-y-12 right-0 w-px bg-gradient-to-b from-transparent via-amber-300/12 to-transparent" />
          <div className="relative">
            <LiquidSportText
              as="h1"
              text={["CREATE NEW", "SESSION"]}
              variant="hero-bright"
              simplifyMotion
              className="text-center text-[2.2rem] font-semibold uppercase tracking-[-0.045em] sm:text-[2.95rem]"
              lineClassName="leading-[0.94]"
            />
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
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.1),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_34%)] opacity-70" />
                  <FaPen className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors group-focus-within:text-amber-300" />
                  <input
                    id="session-name"
                    value={name}
                    onChange={(event) => setName(event.target.value.toUpperCase())}
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
                  Match Image
                </label>
                <div className="relative rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
                  <div className="pointer-events-none absolute inset-0 rounded-[24px] bg-[radial-gradient(circle_at_top_left,rgba(244,114,182,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.08),transparent_26%)]" />
                  <div className="flex flex-col items-center gap-3 rounded-[20px] border border-white/8 bg-black/20 px-4 py-4 text-center">
                    <label
                      htmlFor="session-image"
                      className="press-feedback inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                    >
                      <FaImage className="text-zinc-400" />
                      Add match image
                    </label>
                    {selectedFileName ? (
                      <div className="w-full min-w-0">
                        <p className="truncate text-sm text-zinc-400">
                          {selectedFileName}
                        </p>
                        <p className="mt-1 text-xs font-medium text-emerald-300/80">
                          Saves with this game.
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
                  <p className="mt-3 text-center text-xs font-medium text-zinc-500">Optional</p>
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
              <div className="mt-6 rounded-2xl border border-rose-500/20 bg-[linear-gradient(180deg,rgba(190,24,93,0.16),rgba(127,29,29,0.12))] px-4 py-3 text-center text-sm text-rose-200 shadow-[0_14px_28px_rgba(190,24,93,0.08)]">
                {error}
              </div>
            )}

            <LoadingButton
              onClick={createSession}
              loading={saving}
              pendingLabel={savingLabel}
              trailingIcon={<FaArrowRight />}
              className="relative mt-8 inline-flex w-full items-center justify-center gap-3 rounded-[24px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(11,15,24,0.98),rgba(6,8,14,0.98))] px-6 py-4 text-lg font-semibold text-white shadow-[0_18px_40px_rgba(0,0,0,0.28),0_0_0_1px_rgba(34,211,238,0.06)] transition hover:border-cyan-200/24 hover:bg-[linear-gradient(180deg,rgba(12,18,28,0.98),rgba(7,10,16,0.98))]"
            >
              <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/82 via-38% via-amber-200/76 to-transparent" />
              <span className="pointer-events-none absolute inset-x-7 top-0 h-10 rounded-b-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04)_36%,transparent_80%)] blur-xl" />
              <span className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-400/18 to-transparent" />
              Select Teams
            </LoadingButton>
          </div>
        </div>
      </div>
      <ImagePinModal
        isOpen={isPinModalOpen}
        title="Add Match Image"
        subtitle="Enter the 4-digit PIN before adding this match image."
        confirmLabel="Use this image"
        showContinueWithout={true}
        digitCount={4}
        pinLabel="4-digit PIN"
        placeholder="0000"
        onConfirm={handleConfirmImagePin}
        onContinueWithout={handleContinueWithoutImage}
        onClose={handleContinueWithoutImage}
      />
    </main>
  );
}


