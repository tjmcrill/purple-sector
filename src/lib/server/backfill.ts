import "server-only";

import { CURRENT_CIRCUIT_ASSET_MAP } from "@/lib/circuit-config";
import { fetchJolpica } from "@/lib/api/jolpica";
import { fetchOpenF1 } from "@/lib/api/openf1";
import { formatLapTime, normalizeDriverName, parseLapTimeToMs } from "@/lib/f1-utils";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type JolpicaQualifyingResponse = {
  MRData: {
    total: string;
    RaceTable: {
      Races: Array<{
        season: string;
        QualifyingResults: Array<{
          Q1?: string;
          Q2?: string;
          Q3?: string;
          Driver: {
            driverId: string;
            givenName: string;
            familyName: string;
            code?: string;
            nationality?: string;
          };
          Constructor: {
            name: string;
          };
        }>;
      }>;
    };
  };
};

type OpenF1Session = {
  session_key: number;
  session_name: string;
  circuit_short_name: string;
  location?: string;
  year: number;
};

type OpenF1Driver = {
  driver_number: number;
  first_name: string;
  last_name: string;
  team_name: string;
};

type OpenF1Lap = {
  driver_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  is_pit_out_lap: boolean;
};

type DriverSeedRow = {
  driver_id: string;
  driver_name: string;
  code: string | null;
  nationality: string | null;
};

type LapSeedRow = {
  driver_id: string;
  driver_name: string;
  circuit_id: string;
  season: number;
  team: string;
  lap_time_ms: number;
  lap_time_display: string;
  sector_1_ms: null;
  sector_2_ms: null;
  sector_3_ms: null;
};

type BackfillOptions = {
  minSeason?: number;
  maxSeason?: number;
  requestInit?: RequestInit;
};

type RaceResult = JolpicaQualifyingResponse["MRData"]["RaceTable"]["Races"][number];

function getBestQualifyingLap(result: {
  Q1?: string;
  Q2?: string;
  Q3?: string;
}) {
  const candidates = [result.Q1, result.Q2, result.Q3]
    .map((display) => ({
      display: display ?? null,
      ms: parseLapTimeToMs(display),
    }))
    .filter((candidate) => candidate.ms !== null) as Array<{
    display: string | null;
    ms: number;
  }>;

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((best, candidate) =>
    candidate.ms < best.ms ? candidate : best,
  );
}

function collectQualifyingRows(
  circuitId: string,
  races: RaceResult[],
  options: Pick<BackfillOptions, "minSeason" | "maxSeason"> = {},
) {
  const { minSeason, maxSeason } = options;
  const driverRows = new Map<string, DriverSeedRow>();
  const lapRows = new Map<string, LapSeedRow>();

  for (const race of races) {
    const raceSeason = Number(race.season);
    if (
      (typeof minSeason === "number" && raceSeason < minSeason) ||
      (typeof maxSeason === "number" && raceSeason > maxSeason)
    ) {
      continue;
    }

    for (const result of race.QualifyingResults ?? []) {
      const bestLap = getBestQualifyingLap(result);
      if (!bestLap) {
        continue;
      }

      const driverName = `${result.Driver.givenName} ${result.Driver.familyName}`;
      driverRows.set(result.Driver.driverId, {
        driver_id: result.Driver.driverId,
        driver_name: driverName,
        code: result.Driver.code ?? null,
        nationality: result.Driver.nationality ?? null,
      });

      const row = {
        driver_id: result.Driver.driverId,
        driver_name: driverName,
        circuit_id: circuitId,
        season: raceSeason,
        team: result.Constructor.name,
        lap_time_ms: bestLap.ms,
        lap_time_display: bestLap.display ?? formatLapTime(bestLap.ms),
        sector_1_ms: null,
        sector_2_ms: null,
        sector_3_ms: null,
      } satisfies LapSeedRow;

      const key = `${row.driver_id}:${row.circuit_id}:${row.season}`;
      const existing = lapRows.get(key);
      if (!existing || row.lap_time_ms < existing.lap_time_ms) {
        lapRows.set(key, row);
      }
    }
  }

  return {
    driverRows: [...driverRows.values()],
    lapRows: [...lapRows.values()],
  };
}

async function persistQualifyingRows(params: {
  circuitId: string;
  races: RaceResult[];
  minSeason?: number;
  maxSeason?: number;
}) {
  const { circuitId, races, minSeason, maxSeason } = params;
  const supabase = createSupabaseAdminClient();
  const { driverRows, lapRows } = collectQualifyingRows(circuitId, races, {
    minSeason,
    maxSeason,
  });

  if (driverRows.length > 0) {
    const { error: driverError } = await supabase
      .from("drivers")
      .upsert(driverRows, { onConflict: "driver_id" });

    if (driverError) {
      throw driverError;
    }
  }

  if (lapRows.length > 0) {
    const { error: lapError } = await supabase
      .from("lap_times")
      .upsert(lapRows, { onConflict: "driver_id,circuit_id,season" });

    if (lapError) {
      throw lapError;
    }
  }

  return lapRows.length;
}

