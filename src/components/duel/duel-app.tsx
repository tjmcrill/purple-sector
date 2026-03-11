"use client";

import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

import type {
  CircuitMetadata,
  DriverOption,
  DuelResponse,
  EvolutionEntry,
  EvolutionResponse,
  RandomDuelPick,
} from "@/types/f1";

import { EvolutionChart } from "@/components/evolution/evolution-chart";
import { HeadToHead } from "./head-to-head";
import { Leaderboard } from "./leaderboard";
import { SelectorPanel } from "./selector-panel";
import { TrackMap } from "./track-map";
import { WeatherPanel } from "./weather-panel";

type DuelSelection = {
  circuitId: string;
  driverA: string;
  driverB: string;
  season: string;
  driverASeasonOverride?: string | null;
  driverBSeasonOverride?: string | null;
};

export function DuelApp() {
  const [circuits, setCircuits] = useState<CircuitMetadata[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedCircuitId, setSelectedCircuitId] = useState("");
  const [selectedDriverA, setSelectedDriverA] = useState("");
  const [selectedDriverB, setSelectedDriverB] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("2026");
  const [driverASeasonOverride, setDriverASeasonOverride] = useState<string | null>(null);
  const [driverBSeasonOverride, setDriverBSeasonOverride] = useState<string | null>(null);
  const [duel, setDuel] = useState<DuelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [evolution, setEvolution] = useState<EvolutionResponse | null>(null);
  const [evolutionLoading, setEvolutionLoading] = useState(false);
  const [shareLabel, setShareLabel] = useState("Copy link");
  const [error, setError] = useState<string | null>(null);
  const initialLoadHandled = useRef(false);
  const shareResetRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setBootstrapping(true);
      try {
        const [circuitResponse, driverResponse] = await Promise.all([
          fetch("/api/metadata/circuits"),
          fetch("/api/metadata/drivers"),
        ]);

        if (!circuitResponse.ok || !driverResponse.ok) {
          throw new Error(
            "Metadata is unavailable. Run the seed scripts after applying the Supabase migration.",
          );
        }

        const [circuitData, driverData] = await Promise.all([
          circuitResponse.json() as Promise<CircuitMetadata[]>,
          driverResponse.json() as Promise<DriverOption[]>,
        ]);

        if (cancelled) {
          return;
        }

        setCircuits(circuitData);
        setDrivers(driverData);
        setSelectedCircuitId(circuitData[0]?.circuit_id ?? "");
        const findDriver = (id: string) => driverData.find((d) => d.driver_id === id);
        setSelectedDriverA(findDriver("norris")?.driver_id ?? driverData[0]?.driver_id ?? "");
        setSelectedDriverB(findDriver("leclerc")?.driver_id ?? driverData[1]?.driver_id ?? "");
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : "Unable to load metadata.",
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

  function clearSeasonOverrides() {
    setDriverASeasonOverride(null);
    setDriverBSeasonOverride(null);
  }

  function handleCircuitChange(value: string) {
    clearSeasonOverrides();
    setSelectedCircuitId(value);
  }

  function handleDriverAChange(value: string) {
    clearSeasonOverrides();
    setSelectedDriverA(value);
  }

  function handleDriverBChange(value: string) {
    clearSeasonOverrides();
    setSelectedDriverB(value);
  }

  function handleSeasonChange(value: string) {
    clearSeasonOverrides();
    setSelectedSeason(value);
  }

  function clearUrl() {
    window.history.replaceState(null, "", window.location.pathname);
  }

  function buildShareUrl(selection: DuelSelection) {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set("circuitId", selection.circuitId);
    url.searchParams.set("driverA", selection.driverA);
    url.searchParams.set("driverB", selection.driverB);

    if (selection.season.trim()) {
      url.searchParams.set("season", selection.season.trim());
    }
    if (selection.driverASeasonOverride) {
      url.searchParams.set("driverASeason", selection.driverASeasonOverride);
    }
    if (selection.driverBSeasonOverride) {
      url.searchParams.set("driverBSeason", selection.driverBSeasonOverride);
    }

    return url.toString();
  }

  async function runDuelWithSelection(selection: DuelSelection) {
    if (!selection.circuitId || !selection.driverA || !selection.driverB) {
      return;
    }

    setSelectedCircuitId(selection.circuitId);
    setSelectedDriverA(selection.driverA);
    setSelectedDriverB(selection.driverB);
    setSelectedSeason(selection.season);
    setDriverASeasonOverride(selection.driverASeasonOverride ?? null);
    setDriverBSeasonOverride(selection.driverBSeasonOverride ?? null);
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        circuitId: selection.circuitId,
        driverA: selection.driverA,
        driverB: selection.driverB,
      });

      if (selection.season.trim()) {
        params.set("season", selection.season.trim());
      }
      if (selection.driverASeasonOverride) {
        params.set("driverASeason", selection.driverASeasonOverride);
      }
      if (selection.driverBSeasonOverride) {
        params.set("driverBSeason", selection.driverBSeasonOverride);
      }

      const response = await fetch(`/api/duel?${params.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Duel request failed.");
      }

      const payload = (await response.json()) as DuelResponse;
      startTransition(() => {
        setDuel(payload);
      });
    } catch (duelError) {
      setError(duelError instanceof Error ? duelError.message : "Duel request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runDuel() {
    await runDuelWithSelection({
      circuitId: selectedCircuitId,
      driverA: selectedDriverA,
      driverB: selectedDriverB,
      season: selectedSeason,
      driverASeasonOverride,
      driverBSeasonOverride,
    });
  }

  async function runRandomDuel() {
    setRandomLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/random-duel?mode=random");
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Random duel request failed.");
      }

      const pick = (await response.json()) as RandomDuelPick;
      await runDuelWithSelection({
        circuitId: pick.circuitId,
        driverA: pick.driverA,
        driverB: pick.driverB,
        season: String(pick.season),
      });
    } catch (randomError) {
      setError(
        randomError instanceof Error ? randomError.message : "Random duel request failed.",
      );
    } finally {
      setRandomLoading(false);
    }
  }

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(
        buildShareUrl({
          circuitId: selectedCircuitId,
          driverA: selectedDriverA,
          driverB: selectedDriverB,
          season: selectedSeason,
          driverASeasonOverride,
          driverBSeasonOverride,
        }),
      );
      setShareLabel("Copied");
    } catch {
      setShareLabel("Failed");
    }

    if (shareResetRef.current) {
      window.clearTimeout(shareResetRef.current);
    }

    shareResetRef.current = window.setTimeout(() => {
      setShareLabel("Copy link");
    }, 1600);
  }

  async function duelEvolutionEntry(entry: EvolutionEntry) {
    if (!duel?.circuitRecord) {
      return;
    }

    await runDuelWithSelection({
      circuitId: duel.circuit.circuit_id,
      driverA: entry.driverId,
      driverB: duel.circuitRecord.driver_id,
      season: String(entry.season),
      driverASeasonOverride: String(entry.season),
      driverBSeasonOverride: String(duel.circuitRecord.season),
    });
  }

  const runInitialDuel = useEffectEvent((selection: DuelSelection) => {
    void runDuelWithSelection(selection);
  });

  useEffect(() => {
    return () => {
      if (shareResetRef.current) {
        window.clearTimeout(shareResetRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (bootstrapping || initialLoadHandled.current || circuits.length === 0 || drivers.length === 0) {
      return;
    }

    initialLoadHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const circuitId = params.get("circuitId");
    const driverA = params.get("driverA");
    const driverB = params.get("driverB");
    const season = params.get("season") ?? "";
    const driverASeason = params.get("driverASeason");
    const driverBSeason = params.get("driverBSeason");

    if (!circuitId || !driverA || !driverB) {
      return;
    }

    const circuitExists = circuits.some((circuit) => circuit.circuit_id === circuitId);
    const driversExist =
      drivers.some((driver) => driver.driver_id === driverA) &&
      drivers.some((driver) => driver.driver_id === driverB);

    if (!circuitExists || !driversExist) {
      return;
    }

    clearUrl();
    runInitialDuel({
      circuitId,
      driverA,
      driverB,
      season,
      driverASeasonOverride: driverASeason,
      driverBSeasonOverride: driverBSeason,
    });
  }, [bootstrapping, circuits, drivers]);

  useEffect(() => {
    if (!duel) {
      setEvolution(null);
      return;
    }

    const circuitId = duel.circuit.circuit_id;
    let cancelled = false;

    async function fetchEvolution() {
      setEvolutionLoading(true);
      try {
        const response = await fetch(`/api/evolution?circuitId=${circuitId}`);
        if (!response.ok) {
          throw new Error("Evolution data is unavailable.");
        }

        const payload = (await response.json()) as EvolutionResponse;
        if (!cancelled) {
          setEvolution(payload);
        }
      } catch {
        if (!cancelled) {
          setEvolution(null);
        }
      } finally {
        if (!cancelled) {
          setEvolutionLoading(false);
        }
      }
    }

    void fetchEvolution();
    return () => {
      cancelled = true;
    };
  }, [duel]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <SelectorPanel
        circuits={circuits}
        drivers={drivers}
        selectedCircuitId={selectedCircuitId}
        selectedDriverA={selectedDriverA}
        selectedDriverB={selectedDriverB}
        selectedSeason={selectedSeason}
        duel={duel}
        loading={loading}
        randomLoading={randomLoading}
        onCircuitChange={handleCircuitChange}
        onDriverAChange={handleDriverAChange}
        onDriverBChange={handleDriverBChange}
        onSeasonChange={handleSeasonChange}
        onSubmit={runDuel}
        onRandomDuel={runRandomDuel}
      />

      {error ? (
        <p className="text-center text-sm text-red-400">{error}</p>
      ) : null}

      {bootstrapping ? (
        <p className="text-center text-sm text-[#666666]">Loading circuits and drivers…</p>
      ) : null}

      {loading && !duel ? (
        <div className="flex items-center justify-center rounded-[24px] border border-[#2a2a2a] bg-[#111111] sm:rounded-[28px]">
          <div className="h-[42svh] min-h-[260px] w-full animate-pulse rounded-[24px] bg-[#161616] sm:h-[48vh] sm:min-h-[320px]" />
        </div>
      ) : null}

      {!bootstrapping && !duel && !loading && !error ? (
        <p className="text-center text-sm text-[#555555]">
          Select drivers and a circuit to begin.
        </p>
      ) : null}

      {duel ? (
        <div className="space-y-6">
          <HeadToHead
            duel={duel}
            drivers={drivers}
            onShare={copyShareUrl}
            shareLabel={shareLabel}
          />
          {duel.weather ? <WeatherPanel weather={duel.weather} /> : null}
          <TrackMap duel={duel} drivers={drivers} />
          <Leaderboard duel={duel} drivers={drivers} />
          {evolutionLoading && !evolution ? (
            <div className="rounded-[22px] border border-[#232323] bg-[#141414] px-4 py-8 text-center text-sm text-[#666666] sm:rounded-[24px]">
              Loading lap evolution…
            </div>
          ) : null}
          {evolution ? (
            <EvolutionChart
              evolution={evolution}
              selectedSeason={duel.selectedSeason}
              onSelectSeason={duelEvolutionEntry}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
