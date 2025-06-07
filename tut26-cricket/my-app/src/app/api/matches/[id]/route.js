// src/app/api/matches/[id]/route.js

// Corrected imports:
import { connectDB } from "../../../lib/db";
import Match from "../../../../models/Match"; // Go up four levels to src, then to models/Match.js

// GET handler is correct, no changes needed.
export async function GET(_req, { params }) {
  await connectDB();
  const match = await Match.findById(params.id);
  if (!match) {
    return Response.json({ message: "Match not found" }, { status: 404 });
  }
  return new Response(JSON.stringify(match), { status: 200 });
}

// PATCH /api/matches/:id → update any fields of the match
export async function PATCH(req, { params }) {
  try {
    const data = await req.json();
    await connectDB();

    const updateQuery = { $set: {} };

    // This whitelist determines what the client is allowed to change.
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
    ];

    // Build the $set operator from the received data
    for (const key in data) {
      if (updatableFields.includes(key)) {
        updateQuery.$set[key] = data[key];
      }
    }

    if (Object.keys(updateQuery.$set).length === 0) {
      return Response.json(
        { message: "No valid updatable fields provided" },
        { status: 400 }
      );
    }

    const updated = await Match.findByIdAndUpdate(params.id, updateQuery, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return Response.json(
        { message: "Match not found for update" },
        { status: 404 }
      );
    }

    return new Response(JSON.stringify(updated), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return Response.json(
        { message: "Validation Error", error: err.message },
        { status: 400 }
      );
    }
    return Response.json(
      { message: "Error updating match", error: err.message },
      { status: 500 }
    );
  }
}

// DELETE handler is correct, no changes needed.
export async function DELETE(_req, { params }) {
  try {
    await connectDB();
    const deletedMatch = await Match.findByIdAndDelete(params.id);
    if (!deletedMatch) {
      return Response.json({ message: "Match not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 }); // 204 No Content
  } catch (err) {
    return Response.json(
      { message: "Error deleting match", error: err.message },
      { status: 500 }
    );
  }
}
