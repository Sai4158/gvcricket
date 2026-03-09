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
    announcer: { type: mongoose.Schema.Types.Mixed, default: {} },
    uiMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    mediaUpdatedAt: { type: Date, default: null },
    lastLiveEvent: { type: mongoose.Schema.Types.Mixed, default: null },
    matchImageUrl: { type: String, default: "", trim: true },
    matchImagePublicId: { type: String, default: "", trim: true },
    matchImageUploadedAt: { type: Date, default: null },
    matchImageUploadedBy: { type: String, default: "", trim: true },
    announcerEnabled: { type: Boolean, default: false },
    announcerMode: {
      type: String,
      enum: ["simple", "full", ""],
      default: "",
    },
    lastEventType: { type: String, default: "", trim: true },
    lastEventText: { type: String, default: "", trim: true },
    adminAccessVersion: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.models.Match || mongoose.model("Match", MatchSchema);
