import { NextRequest, NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { getRandomDuel } from "@/lib/server/queries";

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip).limited) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const modeParam = request.nextUrl.searchParams.get("mode");
  const mode = modeParam === "dotd" ? "dotd" : "random";

  if (modeParam && modeParam !== "random" && modeParam !== "dotd") {
    return NextResponse.json(
      { error: "mode must be random or dotd" },
      { status: 400 },
    );
  }

  const pick = await getRandomDuel(mode);
  if (!pick) {
    return NextResponse.json(
      { error: "No qualifying duel candidates found" },
      { status: 404 },
    );
  }

  return NextResponse.json(pick, {
    headers: {
      "Cache-Control": "s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
