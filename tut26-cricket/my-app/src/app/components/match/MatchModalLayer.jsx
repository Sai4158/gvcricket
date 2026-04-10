"use client";

/**
 * File overview:
 * Purpose: Renders Match UI for the app's screens and flows.
 * Main exports: MatchModalLayer.
 * Major callers: Feature routes and sibling components.
 * Side effects: uses React hooks and browser APIs.
 * Read next: ./README.md
 */


import { AnimatePresence } from "framer-motion";
import AnnouncementControls from "../live/AnnouncementControls";
import LiveMicModal from "../live/LiveMicModal";
import WalkiePanel from "../live/WalkiePanel";
import OptionalFeatureBoundary from "../shared/OptionalFeatureBoundary";
import { countLegalBalls } from "../../lib/match-scoring";
import {
  HistoryModal,
  InningsEndModal,
  MatchImageModal,
  ModalBase,
  RulesModal,
  RunInputModal,
} from "./MatchBaseModals";
import { EditOversModal, EditTeamsModal } from "./MatchEditModals";

export default function MatchModalLayer({
  showInningsEnd,
  match,
  modalType,
  isUpdating,
  isStageCardUndoPending = false,
  micMonitor,
  entryScoreSoundPromptProps,
  stageContinuePromptProps,
  commentaryProps,
  walkieProps,
  currentOverNumber,
  firstInningsOversPlayed,
  infoText,
  onNext,
  onUpdate,
  onImageUploaded,
  onScoreEvent,
  onClose,
  onInfoClose,
  onUndoStageCard,
}) {
  const renderPromptSwitch = (checked, onChange, label) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-8 w-13.5 items-center rounded-full border transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-400/35 ${
        checked
          ? "border-emerald-300/35 bg-emerald-500 shadow-[0_10px_24px_rgba(16,185,129,0.22)]"
          : "border-white/10 bg-white/8"
      }`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-6.5" : "translate-x-0.75"
        }`}
      />
    </button>
  );
  const modalFallback = (label) => (
    <ModalBase title="Unavailable" onExit={onClose}>
      <div className="rounded-2xl border border-white/8 bg-white/3 px-4 py-3 text-center text-sm text-zinc-400">
        {label}
      </div>
    </ModalBase>
  );

  return (
    <AnimatePresence>
      {showInningsEnd && (
        <InningsEndModal
          key="innings-end"
          match={match}
          onNext={onNext}
          onUndo={onUndoStageCard}
          undoDisabled={isUpdating || isStageCardUndoPending}
        />
      )}
      {stageContinuePromptProps ? (
        <ModalBase
          key="stage-continue-prompt"
          title="Please Wait"
          onExit={stageContinuePromptProps.onStay}
          panelClassName="max-w-sm"
        >
          <div className="space-y-4 text-center">
            <div className="rounded-2xl border border-amber-300/12 bg-amber-500/[0.07] px-4 py-4">
              <p className="text-sm font-semibold text-white">
                Announcement is still continuing.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={stageContinuePromptProps.onForceContinue}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/8"
              >
                Force Continue
              </button>
              <button
                type="button"
                onClick={stageContinuePromptProps.onStay}
                className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
              >
                Stay
              </button>
            </div>
          </div>
        </ModalBase>
      ) : null}
      {modalType === "history" && (
        <HistoryModal key="history" match={match} onClose={onClose} />
      )}
      {modalType === "editTeams" && (
        <EditTeamsModal
          key="edit-teams"
          match={match}
          onUpdate={onUpdate}
          onClose={onClose}
          isUpdating={isUpdating}
        />
      )}
      {modalType === "out" && (
        <RunInputModal
          key="out"
          title="OUT"
          onConfirm={(runs) => {
            onScoreEvent(runs, true);
            onClose();
          }}
          onClose={onClose}
        />
      )}
      {modalType === "noball" && (
        <RunInputModal
          key="noball"
          title="No Ball"
          onConfirm={(runs) => {
            onScoreEvent(runs, false, "noball");
            onClose();
          }}
          onClose={onClose}
        />
      )}
      {modalType === "wide" && (
        <RunInputModal
          key="wide"
          title="Wide"
          onConfirm={(runs) => {
            onScoreEvent(runs, false, "wide");
            onClose();
          }}
          onClose={onClose}
        />
      )}
      {modalType === "editOvers" && (
        <EditOversModal
          key="edit-overs"
          currentOvers={match.overs}
          currentLegalBalls={countLegalBalls(
            match[match.innings === "second" ? "innings2" : "innings1"]
              ?.history || [],
          )}
          currentOverNumber={currentOverNumber}
          innings={match.innings}
          firstInningsOversPlayed={firstInningsOversPlayed}
          currentFirstInningsScore={Number(match?.innings1?.score || 0)}
          firstInningsTeamName={match?.innings1?.team || ""}
          currentSecondInningsScore={Number(
            match?.innings2?.score || match?.score || 0,
          )}
          onUpdate={onUpdate}
          onClose={onClose}
          isUpdating={isUpdating}
        />
      )}
      {modalType === "image" && (
        <OptionalFeatureBoundary
          key="image"
          fallback={modalFallback("Image unavailable right now.")}
        >
          <MatchImageModal
            match={match}
            onUploaded={onImageUploaded}
            onClose={onClose}
          />
        </OptionalFeatureBoundary>
      )}
      {modalType === "commentary" && commentaryProps ? (
        <OptionalFeatureBoundary
          key="commentary"
          fallback={modalFallback("Commentary controls unavailable right now.")}
        >
          <ModalBase title="" onExit={onClose} hideHeader>
            <AnnouncementControls {...commentaryProps} />
          </ModalBase>
        </OptionalFeatureBoundary>
      ) : null}
      {modalType === "walkie" && walkieProps ? (
        <OptionalFeatureBoundary
          key="walkie"
          fallback={modalFallback("Walkie unavailable right now.")}
        >
          <ModalBase title="Walkie-Talkie" onExit={onClose}>
            <WalkiePanel {...walkieProps} />
          </ModalBase>
        </OptionalFeatureBoundary>
      ) : null}
      {modalType === "mic" && (
        <OptionalFeatureBoundary
          key="mic"
          fallback={modalFallback("Live mic unavailable right now.")}
        >
          <LiveMicModal
            title="Live Commentary Mic"
            monitor={micMonitor}
            onClose={onClose}
          />
        </OptionalFeatureBoundary>
      )}
      {modalType === "rules" && (
        <RulesModal key="rules" onClose={onClose} />
      )}
      {modalType === "entryScoreSoundEffects" && entryScoreSoundPromptProps ? (
        <ModalBase
          key="entry-score-sound-effects"
          title=""
          onExit={() => {}}
          hideHeader
          panelClassName="max-w-md"
        >
          <div className="space-y-5 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
                Umpire Mode
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Score Feedback
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Choose what should happen after each ball.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/4 p-4 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 pr-2">
                  <p className="text-base font-semibold text-white">
                    Announcer score
                  </p>
                  <p className="mt-2 text-sm leading-5 text-zinc-400">
                    Turn this on to announce the score after each ball.
                  </p>
                </div>
                <div className="shrink-0 pt-1">
                  {renderPromptSwitch(
                    entryScoreSoundPromptProps.announcerEnabled,
                    entryScoreSoundPromptProps.onAnnouncerChange,
                    entryScoreSoundPromptProps.announcerEnabled
                      ? "Turn announcer score off"
                      : "Turn announcer score on",
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/4 p-4 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 pr-2">
                  <p className="text-base font-semibold text-white">
                    Score tap sound effects
                  </p>
                  <p className="mt-2 text-sm leading-5 text-zinc-400">
                    Turn this off when playing music to avoid cutting it off.
                  </p>
                </div>
                <div className="shrink-0 pt-1">
                  {renderPromptSwitch(
                    entryScoreSoundPromptProps.soundEffectsEnabled,
                    entryScoreSoundPromptProps.onSoundEffectsChange,
                    entryScoreSoundPromptProps.soundEffectsEnabled
                      ? "Turn score tap sounds off"
                      : "Turn score tap sounds on",
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={entryScoreSoundPromptProps.onSave}
              className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400 active:scale-[0.99]"
            >
              Save
            </button>
          </div>
        </ModalBase>
      ) : null}
      {infoText && (
        <ModalBase key="rule-info" title="Rule Info" onExit={onInfoClose}>
          <p className="text-center text-zinc-300">{infoText}</p>
        </ModalBase>
      )}
    </AnimatePresence>
  );
}

