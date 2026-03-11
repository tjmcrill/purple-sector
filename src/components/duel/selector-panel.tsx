"use client";

import { CIRCUIT_ALIASES, CIRCUIT_DISPLAY_NAMES } from "@/config/circuit-aliases";
import { getTeamColors } from "@/config/team-colors";
import { driverFlag, flagEmoji } from "@/lib/f1-utils";
import type { DriverOption, DuelResponse, CircuitMetadata } from "@/types/f1";

import { SearchSelect } from "@/components/ui/search-select";

const SEASONS = [2026, 2025, 2024, 2023, 2022, 2021] as const;

type SelectorPanelProps = {
  circuits: CircuitMetadata[];
  drivers: DriverOption[];
  selectedCircuitId: string;
  selectedDriverA: string;
  selectedDriverB: string;
  selectedSeason: string;
  duel: DuelResponse | null;
  loading: boolean;
  randomLoading: boolean;
  onCircuitChange: (value: string) => void;
  onDriverAChange: (value: string) => void;
  onDriverBChange: (value: string) => void;
  onSeasonChange: (value: string) => void;
  onSubmit: () => void;
  onRandomDuel: () => void;
};

export function SelectorPanel({
  circuits,
  drivers,
  selectedCircuitId,
  selectedDriverA,
  selectedDriverB,
  selectedSeason,
  duel,
  loading,
  randomLoading,
  onCircuitChange,
  onDriverAChange,
  onDriverBChange,
  onSeasonChange,
  onSubmit,
  onRandomDuel,
}: SelectorPanelProps) {
  const circuitOptions = circuits.map((circuit) => ({
    value: circuit.circuit_id,
    label: `${flagEmoji(circuit.country_code)} ${CIRCUIT_DISPLAY_NAMES[circuit.circuit_id] ?? circuit.name}`,
    subtitle: circuit.name,
    searchAliases: CIRCUIT_ALIASES[circuit.circuit_id] ?? "",
  }));
  const driverOptions = drivers.map((driver) => ({
    value: driver.driver_id,
    label: `${driverFlag(driver.nationality)} ${driver.driver_name}`,
    subtitle: driver.code ?? driver.nationality ?? undefined,
  }));

  const driverAColors = getTeamColors(duel?.driverA.team ?? "Mercedes");
  const driverBColors = getTeamColors(duel?.driverB.team ?? "Ferrari");
  const busy = loading || randomLoading;

  return (
    <section className="relative rounded-2xl border border-[#2a2a2a] bg-[#111111] p-3 shadow-lg sm:rounded-[24px] sm:p-4">
      <div className="grid items-end gap-3 lg:grid-cols-[1fr_1fr_1fr_100px_168px]">
        <SearchSelect
          label="Driver A"
          placeholder="Search driver"
          options={driverOptions}
          value={selectedDriverA}
          accentColor={driverAColors.primary}
          onChange={onDriverAChange}
        />
        <SearchSelect
          label="Driver B"
          placeholder="Search driver"
          options={driverOptions}
          value={selectedDriverB}
          accentColor={driverBColors.primary}
          onChange={onDriverBChange}
        />
        <SearchSelect
          label="Circuit"
          placeholder="Search circuit"
          options={circuitOptions}
          value={selectedCircuitId}
          onChange={onCircuitChange}
        />
        <div>
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-[#888888]">
            Season
          </label>
          <select
            value={selectedSeason}
            onChange={(event) => onSeasonChange(event.target.value)}
            className="w-full appearance-none rounded-2xl border border-[#2a2a2a] bg-[#131313] px-4 py-3 text-base text-[#f5f5f5] outline-none sm:text-sm"
          >
            <option value="">All</option>
            {SEASONS.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy}
            className="flex h-[46px] w-full items-center justify-center self-end rounded-xl border border-[#ff2d20] bg-[#ff2d20]/10 text-[11px] font-bold tracking-[0.2em] text-[#ff2d20] transition hover:bg-[#ff2d20]/20 disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? <span className="start-spinner" /> : "START"}
          </button>
          <button
            type="button"
            onClick={onRandomDuel}
            disabled={busy}
            className="h-[42px] rounded-xl border border-[#2f2f2f] bg-[#161616] px-4 text-[11px] font-semibold tracking-[0.18em] text-[#d5d5d5] transition hover:border-[#444444] hover:bg-[#1b1b1b] disabled:cursor-wait disabled:opacity-70"
          >
            {randomLoading ? "LOADING…" : "SURPRISE ME"}
          </button>
        </div>
      </div>
      <p className="mt-2 text-center text-[10px] tracking-wide text-[#555555]">
        Qualifying data from 2021–2026
      </p>
    </section>
  );
}
