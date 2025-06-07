// src/app/api/matches/route.js

// Corrected imports:
import { connectDB } from "../../lib/db"; // Correct module path
import Match from "../../../models/Match"; // Go up three levels to src, then to models/Match.js

// POST /api/matches → create a new match
export async function POST(req) {
  try {
    const { teamA, teamB, overs, sessionId } = await req.json();
    await connectDB();

    const newMatch = new Match({
      teamA,
      teamB,
      overs,
      sessionId,
      isOngoing: true,
      innings1: {
        score: 0,
        history: [],
      },
      innings2: {
        score: 0,
        history: [],
      },
    });

    await newMatch.save();

    return new Response(JSON.stringify(newMatch), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error creating match:", err);
    return Response.json(
      { message: "Error saving match", error: err.message },
      { status: 500 }
    );
  }
}

// GET /api/matches → list recent matches (optional helper)
export async function GET() {
  try {
    await connectDB();
    const matches = await Match.find().sort({ createdAt: -1 });
    return new Response(JSON.stringify(matches), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return Response.json(
      { message: "Error fetching matches", error: err.message },
      { status: 500 }
    );
  }
}
