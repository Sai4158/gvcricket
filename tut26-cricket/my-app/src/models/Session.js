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
  },
  { timestamps: true }
);

export default mongoose.models.Session ||
  mongoose.model("Session", SessionSchema);
