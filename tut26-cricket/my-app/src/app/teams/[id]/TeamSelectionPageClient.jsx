"use client";


/**
 * File overview:
 * Purpose: Source module for TeamSelectionPageClient.
 * Main exports: TeamSelectionPageClient.
 * Major callers: Adjacent modules in the same feature area.
 * Side effects: reads or writes browser storage.
 * Read next: ../../../../docs/ONBOARDING.md
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaArrowLeft,
  FaArrowRight,
  FaCircle,
  FaInfoCircle,
  FaRedo,
} from "react-icons/fa";
import TeamsInfoModal from "../../components/teams/InfoModal";
import TeamRoster, {
  createDefaultRoster,
} from "../../components/teams/TeamRoster";
import useSessionStorageState from "../../components/teams/useSessionStorageState";
import LoadingButton from "../../components/shared/LoadingButton";
import LiquidSportText from "../../components/home/LiquidSportText";
import {
  clearPendingSessionImage,
  clearPendingSessionImageNotice,
  getPendingSessionImage,
  getPendingSessionImageNotice,
  uploadPendingSessionImageToDraftSession,
} from "../../lib/pending-session-image";
import { primeUiAudio } from "../../lib/page-audio";
import StepFlow from "../../components/shared/StepFlow";
import useSpeechAnnouncer from "../../components/live/useSpeechAnnouncer";
import { CoinHeads, CoinTails, SpinningCoin } from "../../components/toss/CoinArt";

const TEAM_SETUP_TOSS_ANNOUNCER_SETTINGS = {
  enabled: true,
  muted: false,
  volume: 1,
  mode: "full",
};

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function TeamSelectionPageClient({ sessionId }) {
  const resolvedSessionId = String(sessionId || "").trim();
  const router = useRouter();
  const draftTokenKey = `session_${resolvedSessionId}_draftToken`;
  const [teamA, setTeamA] = useSessionStorageState(
    `session_${resolvedSessionId}_teamA_v2`,
    createDefaultRoster("Team Blue")
  );
  const [teamB, setTeamB] = useSessionStorageState(
    `session_${resolvedSessionId}_teamB_v2`,
    createDefaultRoster("Team Red")
  );
  const [overs, setOvers] = useSessionStorageState(
    `session_${resolvedSessionId}_overs_v2`,
    6
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [imageUploadState, setImageUploadState] = useState("idle");
  const [imageUploadNotice, setImageUploadNotice] = useState("");
  const [tossStatus, setTossStatus] = useState("choosing");
  const [tossCountdown, setTossCountdown] = useState(3);
  const [tossCall, setTossCall] = useState("");
  const [tossSide, setTossSide] = useState("");
  const imageUploadPromiseRef = useRef(null);
  const spokenCountdownRef = useRef(null);
  const { speak, prime, stop } = useSpeechAnnouncer(
    TEAM_SETUP_TOSS_ANNOUNCER_SETTINGS
  );

  const uploadDraftImageIfNeeded = useCallback(async () => {
    if (typeof window === "undefined") {
      return true;
    }

    if (imageUploadPromiseRef.current) {
      return imageUploadPromiseRef.current;
    }

    if (!resolvedSessionId) {
      setImageUploadState("failed");
      return false;
    }

    const draftToken = window.sessionStorage.getItem(draftTokenKey) || "";
    const pendingImage = getPendingSessionImage();

    if (!draftToken || !pendingImage?.dataUrl) {
      setImageUploadState("done");
      return true;
    }

    setImageUploadState("uploading");

    const uploadPromise = uploadPendingSessionImageToDraftSession({
      sessionId: resolvedSessionId,
      draftToken,
      pendingImage,
    })
      .then((didUpload) => {
        if (didUpload) {
          clearPendingSessionImage();
          clearPendingSessionImageNotice(resolvedSessionId);
          setImageUploadNotice("");
          setImageUploadState("done");
          return true;
        }

        setImageUploadState("failed");
        return false;
      })
      .catch(() => {
        setImageUploadState("failed");
        return false;
      })
      .finally(() => {
        imageUploadPromiseRef.current = null;
      });

    imageUploadPromiseRef.current = uploadPromise;
    return uploadPromise;
  }, [draftTokenKey, resolvedSessionId]);

  useEffect(() => {
    const pendingImage = getPendingSessionImage();

    if (!pendingImage?.dataUrl) {
      clearPendingSessionImageNotice(resolvedSessionId);
      setImageUploadNotice("");
      setImageUploadState("done");
      return;
    }

    setImageUploadNotice(getPendingSessionImageNotice(resolvedSessionId));
  }, [resolvedSessionId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    if (!window.sessionStorage.getItem(draftTokenKey) || !getPendingSessionImage()?.dataUrl) {
      return undefined;
    }

    let isMounted = true;

    void uploadDraftImageIfNeeded().then((didUpload) => {
      if (!isMounted || didUpload) {
        return;
      }
      setImageUploadState("failed");
    });

    return () => {
      isMounted = false;
    };
  }, [draftTokenKey, resolvedSessionId, uploadDraftImageIfNeeded]);

  useEffect(() => {
    if (tossStatus !== "counting" || tossCountdown <= 0) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setTossCountdown((current) => current - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [tossCountdown, tossStatus]);

  useEffect(() => {
    if (
      tossStatus !== "counting" ||
      tossCountdown <= 0 ||
      spokenCountdownRef.current === tossCountdown
    ) {
      return;
    }

    const didSpeak = speak(String(tossCountdown), { interrupt: true });
    if (didSpeak) {
      spokenCountdownRef.current = tossCountdown;
    }
  }, [speak, tossCountdown, tossStatus]);

  useEffect(() => {
    if (tossStatus !== "counting" || tossCountdown !== 0 || !tossCall) {
      return undefined;
    }

    const resultTimer = window.setTimeout(() => {
      const nextSide = Math.random() < 0.5 ? "heads" : "tails";
      setTossSide(nextSide);
      setTossStatus("finished");
      speak(
        `${nextSide} wins. Winner gets to pick the first player. Please edit team names, players and overs, then proceed to match toss on the next step.`,
        {
          interrupt: true,
          priority: 3,
        }
      );
    }, 700);

    return () => window.clearTimeout(resultTimer);
  }, [speak, tossCall, tossCountdown, tossStatus]);

  useEffect(() => () => stop(), [stop]);

  const handleTossChoice = (choice) => {
    stop();
    setError("");
    setTossCall(choice);
    setTossSide("");
    spokenCountdownRef.current = null;
    prime({ userGesture: true });
    setTossCountdown(3);
    setTossStatus("counting");
  };

  const redoCompactToss = () => {
    stop();
    setTossStatus("choosing");
    setTossCountdown(3);
    setTossCall("");
    setTossSide("");
    spokenCountdownRef.current = null;
  };

  const deleteDraftSession = async () => {
    if (typeof window === "undefined" || !resolvedSessionId) return;
    const draftToken = window.sessionStorage.getItem(draftTokenKey);
    if (!draftToken) return;

    try {
      await fetch(`/api/sessions/${resolvedSessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftToken }),
        keepalive: true,
      });
    } catch {
      // Ignore cleanup errors; the session is hidden as a draft anyway.
    } finally {
      window.sessionStorage.removeItem(draftTokenKey);
      clearPendingSessionImageNotice(resolvedSessionId);
      window.sessionStorage.removeItem(`session_${resolvedSessionId}_teamA_v2`);
      window.sessionStorage.removeItem(`session_${resolvedSessionId}_teamB_v2`);
      window.sessionStorage.removeItem(`session_${resolvedSessionId}_overs_v2`);
    }
  };

  const handleBack = async () => {
    stop();
    await deleteDraftSession();
    router.push("/session/new");
  };

  const handleSubmit = async () => {
    stop();
    if (!resolvedSessionId) {
      setError("Session is still loading. Please try again.");
      return;
    }

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
    await primeUiAudio().catch(() => false);

    try {
      if (getPendingSessionImage()?.dataUrl) {
        void uploadDraftImageIfNeeded();
      }

      const response = await fetch(`/api/sessions/${resolvedSessionId}/setup-match`, {
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
      const payload = await readJsonSafely(response);

      if (!response.ok) {
        throw new Error(
          payload?.message || "Failed to set up the match."
        );
      }

      router.push(`/toss/${resolvedSessionId}`);
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
            <LiquidSportText
              as="h1"
              text="TEAM SELECTION"
              variant="hero-bright"
              simplifyMotion
              className="text-[2.45rem] font-semibold uppercase tracking-[-0.05em] sm:text-[3.2rem]"
              lineClassName="leading-[0.94]"
            />
          </div>
          <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-zinc-400 sm:text-base">
            Optional toss first, then teams and overs.
          </p>
        </header>

        <section className="mb-8">
          <div className="relative overflow-hidden rounded-[30px] border border-amber-400/18 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,rgba(20,20,24,0.96),rgba(10,10,14,0.98))] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 overflow-hidden bg-[linear-gradient(90deg,rgba(59,130,246,0.96)_0%,rgba(96,165,250,0.88)_36%,rgba(251,113,133,0.86)_64%,rgba(239,68,68,0.96)_100%)] shadow-[0_0_18px_rgba(96,165,250,0.22)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_18%)]" />
            <div className="mb-4 text-center">
              <LiquidSportText
                as="h2"
                text={["WINNER PICKS", "FIRST PLAYER"]}
                variant="hero-bright"
                simplifyMotion
                className="text-[1.36rem] font-semibold uppercase tracking-[0.08em] sm:text-[1.52rem]"
                lineClassName="leading-[1.24]"
              />
            </div>

            <div className="mb-4 flex justify-center">
              {tossStatus !== "choosing" ? (
                <button
                  type="button"
                  onClick={redoCompactToss}
                  className="btn-ui btn-ui-quiet inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em]"
                >
                  <FaRedo className="text-[0.8rem]" />
                  Redo
                </button>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 px-5 py-6">
              <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                {tossStatus === "choosing" ? (
                  <>
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                      <FaCircle className="text-[8px] text-amber-300" />
                      Pick Call
                    </div>
                    <div className="mb-5 scale-[0.88]">
                      <motion.div
                        animate={{ rotateY: 720 }}
                        transition={{
                          duration: 6,
                          ease: "linear",
                          repeat: Number.POSITIVE_INFINITY,
                        }}
                        className="[transform-style:preserve-3d]"
                      >
                        <SpinningCoin />
                      </motion.div>
                    </div>
                    <div className="grid w-full max-w-sm grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => handleTossChoice("heads")}
                        className="btn-ui btn-ui-glass-dark rounded-[24px] px-4 py-4 text-base font-bold uppercase tracking-[0.22em]"
                      >
                        Heads
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTossChoice("tails")}
                        className="btn-ui btn-ui-glass-dark-alt rounded-[24px] px-4 py-4 text-base font-bold uppercase tracking-[0.22em]"
                      >
                        Tails
                      </button>
                    </div>
                  </>
                ) : tossStatus === "counting" ? (
                  <>
                    <motion.div
                      className="mb-3 [transform-style:preserve-3d]"
                      animate={{ rotateY: 1440 }}
                      transition={{ duration: 2.2, ease: "easeInOut" }}
                    >
                      <SpinningCoin />
                    </motion.div>
                    <p className="text-6xl font-black text-white">{tossCountdown}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.24em] text-amber-200/70">
                      {tossCall}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-4 scale-[0.88]">
                      {tossSide === "heads" ? <CoinHeads /> : <CoinTails />}
                    </div>
                    <p className="text-2xl font-black uppercase tracking-[0.14em] text-white">
                      {tossSide}
                    </p>
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-300">
                      Scroll and proceed to match toss
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

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
                <span className="text-[1.35rem] font-medium leading-none">-</span>
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
          ) : imageUploadNotice ? (
            <p className="text-center text-xs font-medium text-zinc-500">
              {imageUploadNotice}
            </p>
          ) : imageUploadState === "failed" ? (
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
