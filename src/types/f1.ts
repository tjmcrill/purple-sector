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

export type DuelResponse = {
  circuit: CircuitMetadata;
  selectedSeason: number | null;
  bestAcrossSeasons: boolean;
  driverA: LapTimeRecord;
  driverB: LapTimeRecord;
  leaderboardTop10: LapTimeRecord[];
  circuitRecord: LapTimeRecord | null;
  sectorDataAvailable: boolean;
};
