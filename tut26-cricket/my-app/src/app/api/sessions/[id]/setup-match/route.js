import { connectDB } from "../../../../lib/db";
import { NextResponse } from "next/server";
import { getMatchAccessCookie } from "../../../../lib/match-access";
import { buildTeamUpdate } from "../../../../lib/team-utils";
import Match from "../../../../../models/Match";
import Session from "../../../../../models/Session";

export async function POST(req, { params }) {
  const { id: sessionId } = params;
  let transactionSession;

  try {
    await connectDB();
    const { teamAName, teamAPlayers, teamBName, teamBPlayers, overs } =
      await req.json();
    const normalizedTeamA = buildTeamUpdate(teamAName, teamAPlayers);
    const normalizedTeamB = buildTeamUpdate(teamBName, teamBPlayers);

    if (
      !normalizedTeamA.name ||
      !normalizedTeamB.name ||
      !normalizedTeamA.players.length ||
      !normalizedTeamB.players.length ||
      !overs ||
      !sessionId
    ) {
      return Response.json(
        { message: "Missing required fields." },
        { status: 400 }
      );
    }

    let createdMatch = null;
    transactionSession = await Match.startSession();

    await transactionSession.withTransaction(async () => {
      const existingSession = await Session.findById(sessionId).session(
        transactionSession
      );

      if (!existingSession) {
        throw new Error("SESSION_NOT_FOUND");
      }

      [createdMatch] = await Match.create(
        [
          {
            teamA: normalizedTeamA.players,
            teamB: normalizedTeamB.players,
            teamAName: normalizedTeamA.name,
            teamBName: normalizedTeamB.name,
            overs,
            sessionId,
            isOngoing: true,
            innings1: { score: 0, history: [] },
            innings2: { score: 0, history: [] },
          },
        ],
        { session: transactionSession }
      );

      await Session.findByIdAndUpdate(
        sessionId,
        {
          $set: {
            match: createdMatch._id,
            teamA: normalizedTeamA.players,
            teamB: normalizedTeamB.players,
            teamAName: normalizedTeamA.name,
            teamBName: normalizedTeamB.name,
            overs,
            isLive: true,
          },
        },
        { new: true, session: transactionSession }
      );
    });

    const response = NextResponse.json(createdMatch, { status: 201 });
    const matchCookie = getMatchAccessCookie(createdMatch._id);
    response.cookies.set(matchCookie.name, matchCookie.value, matchCookie.options);
    return response;
  } catch (error) {
    if (error.message === "SESSION_NOT_FOUND") {
      return Response.json({ message: "Session not found" }, { status: 404 });
    }

    console.error("Error setting up match:", error);
    return Response.json(
      { message: "Error setting up match", error: error.message },
      { status: 500 }
    );
  } finally {
    if (transactionSession) {
      await transactionSession.endSession();
    }
  }
}
