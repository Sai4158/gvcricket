import { cookies } from "next/headers";
import { jsonError } from "../../../../lib/api-response";
import { connectDB } from "../../../../lib/db";
import {
  getMatchAccessCookieName,
  hasValidMatchAccess,
} from "../../../../lib/match-access";
import { serializeUmpireHistory } from "../../../../lib/public-data";
import Match from "../../../../../models/Match";

async function hasMatchAccess(matchId, accessVersion) {
  const cookieStore = await cookies();
  const token = cookieStore.get(getMatchAccessCookieName(matchId))?.value;
  return hasValidMatchAccess(matchId, token, accessVersion);
}

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    await connectDB();

    const match = await Match.findById(id).select(
      "_id innings innings1 innings2 updatedAt adminAccessVersion",
    );
    if (!match) {
      return jsonError("Match not found.", 404);
    }

    const hasAccess = await hasMatchAccess(
      id,
      Number(match.adminAccessVersion || 1),
    );
    if (!hasAccess) {
      return jsonError("Umpire access required.", 403);
    }

    return Response.json(serializeUmpireHistory(match), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return jsonError("Could not load umpire history.", 500);
  }
}
