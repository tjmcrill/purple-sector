"use client";

import { useMemo, useState } from "react";

import { getTeamColors } from "@/config/team-colors";
import type { EvolutionEntry, EvolutionResponse } from "@/types/f1";

function barWidth(value: number, min: number, max: number) {
  if (min === max) {
    return 100;
  }

  const normalized = (max - value) / (max - min);
  return 42 + normalized * 58;
}

export function EvolutionChart({
  evolution,
  selectedSeason,
  onSelectSeason,
}: {
  evolution: EvolutionResponse;
  selectedSeason: number | null;
  onSelectSeason: (entry: EvolutionEntry) => void;
}) {
  const [open, setOpen] = useState(
    () =>
      typeof window === "undefined"
        ? false
        : window.matchMedia("(min-width: 768px)").matches,
  );

  const fastestTime = useMemo(
    () => Math.min(...evolution.entries.map((entry) => entry.lapTimeMs)),
    [evolution.entries],
  );
  const slowestTime = useMemo(
    () => Math.max(...evolution.entries.map((entry) => entry.lapTimeMs)),
    [evolution.entries],
  );

  return (
    <section className="rounded-[22px] border border-[#232323] bg-[#141414] sm:rounded-[24px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
      >
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#888888]">
            Lap evolution
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[#f5f5f5]">
            {evolution.circuitName}
          </h3>
        </div>
        <span className="text-sm text-[#888888]">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="border-t border-[#232323] px-3 pb-3 pt-2 sm:px-5 sm:pb-5">
          <div className="space-y-2">
            {evolution.entries.map((entry) => {
              const colors = getTeamColors(entry.team);
              const isRecord = entry.lapTimeMs === fastestTime;
              const isActive = selectedSeason === entry.season;
              return (
                <button
                  key={entry.season}
                  type="button"
                  onClick={() => onSelectSeason(entry)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition hover:bg-[#181818] sm:px-4 ${
                    isActive
                      ? "border-[#3b3b3b] bg-[#191919]"
                      : "border-[#242424] bg-[#111111]"
                  }`}
                >
                  <span className="w-11 shrink-0 font-mono text-sm text-[#f5f5f5]">
                    {entry.season}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: colors.primary }}
                      />
                      <p className="truncate text-sm font-medium text-[#f5f5f5]">
                        {entry.driverName}
                      </p>
                      {isRecord ? (
                        <span className="rounded-full bg-[#A020F0]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d68cff]">
                          Record
                        </span>
                      ) : null}
                    </div>
                    <div className="h-2 rounded-full bg-[#1d1d1d]">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${barWidth(entry.lapTimeMs, fastestTime, slowestTime)}%`,
                          backgroundColor: isRecord ? "#A020F0" : colors.primary,
                        }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-sm text-[#d5d5d5]">
                    {entry.lapTimeDisplay}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] tracking-[0.08em] text-[#666666]">
            Tap a season to duel its pole-sitter.
          </p>
        </div>
      ) : null}
    </section>
  );
}
