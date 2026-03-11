import { NextRequest, NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { getCircuitEvolution } from "@/lib/server/queries";

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

  const circuitId = request.nextUrl.searchParams.get("circuitId");
  if (!circuitId) {
    return NextResponse.json({ error: "circuitId is required" }, { status: 400 });
  }

  if (!ID_PATTERN.test(circuitId)) {
    return NextResponse.json({ error: "Invalid circuitId" }, { status: 400 });
  }

  const evolution = await getCircuitEvolution(circuitId);
  if (!evolution) {
    return NextResponse.json(
      { error: "No evolution data found for the requested circuit" },
      { status: 404 },
    );
  }

  return NextResponse.json(evolution, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
