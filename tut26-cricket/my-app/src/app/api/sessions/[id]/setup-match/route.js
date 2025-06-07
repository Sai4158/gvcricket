// src/app/api/sessions/[id]/setup-match/route.js

import { connectDB } from "../../../../lib/db";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

// POST /api/sessions/:id/setup-match
export async function POST(req, { params }) {
  const { id: sessionId } = params;

  try {
    await connectDB();
    const { teamA, teamB, overs } = await req.json();

    // Validate incoming data
    if (!teamA || !teamB || !overs || !sessionId) {
      return Response.json(
        { message: "Missing required fields." },
        { status: 400 }
      );
    }

    // 1. Create the new Match document
    const newMatch = new Match({
      teamA,
      teamB,
      overs,
      sessionId, // Link back to the session
      isOngoing: true,
      innings1: { score: 0, history: [] },
      innings2: { score: 0, history: [] },
    });
    await newMatch.save();

    // 2. Atomically update the corresponding Session to link the new match
    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $set: {
          match: newMatch._id,
          teamA: teamA,
          teamB: teamB,
          overs: overs,
          isLive: true,
        },
      },
      { new: true } // Return the updated document
    );

    if (!updatedSession) {
      // This would happen if the sessionId was invalid
      return Response.json({ message: "Session not found" }, { status: 404 });
    }

    // 3. Return the newly created match object
    return new Response(JSON.stringify(newMatch), {
      status: 201, // 201 Created
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error setting up match:", err);
    return Response.json(
      { message: "Error setting up match", error: err.message },
      { status: 500 }
    );
  }
}
