export type CircuitMetadata = {
  circuit_id: string;
  name: string;
  country: string;
  country_code: string;
  svg_path: string;
  viewbox: string;
  length_km: number | null;
  has_markers: boolean;
};

export type DriverOption = {
  driver_id: string;
  driver_name: string;
  code: string | null;
  nationality: string | null;
};

export type LapTimeRecord = {
  id?: string;
  driver_id: string;
  driver_name: string;
  circuit_id: string;
  season: number;
  team: string;
  lap_time_ms: number;
  lap_time_display: string;
  sector_1_ms: number | null;
  sector_2_ms: number | null;
  sector_3_ms: number | null;
};

export type WeatherConditions = {
  airTempC: number;
  trackTempC: number;
  humidityPct: number;
  windSpeedMs: number;
  windDirectionDeg: number;
  rainfall: boolean;
  pressureMbar: number | null;
  sampledAt: string | null;
};

export type EvolutionEntry = {
  season: number;
  driverId: string;
  driverName: string;
  team: string;
  lapTimeMs: number;
  lapTimeDisplay: string;
};

export type EvolutionResponse = {
  circuitId: string;
  circuitName: string;
  entries: EvolutionEntry[];
};

export type RandomDuelPick = {
  circuitId: string;
  driverA: string;
  driverB: string;
  season: number;
  gapMs: number;
};

export type TeammateOption = {
  driverId: string;
  driverName: string;
  team: string;
  seasons: number[];
};

export type TeammateBattleRound = {
  circuitId: string;
  circuitName: string;
  countryCode: string;
  season: number;
  team: string;
  driverATimeMs: number;
  driverADisplay: string;
  driverBTimeMs: number;
  driverBDisplay: string;
  gapMs: number;
  winnerId: string;
};

export type TeammateBattleResult = {
  driverA: {
    driverId: string;
    driverName: string;
    wins: number;
    avgGapMs: number;
  };
  driverB: {
    driverId: string;
    driverName: string;
    wins: number;
    avgGapMs: number;
  };
  team: string;
  teams: string[];
  season: number | null;
  averageGapMs: number;
  rounds: TeammateBattleRound[];
};

export type DuelResponse = {
  circuit: CircuitMetadata;
  selectedSeason: number | null;
  bestAcrossSeasons: boolean;
  driverA: LapTimeRecord;
  driverB: LapTimeRecord;
  leaderboardTop10: LapTimeRecord[];
  circuitRecord: LapTimeRecord | null;
  sectorDataAvailable: boolean;
  weather: WeatherConditions | null;
};
