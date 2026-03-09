import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../lib/match-access";
import Match from "../../../../models/Match";
import Session from "../../../../models/Session";

async function requireMatchAccess(matchId) {
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(getMatchAccessCookieName(matchId));

  return hasValidMatchAccess(matchId, accessCookie?.value);
}

export async function GET(_req, { params }) {
  try {
    await connectDB();
    const match = await Match.findById(params.id);

    if (!match) {
      return NextResponse.json({ message: "Match not found" }, { status: 404 });
    }

    return NextResponse.json(match, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: "Error fetching match", error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const hasAccess = await requireMatchAccess(params.id);

    if (!hasAccess) {
      return NextResponse.json(
        { message: "Umpire access required" },
        { status: 403 }
      );
    }

    const data = await req.json();
    await connectDB();

    const updateQuery = { $set: {} };
    const updatableFields = [
      "score",
      "outs",
      "result",
      "isOngoing",
      "innings",
      "innings1",
      "innings2",
      "balls",
      "tossWinner",
      "tossDecision",
      "teamA",
      "teamB",
      "teamAName",
      "teamBName",
      "overs",
    ];

    for (const key in data) {
      if (updatableFields.includes(key)) {
        updateQuery.$set[key] = data[key];
      }
    }

    if (Object.keys(updateQuery.$set).length === 0) {
      return NextResponse.json(
        { message: "No valid updatable fields provided" },
        { status: 400 }
      );
    }

    const updated = await Match.findByIdAndUpdate(params.id, updateQuery, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return NextResponse.json(
        { message: "Match not found for update" },
        { status: 404 }
      );
    }

    const sessionUpdate = {};

    if ("teamA" in updateQuery.$set) sessionUpdate.teamA = updated.teamA;
    if ("teamB" in updateQuery.$set) sessionUpdate.teamB = updated.teamB;
    if ("teamAName" in updateQuery.$set) sessionUpdate.teamAName = updated.teamAName;
    if ("teamBName" in updateQuery.$set) sessionUpdate.teamBName = updated.teamBName;
    if ("overs" in updateQuery.$set) sessionUpdate.overs = updated.overs;
    if ("tossWinner" in updateQuery.$set) {
      sessionUpdate.tossWinner = updated.tossWinner;
    }
    if ("isOngoing" in updateQuery.$set) {
      sessionUpdate.isLive = updated.isOngoing;
    }

    if (Object.keys(sessionUpdate).length > 0) {
      await Session.findByIdAndUpdate(updated.sessionId, {
        $set: sessionUpdate,
      });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    if (error.name === "ValidationError") {
      return NextResponse.json(
        { message: "Validation Error", error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: "Error updating match", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(_req, { params }) {
  try {
    const hasAccess = await requireMatchAccess(params.id);

    if (!hasAccess) {
      return NextResponse.json(
        { message: "Umpire access required" },
        { status: 403 }
      );
    }

    await connectDB();
    const deletedMatch = await Match.findByIdAndDelete(params.id);

    if (!deletedMatch) {
      return NextResponse.json({ message: "Match not found" }, { status: 404 });
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { message: "Error deleting match", error: error.message },
      { status: 500 }
    );
  }
}
