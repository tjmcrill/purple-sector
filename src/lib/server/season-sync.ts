import "server-only";

import { fetchJolpica } from "@/lib/api/jolpica";
import { backfillCircuitSeason, enrichCircuitSeason } from "@/lib/server/backfill";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type JolpicaRaceScheduleResponse = {
  MRData: {
    RaceTable: {
      season: string;
      Races: Array<{
        season: string;
        round: string;
        raceName: string;
        date: string;
        time?: string;
        Circuit: {
          circuitId: string;
          circuitName: string;
        };
      }>;
    };
  };
};

type LatestRaceSummary = {
  season: number;
  round: number;
  raceName: string;
  circuitId: string;
  circuitName: string;
  raceDateUtc: string;
};

type SyncResult = {
  race: LatestRaceSummary;
  lapRows: number;
  sectorRows: number;
};

function parseRaceDate(date: string, time?: string) {
  return new Date(`${date}T${time ?? "00:00:00Z"}`);
}

async function fetchSeasonRaces(season: number) {
  const payload = await fetchJolpica<JolpicaRaceScheduleResponse>(
    `/${season}/races.json?limit=100`,
    { cache: "no-store" },
  );
  return payload.MRData.RaceTable.Races ?? [];
}

export async function getLatestCompletedRace(now = new Date()) {
  const candidateSeasons = [...new Set([now.getUTCFullYear(), now.getUTCFullYear() - 1])];
  const seasonRaceLists = await Promise.all(candidateSeasons.map(fetchSeasonRaces));

  const completedRaces = seasonRaceLists
    .flat()
    .map((race) => ({
      season: Number(race.season),
      round: Number(race.round),
      raceName: race.raceName,
      circuitId: race.Circuit.circuitId,
      circuitName: race.Circuit.circuitName,
      raceDate: parseRaceDate(race.date, race.time),
    }))
    .filter((race) => Number.isFinite(race.round) && race.raceDate.getTime() <= now.getTime())
    .sort((a, b) => b.raceDate.getTime() - a.raceDate.getTime());

  if (completedRaces.length === 0) {
    return null;
  }

  const latestRace = completedRaces[0];
  return {
    season: latestRace.season,
    round: latestRace.round,
    raceName: latestRace.raceName,
    circuitId: latestRace.circuitId,
    circuitName: latestRace.circuitName,
    raceDateUtc: latestRace.raceDate.toISOString(),
  } satisfies LatestRaceSummary;
}

export async function syncLatestCompletedRace() {
  const race = await getLatestCompletedRace();
  if (!race) {
    throw new Error("No completed races found in Jolpica schedule");
  }

  await backfillCircuitSeason(race.circuitId, race.season, {
    requestInit: { cache: "no-store" },
  });

  if (race.season >= 2023) {
    await enrichCircuitSeason(race.circuitId, race.season);
  }

  const supabase = createSupabaseAdminClient();
  const { count: lapRows, error: lapError } = await supabase
    .from("lap_times")
    .select("id", { count: "exact", head: true })
    .eq("circuit_id", race.circuitId)
    .eq("season", race.season);

  if (lapError) {
    throw lapError;
  }

  const { count: sectorRows, error: sectorError } = await supabase
    .from("lap_times")
    .select("id", { count: "exact", head: true })
    .eq("circuit_id", race.circuitId)
    .eq("season", race.season)
    .not("sector_1_ms", "is", null);

  if (sectorError) {
    throw sectorError;
  }

  return {
    race,
    lapRows: lapRows ?? 0,
    sectorRows: sectorRows ?? 0,
  } satisfies SyncResult;
}
