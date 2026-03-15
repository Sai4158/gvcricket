"use client";

import { AnimatePresence } from "framer-motion";
import AnnouncementControls from "../live/AnnouncementControls";
import LiveMicModal from "../live/LiveMicModal";
import WalkiePanel from "../live/WalkiePanel";
import OptionalFeatureBoundary from "../shared/OptionalFeatureBoundary";
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
  micMonitor,
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
        <EditTeamsModal match={match} onUpdate={onUpdate} onClose={onClose} />
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
          currentOverNumber={currentOverNumber}
          innings={match.innings}
          firstInningsOversPlayed={firstInningsOversPlayed}
          onUpdate={onUpdate}
          onClose={onClose}
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
      {infoText && (
        <ModalBase title="Rule Info" onExit={onInfoClose}>
          <p className="text-center text-zinc-300">{infoText}</p>
        </ModalBase>
      )}
    </AnimatePresence>
  );
}
