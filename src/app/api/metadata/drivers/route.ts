import { NextResponse } from "next/server";

import { getDrivers } from "@/lib/server/queries";

export async function GET() {
  const drivers = await getDrivers();
  return NextResponse.json(drivers, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
