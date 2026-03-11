import process from "node:process";

import { fetchJson, getSupabaseAdmin, loadEnvFile } from "./lib/shared.mjs";
import { STARTER_SEED_TARGETS } from "./lib/seed-targets.mjs";

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

  const { data: circuits, error: circuitError } = await supabase
    .from("circuits")
    .select("circuit_id, name")
    .order("circuit_id", { ascending: true });

  if (circuitError) {
    throw circuitError;
  }

  const { count: circuitCount, error: circuitCountError } = await supabase
    .from("circuits")
    .select("circuit_id", { count: "exact", head: true });

  if (circuitCountError) {
    throw circuitCountError;
  }

  const { count: driverCount, error: driverCountError } = await supabase
    .from("drivers")
    .select("driver_id", { count: "exact", head: true });

  if (driverCountError) {
    throw driverCountError;
  }

  const { count: lapCount, error: lapCountError } = await supabase
    .from("lap_times")
    .select("id", { count: "exact", head: true });

  if (lapCountError) {
    throw lapCountError;
  }

  const circuitLabelById = new Map(
    (circuits ?? []).map((circuit) => [circuit.circuit_id, circuit.name]),
  );

  console.log("Coverage summary");
  console.log(`- circuits: ${circuitCount ?? 0}`);
  console.log(`- drivers: ${driverCount ?? 0}`);
  console.log(`- lap_times: ${lapCount ?? 0}`);
  console.log("");

  for (const target of STARTER_SEED_TARGETS) {
    const races = seasonRaceMap.get(target.season) ?? [];
    const seasonCircuitIds = [...new Set(races.map((race) => race.Circuit?.circuitId).filter(Boolean))];
    const coveredCircuits = [];
    const missingCircuits = [];
    const sectorCovered = [];
    const sectorMissing = [];

    for (const circuitId of seasonCircuitIds) {
      const { count: rowCount, error: rowError } = await supabase
        .from("lap_times")
        .select("id", { count: "exact", head: true })
        .eq("season", target.season)
        .eq("circuit_id", circuitId);

      if (rowError) {
        throw rowError;
      }

      if ((rowCount ?? 0) > 0) {
        coveredCircuits.push(circuitId);
      } else {
        missingCircuits.push(circuitId);
      }

      if (target.season >= 2023) {
        const { count: sectorCount, error: sectorError } = await supabase
          .from("lap_times")
          .select("id", { count: "exact", head: true })
          .eq("season", target.season)
          .eq("circuit_id", circuitId)
          .not("sector_1_ms", "is", null);

        if (sectorError) {
          throw sectorError;
        }

        if ((sectorCount ?? 0) > 0) {
          sectorCovered.push(circuitId);
        } else {
          sectorMissing.push(circuitId);
        }
      }
    }

    console.log(
      `${target.season}${target.round ? ` round ${target.round}` : ""}: ${coveredCircuits.length}/${seasonCircuitIds.length} circuits cached`,
    );

    if (missingCircuits.length > 0) {
      console.log(
        `  missing cache: ${missingCircuits
          .map((circuitId) => `${circuitId} (${circuitLabelById.get(circuitId) ?? "unknown"})`)
          .join(", ")}`,
      );
    }

    if (target.season >= 2023) {
      console.log(
        `  sector coverage: ${sectorCovered.length}/${seasonCircuitIds.length} circuits`,
      );
      if (sectorMissing.length > 0) {
        console.log(
          `  missing sectors: ${sectorMissing
            .map((circuitId) => `${circuitId} (${circuitLabelById.get(circuitId) ?? "unknown"})`)
            .join(", ")}`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
