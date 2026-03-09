"use client";

import { AnimatePresence } from "framer-motion";
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
  oversHistory,
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
  return (
    <AnimatePresence>
      {showInningsEnd && <InningsEndModal match={match} onNext={onNext} />}
      {modalType === "history" && (
        <HistoryModal history={oversHistory} onClose={onClose} />
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
        <MatchImageModal
          match={match}
          onUploaded={onImageUploaded}
          onClose={onClose}
        />
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
