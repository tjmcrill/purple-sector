import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enrichCircuitSeason, ensureCircuitBackfilled } from "@/lib/server/backfill";
import type { CircuitMetadata, DuelResponse, LapTimeRecord } from "@/types/f1";

async function getCircuit(circuitId: string): Promise<CircuitMetadata | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("circuits")
    .select(
      "circuit_id, name, country, country_code, svg_path, viewbox, length_km, sector_markers, start_finish_t",
    )
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
    .select(
      "id, driver_id, driver_name, circuit_id, season, team, lap_time_ms, lap_time_display, sector_1_ms, sector_2_ms, sector_3_ms",
    )
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
    .select(
      "id, driver_id, driver_name, circuit_id, season, team, lap_time_ms, lap_time_display, sector_1_ms, sector_2_ms, sector_3_ms",
    )
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
    .select(
      "circuit_id, name, country, country_code, svg_path, viewbox, length_km, sector_markers, start_finish_t",
    )
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

export async function getDuelData(params: {
  circuitId: string;
  driverAId: string;
  driverBId: string;
  season: number | null;
}): Promise<DuelResponse | null> {
  const { circuitId, driverAId, driverBId, season } = params;

  await ensureCircuitBackfilled(circuitId);

  if (season !== null) {
    await enrichCircuitSeason(circuitId, season);
  }

  const [circuit, driverA, driverB, leaderboard] = await Promise.all([
    getCircuit(circuitId),
    getDriverLap(circuitId, driverAId, season),
    getDriverLap(circuitId, driverBId, season),
    getLeaderboard(circuitId),
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
  };
}
