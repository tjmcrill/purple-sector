import process from "node:process";
import { pathToFileURL } from "node:url";

import { CIRCUIT_ASSET_MAP } from "./lib/current-circuit-config.mjs";
import {
  fetchJson,
  formatLapTime,
  getSupabaseAdmin,
  loadEnvFile,
  normalizeDriverName,
  parseLapTimeToMs,
  sleep,
} from "./lib/shared.mjs";

loadEnvFile();

const ergastBaseUrl = process.env.ERGAST_BASE_URL;
const openF1BaseUrl = process.env.OPENF1_BASE_URL;

if (!ergastBaseUrl) {
  throw new Error("ERGAST_BASE_URL is required");
}

if (!openF1BaseUrl) {
  throw new Error("OPENF1_BASE_URL is required");
}

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] ?? null;
}

function getBestQualifyingLap(result) {
  const candidates = [result.Q1, result.Q2, result.Q3]
    .map((value) => ({
      display: value,
      ms: parseLapTimeToMs(value),
    }))
    .filter((candidate) => candidate.ms !== null);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, candidate) => {
    if (candidate.ms < best.ms) {
      return candidate;
    }

    return best;
  });
}

export async function backfillCircuitHistory(
  supabase,
  circuitId,
  options = {},
) {
  const { minSeason = null, maxSeason = null } = options;
  const pageSize = 100;
  let offset = 0;
  const lapRows = new Map();
  const driverRows = new Map();

  while (true) {
    const payload = await fetchJson(
      `${ergastBaseUrl}/circuits/${circuitId}/qualifying.json?limit=${pageSize}&offset=${offset}`,
    );
    const races = payload?.MRData?.RaceTable?.Races ?? [];

    for (const race of races) {
      const raceSeason = Number(race.season);
      if (
        (minSeason !== null && raceSeason < minSeason) ||
        (maxSeason !== null && raceSeason > maxSeason)
      ) {
        continue;
      }

      for (const result of race.QualifyingResults ?? []) {
        const bestLap = getBestQualifyingLap(result);
        if (!bestLap) {
          continue;
        }

        const driver = result.Driver;
        const constructor = result.Constructor;
        driverRows.set(driver.driverId, {
          driver_id: driver.driverId,
          driver_name: `${driver.givenName} ${driver.familyName}`,
          code: driver.code ?? null,
          nationality: driver.nationality ?? null,
        });

        const row = {
          driver_id: driver.driverId,
          driver_name: `${driver.givenName} ${driver.familyName}`,
          circuit_id: circuitId,
          season: raceSeason,
          team: constructor.name,
          lap_time_ms: bestLap.ms,
          lap_time_display: bestLap.display ?? formatLapTime(bestLap.ms),
          sector_1_ms: null,
          sector_2_ms: null,
          sector_3_ms: null,
        };

        const key = `${row.driver_id}:${row.circuit_id}:${row.season}`;
        const existing = lapRows.get(key);
        if (!existing || row.lap_time_ms < existing.lap_time_ms) {
          lapRows.set(key, row);
        }
      }
    }

    const total = Number(payload?.MRData?.total ?? races.length);
    offset += pageSize;
    if (offset >= total || races.length === 0) {
      break;
    }
  }

  if (driverRows.size > 0) {
    const { error: driversError } = await supabase
      .from("drivers")
      .upsert([...driverRows.values()], { onConflict: "driver_id" });

    if (driversError) {
      throw driversError;
    }
  }

  const dedupedLapRows = [...lapRows.values()];

  if (dedupedLapRows.length > 0) {
    const { error: lapTimesError } = await supabase
      .from("lap_times")
      .upsert(dedupedLapRows, { onConflict: "driver_id,circuit_id,season" });

    if (lapTimesError) {
      throw lapTimesError;
    }
  }

  console.log(`Backfilled ${dedupedLapRows.length} qualifying rows for ${circuitId}`);
}

async function findOpenF1Session(circuitId, season) {
  const assetConfig = CIRCUIT_ASSET_MAP[circuitId];
  if (!assetConfig?.openF1CircuitName) {
    return null;
  }

  const sessions = await fetchJson(
    `${openF1BaseUrl}/sessions?year=${season}&session_name=Qualifying`,
  );

  return sessions.find((session) => {
    const shortName = session.circuit_short_name?.toLowerCase();
    const location = session.location?.toLowerCase();
    const configuredName = assetConfig.openF1CircuitName.toLowerCase();
    return (
      shortName === configuredName ||
      shortName?.includes(configuredName) ||
      configuredName.includes(shortName ?? "") ||
      location === configuredName ||
      location?.includes(configuredName)
    );
  }) ?? null;
}

