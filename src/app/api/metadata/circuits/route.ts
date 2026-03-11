import { NextResponse } from "next/server";

import { getCircuits } from "@/lib/server/queries";

export async function GET() {
  const circuits = await getCircuits();
  return NextResponse.json(circuits, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
