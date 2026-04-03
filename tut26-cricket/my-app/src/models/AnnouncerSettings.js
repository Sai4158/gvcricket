import mongoose from "mongoose";

const AnnouncerSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    role: { type: String, required: true, trim: true },
    scoreSoundEffectMap: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

export default mongoose.models.AnnouncerSettings ||
  mongoose.model("AnnouncerSettings", AnnouncerSettingsSchema);
