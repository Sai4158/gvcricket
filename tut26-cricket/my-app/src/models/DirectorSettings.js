import mongoose from "mongoose";

const DirectorSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    audioLibraryOrder: { type: [String], default: [] },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

export default mongoose.models.DirectorSettings ||
  mongoose.model("DirectorSettings", DirectorSettingsSchema);
