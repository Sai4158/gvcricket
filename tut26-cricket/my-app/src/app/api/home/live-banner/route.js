import { NextResponse } from "next/server";
import { loadHomeLiveBannerData } from "../../../lib/server-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const liveMatch = await loadHomeLiveBannerData();
    return NextResponse.json(
      { liveMatch },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Home live-banner API failed:", error);
    return NextResponse.json(
      { liveMatch: null },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  }
}
