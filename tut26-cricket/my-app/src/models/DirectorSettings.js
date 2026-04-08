/**
 * File overview:
 * Purpose: Mongoose model definition for DirectorSettings.
 * Main exports: default export.
 * Major callers: Server loaders, API routes, and data helpers.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: README.md
 */
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
