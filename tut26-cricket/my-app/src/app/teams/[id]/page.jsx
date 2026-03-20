"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  FaArrowLeft,
  FaArrowRight,
  FaInfoCircle,
  FaMinus,
  FaPlus,
} from "react-icons/fa";
import TeamsInfoModal from "../../components/teams/InfoModal";
import TeamRoster, {
  createDefaultRoster,
} from "../../components/teams/TeamRoster";
import useSessionStorageState from "../../components/teams/useSessionStorageState";
import LoadingButton from "../../components/shared/LoadingButton";
import {
  clearPendingSessionImage,
  getPendingSessionImage,
  uploadPendingSessionImageToDraftSession,
} from "../../lib/pending-session-image";
import StepFlow from "../../components/shared/StepFlow";

export default function TeamSelectionPage() {
  const { id: sessionId } = useParams();
  const router = useRouter();
  const draftTokenKey = `session_${sessionId}_draftToken`;
  const [teamA, setTeamA] = useSessionStorageState(
    `session_${sessionId}_teamA_v2`,
    createDefaultRoster("Team Blue")
  );
  const [teamB, setTeamB] = useSessionStorageState(
    `session_${sessionId}_teamB_v2`,
    createDefaultRoster("Team Red")
  );
  const [overs, setOvers] = useSessionStorageState(
    `session_${sessionId}_overs_v2`,
    6
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [imageUploadState, setImageUploadState] = useState("idle");

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const draftToken = window.sessionStorage.getItem(draftTokenKey) || "";
    const pendingImage = getPendingSessionImage();

    if (!draftToken || !pendingImage?.dataUrl) {
      return undefined;
    }

    let isMounted = true;

    setImageUploadState("uploading");

    void uploadPendingSessionImageToDraftSession({
      sessionId,
      draftToken,
      pendingImage,
    })
      .then((didUpload) => {
        if (didUpload) {
          clearPendingSessionImage();
          if (!isMounted) return;
          setImageUploadState("done");
          return;
        }

        if (!isMounted) return;
        setImageUploadState("failed");
      })
      .catch(() => {
        if (!isMounted) return;
        setImageUploadState("failed");
      });

    return () => {
      isMounted = false;
    };
  }, [draftTokenKey, sessionId]);

  const deleteDraftSession = async () => {
    if (typeof window === "undefined") return;
    const draftToken = window.sessionStorage.getItem(draftTokenKey);
    if (!draftToken) return;

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftToken }),
        keepalive: true,
      });
    } catch {
      // Ignore cleanup errors; the session is hidden as a draft anyway.
    } finally {
      window.sessionStorage.removeItem(draftTokenKey);
      window.sessionStorage.removeItem(`session_${sessionId}_teamA_v2`);
      window.sessionStorage.removeItem(`session_${sessionId}_teamB_v2`);
      window.sessionStorage.removeItem(`session_${sessionId}_overs_v2`);
    }
  };

  const handleBack = async () => {
    await deleteDraftSession();
    router.push("/session/new");
  };

  const handleSubmit = async () => {
    const finalTeamAName = teamA.name.trim();
    const finalTeamBName = teamB.name.trim();
    const finalTeamAPlayers = teamA.players.map((player) => player.trim()).filter(Boolean);
    const finalTeamBPlayers = teamB.players.map((player) => player.trim()).filter(Boolean);

    if (!finalTeamAName || !finalTeamBName) {
      setError("Each team must have a name.");
      return;
    }

    if (!finalTeamAPlayers.length || !finalTeamBPlayers.length) {
      setError("Each team must have at least one player.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/sessions/${sessionId}/setup-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamAName: finalTeamAName,
          teamAPlayers: finalTeamAPlayers,
          teamBName: finalTeamBName,
          teamBPlayers: finalTeamBPlayers,
          overs,
          draftToken:
            typeof window !== "undefined"
              ? window.sessionStorage.getItem(draftTokenKey) || ""
              : "",
        }),
      });

      if (!response.ok) {
        throw new Error(
          (await response.json()).message || "Failed to set up the match."
        );
      }

      await response.json();
      router.push(`/toss/${sessionId}`);
    } catch (caughtError) {
      setError(caughtError.message);
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.08),transparent_26%),radial-gradient(circle_at_bottom,rgba(239,68,68,0.08),transparent_24%),linear-gradient(180deg,#050505_0%,#0b0b11_55%,#050505_100%)] px-5 py-10 text-zinc-100">
      <div className="w-full max-w-4xl mx-auto">
        <header className="mb-8 mt-4">
          <div className="mb-5 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={handleBack}
              className="btn-ui-icon"
              aria-label="Go back"
            >
              <FaArrowLeft size={18} />
            </button>
            <button
              onClick={() => setIsInfoModalOpen(true)}
              className="btn-ui-icon"
              aria-label="Open team setup help"
            >
              <FaInfoCircle size={22} />
            </button>
          </div>
          <div className="mb-6 text-center">
            <StepFlow currentStep={2} />
          </div>
          <div className="text-center">
            <h1 className="bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(226,232,240,0.96)_24%,rgba(165,243,252,0.94)_54%,rgba(253,224,71,0.9)_100%)] bg-clip-text text-[2.35rem] font-extrabold uppercase tracking-[-0.05em] text-transparent drop-shadow-[0_8px_24px_rgba(0,0,0,0.34)] sm:text-[3.1rem]">
              Team Selection
            </h1>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-400 sm:text-base">
            Set team names, squad size, and overs before the toss.
          </p>
        </header>

        <section className="grid md:grid-cols-2 gap-8 mb-10">
          <TeamRoster color="blue" roster={teamA} setRoster={setTeamA} />
          <TeamRoster color="red" roster={teamB} setRoster={setTeamB} />
        </section>

        <section className="w-full max-w-md mx-auto space-y-8">
          <div className="flex items-center justify-between rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,14,0.96))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <div>
              <h2 className="text-xl font-black text-white">Overs</h2>
              <p className="mt-1 text-sm text-zinc-500">Match length</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => overs > 1 && setOvers(overs - 1)}
                className="btn-ui btn-ui-quiet h-11 w-11 rounded-2xl p-0"
                aria-label="Decrease overs"
              >
                <span className="text-[1.35rem] font-medium leading-none">−</span>
              </button>
              <span className="w-12 text-center text-4xl font-black text-white">
                {overs}
              </span>
              <button
                onClick={() => overs < 50 && setOvers(overs + 1)}
                className="btn-ui btn-ui-quiet h-11 w-11 rounded-2xl p-0"
                aria-label="Increase overs"
              >
                <span className="text-[1.35rem] font-medium leading-none">+</span>
              </button>
            </div>
          </div>

          <LoadingButton
            onClick={handleSubmit}
            loading={isLoading}
            pendingLabel="Saving..."
            trailingIcon={<FaArrowRight />}
            className="relative inline-flex w-full items-center justify-center gap-3 rounded-[28px] border border-rose-300/16 bg-[linear-gradient(180deg,rgba(11,15,24,0.98),rgba(6,8,14,0.98))] px-6 py-5 text-xl font-semibold text-white shadow-[0_18px_40px_rgba(0,0,0,0.28),0_0_0_1px_rgba(244,63,94,0.06)] transition hover:border-rose-200/24 hover:bg-[linear-gradient(180deg,rgba(12,18,28,0.98),rgba(7,10,16,0.98))]"
          >
            <span className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-rose-200/82 via-38% via-amber-200/76 to-transparent" />
            <span className="pointer-events-none absolute inset-x-7 top-0 h-10 rounded-b-[20px] bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04)_36%,transparent_80%)] blur-xl" />
            <span className="pointer-events-none absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-rose-400/18 to-transparent" />
            Proceed to Toss
          </LoadingButton>
          {imageUploadState === "uploading" ? (
            <p className="text-center text-xs font-medium text-cyan-200/80">
              Cover image is uploading in the background while you set up teams.
            </p>
          ) : null}
          {imageUploadState === "failed" ? (
            <p className="text-center text-xs font-medium text-zinc-500">
              Cover image will keep trying later and will not block the match setup.
            </p>
          ) : null}
          {error && (
            <p className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-200">
              {error}
            </p>
          )}
        </section>
      </div>
      <AnimatePresence>
        {isInfoModalOpen && (
          <TeamsInfoModal onExit={() => setIsInfoModalOpen(false)} />
        )}
      </AnimatePresence>
    </main>
  );
}
