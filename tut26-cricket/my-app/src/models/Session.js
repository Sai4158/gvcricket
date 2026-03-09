import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: String, default: "", trim: true },
    overs: { type: Number, default: null },
    isLive: { type: Boolean, default: false },
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },
    tossWinner: { type: String, default: "" },
    teamAName: { type: String, default: "", trim: true },
    teamBName: { type: String, default: "", trim: true },
    teamA: { type: [String], default: [] },
    teamB: { type: [String], default: [] },
    images: { type: [String], default: [] },
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
    lastEventType: { type: String, default: "", trim: true },
    lastEventText: { type: String, default: "", trim: true },
    adminAccessVersion: { type: Number, default: 1 },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

export default mongoose.models.Session ||
  mongoose.model("Session", SessionSchema);
