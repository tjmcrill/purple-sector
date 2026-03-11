"use client";

import { startTransition, useEffect, useState } from "react";

import type { CircuitMetadata, DriverOption, DuelResponse } from "@/types/f1";

import { HeadToHead } from "./head-to-head";
import { Leaderboard } from "./leaderboard";
import { SelectorPanel } from "./selector-panel";
import { TrackMap } from "./track-map";

export function DuelApp() {
  const [circuits, setCircuits] = useState<CircuitMetadata[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [selectedCircuitId, setSelectedCircuitId] = useState("");
  const [selectedDriverA, setSelectedDriverA] = useState("");
  const [selectedDriverB, setSelectedDriverB] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("2026");
  const [duel, setDuel] = useState<DuelResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setSelectedDriverA(findDriver("max_verstappen")?.driver_id ?? driverData[0]?.driver_id ?? "");
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

  const canSubmit = selectedCircuitId && selectedDriverA && selectedDriverB;

  async function runDuel() {
    if (!canSubmit) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        circuitId: selectedCircuitId,
        driverA: selectedDriverA,
        driverB: selectedDriverB,
      });

      if (selectedSeason.trim()) {
        params.set("season", selectedSeason.trim());
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
        onCircuitChange={setSelectedCircuitId}
        onDriverAChange={setSelectedDriverA}
        onDriverBChange={setSelectedDriverB}
        onSeasonChange={setSelectedSeason}
        onSubmit={runDuel}
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
          <HeadToHead duel={duel} drivers={drivers} />
          <TrackMap duel={duel} drivers={drivers} />
          <Leaderboard duel={duel} drivers={drivers} />
        </div>
      ) : null}
    </div>
  );
}
