import Session from "../../../models/Session.js";
import { connectDB } from "../../lib/db";
import { getTeamBundle } from "../../lib/team-utils";

export async function POST(req) {
  try {
    const body = await req.json();
    await connectDB();
    const doc = await Session.create(body);
    return Response.json(doc, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    return new Response(
      JSON.stringify({
        message: "Could not create session",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function GET() {
  await connectDB();

  try {
    const sessions = await Session.find()
      .populate({
        path: "match",
        select:
          "teamA teamB teamAName teamBName score outs innings innings1 innings2 isOngoing result _id updatedAt",
      })
      .sort({ createdAt: -1 });

    const transformedSessions = sessions.map((session) => {
      const isLive = session.match ? session.match.isOngoing : false;
      const teamA = getTeamBundle(session, "teamA");
      const teamB = getTeamBundle(session, "teamB");

      return {
        _id: session._id,
        name: session.name,
        date: session.date || "",
        createdAt: session.createdAt,
        updatedAt: session.match?.updatedAt || session.updatedAt,
        match: session.match ? session.match._id : null,
        isLive,
        result: session.match ? session.match.result : session.result,
        teamA: teamA.players,
        teamB: teamB.players,
        teamAName: teamA.name,
        teamBName: teamB.name,
        overs: session.overs,
        isLiveSessionField: session.isLive,
      };
    });

    return new Response(JSON.stringify(transformedSessions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return new Response(
      JSON.stringify({
        message: "Failed to retrieve sessions",
        error: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
