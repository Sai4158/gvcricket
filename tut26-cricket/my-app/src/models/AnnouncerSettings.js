/**
 * File overview:
 * Purpose: Defines the Mongoose schema and model wiring for AnnouncerSettings data.
 * Main exports: default export.
 * Major callers: Server loaders, API routes, and data helpers.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: ./README.md
 */

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


