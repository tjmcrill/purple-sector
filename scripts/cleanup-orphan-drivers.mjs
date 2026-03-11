import process from "node:process";
import { pathToFileURL } from "node:url";

import { getSupabaseAdmin, loadEnvFile } from "./lib/shared.mjs";

loadEnvFile();

const MIN_SEASON = 2021;

async function main() {
  const supabase = getSupabaseAdmin();

  // Step 1: Delete pre-2021 lap times
  console.log(`Deleting lap_times with season < ${MIN_SEASON}…`);
  const { count: preSeasonCount, error: preSeasonError } = await supabase
    .from("lap_times")
    .delete({ count: "exact" })
    .lt("season", MIN_SEASON);

  if (preSeasonError) {
    throw preSeasonError;
  }

  console.log(`Deleted ${preSeasonCount ?? 0} pre-${MIN_SEASON} lap time rows.`);

  // Step 2: Find orphan drivers (no remaining lap_times)
  const { data: allDrivers, error: driversError } = await supabase
    .from("drivers")
    .select("driver_id");

  if (driversError) {
    throw driversError;
  }

  const { data: lapDrivers, error: lapError } = await supabase
    .from("lap_times")
    .select("driver_id");

  if (lapError) {
    throw lapError;
  }

  const lapDriverIds = new Set(lapDrivers.map((row) => row.driver_id));
  const orphanIds = allDrivers
    .map((row) => row.driver_id)
    .filter((id) => !lapDriverIds.has(id));

  if (orphanIds.length === 0) {
    console.log("No orphan drivers found.");
    return;
  }

  console.log(`Found ${orphanIds.length} orphan drivers (not in lap_times). Deleting…`);

  const chunkSize = 200;
  for (let i = 0; i < orphanIds.length; i += chunkSize) {
    const chunk = orphanIds.slice(i, i + chunkSize);
    const { error: deleteError } = await supabase
      .from("drivers")
      .delete()
      .in("driver_id", chunk);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`Deleted batch ${Math.floor(i / chunkSize) + 1}: ${chunk.length} drivers`);
  }

  console.log(`Done. Removed ${orphanIds.length} orphan drivers.`);

  // Step 3: Final counts
  const { count: finalDrivers } = await supabase
    .from("drivers")
    .select("driver_id", { count: "exact", head: true });

  const { count: finalLaps } = await supabase
    .from("lap_times")
    .select("id", { count: "exact", head: true });

  console.log(`\nFinal state: ${finalDrivers} drivers, ${finalLaps} lap times (all ${MIN_SEASON}+)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
