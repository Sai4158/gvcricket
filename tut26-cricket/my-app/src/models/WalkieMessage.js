/**
 * File overview:
 * Purpose: Mongoose model definition for WalkieMessage.
 * Main exports: default export.
 * Major callers: Server loaders, API routes, and data helpers.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: README.md
 */
import mongoose from "mongoose";

const WalkieMessageSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, index: true },
    toParticipantId: { type: String, required: true, index: true },
    eventType: { type: String, enum: ["signal", "participant"], required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

WalkieMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
WalkieMessageSchema.index({ matchId: 1, toParticipantId: 1, createdAt: 1 });

export default mongoose.models.WalkieMessage ||
  mongoose.model("WalkieMessage", WalkieMessageSchema);
