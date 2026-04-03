import mongoose from "mongoose";

const BallSchema = new mongoose.Schema(
  {
    runs: { type: Number, required: true },
    isExtra: { type: Boolean, default: false },
    extraType: {
      type: String,
      enum: ["wide", "noball", "byes", "legbyes", null],
      default: null,
    },
    isOut: { type: Boolean, default: false },
    batsmanOnStrike: { type: String, default: "" },
  },
  { _id: false }
);

const OverSchema = new mongoose.Schema(
  {
    overNumber: { type: Number, required: true },
    balls: [BallSchema],
    bowler: { type: String, default: "" },
  },
  { _id: false }
);

const MatchImageEntrySchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true },
    url: { type: String, default: "", trim: true },
    publicId: { type: String, default: "", trim: true },
    storageUrlEnc: { type: String, default: "", trim: true },
    storageUrlHash: { type: String, default: "", trim: true },
    uploadedAt: { type: Date, default: null },
    uploadedBy: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const MatchSchema = new mongoose.Schema(
  {
    teamA: { type: [String], required: true },
    teamB: { type: [String], required: true },
    teamAName: { type: String, default: "", trim: true },
    teamBName: { type: String, default: "", trim: true },
    overs: { type: Number, required: true },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
    },
    tossWinner: { type: String, default: "" },
    tossDecision: { type: String, enum: ["bat", "bowl", ""], default: "" },
    score: { type: Number, default: 0 },
    outs: { type: Number, default: 0 },
    isOngoing: { type: Boolean, default: true },
    innings: { type: String, enum: ["first", "second"], default: "first" },
    result: { type: String, default: "" },
    innings1: {
      team: { type: String, default: "" },
      score: { type: Number, default: 0 },
      history: [OverSchema],
    },
    innings2: {
      team: { type: String, default: "" },
      score: { type: Number, default: 0 },
      history: [OverSchema],
    },
    widesInRow: { type: Number, default: 0 },
    balls: [BallSchema],
    images: { type: [String], default: [] },
    matchImages: { type: [MatchImageEntrySchema], default: [] },
    announcer: { type: mongoose.Schema.Types.Mixed, default: {} },
    uiMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    mediaUpdatedAt: { type: Date, default: null },
    lastLiveEvent: { type: mongoose.Schema.Types.Mixed, default: null },
    matchImageUrl: { type: String, default: "", trim: true },
    matchImagePublicId: { type: String, default: "", trim: true },
    matchImageStorageUrlEnc: { type: String, default: "", trim: true },
    matchImageStorageUrlHash: { type: String, default: "", trim: true },
    matchImageUploadedAt: { type: Date, default: null },
    matchImageUploadedBy: { type: String, default: "", trim: true },
    announcerEnabled: { type: Boolean, default: false },
    announcerMode: {
      type: String,
      enum: ["simple", "full", ""],
      default: "",
    },
    announcerScoreSoundEffectsEnabled: { type: Boolean, default: true },
    announcerBroadcastScoreSoundEffectsEnabled: {
      type: Boolean,
      default: true,
    },
    walkieTalkieEnabled: { type: Boolean, default: false },
    walkieTalkieUpdatedAt: { type: Date, default: null },
    lastEventType: { type: String, default: "", trim: true },
    lastEventText: { type: String, default: "", trim: true },
    adminAccessVersion: { type: Number, default: 1 },
    processedActionIds: { type: [String], default: [] },
    actionHistory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

MatchSchema.index({ sessionId: 1 });
MatchSchema.index({ sessionId: 1, updatedAt: -1, _id: -1 });
MatchSchema.index({ isOngoing: 1, createdAt: -1 });
MatchSchema.index({ isOngoing: 1, updatedAt: -1, _id: -1 });
MatchSchema.index({ updatedAt: -1 });

export default mongoose.models.Match || mongoose.model("Match", MatchSchema);
