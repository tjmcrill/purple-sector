import { NextRequest, NextResponse } from "next/server";

import { rateLimit } from "@/lib/rate-limit";
import { getTeammates } from "@/lib/server/queries";

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

  const driverId = request.nextUrl.searchParams.get("driverId");
  if (!driverId) {
    return NextResponse.json({ error: "driverId is required" }, { status: 400 });
  }

  if (!ID_PATTERN.test(driverId)) {
    return NextResponse.json({ error: "Invalid driverId" }, { status: 400 });
  }

  const teammates = await getTeammates(driverId);
  return NextResponse.json(
    { driverId, teammates },
    {
      headers: {
        "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
