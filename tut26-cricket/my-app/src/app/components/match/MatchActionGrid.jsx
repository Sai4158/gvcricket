"use client";

import {
  FaBookOpen,
  FaImage,
  FaInfoCircle,
  FaRegClock,
  FaShareAlt,
  FaUserEdit,
} from "react-icons/fa";
import { LuUndo2 } from "react-icons/lu";
import { ActionButton } from "./MatchControls";

export default function MatchActionGrid({
  isUpdating,
  historyStackLength,
  onEditTeams,
  onEditOvers,
  onUndo,
  onHistory,
  onImage,
  onShare,
  onRules,
}) {
  return (
    <div className="mt-8 pt-6 border-t border-zinc-700 flex justify-center">
      <div className="grid grid-cols-3 gap-x-4 gap-y-6">
        <ActionButton
          onClick={onEditTeams}
          icon={<FaUserEdit />}
          label="Edit Teams"
          colorClass="text-sky-400"
          disabled={isUpdating}
        />
        <ActionButton
          onClick={onEditOvers}
          icon={<FaRegClock />}
          label="Edit Overs"
          colorClass="text-amber-400"
          disabled={isUpdating}
        />
        <ActionButton
          onClick={onUndo}
          icon={<LuUndo2 />}
          label="Undo"
          colorClass="text-zinc-400"
          disabled={isUpdating || historyStackLength === 0}
        />
        <ActionButton
          onClick={onHistory}
          icon={<FaBookOpen />}
          label="History"
          colorClass="text-violet-400"
        />
        <ActionButton
          onClick={onImage}
          icon={<FaImage />}
          label="Image"
          colorClass="text-pink-400"
        />
        <ActionButton
          onClick={onShare}
          icon={<FaShareAlt />}
          label="Share"
          colorClass="text-green-400"
        />
        <ActionButton
          onClick={onRules}
          icon={<FaInfoCircle />}
          label="Rules"
          colorClass="text-teal-400"
        />
      </div>
    </div>
  );
}
