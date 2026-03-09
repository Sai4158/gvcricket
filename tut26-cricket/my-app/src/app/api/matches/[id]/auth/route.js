import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getMatchAccessCookie,
  getMatchAccessCookieName,
  hasValidMatchAccess,
  isValidUmpirePin,
} from "../../../../lib/match-access";

export async function GET(_req, { params }) {
  const cookieStore = await cookies();
  const cookieName = getMatchAccessCookieName(params.id);
  const token = cookieStore.get(cookieName)?.value;

  return NextResponse.json({
    authorized: hasValidMatchAccess(params.id, token),
  });
}

export async function POST(req, { params }) {
  const { pin } = await req.json();

  if (!isValidUmpirePin(pin)) {
    return NextResponse.json({ message: "Incorrect PIN." }, { status: 401 });
  }

  const response = NextResponse.json({ authorized: true });
  const matchCookie = getMatchAccessCookie(params.id);
  response.cookies.set(matchCookie.name, matchCookie.value, matchCookie.options);

  return response;
}
