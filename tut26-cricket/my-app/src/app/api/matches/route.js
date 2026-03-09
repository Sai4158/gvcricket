import { connectDB } from "../../lib/db";
import { buildTeamUpdate } from "../../lib/team-utils";
import Match from "../../../models/Match";

export async function POST(req) {
  try {
    const {
      teamA,
      teamB,
      teamAName,
      teamBName,
      overs,
      sessionId,
    } = await req.json();
    await connectDB();

    const normalizedTeamA = buildTeamUpdate(teamAName, teamA || []);
    const normalizedTeamB = buildTeamUpdate(teamBName, teamB || []);

    const newMatch = new Match({
      teamA: normalizedTeamA.players,
      teamB: normalizedTeamB.players,
      teamAName: normalizedTeamA.name,
      teamBName: normalizedTeamB.name,
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
  } catch (error) {
    console.error("Error creating match:", error);
    return Response.json(
      { message: "Error saving match", error: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectDB();
    const matches = await Match.find().sort({ createdAt: -1 });
    return new Response(JSON.stringify(matches), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return Response.json(
      { message: "Error fetching matches", error: error.message },
      { status: 500 }
    );
  }
}
