import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { syncLatestCompletedRace } from "@/lib/server/season-sync";

export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: NextRequest) {
  if (!env.cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization");
  return authorization === `Bearer ${env.cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncLatestCompletedRace();
    return NextResponse.json(
      {
        ok: true,
        syncedAt: new Date().toISOString(),
        ...result,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown cron sync error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
