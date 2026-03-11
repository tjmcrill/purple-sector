import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enrichCircuitSeason, ensureCircuitBackfilled } from "@/lib/server/backfill";
import { ensureWeatherCached } from "@/lib/server/weather";
import type {
  CircuitMetadata,
  DuelResponse,
  EvolutionResponse,
  LapTimeRecord,
  RandomDuelPick,
  TeammateBattleResult,
  TeammateOption,
} from "@/types/f1";

const LAP_SELECT =
  "id, driver_id, driver_name, circuit_id, season, team, lap_time_ms, lap_time_display, sector_1_ms, sector_2_ms, sector_3_ms";
const CIRCUIT_SELECT =
  "circuit_id, name, country, country_code, svg_path, viewbox, length_km, sector_markers, start_finish_t";
const FEATURE_MIN_SEASON = 2021;
const FEATURE_MAX_SEASON = 2026;

type CircuitSummary = {
  circuit_id: string;
  name: string;
  country_code: string;
};

type MinimalLapRow = {
  driver_id: string;
  driver_name: string;
  circuit_id: string;
  season: number;
  team: string;
  lap_time_ms: number;
  lap_time_display: string;
};

async function getCircuit(circuitId: string): Promise<CircuitMetadata | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("circuits")
    .select(CIRCUIT_SELECT)
    .eq("circuit_id", circuitId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    ...data,
    has_markers: Boolean(data.sector_markers || data.start_finish_t !== null),
  };
}

async function getDriverLap(
  circuitId: string,
  driverId: string,
  season: number | null,
): Promise<LapTimeRecord | null> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("lap_times")
    .select(LAP_SELECT)
    .eq("circuit_id", circuitId)
    .eq("driver_id", driverId);

  if (season !== null) {
    query = query.eq("season", season);
  } else {
    query = query.order("lap_time_ms", { ascending: true }).order("season", {
      ascending: false,
    });
  }

  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    throw error;
  }

  return data;
}

async function getLeaderboard(circuitId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lap_times")
    .select(LAP_SELECT)
    .eq("circuit_id", circuitId)
    .order("lap_time_ms", { ascending: true })
    .limit(10);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getCircuits() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("circuits")
    .select(CIRCUIT_SELECT)
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((circuit) => ({
    ...circuit,
    has_markers: Boolean(circuit.sector_markers || circuit.start_finish_t !== null),
  }));
}

export async function getDrivers() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("drivers")
    .select("driver_id, driver_name, code, nationality")
    .order("driver_name", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function getCircuitSummariesById() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("circuits")
    .select("circuit_id, name, country_code");

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((row) => [row.circuit_id, row satisfies CircuitSummary]),
  );
}

async function getFeatureLapTimes(): Promise<MinimalLapRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lap_times")
    .select(
      "driver_id, driver_name, circuit_id, season, team, lap_time_ms, lap_time_display",
    )
    .gte("season", FEATURE_MIN_SEASON)
    .lte("season", FEATURE_MAX_SEASON);

  if (error) {
    throw error;
  }

  return data ?? [];
}

