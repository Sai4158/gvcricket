import mongoose from "mongoose";

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

const SessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: String, default: "", trim: true },
    overs: { type: Number, default: null },
    isLive: { type: Boolean, default: false },
    isDraft: { type: Boolean, default: false },
    draftTokenHash: { type: String, default: "", trim: true },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },
    tossWinner: { type: String, default: "" },
    tossDecision: { type: String, enum: ["bat", "bowl", ""], default: "" },
    teamAName: { type: String, default: "", trim: true },
    teamBName: { type: String, default: "", trim: true },
    teamA: { type: [String], default: [] },
    teamB: { type: [String], default: [] },
    images: { type: [String], default: [] },
    matchImages: { type: [MatchImageEntrySchema], default: [] },
    announcer: { type: mongoose.Schema.Types.Mixed, default: {} },
    uiMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    mediaUpdatedAt: { type: Date, default: null },
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
    walkieTalkieEnabled: { type: Boolean, default: false },
    walkieTalkieUpdatedAt: { type: Date, default: null },
    lastEventType: { type: String, default: "", trim: true },
    lastEventText: { type: String, default: "", trim: true },
    adminAccessVersion: { type: Number, default: 1 },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

SessionSchema.index({ isDraft: 1, createdAt: -1 });
SessionSchema.index({ isLive: 1, createdAt: -1 });
SessionSchema.index({ createdAt: -1, _id: -1 });
SessionSchema.index({ match: 1 });

export default mongoose.models.Session ||
  mongoose.model("Session", SessionSchema);
