import process from "node:process";
import { pathToFileURL } from "node:url";

import { STARTER_SEED_TARGETS } from "./lib/seed-targets.mjs";
import {
  fetchJson,
  getSupabaseAdmin,
  loadEnvFile,
} from "./lib/shared.mjs";

loadEnvFile();

const baseUrl = process.env.ERGAST_BASE_URL;
if (!baseUrl) {
  throw new Error("ERGAST_BASE_URL is required");
}

export async function seedDrivers(supabase = getSupabaseAdmin()) {
  const seasons = [...new Set(STARTER_SEED_TARGETS.map((t) => t.season))];
  const driverMap = new Map();

  for (const season of seasons) {
    const url = `${baseUrl}/${season}/drivers.json?limit=100&offset=0`;
    const payload = await fetchJson(url);
    const drivers = payload?.MRData?.DriverTable?.Drivers ?? [];

    for (const driver of drivers) {
      driverMap.set(driver.driverId, {
        driver_id: driver.driverId,
        driver_name: `${driver.givenName} ${driver.familyName}`,
        code: driver.code ?? null,
        nationality: driver.nationality ?? null,
      });
    }

    console.log(`Season ${season}: ${drivers.length} drivers`);
  }

  const rows = [...driverMap.values()];

  const { error } = await supabase
    .from("drivers")
    .upsert(rows, { onConflict: "driver_id" });

  if (error) {
    throw error;
  }

  console.log(`Seeded ${rows.length} unique drivers across seasons ${seasons.join(", ")}`);
}

async function main() {
  await seedDrivers();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
