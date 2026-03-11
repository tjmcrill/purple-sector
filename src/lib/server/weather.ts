import "server-only";

import { fetchSessionWeather, type OpenF1WeatherSample } from "@/lib/api/openf1";
import { resolveQualifyingSession } from "@/lib/server/backfill";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WeatherConditions } from "@/types/f1";

type SessionWeatherRow = {
  air_temp_c: number;
  track_temp_c: number;
  humidity_pct: number;
  wind_speed_ms: number;
  wind_direction_deg: number;
  rainfall: boolean;
  pressure_mbar: number | null;
  sampled_at: string | null;
};

const SESSION_WEATHER_SELECT =
  "air_temp_c, track_temp_c, humidity_pct, wind_speed_ms, wind_direction_deg, rainfall, pressure_mbar, sampled_at";

function mapWeatherRow(row: SessionWeatherRow): WeatherConditions {
  return {
    airTempC: Number(row.air_temp_c),
    trackTempC: Number(row.track_temp_c),
    humidityPct: Number(row.humidity_pct),
    windSpeedMs: Number(row.wind_speed_ms),
    windDirectionDeg: Number(row.wind_direction_deg),
    rainfall: Boolean(row.rainfall),
    pressureMbar:
      row.pressure_mbar === null ? null : Number(row.pressure_mbar),
    sampledAt: row.sampled_at,
  };
}

function summarizeWeather(samples: OpenF1WeatherSample[]) {
  if (samples.length === 0) {
    return null;
  }

  const ordered = [...samples].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const representative = ordered[Math.floor(ordered.length / 2)];

  return {
    air_temp_c: representative.air_temperature,
    track_temp_c: representative.track_temperature,
    humidity_pct: representative.humidity,
    wind_speed_ms: representative.wind_speed,
    wind_direction_deg: representative.wind_direction,
    rainfall: ordered.some((sample) => sample.rainfall > 0),
    pressure_mbar: representative.pressure ?? null,
    sampled_at: representative.date,
  };
}

export async function ensureWeatherCached(
  circuitId: string,
  season: number,
): Promise<WeatherConditions | null> {
  if (season < 2023) {
    return null;
  }

  const supabase = createSupabaseAdminClient();
  const { data: cached, error: cacheError } = await supabase
    .from("session_weather")
    .select(SESSION_WEATHER_SELECT)
    .eq("circuit_id", circuitId)
    .eq("season", season)
    .maybeSingle<SessionWeatherRow>();

  if (cacheError) {
    throw cacheError;
  }

  if (cached) {
    return mapWeatherRow(cached);
  }

  const session = await resolveQualifyingSession(circuitId, season);
  if (!session) {
    return null;
  }

  let samples: OpenF1WeatherSample[];
  try {
    samples = await fetchSessionWeather(session.session_key);
  } catch {
    return null;
  }

  const summary = summarizeWeather(samples);
  if (!summary) {
    return null;
  }

  const payload = {
    circuit_id: circuitId,
    season,
    session_key: session.session_key,
    ...summary,
  };

  const { error: upsertError } = await supabase
    .from("session_weather")
    .upsert(payload, { onConflict: "circuit_id,season" });

  if (upsertError) {
    throw upsertError;
  }

  return mapWeatherRow(summary);
}
