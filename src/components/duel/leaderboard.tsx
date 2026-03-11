"use client";

import { useState } from "react";

import { getTeamColors } from "@/config/team-colors";
import { driverFlag } from "@/lib/f1-utils";
import type { DriverOption, DuelResponse } from "@/types/f1";

export function Leaderboard({ duel, drivers }: { duel: DuelResponse; drivers: DriverOption[] }) {
  const [open, setOpen] = useState(
    () =>
      typeof window === "undefined"
        ? true
        : window.matchMedia("(min-width: 768px)").matches,
  );

  return (
    <section className="rounded-[22px] border border-[#232323] bg-[#151515] sm:rounded-[24px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-4 text-left sm:px-5"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#888888]">
            Historical leaderboard
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[#f5f5f5]">
            Top 10 qualifying laps
          </h3>
        </div>
        <span className="text-sm text-[#888888]">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="border-t border-[#232323] px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
          <div className="hidden grid-cols-[44px_1fr_100px_72px] gap-3 px-2 py-2 text-xs uppercase tracking-[0.2em] text-[#666666] md:grid">
            <span>Pos</span>
            <span>Driver</span>
            <span>Lap</span>
            <span>Year</span>
          </div>
          {duel.leaderboardTop10.map((row, index) => {
            const selected =
              row.driver_id === duel.driverA.driver_id ||
              row.driver_id === duel.driverB.driver_id;
            const colors = getTeamColors(row.team);

            return (
              <div
                key={`${row.driver_id}-${row.season}`}
                className={`grid gap-2 rounded-2xl px-3 py-3 md:grid-cols-[44px_1fr_100px_72px] md:gap-3 md:px-2 ${
                  selected ? "bg-[#191919]" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 md:contents">
                  <span className="text-sm font-semibold text-[#888888]">
                    #{index + 1}
                  </span>
                  <span className="font-mono text-sm text-[#f5f5f5] md:hidden">
                    {row.lap_time_display}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: colors.primary }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#f5f5f5]">
                      {driverFlag(drivers.find((d) => d.driver_id === row.driver_id)?.nationality ?? null)} {row.driver_name}
                    </p>
                    <p className="truncate text-xs text-[#888888]">{row.team}</p>
                  </div>
                </div>
                <span className="hidden font-mono text-sm text-[#f5f5f5] md:block">
                  {row.lap_time_display}
                </span>
                <span className="text-sm text-[#888888]">{row.season}</span>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
