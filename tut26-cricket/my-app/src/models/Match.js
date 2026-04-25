/**
 * File overview:
 * Purpose: Defines the Mongoose schema and model wiring for Match data.
 * Main exports: default export.
 * Major callers: Server loaders, API routes, and data helpers.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: ./README.md
 */

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

const MatchLiveStreamSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["youtube"],
      default: "youtube",
      trim: true,
    },
    inputUrl: { type: String, default: "", trim: true },
    watchUrl: { type: String, default: "", trim: true },
    embedUrl: { type: String, default: "", trim: true },
    videoId: { type: String, default: "", trim: true },
    updatedAt: { type: Date, default: null },
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
    pendingResult: { type: String, default: "", trim: true },
    pendingResultAt: { type: Date, default: null },
    resultAutoFinalizeAt: { type: Date, default: null },
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
    activeOverBalls: { type: [BallSchema], default: [] },
    activeOverNumber: { type: Number, default: 1 },
    legalBallCount: { type: Number, default: 0 },
    firstInningsLegalBallCount: { type: Number, default: 0 },
    secondInningsLegalBallCount: { type: Number, default: 0 },
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
    liveStream: { type: MatchLiveStreamSchema, default: null },
    announcerEnabled: { type: Boolean, default: false },
    announcerMode: {
      type: String,
      enum: ["simple", "full", ""],
      default: "",
    },
    announcerScoreSoundEffectsEnabled: { type: Boolean, default: false },
    announcerBroadcastScoreSoundEffectsEnabled: {
      type: Boolean,
      default: false,
    },
    walkieTalkieEnabled: { type: Boolean, default: false },
    walkieTalkieUpdatedAt: { type: Date, default: null },
    lastEventType: { type: String, default: "", trim: true },
    lastEventText: { type: String, default: "", trim: true },
    adminAccessVersion: { type: Number, default: 1 },
    recentActionIds: { type: [String], default: [] },
    undoCount: { type: Number, default: 0 },
    undoSequence: { type: Number, default: 0 },
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


