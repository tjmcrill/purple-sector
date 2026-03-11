import { getTeamColors } from "@/config/team-colors";
import type { DuelResponse, LapTimeRecord } from "@/types/f1";

function formatSector(ms: number | null) {
  if (ms === null) {
    return "--";
  }

  return `${(ms / 1000).toFixed(3)}s`;
}

function SectorRow({
  label,
  a,
  b,
}: {
  label: string;
  a: number | null;
  b: number | null;
}) {
  const max = Math.max(a ?? 0, b ?? 0, 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.22em] text-[#888888]">
        <span>{label}</span>
        <span>
          {formatSector(a)} / {formatSector(b)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-2 rounded-full bg-[#202020]">
          <div
            className="h-2 rounded-full bg-[#f5f5f5]"
            style={{ width: `${((a ?? 0) / max) * 100}%` }}
          />
        </div>
        <div className="h-2 rounded-full bg-[#202020]">
          <div
            className="h-2 rounded-full bg-[#888888]"
            style={{ width: `${((b ?? 0) / max) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function DriverCard({ lap }: { lap: LapTimeRecord }) {
  const colors = getTeamColors(lap.team);

  return (
    <article className="rounded-[22px] border border-[#232323] bg-[linear-gradient(180deg,_rgba(255,255,255,0.035),_rgba(255,255,255,0.015))] p-4 sm:rounded-[24px] sm:p-5">
      <div
        className="mb-4 h-1.5 rounded-full"
        style={{ background: colors.primary }}
      />
      <p className="text-xs uppercase tracking-[0.24em] text-[#888888]">{lap.team}</p>
      <h3 className="mt-2 text-xl font-semibold text-[#f5f5f5] sm:text-2xl">
        {lap.driver_name}
      </h3>
      <p className="mt-4 font-mono text-3xl tabular-nums text-[#f5f5f5] sm:text-4xl">
        {lap.lap_time_display}
      </p>
      <p className="mt-1 text-sm text-[#888888]">Season {lap.season}</p>
    </article>
  );
}

export function StatsPanel({ duel }: { duel: DuelResponse }) {
  const aIsFaster = duel.driverA.lap_time_ms <= duel.driverB.lap_time_ms;
  const winner = aIsFaster ? duel.driverA : duel.driverB;
  const deltaMs = Math.abs(duel.driverA.lap_time_ms - duel.driverB.lap_time_ms);
  const winnerColors = getTeamColors(winner.team);

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="grid gap-4 md:grid-cols-2">
        <DriverCard lap={duel.driverA} />
        <DriverCard lap={duel.driverB} />
      </div>

      <aside className="rounded-[22px] border border-[#232323] bg-[linear-gradient(180deg,_rgba(255,255,255,0.035),_rgba(255,255,255,0.015))] p-4 sm:rounded-[24px] sm:p-5">
        <span
          className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]"
          style={{
            background: `${winnerColors.primary}20`,
            color: winnerColors.primary,
          }}
        >
          Winner
        </span>
        <p className="mt-4 text-xs uppercase tracking-[0.24em] text-[#888888]">
          Delta
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-[#f5f5f5] sm:text-3xl">
          {winner.driver_name} {(deltaMs / 1000).toFixed(3)}s faster
        </h3>
        {duel.circuitRecord ? (
          <p className="mt-3 text-sm text-[#888888]">
            Circuit record: {duel.circuitRecord.driver_name} in{" "}
            {duel.circuitRecord.lap_time_display} ({duel.circuitRecord.season})
          </p>
        ) : null}

        {duel.sectorDataAvailable ? (
          <div className="mt-6 space-y-4">
            <SectorRow
              label="Sector 1"
              a={duel.driverA.sector_1_ms}
              b={duel.driverB.sector_1_ms}
            />
            <SectorRow
              label="Sector 2"
              a={duel.driverA.sector_2_ms}
              b={duel.driverB.sector_2_ms}
            />
            <SectorRow
              label="Sector 3"
              a={duel.driverA.sector_3_ms}
              b={duel.driverB.sector_3_ms}
            />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-[#232323] bg-[#121212] px-4 py-4 text-sm text-[#888888]">
            Sector splits are only available when OpenF1 enrichment exists for the selected
            season.
          </div>
        )}
      </aside>
    </section>
  );
}
