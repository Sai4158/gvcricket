/**
 * File overview:
 * Purpose: Mongoose model definition for AuditLog.
 * Main exports: default export.
 * Major callers: Server loaders, API routes, and data helpers.
 * Side effects: registers or reuses a Mongoose model.
 * Read next: README.md
 */
import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true },
    targetType: { type: String, default: "", trim: true },
    targetId: { type: String, default: "", trim: true },
    status: { type: String, enum: ["success", "failure"], required: true },
    ip: { type: String, default: "", trim: true },
    userAgent: { type: String, default: "", trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, strict: true, strictQuery: true }
);

export default mongoose.models.AuditLog ||
  mongoose.model("AuditLog", AuditLogSchema);
