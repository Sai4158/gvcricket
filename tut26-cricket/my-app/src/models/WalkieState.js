/**
 * File overview:
 * Purpose: Mongoose model definition for WalkieState.
 * Main exports: default export.
 * Major callers: Server loaders, API routes, and data helpers.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: README.md
 */
import mongoose from "mongoose";

const WalkieParticipantSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    role: { type: String, enum: ["umpire", "spectator", "director"], required: true },
    name: { type: String, default: "", trim: true },
    ready: { type: Boolean, default: true },
    connectedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WalkiePendingRequestSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true },
    participantId: { type: String, required: true },
    role: { type: String, enum: ["spectator", "director"], required: true },
    name: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },
    requestedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const WalkieCooldownSchema = new mongoose.Schema(
  {
    participantId: { type: String, required: true },
    until: { type: Date, required: true },
  },
  { _id: false }
);

const WalkieNotificationSchema = new mongoose.Schema(
  {
    id: { type: String, default: "" },
    type: { type: String, default: "" },
    message: { type: String, default: "" },
    request: { type: mongoose.Schema.Types.Mixed, default: null },
    createdAt: { type: Date, default: null },
  },
  { _id: false }
);

const WalkieStateSchema = new mongoose.Schema(
  {
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: "Match", required: true, unique: true },
    enabled: { type: Boolean, default: false },
    participants: { type: [WalkieParticipantSchema], default: [] },
    activeSpeakerRole: { type: String, default: "" },
    activeSpeakerId: { type: String, default: "" },
    activeSpeakerName: { type: String, default: "" },
    lockStartedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    transmissionId: { type: String, default: "" },
    pendingRequests: { type: [WalkiePendingRequestSchema], default: [] },
    requestCooldowns: { type: [WalkieCooldownSchema], default: [] },
    version: { type: Number, default: 0 },
    lastNotification: { type: WalkieNotificationSchema, default: () => ({}) },
    idleExpiresAt: { type: Date, default: null },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

WalkieStateSchema.index({ updatedAt: -1 });
WalkieStateSchema.index({ idleExpiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.WalkieState ||
  mongoose.model("WalkieState", WalkieStateSchema);
