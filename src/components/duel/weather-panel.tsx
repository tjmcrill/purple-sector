"use client";

import { useState } from "react";

import type { WeatherConditions } from "@/types/f1";

function describeConditions(weather: WeatherConditions) {
  return `${weather.trackTempC.toFixed(0)}°C track, ${weather.rainfall ? "wet" : "dry"}`;
}

function windLabel(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 45) % directions.length];
}

export function WeatherPanel({ weather }: { weather: WeatherConditions }) {
  const [open, setOpen] = useState(
    () =>
      typeof window === "undefined"
        ? false
        : window.matchMedia("(min-width: 768px)").matches,
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
            Track conditions
          </p>
          <p className="mt-1 text-sm text-[#d5d5d5]">{describeConditions(weather)}</p>
        </div>
        <span className="text-sm text-[#888888]">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="grid gap-3 border-t border-[#232323] px-4 pb-4 pt-3 sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-5">
          <div className="rounded-2xl border border-[#242424] bg-[#101010] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#666666]">Air</p>
            <p className="mt-2 font-mono text-2xl text-[#f5f5f5]">{weather.airTempC.toFixed(1)}°</p>
          </div>
          <div className="rounded-2xl border border-[#242424] bg-[#101010] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#666666]">Track</p>
            <p className="mt-2 font-mono text-2xl text-[#f5f5f5]">{weather.trackTempC.toFixed(1)}°</p>
          </div>
          <div className="rounded-2xl border border-[#242424] bg-[#101010] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#666666]">Humidity</p>
            <p className="mt-2 font-mono text-2xl text-[#f5f5f5]">{weather.humidityPct.toFixed(0)}%</p>
          </div>
          <div className="rounded-2xl border border-[#242424] bg-[#101010] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#666666]">Wind</p>
            <div className="mt-2 flex items-center gap-2">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2a2a2a] text-sm text-[#f5f5f5]"
                style={{ transform: `rotate(${weather.windDirectionDeg}deg)` }}
              >
                ↑
              </span>
              <div>
                <p className="font-mono text-lg text-[#f5f5f5]">{weather.windSpeedMs.toFixed(1)} m/s</p>
                <p className="text-xs text-[#777777]">{windLabel(weather.windDirectionDeg)}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#242424] bg-[#101010] px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.24em] text-[#666666]">Surface</p>
            <p
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                weather.rainfall
                  ? "bg-[#1a365d] text-[#7cc7ff]"
                  : "bg-[#1d2a1d] text-[#8ed78e]"
              }`}
            >
              {weather.rainfall ? "Wet" : "Dry"}
            </p>
            {weather.pressureMbar !== null ? (
              <p className="mt-3 text-xs text-[#777777]">
                Pressure {weather.pressureMbar.toFixed(0)} mbar
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