function hashValue(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export async function getDuelData(params: {
  circuitId: string;
  driverAId: string;
  driverBId: string;
  season: number | null;
  driverASeason: number | null;
  driverBSeason: number | null;
}): Promise<DuelResponse | null> {
  const { circuitId, driverAId, driverBId, season, driverASeason, driverBSeason } = params;

  await ensureCircuitBackfilled(circuitId);

  const seasonsToEnrich = [...new Set([driverASeason, driverBSeason].filter((value) => value !== null))];
  for (const seasonToEnrich of seasonsToEnrich) {
    await enrichCircuitSeason(circuitId, seasonToEnrich);
  }

  const [circuit, driverA, driverB, leaderboard, weather] = await Promise.all([
    getCircuit(circuitId),
    getDriverLap(circuitId, driverAId, driverASeason),
    getDriverLap(circuitId, driverBId, driverBSeason),
    getLeaderboard(circuitId),
    season !== null && driverASeason === driverBSeason && driverASeason === season
      ? ensureWeatherCached(circuitId, season)
      : Promise.resolve(null),
  ]);

  if (!circuit || !driverA || !driverB) {
    return null;
  }

  return {
    circuit,
    selectedSeason: season,
    bestAcrossSeasons: season === null,
    driverA,
    driverB,
    leaderboardTop10: leaderboard,
    circuitRecord: leaderboard[0] ?? null,
    sectorDataAvailable: Boolean(
      driverA.sector_1_ms !== null &&
        driverA.sector_2_ms !== null &&
        driverA.sector_3_ms !== null &&
        driverB.sector_1_ms !== null &&
        driverB.sector_2_ms !== null &&
        driverB.sector_3_ms !== null,
    ),
    weather,
  };
}

export async function getCircuitEvolution(
  circuitId: string,
): Promise<EvolutionResponse | null> {
  await ensureCircuitBackfilled(circuitId);

  const [circuit, rows] = await Promise.all([
    getCircuit(circuitId),
    createSupabaseAdminClient()
      .from("lap_times")
      .select(
        "driver_id, driver_name, circuit_id, season, team, lap_time_ms, lap_time_display",
      )
      .eq("circuit_id", circuitId)
      .gte("season", FEATURE_MIN_SEASON)
      .lte("season", FEATURE_MAX_SEASON)
      .order("season", { ascending: true })
      .order("lap_time_ms", { ascending: true }),
  ]);

  if (!circuit) {
    return null;
  }

  if (rows.error) {
    throw rows.error;
  }

  const bestBySeason = new Map<number, MinimalLapRow>();
  for (const row of rows.data ?? []) {
    if (!bestBySeason.has(row.season)) {
      bestBySeason.set(row.season, row);
    }
  }

  const entries = [...bestBySeason.values()].map((row) => ({
    season: row.season,
    driverId: row.driver_id,
    driverName: row.driver_name,
    team: row.team,
    lapTimeMs: row.lap_time_ms,
    lapTimeDisplay: row.lap_time_display,
  }));

  if (entries.length === 0) {
    return null;
  }

  return {
    circuitId,
    circuitName: circuit.name,
    entries,
  };
}

export async function getRandomDuel(
  mode: "random" | "dotd",
): Promise<RandomDuelPick | null> {
  const rows = await getFeatureLapTimes();
  const groups = new Map<string, MinimalLapRow[]>();

  for (const row of rows) {
    const key = `${row.circuit_id}:${row.season}`;
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const candidates: RandomDuelPick[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.lap_time_ms - b.lap_time_ms);
    for (let index = 0; index < sorted.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < sorted.length; compareIndex += 1) {
        const driverA = sorted[index];
        const driverB = sorted[compareIndex];

        if (driverA.team === driverB.team) {
          continue;
        }

        candidates.push({
          circuitId: driverA.circuit_id,
          driverA: driverA.driver_id,
          driverB: driverB.driver_id,
          season: driverA.season,
          gapMs: Math.abs(driverA.lap_time_ms - driverB.lap_time_ms),
        });
      }
    }
  }

  const narrowPool = candidates
    .filter((candidate) => candidate.gapMs < 150)
    .sort((a, b) => a.gapMs - b.gapMs);
  const mediumPool = candidates
    .filter((candidate) => candidate.gapMs < 250)
    .sort((a, b) => a.gapMs - b.gapMs);
  const fallbackPool = [...candidates].sort((a, b) => a.gapMs - b.gapMs);
  const poolSource =
    narrowPool.length > 0 ? narrowPool : mediumPool.length > 0 ? mediumPool : fallbackPool;

  if (poolSource.length === 0) {
    return null;
  }

  const pool = poolSource.slice(0, Math.min(poolSource.length, 48));
  if (mode === "random") {
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  }

  const today = new Date().toISOString().slice(0, 10);
  return (
    [...pool]
      .map((candidate) => ({
        candidate,
        hash: hashValue(
          `${today}:${candidate.circuitId}:${candidate.driverA}:${candidate.driverB}:${candidate.season}`,
        ),
      }))
      .sort((a, b) => a.hash.localeCompare(b.hash) || a.candidate.gapMs - b.candidate.gapMs)[0]
      ?.candidate ?? null
  );
}

