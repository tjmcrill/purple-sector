import { NextRequest, NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { getTeammateBattle } from "@/lib/server/queries";

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
  const driverA = searchParams.get("driverA");
  const driverB = searchParams.get("driverB");
  const seasonRaw = searchParams.get("season");

  if (!driverA || !driverB) {
    return NextResponse.json(
      { error: "driverA and driverB are required" },
      { status: 400 },
    );
  }

  if (!ID_PATTERN.test(driverA) || !ID_PATTERN.test(driverB)) {
    return NextResponse.json(
      { error: "Invalid driverA or driverB" },
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

  const battle = await getTeammateBattle(driverA, driverB, season);
  if (!battle) {
    return NextResponse.json(
      { error: "No teammate qualifying battle found" },
      { status: 404 },
    );
  }

  return NextResponse.json(battle, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
