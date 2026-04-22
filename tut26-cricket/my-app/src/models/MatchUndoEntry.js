/**
 * File overview:
 * Purpose: Stores full undo snapshots outside the hot Match document.
 * Main exports: default export.
 * Major callers: Match score and undo API routes.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: ./README.md
 */

import mongoose from "mongoose";

const MatchUndoEntrySchema = new mongoose.Schema(
  {
    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      required: true,
      index: true,
    },
    sequence: { type: Number, required: true },
    actionId: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

MatchUndoEntrySchema.index({ matchId: 1, sequence: -1 }, { unique: true });
MatchUndoEntrySchema.index({ matchId: 1, createdAt: -1 });

export default mongoose.models.MatchUndoEntry ||
  mongoose.model("MatchUndoEntry", MatchUndoEntrySchema);
