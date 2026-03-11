"use client";

import Link from "next/link";

import { getTeamColors } from "@/config/team-colors";
import { flagEmoji } from "@/lib/f1-utils";
import type { TeammateBattleResult } from "@/types/f1";

function formatGap(ms: number) {
  return `${(ms / 1000).toFixed(3)}s`;
}

export function TeammateBattle({ battle }: { battle: TeammateBattleResult }) {
  const colors = getTeamColors(battle.teams[0] ?? battle.team);

  return (
    <section className="space-y-4">
      <div className="rounded-[24px] border border-[#232323] bg-[linear-gradient(180deg,_rgba(255,255,255,0.045),_rgba(255,255,255,0.015))] p-4 sm:p-5">
        <p className="text-xs uppercase tracking-[0.24em] text-[#888888]">
          Teammate battle
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[#f5f5f5] sm:text-3xl">
              {battle.driverA.driverName} {battle.driverA.wins} - {battle.driverB.wins}{" "}
              {battle.driverB.driverName}
            </h2>
            <p className="mt-2 text-sm text-[#9a9a9a]">
              {battle.team}
              {battle.season !== null ? ` · ${battle.season}` : battle.teams.length > 1 ? " · all seasons" : ""}
            </p>
          </div>
          <div
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: `${colors.primary}40`,
              backgroundColor: `${colors.primary}12`,
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#888888]">
              Average gap
            </p>
            <p className="mt-2 font-mono text-2xl text-[#f5f5f5]">
              {formatGap(battle.averageGapMs)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-[#232323] bg-[#141414]">
        <div className="border-b border-[#232323] px-4 py-4 sm:px-5">
          <h3 className="text-lg font-semibold text-[#f5f5f5]">Circuit breakdown</h3>
        </div>
        <div className="divide-y divide-[#202020]">
          {battle.rounds.map((round) => {
            const aWon = round.winnerId === battle.driverA.driverId;
            return (
              <Link
                key={`${round.season}-${round.circuitId}`}
                href={`/?circuitId=${round.circuitId}&driverA=${battle.driverA.driverId}&driverB=${battle.driverB.driverId}&season=${round.season}`}
                className="block px-4 py-4 transition hover:bg-[#181818] sm:px-5"
              >
                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center">
                  <div>
                    <p className="text-sm font-medium text-[#f5f5f5]">
                      {flagEmoji(round.countryCode)} {round.circuitName}
                    </p>
                    <p className="mt-1 text-xs text-[#777777]">
                      {round.season} · {round.team}
                    </p>
                  </div>
                  <div className={aWon ? "text-[#f5f5f5]" : "text-[#9a9a9a]"}>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                      {battle.driverA.driverName}
                    </p>
                    <p className="mt-1 font-mono text-sm">{round.driverADisplay}</p>
                  </div>
                  <div className={!aWon ? "text-[#f5f5f5]" : "text-[#9a9a9a]"}>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-[#666666]">
                      {battle.driverB.driverName}
                    </p>
                    <p className="mt-1 font-mono text-sm">{round.driverBDisplay}</p>
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="font-mono text-sm text-[#f5f5f5]">+{formatGap(round.gapMs)}</p>
                    <p className="mt-1 text-xs text-[#777777]">Open duel</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
