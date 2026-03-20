import { connectDB } from "./db";
import AuditLog from "../../models/AuditLog";

export async function writeAuditLog(entry) {
  try {
    await connectDB();
    await AuditLog.create(entry);
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}
