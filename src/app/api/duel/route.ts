import { NextRequest, NextResponse } from "next/server";

import { getDuelData } from "@/lib/server/queries";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const circuitId = searchParams.get("circuitId");
  const driverAId = searchParams.get("driverA");
  const driverBId = searchParams.get("driverB");
  const seasonRaw = searchParams.get("season");

  if (!circuitId || !driverAId || !driverBId) {
    return NextResponse.json(
      { error: "circuitId, driverA, and driverB are required" },
      { status: 400 },
    );
  }

  const season = seasonRaw ? Number(seasonRaw) : null;
  const duel = await getDuelData({
    circuitId,
    driverAId,
    driverBId,
    season: Number.isFinite(season) ? season : null,
  });

  if (!duel) {
    return NextResponse.json(
      { error: "No lap data found for the requested duel" },
      { status: 404 },
    );
  }

  return NextResponse.json(duel, {
    headers: {
      "Cache-Control": "s-maxage=60, stale-while-revalidate=3600",
    },
  });
}
