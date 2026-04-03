"use client";

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
  micMonitor,
  entryScoreSoundPromptProps,
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
}) {
  const renderPromptSwitch = (checked, onChange, label) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-8 w-[54px] items-center rounded-full border transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-400/35 ${
        checked
          ? "border-emerald-300/35 bg-emerald-500 shadow-[0_10px_24px_rgba(16,185,129,0.22)]"
          : "border-white/10 bg-white/[0.08]"
      }`}
    >
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.28)] transition-transform ${
          checked ? "translate-x-[26px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
  const modalFallback = (label) => (
    <ModalBase title="Unavailable" onExit={onClose}>
      <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-center text-sm text-zinc-400">
        {label}
      </div>
    </ModalBase>
  );

  return (
    <AnimatePresence>
      {showInningsEnd && <InningsEndModal match={match} onNext={onNext} />}
      {modalType === "history" && (
        <HistoryModal match={match} onClose={onClose} />
      )}
      {modalType === "editTeams" && (
        <EditTeamsModal
          match={match}
          onUpdate={onUpdate}
          onClose={onClose}
          isUpdating={isUpdating}
        />
      )}
      {modalType === "out" && (
        <RunInputModal
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
          currentOvers={match.overs}
          currentLegalBalls={countLegalBalls(match[match.innings === "second" ? "innings2" : "innings1"]?.history || [])}
          currentOverNumber={currentOverNumber}
          innings={match.innings}
          firstInningsOversPlayed={firstInningsOversPlayed}
          currentFirstInningsScore={Number(match?.innings1?.score || 0)}
          firstInningsTeamName={match?.innings1?.team || ""}
          currentSecondInningsScore={Number(match?.innings2?.score || match?.score || 0)}
          onUpdate={onUpdate}
          onClose={onClose}
          isUpdating={isUpdating}
        />
      )}
      {modalType === "image" && (
        <OptionalFeatureBoundary fallback={modalFallback("Image unavailable right now.")}>
          <MatchImageModal
            match={match}
            onUploaded={onImageUploaded}
            onClose={onClose}
          />
        </OptionalFeatureBoundary>
      )}
      {modalType === "commentary" && commentaryProps ? (
        <OptionalFeatureBoundary fallback={modalFallback("Commentary controls unavailable right now.")}>
          <ModalBase title="" onExit={onClose} hideHeader>
            <AnnouncementControls {...commentaryProps} />
          </ModalBase>
        </OptionalFeatureBoundary>
      ) : null}
      {modalType === "walkie" && walkieProps ? (
        <OptionalFeatureBoundary fallback={modalFallback("Walkie unavailable right now.")}>
          <ModalBase title="Walkie-Talkie" onExit={onClose}>
            <WalkiePanel {...walkieProps} />
          </ModalBase>
        </OptionalFeatureBoundary>
      ) : null}
      {modalType === "mic" && (
        <OptionalFeatureBoundary fallback={modalFallback("Live mic unavailable right now.")}>
          <LiveMicModal
            title="Live Commentary Mic"
            monitor={micMonitor}
            onClose={onClose}
          />
        </OptionalFeatureBoundary>
      )}
      {modalType === "rules" && <RulesModal onClose={onClose} />}
      {modalType === "entryScoreSoundEffects" && entryScoreSoundPromptProps ? (
        <ModalBase title="" onExit={() => {}} hideHeader panelClassName="max-w-md">
          <div className="space-y-5 text-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
                Umpire Mode
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Score Tap Sound Effects
              </h2>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                Keep this on to play the selected sound effect on each score tap.
                Turn it off if you are already playing music on this device.
              </p>
            </div>

            <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 text-left">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Enable score tap sounds
                  </p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">
                    Applies only to this umpire device and stays on by default.
                  </p>
                </div>
                {renderPromptSwitch(
                  entryScoreSoundPromptProps.enabled,
                  entryScoreSoundPromptProps.onChange,
                  entryScoreSoundPromptProps.enabled
                    ? "Turn score tap sounds off"
                    : "Turn score tap sounds on",
                )}
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
        <ModalBase title="Rule Info" onExit={onInfoClose}>
          <p className="text-center text-zinc-300">{infoText}</p>
        </ModalBase>
      )}
    </AnimatePresence>
  );
}