export async function backfillCircuitHistory(
  circuitId: string,
  options: BackfillOptions = {},
) {
  const pageSize = 100;
  let offset = 0;
  const allRaces: RaceResult[] = [];

  while (true) {
    const payload = await fetchJolpica<JolpicaQualifyingResponse>(
      `/circuits/${circuitId}/qualifying.json?limit=${pageSize}&offset=${offset}`,
      options.requestInit,
    );
    const races = payload.MRData.RaceTable.Races ?? [];
    allRaces.push(...races);

    offset += pageSize;
    if (offset >= Number(payload.MRData.total) || races.length === 0) {
      break;
    }
  }

  return persistQualifyingRows({
    circuitId,
    races: allRaces,
    minSeason: options.minSeason,
    maxSeason: options.maxSeason,
  });
}

export async function backfillCircuitSeason(
  circuitId: string,
  season: number,
  options: Pick<BackfillOptions, "requestInit"> = {},
) {
  const payload = await fetchJolpica<JolpicaQualifyingResponse>(
    `/${season}/circuits/${circuitId}/qualifying.json?limit=100`,
    options.requestInit,
  );

  return persistQualifyingRows({
    circuitId,
    races: payload.MRData.RaceTable.Races ?? [],
    minSeason: season,
    maxSeason: season,
  });
}

export async function ensureCircuitBackfilled(circuitId: string) {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from("lap_times")
    .select("id", { count: "exact", head: true })
    .eq("circuit_id", circuitId);

  if (error) {
    throw error;
  }

  if ((count ?? 0) > 0) {
    return;
  }

  await backfillCircuitHistory(circuitId, { minSeason: 2021 });
}

export async function enrichCircuitSeason(circuitId: string, season: number) {
  if (season < 2023) {
    return;
  }

  const circuitConfig = CURRENT_CIRCUIT_ASSET_MAP[circuitId];
  if (!circuitConfig?.openF1CircuitName) {
    return;
  }

  // Skip enrichment if sector data already exists for this circuit+season
  const supabaseEarly = createSupabaseAdminClient();
  const { count: sectorCount, error: sectorError } = await supabaseEarly
    .from("lap_times")
    .select("id", { count: "exact", head: true })
    .eq("circuit_id", circuitId)
    .eq("season", season)
    .not("sector_1_ms", "is", null);

  if (!sectorError && (sectorCount ?? 0) > 0) {
    return;
  }

  const sessions = await fetchOpenF1<OpenF1Session[]>(
    `/sessions?year=${season}&session_name=Qualifying`,
  );
  const matchingSession = sessions.find((session) => {
    const shortName = session.circuit_short_name.toLowerCase();
    const location = session.location?.toLowerCase();
    const target = circuitConfig.openF1CircuitName?.toLowerCase() ?? "";
    return (
      shortName === target ||
      shortName.includes(target) ||
      target.includes(shortName) ||
      location === target ||
      location?.includes(target)
    );
  });

  if (!matchingSession) {
    return;
  }

  let drivers: OpenF1Driver[];
  let laps: OpenF1Lap[];
  try {
    [drivers, laps] = await Promise.all([
      fetchOpenF1<OpenF1Driver[]>(
        `/drivers?session_key=${matchingSession.session_key}`,
      ),
      fetchOpenF1<OpenF1Lap[]>(`/laps?session_key=${matchingSession.session_key}`),
    ]);
  } catch {
    return;
  }

  const driversByNumber = new Map(
    drivers.map((driver) => [driver.driver_number, driver]),
  );
  const bestLapByDriver = new Map<
    string,
    {
      team: string;
      lap_time_ms: number;
      lap_time_display: string;
      sector_1_ms: number | null;
      sector_2_ms: number | null;
      sector_3_ms: number | null;
    }
  >();

  for (const lap of laps) {
    if (lap.is_pit_out_lap || lap.lap_duration === null) {
      continue;
    }

    const driver = driversByNumber.get(lap.driver_number);
    if (!driver) {
      continue;
    }

    const driverKey = normalizeDriverName(`${driver.first_name} ${driver.last_name}`);
    const lapTimeMs = Math.round(lap.lap_duration * 1_000);
    const currentBest = bestLapByDriver.get(driverKey);

    if (!currentBest || lapTimeMs < currentBest.lap_time_ms) {
      bestLapByDriver.set(driverKey, {
        team: driver.team_name,
        lap_time_ms: lapTimeMs,
        lap_time_display: formatLapTime(lapTimeMs),
        sector_1_ms:
          lap.duration_sector_1 !== null
            ? Math.round(lap.duration_sector_1 * 1_000)
            : null,
        sector_2_ms:
          lap.duration_sector_2 !== null
            ? Math.round(lap.duration_sector_2 * 1_000)
            : null,
        sector_3_ms:
          lap.duration_sector_3 !== null
            ? Math.round(lap.duration_sector_3 * 1_000)
            : null,
      });
    }
  }

  const supabase = createSupabaseAdminClient();
  const { data: existingRows, error: fetchError } = await supabase
    .from("lap_times")
    .select("id, driver_name")
    .eq("circuit_id", circuitId)
    .eq("season", season);

  if (fetchError) {
    throw fetchError;
  }

  const updates: Array<{
    id: string;
    team: string;
    lap_time_ms: number;
    lap_time_display: string;
    sector_1_ms: number | null;
    sector_2_ms: number | null;
    sector_3_ms: number | null;
  }> = [];

  for (const row of existingRows ?? []) {
    if (!row.id) {
      continue;
    }

    const enriched = bestLapByDriver.get(normalizeDriverName(row.driver_name));
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
}
