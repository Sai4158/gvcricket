/**
 * File overview:
 * Purpose: Provides shared Audit Log logic for routes, APIs, and feature code.
 * Main exports: module side effects only.
 * Major callers: Route loaders, API routes, and feature components.
 * Side effects: none.
 * Read next: ./README.md
 */

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


