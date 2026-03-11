"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { F1Mark } from "@/components/f1-mark";
import { SearchSelect } from "@/components/ui/search-select";
import { driverFlag } from "@/lib/f1-utils";
import type { DriverOption, TeammateBattleResult, TeammateOption } from "@/types/f1";

import { TeammateBattle } from "./teammate-battle";

type TeammatesResponse = {
  driverId: string;
  teammates: TeammateOption[];
};

type TeammateSelection = TeammateOption & { key: string };

export function TeammatePage() {
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [teammates, setTeammates] = useState<TeammateSelection[]>([]);
  const [selectedTeammateKey, setSelectedTeammateKey] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");
  const [battle, setBattle] = useState<TeammateBattleResult | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loadingTeammates, setLoadingTeammates] = useState(false);
  const [loadingBattle, setLoadingBattle] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTeammate =
    teammates.find((option) => option.key === selectedTeammateKey) ?? null;
  const driverLookup = useMemo(
    () => new Map(drivers.map((driver) => [driver.driver_id, driver])),
    [drivers],
  );

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setBootstrapping(true);
      try {
        const response = await fetch("/api/metadata/drivers");
        if (!response.ok) {
          throw new Error("Unable to load driver list.");
        }

        const payload = (await response.json()) as DriverOption[];
        if (cancelled) {
          return;
        }

        setDrivers(payload);
        setSelectedDriverId(
          payload.find((driver) => driver.driver_id === "norris")?.driver_id ??
            payload[0]?.driver_id ??
            "",
        );
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : "Unable to load driver list.",
          );
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedSeason("");
  }, [selectedTeammateKey]);

  useEffect(() => {
    if (!selectedDriverId) {
      setTeammates([]);
      setSelectedTeammateKey("");
      return;
    }

    let cancelled = false;

    async function fetchTeammates() {
      setLoadingTeammates(true);
      setError(null);
      setBattle(null);

      try {
        const response = await fetch(`/api/teammates?driverId=${selectedDriverId}`);
        if (!response.ok) {
          throw new Error("Unable to load teammates for the selected driver.");
        }

        const payload = (await response.json()) as TeammatesResponse;
        if (cancelled) {
          return;
        }

        const nextTeammates = payload.teammates.map((teammate) => ({
          ...teammate,
          key: `${teammate.driverId}:${teammate.team}`,
        }));

        setTeammates(nextTeammates);
        const nextSelection = nextTeammates[0]?.key ?? "";
        setSelectedTeammateKey(nextSelection);
        setSelectedSeason("");
      } catch (teammatesError) {
        if (!cancelled) {
          setError(
            teammatesError instanceof Error
              ? teammatesError.message
              : "Unable to load teammates.",
          );
          setTeammates([]);
          setSelectedTeammateKey("");
        }
      } finally {
        if (!cancelled) {
          setLoadingTeammates(false);
        }
      }
    }

    void fetchTeammates();
    return () => {
      cancelled = true;
    };
  }, [selectedDriverId]);

  async function runBattle() {
    if (!selectedDriverId || !selectedTeammate) {
      return;
    }

    setLoadingBattle(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        driverA: selectedDriverId,
        driverB: selectedTeammate.driverId,
      });

      if (selectedSeason) {
        params.set("season", selectedSeason);
      }

      const response = await fetch(`/api/teammate-battle?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Unable to load teammate battle.");
      }

      const payload = (await response.json()) as TeammateBattleResult;
      setBattle(payload);
    } catch (battleError) {
      setError(
        battleError instanceof Error ? battleError.message : "Unable to load teammate battle.",
      );
      setBattle(null);
    } finally {
      setLoadingBattle(false);
    }
  }

  const driverOptions = drivers.map((driver) => ({
    value: driver.driver_id,
    label: `${driverFlag(driver.nationality)} ${driver.driver_name}`,
    subtitle: driver.code ?? driver.nationality ?? undefined,
  }));
  const teammateOptions = teammates.map((teammate) => {
    const driver = driverLookup.get(teammate.driverId);
    return {
      value: teammate.key,
      label: `${driverFlag(driver?.nationality ?? null)} ${teammate.driverName}`,
      subtitle: `${teammate.team} · ${teammate.seasons.join(", ")}`,
    };
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <F1Mark />
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-full border border-[#2a2a2a] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#cfcfcf] transition hover:border-[#3d3d3d] hover:bg-[#171717]"
        >
          Back to duel
        </Link>
      </div>

      <section className="rounded-[24px] border border-[#232323] bg-[#111111] p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[#888888]">
            Teammate qualifying battles
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#f5f5f5] sm:text-3xl">
            Track intra-team pace across the grid
          </h1>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_120px_152px]">
          <SearchSelect
            label="Driver"
            placeholder="Search driver"
            options={driverOptions}
            value={selectedDriverId}
            onChange={setSelectedDriverId}
          />
          <SearchSelect
            label="Teammate"
            placeholder={loadingTeammates ? "Loading teammates" : "Select teammate"}
            options={teammateOptions}
            value={selectedTeammateKey}
            disabled={loadingTeammates || teammateOptions.length === 0}
            onChange={setSelectedTeammateKey}
          />
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-[#888888]">
              Season
            </label>
            <select
              value={selectedSeason}
              onChange={(event) => setSelectedSeason(event.target.value)}
              className="w-full appearance-none rounded-2xl border border-[#2a2a2a] bg-[#131313] px-4 py-3 text-sm text-[#f5f5f5] outline-none"
            >
              <option value="">All</option>
              {(selectedTeammate?.seasons ?? []).map((season) => (
                <option key={season} value={String(season)}>
                  {season}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={runBattle}
            disabled={!selectedDriverId || !selectedTeammate || loadingBattle || bootstrapping}
            className="h-[46px] self-end rounded-xl border border-[#ff2d20] bg-[#ff2d20]/10 px-4 text-[11px] font-bold tracking-[0.18em] text-[#ff2d20] transition hover:bg-[#ff2d20]/20 disabled:cursor-wait disabled:opacity-70"
          >
            {loadingBattle ? "LOADING…" : "LOAD BATTLE"}
          </button>
        </div>
      </section>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      {bootstrapping ? (
        <p className="mt-4 text-sm text-[#666666]">Loading drivers…</p>
      ) : null}
      {!bootstrapping && !error && !battle ? (
        <p className="mt-4 text-sm text-[#666666]">
          Pick a driver and teammate to compare their qualifying record.
        </p>
      ) : null}

      {battle ? <div className="mt-5"><TeammateBattle battle={battle} /></div> : null}
    </main>
  );
}