export async function enrichCircuitSeason(
  supabase,
  circuitId,
  season,
  options = {},
) {
  const { paceRequests = false } = options;
  if (season < 2023) {
    return;
  }

  const session = await findOpenF1Session(circuitId, season);
  if (!session) {
    console.warn(`No OpenF1 qualifying session found for ${circuitId} ${season}`);
    return;
  }

  if (paceRequests) {
    await sleep(2_100);
  }
  let drivers;
  let laps;
  try {
    drivers = await fetchJson(
      `${openF1BaseUrl}/drivers?session_key=${session.session_key}`,
    );
    if (paceRequests) {
      await sleep(2_100);
    }
    laps = await fetchJson(`${openF1BaseUrl}/laps?session_key=${session.session_key}`);
  } catch (error) {
    console.warn(
      `OpenF1 enrichment unavailable for ${circuitId} ${season}: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return;
  }

  const driverByNumber = new Map(
    drivers.map((driver) => [String(driver.driver_number), driver]),
  );
  const bestLapByDriverId = new Map();

  for (const lap of laps) {
    if (lap.is_pit_out_lap || !lap.lap_duration) {
      continue;
    }

    const driver = driverByNumber.get(String(lap.driver_number));
    if (!driver) {
      continue;
    }

    const lapMs = Math.round(lap.lap_duration * 1_000);
    const driverKey = normalizeDriverName(`${driver.first_name} ${driver.last_name}`);
    const current = bestLapByDriverId.get(driverKey);
    if (!current || lapMs < current.lap_time_ms) {
      bestLapByDriverId.set(driverKey, {
        driver_name: `${driver.first_name} ${driver.last_name}`,
        team: driver.team_name,
        lap_time_ms: lapMs,
        lap_time_display: formatLapTime(lapMs),
        sector_1_ms: lap.duration_sector_1 ? Math.round(lap.duration_sector_1 * 1_000) : null,
        sector_2_ms: lap.duration_sector_2 ? Math.round(lap.duration_sector_2 * 1_000) : null,
        sector_3_ms: lap.duration_sector_3 ? Math.round(lap.duration_sector_3 * 1_000) : null,
      });
    }
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from("lap_times")
    .select("id, driver_name")
    .eq("circuit_id", circuitId)
    .eq("season", season);

  if (fetchError) {
    throw fetchError;
  }

  const updates = [];
  for (const row of existingRows ?? []) {
    const enriched = bestLapByDriverId.get(normalizeDriverName(row.driver_name));

    if (!enriched) {
      continue;
    }

    updates.push({
      id: row.id,
      team: enriched.team,
      lap_time_ms: enriched.lap_time_ms,
      lap_time_display: enriched.lap_time_display,
      sector_1_ms: enriched.sector_1_ms,
      sector_2_ms: enriched.sector_2_ms,
      sector_3_ms: enriched.sector_3_ms,
    });
  }

  if (updates.length === 0) {
    console.warn(`No OpenF1 rows matched existing Supabase laps for ${circuitId} ${season}`);
    return;
  }

  for (const update of updates) {
    const { id, ...payload } = update;
    const { error: updateError } = await supabase
      .from("lap_times")
      .update(payload)
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }
  }

  console.log(`Enriched ${updates.length} rows from OpenF1 for ${circuitId} ${season}`);
}

async function main() {
  const supabase = getSupabaseAdmin();
  const circuitArg = getArg("--circuit");
  const seasonArg = getArg("--season");
  const enrichOnly = process.argv.includes("--enrich-only");
  const circuits = circuitArg ? [circuitArg] : Object.keys(CURRENT_CIRCUIT_ASSET_MAP);

  for (const circuitId of circuits) {
    if (!enrichOnly) {
      await backfillCircuitHistory(supabase, circuitId, { minSeason: 2021 });
    }

    if (seasonArg) {
      await enrichCircuitSeason(supabase, circuitId, Number(seasonArg));
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
