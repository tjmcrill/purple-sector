"use client";

import { getTeamColors } from "@/config/team-colors";
import { driverFlag } from "@/lib/f1-utils";
import type { DriverOption, DuelResponse } from "@/types/f1";

const PURPLE = "#A020F0";
const YELLOW = "#FFC107";
const GRAY = "#888888";

function formatLap(ms: number) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, "0")}`;
}

function formatSector(ms: number) {
  return (ms / 1000).toFixed(3);
}

function compColor(a: number | null, b: number | null, side: "a" | "b") {
  if (a == null || b == null) return GRAY;
  if (a === b) return GRAY;
  const faster = a < b ? "a" : "b";
  return faster === side ? PURPLE : YELLOW;
}

export function HeadToHead({
  duel,
  drivers,
  onShare,
  shareLabel,
}: {
  duel: DuelResponse;
  drivers: DriverOption[];
  onShare: () => void;
  shareLabel: string;
}) {
  const colorsA = getTeamColors(duel.driverA.team);
  const colorsB = getTeamColors(duel.driverB.team);
  const flagA = driverFlag(drivers.find((d) => d.driver_id === duel.driverA.driver_id)?.nationality ?? null);
  const flagB = driverFlag(drivers.find((d) => d.driver_id === duel.driverB.driver_id)?.nationality ?? null);

  const lapColorA = compColor(duel.driverA.lap_time_ms, duel.driverB.lap_time_ms, "a");
  const lapColorB = compColor(duel.driverA.lap_time_ms, duel.driverB.lap_time_ms, "b");

  const gapMs = Math.abs(duel.driverA.lap_time_ms - duel.driverB.lap_time_ms);
  const gapLabel = `${(gapMs / 1000).toFixed(3)}s`;
  const crossSeason = duel.driverA.season !== duel.driverB.season;

  const sectors: { label: string; aMs: number | null; bMs: number | null }[] = [
    { label: "S1", aMs: duel.driverA.sector_1_ms, bMs: duel.driverB.sector_1_ms },
    { label: "S2", aMs: duel.driverA.sector_2_ms, bMs: duel.driverB.sector_2_ms },
    { label: "S3", aMs: duel.driverA.sector_3_ms, bMs: duel.driverB.sector_3_ms },
  ];

  return (
    <div className="rounded-[20px] border border-[#2a2a2a] bg-[linear-gradient(180deg,_rgba(255,255,255,0.04),_rgba(255,255,255,0.01))] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.3)] sm:rounded-[24px] sm:px-5 sm:py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#888888]">
          Head-to-head
        </p>
        <button
          type="button"
          onClick={onShare}
          className="rounded-full border border-[#252525] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a8a8a8] transition hover:border-[#3a3a3a] hover:bg-[#171717] hover:text-[#f5f5f5]"
        >
          {shareLabel}
        </button>
      </div>

      {/* Main row: Driver A — GAP — Driver B */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {/* Driver A */}
        <div className="flex items-center gap-2">
          <span
            className="h-3 w-1 rounded-full"
            style={{ backgroundColor: colorsA.primary }}
          />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[#f5f5f5] sm:text-sm">
              {flagA} {duel.driverA.driver_name}
            </p>
            {crossSeason ? (
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#666666]">
                {duel.driverA.season}
              </p>
            ) : null}
            <p
              className="font-mono text-base font-bold sm:text-lg"
              style={{ color: lapColorA }}
            >
              {formatLap(duel.driverA.lap_time_ms)}
            </p>
          </div>
        </div>

        {/* Gap */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-wider text-[#666666]">
            Gap
          </span>
          <span className="font-mono text-sm font-bold text-[#f5f5f5]">
            {gapLabel}
          </span>
        </div>

        {/* Driver B */}
        <div className="flex items-center justify-end gap-2">
          <div className="min-w-0 text-right">
            <p className="truncate text-xs font-semibold text-[#f5f5f5] sm:text-sm">
              {flagB} {duel.driverB.driver_name}
            </p>
            {crossSeason ? (
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-[#666666]">
                {duel.driverB.season}
              </p>
            ) : null}
            <p
              className="font-mono text-base font-bold sm:text-lg"
              style={{ color: lapColorB }}
            >
              {formatLap(duel.driverB.lap_time_ms)}
            </p>
          </div>
          <span
            className="h-3 w-1 rounded-full"
            style={{ backgroundColor: colorsB.primary }}
          />
        </div>
      </div>

      {/* Sector breakdown */}
      {duel.sectorDataAvailable ? (
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-2 border-t border-[#1f1f1f] pt-3 sm:gap-4">
          {sectors.map((s) => {
            const colorA = compColor(s.aMs, s.bMs, "a");
            const colorB = compColor(s.aMs, s.bMs, "b");
            return (
              <div key={s.label} className="contents">
                <p
                  className="font-mono text-xs tabular-nums sm:text-sm"
                  style={{ color: colorA }}
                >
                  {s.aMs != null ? formatSector(s.aMs) : "—"}
                </p>
                <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-[#555555]">
                  {s.label}
                </p>
                <p
                  className="text-right font-mono text-xs tabular-nums sm:text-sm"
                  style={{ color: colorB }}
                >
                  {s.bMs != null ? formatSector(s.bMs) : "—"}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
