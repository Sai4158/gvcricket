import { cookies } from "next/headers";
import { jsonError } from "../../../lib/api-response";
import {
  getDirectorAccessCookieName,
  hasValidDirectorAccess,
} from "../../../lib/director-access";
import { loadDirectorSessionsList } from "../../../lib/server-data";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getDirectorAccessCookieName())?.value;

  if (!hasValidDirectorAccess(token)) {
    return jsonError("Director access required.", 403);
  }

  const sessions = await loadDirectorSessionsList();
  return Response.json(
    { sessions },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
