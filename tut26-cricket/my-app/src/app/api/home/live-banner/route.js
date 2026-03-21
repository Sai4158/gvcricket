import { NextResponse } from "next/server";
import { loadHomeLiveBannerData } from "../../../lib/server-data";

export async function GET() {
  try {
    const liveMatch = await loadHomeLiveBannerData();
    return NextResponse.json({ liveMatch }, { status: 200 });
  } catch (error) {
    console.error("Home live-banner API failed:", error);
    return NextResponse.json({ liveMatch: null }, { status: 200 });
  }
}
