import { NextRequest, NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { getDuelData } from "@/lib/server/queries";

const ID_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip).limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

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

  if (
    !ID_PATTERN.test(circuitId) ||
    !ID_PATTERN.test(driverAId) ||
    !ID_PATTERN.test(driverBId)
  ) {
    return NextResponse.json(
      { error: "Invalid circuitId, driverA, or driverB" },
      { status: 400 },
    );
  }

  const season = seasonRaw ? Number(seasonRaw) : null;
  if (
    season !== null &&
    (!Number.isInteger(season) || season < 1950 || season > 2030)
  ) {
    return NextResponse.json(
      { error: "season must be an integer between 1950 and 2030" },
      { status: 400 },
    );
  }

  const duel = await getDuelData({
    circuitId,
    driverAId,
    driverBId,
    season,
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
