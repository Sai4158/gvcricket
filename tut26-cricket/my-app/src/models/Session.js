import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    /* basic meta */
    name: { type: String, required: true, trim: true },
    overs: { type: Number, default: null }, // ✅ not required
    isLive: { type: Boolean, default: false },

    /* links & results */
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },
    tossWinner: { type: String, enum: ["Team A", "Team B", ""], default: "" },

    /* rosters */
    teamA: { type: [String], default: [] },
    teamB: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.Session ||
  mongoose.model("Session", SessionSchema);
