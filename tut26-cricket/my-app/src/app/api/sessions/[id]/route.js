// src/app/api/sessions/[id]/route.js

import Session from "../../../../models/Session";
import { connectDB } from "../../../lib/db";

// ---------- GET  ----------  /api/sessions/:id
export async function GET(_req, { params }) {
  await connectDB();
  const doc = await Session.findById(params.id);
  if (!doc) return new Response("Session not found", { status: 404 });
  return Response.json(doc);
}

// ---------- PATCH ----------  /api/sessions/:id
export async function PATCH(req, { params }) {
  try {
    await connectDB();
    const body = await req.json();
    const updated = await Session.findByIdAndUpdate(params.id, body, {
      new: true,
    });
    return Response.json(updated);
  } catch (e) {
    return new Response("Patch failed – " + e.message, { status: 500 });
  }
}
