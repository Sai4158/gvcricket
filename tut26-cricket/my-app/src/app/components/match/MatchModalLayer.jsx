"use client";

import { AnimatePresence } from "framer-motion";
import AnnouncementControls from "../live/AnnouncementControls";
import LiveMicModal from "../live/LiveMicModal";
import WalkiePanel from "../live/WalkiePanel";
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
            onScoreEvent(runs + 1, false, "noball");
            onClose();
          }}
          onClose={onClose}
        />
      )}
      {modalType === "wide" && (
        <RunInputModal
          title="Wide"
          onConfirm={(runs) => {
            onScoreEvent(runs + 1, false, "wide");
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
      {modalType === "commentary" && commentaryProps ? (
        <ModalBase title="" onExit={onClose} hideHeader>
          <AnnouncementControls {...commentaryProps} />
        </ModalBase>
      ) : null}
      {modalType === "walkie" && walkieProps ? (
        <ModalBase title="Walkie-Talkie" onExit={onClose}>
          <WalkiePanel {...walkieProps} />
        </ModalBase>
      ) : null}
      {modalType === "mic" && (
        <LiveMicModal
          title="Live Commentary Mic"
          monitor={micMonitor}
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
