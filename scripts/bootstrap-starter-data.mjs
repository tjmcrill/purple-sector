import process from "node:process";

import { fetchJson, getSupabaseAdmin, loadEnvFile } from "./lib/shared.mjs";
import { STARTER_SEED_TARGETS } from "./lib/seed-targets.mjs";
import { seedDrivers } from "./seed-drivers.mjs";
import { seedCircuits } from "./seed-circuits.mjs";
import {
  backfillCircuitHistory,
  enrichCircuitSeason,
} from "./backfill-qualifying-laps.mjs";

loadEnvFile();

const ergastBaseUrl = process.env.ERGAST_BASE_URL;
if (!ergastBaseUrl) {
  throw new Error("ERGAST_BASE_URL is required");
}

async function fetchSeasonRaces(season, round = null) {
  const seasonPath = round ? `/${season}/${round}` : `/${season}`;
  const payload = await fetchJson(`${ergastBaseUrl}${seasonPath}/races.json?limit=100`);
  return payload?.MRData?.RaceTable?.Races ?? [];
}

async function main() {
  const supabase = getSupabaseAdmin();
  const seasonRaceMap = new Map();

  for (const target of STARTER_SEED_TARGETS) {
    seasonRaceMap.set(
      target.season,
      await fetchSeasonRaces(target.season, target.round),
    );
  }

  const circuitIds = [...new Set(
    [...seasonRaceMap.values()]
      .flat()
      .map((race) => race.Circuit?.circuitId)
      .filter(Boolean),
  )];

  console.log(`Preparing starter dataset for ${circuitIds.length} circuits`);

  await seedDrivers(supabase);
  await seedCircuits({ circuitIds, supabase });

  const expectedSeasonsByCircuit = new Map();
  for (const [season, races] of seasonRaceMap.entries()) {
    for (const race of races) {
      const circuitId = race.Circuit?.circuitId;
      if (!circuitId) {
        continue;
      }

      if (!expectedSeasonsByCircuit.has(circuitId)) {
        expectedSeasonsByCircuit.set(circuitId, new Set());
      }

      expectedSeasonsByCircuit.get(circuitId).add(season);
    }
  }

  for (const circuitId of circuitIds) {
    const { data, error } = await supabase
      .from("lap_times")
      .select("season")
      .eq("circuit_id", circuitId);

    if (error) {
      throw error;
    }

    const existingSeasons = new Set((data ?? []).map((row) => row.season));
    const expectedSeasons = expectedSeasonsByCircuit.get(circuitId) ?? new Set();
    const missingSeason = [...expectedSeasons].find(
      (season) => !existingSeasons.has(season),
    );

    if (!missingSeason) {
      console.log(`Skipping historical backfill for ${circuitId}; target seasons already present`);
      continue;
    }

    await backfillCircuitHistory(supabase, circuitId, {
      minSeason: 2021,
      maxSeason: 2026,
    });
  }

  for (const [season, races] of seasonRaceMap.entries()) {
    const seasonCircuitIds = [...new Set(races.map((race) => race.Circuit?.circuitId).filter(Boolean))];
    for (const circuitId of seasonCircuitIds) {
      if (season >= 2023) {
        const { count, error } = await supabase
          .from("lap_times")
          .select("id", { count: "exact", head: true })
          .eq("circuit_id", circuitId)
          .eq("season", season)
          .not("sector_1_ms", "is", null);

        if (error) {
          throw error;
        }

        if ((count ?? 0) > 0) {
          console.log(`Skipping OpenF1 enrichment for ${circuitId} ${season}; sectors already present`);
          continue;
        }

        await enrichCircuitSeason(supabase, circuitId, season, {
          paceRequests: true,
        });
      }
    }
  }

  console.log("Starter dataset complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