export async function getTeammates(driverId: string): Promise<TeammateOption[]> {
  const rows = await getFeatureLapTimes();
  const groups = new Map<string, MinimalLapRow[]>();

  for (const row of rows) {
    const key = `${row.season}:${row.circuit_id}:${row.team}`;
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const teammateMap = new Map<
    string,
    { driverId: string; driverName: string; team: string; seasons: Set<number> }
  >();

  for (const group of groups.values()) {
    if (!group.some((row) => row.driver_id === driverId)) {
      continue;
    }

    for (const row of group) {
      if (row.driver_id === driverId) {
        continue;
      }

      const key = `${row.driver_id}:${row.team}`;
      const existing = teammateMap.get(key);
      if (existing) {
        existing.seasons.add(row.season);
      } else {
        teammateMap.set(key, {
          driverId: row.driver_id,
          driverName: row.driver_name,
          team: row.team,
          seasons: new Set([row.season]),
        });
      }
    }
  }

  return [...teammateMap.values()]
    .map((entry) => ({
      driverId: entry.driverId,
      driverName: entry.driverName,
      team: entry.team,
      seasons: [...entry.seasons].sort((a, b) => a - b),
    }))
    .sort((a, b) => {
      const latestA = a.seasons[a.seasons.length - 1] ?? 0;
      const latestB = b.seasons[b.seasons.length - 1] ?? 0;
      return latestB - latestA || a.driverName.localeCompare(b.driverName);
    });
}

export async function getTeammateBattle(
  driverAId: string,
  driverBId: string,
  season: number | null,
): Promise<TeammateBattleResult | null> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("lap_times")
    .select(
      "driver_id, driver_name, circuit_id, season, team, lap_time_ms, lap_time_display",
    )
    .in("driver_id", [driverAId, driverBId])
    .gte("season", FEATURE_MIN_SEASON)
    .lte("season", FEATURE_MAX_SEASON);

  if (season !== null) {
    query = query.eq("season", season);
  }

  const [{ data, error }, circuitMap] = await Promise.all([
    query,
    getCircuitSummariesById(),
  ]);

  if (error) {
    throw error;
  }

  const groups = new Map<string, MinimalLapRow[]>();
  for (const row of data ?? []) {
    const key = `${row.season}:${row.circuit_id}:${row.team}`;
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const rounds = [...groups.values()]
    .map((group) => {
      const driverA = group.find((row) => row.driver_id === driverAId);
      const driverB = group.find((row) => row.driver_id === driverBId);

      if (!driverA || !driverB) {
        return null;
      }

      const circuit = circuitMap.get(driverA.circuit_id);
      if (!circuit) {
        return null;
      }

      return {
        circuitId: driverA.circuit_id,
        circuitName: circuit.name,
        countryCode: circuit.country_code,
        season: driverA.season,
        team: driverA.team,
        driverATimeMs: driverA.lap_time_ms,
        driverADisplay: driverA.lap_time_display,
        driverBTimeMs: driverB.lap_time_ms,
        driverBDisplay: driverB.lap_time_display,
        gapMs: Math.abs(driverA.lap_time_ms - driverB.lap_time_ms),
        winnerId:
          driverA.lap_time_ms <= driverB.lap_time_ms ? driverA.driver_id : driverB.driver_id,
      };
    })
    .filter((round) => round !== null)
    .sort((a, b) => b.season - a.season || a.circuitName.localeCompare(b.circuitName));

  if (rounds.length === 0) {
    return null;
  }

  const driverAName = (data ?? []).find((row) => row.driver_id === driverAId)?.driver_name;
  const driverBName = (data ?? []).find((row) => row.driver_id === driverBId)?.driver_name;
  const totalGap = rounds.reduce((sum, round) => sum + round.gapMs, 0);
  const averageGapMs = Math.round(totalGap / rounds.length);
  const winsA = rounds.filter((round) => round.winnerId === driverAId).length;
  const winsB = rounds.length - winsA;
  const teams = [...new Set(rounds.map((round) => round.team))];

  return {
    driverA: {
      driverId: driverAId,
      driverName: driverAName ?? driverAId,
      wins: winsA,
      avgGapMs: averageGapMs,
    },
    driverB: {
      driverId: driverBId,
      driverName: driverBName ?? driverBId,
      wins: winsB,
      avgGapMs: averageGapMs,
    },
    team: teams.length === 1 ? teams[0] : "Multiple Teams",
    teams,
    season,
    averageGapMs,
    rounds,
  };
}
