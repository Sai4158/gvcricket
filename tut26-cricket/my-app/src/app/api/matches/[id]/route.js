// src/app/api/matches/[id]/route.js

// Corrected imports:
import { connectDB } from "../../../lib/db";
import Match from "../../../../models/Match";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
  try {
    await connectDB();
    const match = await Match.findById(params.id);

    if (!match) {
      return NextResponse.json({ message: "Match not found" }, { status: 404 });
    }

    return NextResponse.json(match, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { message: "Error fetching match", error: err.message },
      { status: 500 }
    );
  }
}

// ✅ FIX: Correctly handling the 'params' object.
export async function PATCH(req, { params }) {
  try {
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

    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    if (err.name === "ValidationError") {
      return NextResponse.json(
        { message: "Validation Error", error: err.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { message: "Error updating match", error: err.message },
      { status: 500 }
    );
  }
}

// ✅ FIX: Correctly handling the 'params' object.
export async function DELETE(req, { params }) {
  try {
    await connectDB();
    const deletedMatch = await Match.findByIdAndDelete(params.id);

    if (!deletedMatch) {
      return NextResponse.json({ message: "Match not found" }, { status: 404 });
    }

    // Return a 204 response with no body
    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json(
      { message: "Error deleting match", error: err.message },
      { status: 500 }
    );
  }
}
