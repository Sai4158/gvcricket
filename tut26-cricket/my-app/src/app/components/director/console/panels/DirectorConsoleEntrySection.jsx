import { FaBroadcastTower } from "react-icons/fa";
import LiquidSportText from "../../../home/LiquidSportText";
import LoadingButton from "../../../shared/LoadingButton";
import SessionCoverHero from "../../../shared/SessionCoverHero";
import DirectorSessionPicker from "../../DirectorSessionPicker";

/**
 * File overview:
 * Purpose: Renders the director console entry, auth, and session-selection hero states.
 * Main exports: DirectorConsoleEntrySection.
 * Major callers: DirectorConsoleScreen.
 * Side effects: none in this panel.
 * Read next: ./README.md
 */

export default function DirectorConsoleEntrySection({
  auth,
  sessionSelection,
}) {
  const {
    authorized,
    directorPinError,
    directorPinRateLimit,
    isSubmittingPin,
    pin,
    setAuthError,
    setPin,
    setShowDirectorPinStep,
    showDirectorPinStep,
    submitDirectorPin,
  } = auth;
  const {
    managedSession,
    openDirectorSession,
    selectedSession,
    sessions,
    showPicker,
  } = sessionSelection;

  return (
    <SessionCoverHero
      imageUrl={
        selectedSession?.match?.matchImageUrl ||
        selectedSession?.session?.matchImageUrl ||
        ""
      }
      alt="Director console cover"
      className="mb-5"
      priority
      showImage={false}
    >
      <div className="space-y-4 px-5 py-5 sm:px-6">
        {!authorized ? (
          <>
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-500/12 text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                <FaBroadcastTower className="text-xl" />
              </div>
              <LiquidSportText
                as="h1"
                text="DIRECTOR CONSOLE"
                variant="hero-bright"
                simplifyMotion
                className="text-2xl font-semibold tracking-[-0.03em] sm:text-[2rem]"
              />
            </div>
            {directorPinError ? (
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {directorPinError}
              </div>
            ) : null}
            {!showDirectorPinStep ? (
              <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(8,8,11,0.68),rgba(8,8,11,0.4))] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <LoadingButton
                  type="button"
                  onClick={() => {
                    setAuthError("");
                    setShowDirectorPinStep(true);
                  }}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#22c55e_58%,#34d399_100%)] px-5 py-3.5 font-bold text-black shadow-[0_16px_36px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Get Started
                </LoadingButton>
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-black/30 px-4 py-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                      Step 1
                    </p>
                    <p className="mt-2 text-sm text-zinc-300">
                      Enter the 4-digit director PIN to join the shared live
                      director console.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDirectorPinStep(false);
                      setPin("");
                      setAuthError("");
                    }}
                    className="press-feedback inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-300"
                  >
                    Back
                  </button>
                </div>
                <label
                  htmlFor="director-inline-pin"
                  className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                >
                  Director PIN
                </label>
                <input
                  id="director-inline-pin"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  value={pin}
                  disabled={isSubmittingPin || directorPinRateLimit.isBlocked}
                  onChange={(event) =>
                    setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void submitDirectorPin();
                    }
                  }}
                  placeholder="0000"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-2xl font-semibold tracking-[0.55em] text-white outline-none transition placeholder:tracking-[0.35em] placeholder:text-zinc-500 focus:border-emerald-400/30 focus:bg-white/6 focus:shadow-[0_0_0_4px_rgba(16,185,129,0.08)]"
                />
                <LoadingButton
                  type="button"
                  onClick={() => void submitDirectorPin()}
                  disabled={pin.length !== 4 || directorPinRateLimit.isBlocked}
                  loading={isSubmittingPin}
                  pendingLabel="Opening..."
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#10b981_0%,#22c55e_58%,#34d399_100%)] px-5 py-3.5 font-bold text-black shadow-[0_16px_36px_rgba(16,185,129,0.2)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open Director Mode
                </LoadingButton>
                {!isSubmittingPin && pin.length !== 4 ? (
                  <p className="mt-3 text-center text-xs text-zinc-500">
                    Enter all 4 digits to continue.
                  </p>
                ) : null}
              </div>
            )}
          </>
        ) : showPicker || !managedSession ? (
          <div className="space-y-4">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-[2rem]">
                Choose a live session
              </h1>
              <p className="mt-1 text-sm text-zinc-300">
                Pick a live match to join. Multiple directors can open the same
                match at the same time.
              </p>
            </div>
            <DirectorSessionPicker
              sessions={sessions}
              onSelect={(item) => {
                openDirectorSession(item.session._id);
              }}
              onQuickStart={(item) => {
                openDirectorSession(item.session._id);
              }}
            />
          </div>
        ) : null}
      </div>
    </SessionCoverHero>
  );
}
