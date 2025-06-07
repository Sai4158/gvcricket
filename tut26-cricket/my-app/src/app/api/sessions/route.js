// src/app/api/sessions/route.js

import Session from "../../../models/Session.js";
import Match from "../../../models/Match.js"; // IMPORT THE MATCH MODEL
import { connectDB } from "../../lib/db";

// ------------- POST ------------- /api/sessions
export async function POST(req) {
  try {
    const body = await req.json();
    await connectDB();
    const doc = await Session.create(body);
    return Response.json(doc, { status: 201 });
  } catch (e) {
    console.error("Error creating session:", e); // Log the server-side error
    return new Response(
      JSON.stringify({ message: "Could not create session", error: e.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// ------------- GET -------------- /api/sessions (list all)
export async function GET() {
  await connectDB();
  try {
    // Fetch all sessions and populate the 'match' field.
    // We select only the necessary fields from the associated Match document:
    // 'isOngoing' to determine if the match is live, 'result' for the final result,
    // and '_id' for frontend navigation.
    const sessions = await Session.find()
      .populate({
        path: "match",
        select:
          "teamA teamB score outs innings innings1 innings2 isOngoing result _id",
      })
      .sort({ createdAt: -1 });

    // Transform the fetched sessions data for the frontend.
    // This ensures consistency and provides the 'isLive' status directly.
    const transformedSessions = sessions.map((session) => {
      // Determine the 'isLive' status based on the associated match's 'isOngoing' field.
      // If there's no associated match, it's considered not live.
      const isLive = session.match ? session.match.isOngoing : false;

      return {
        _id: session._id,
        name: session.name,
        createdAt: session.createdAt,
        // For frontend navigation, we only need the match's _id.
        // If 'match' was populated, it will be an object; here we extract its _id.
        match: session.match ? session.match._id : null,
        isLive: isLive, // The live status derived from the match
        // Use the result from the populated match, or fall back to the session's result.
        result: session.match ? session.match.result : session.result,

        // Include other essential session fields that the frontend might need
        teamA: session.teamA,
        teamB: session.teamB,
        overs: session.overs,
        isLiveSessionField: session.isLive, // Keep session's own isLive field if it exists and is used elsewhere
      };
    });

    // Return the transformed data as JSON
    return new Response(JSON.stringify(transformedSessions), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error fetching sessions:", e); // Log any errors during fetching/transformation
    return new Response(
      JSON.stringify({
        message: "Failed to retrieve sessions",
        error: e.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
