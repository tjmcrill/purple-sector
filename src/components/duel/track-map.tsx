"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { getTeamColors } from "@/config/team-colors";
import { CIRCUIT_DISPLAY_NAMES } from "@/config/circuit-aliases";
import { driverFlag, flagEmoji } from "@/lib/f1-utils";
import type { DriverOption, DuelResponse } from "@/types/f1";

import { CarSprite } from "./car-sprite";

type AnimatedCarState = {
  x: number;
  y: number;
  angle: number;
  progress: number;
};

function samplePoint(path: SVGPathElement, progress: number, offset = 0) {
  const totalLength = path.getTotalLength();
  const clamped = Math.max(0, Math.min(progress, 1));
  const point = path.getPointAtLength(totalLength * clamped);
  const tangentPoint = path.getPointAtLength(
    Math.min(totalLength, totalLength * clamped + 1),
  );
  const dx = tangentPoint.x - point.x;
  const dy = tangentPoint.y - point.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const angle =
    (Math.atan2(dy, dx) * 180) / Math.PI + 90;

  return {
    x: point.x + (-dy / len) * offset,
    y: point.y + (dx / len) * offset,
    angle,
    progress: clamped,
  };
}

function driverCode(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  return last.slice(0, 3).toUpperCase();
}

function formatGap(ms: number) {
  return `+${(ms / 1000).toFixed(3)}s`;
}

export function TrackMap({ duel, drivers }: { duel: DuelResponse; drivers: DriverOption[] }) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [replayToken, setReplayToken] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [carA, setCarA] = useState<AnimatedCarState | null>(null);
  const [carB, setCarB] = useState<AnimatedCarState | null>(null);
  const [tailA, setTailA] = useState<AnimatedCarState | null>(null);
  const [tailB, setTailB] = useState<AnimatedCarState | null>(null);

  const driverAColors = getTeamColors(duel.driverA.team);
  const driverBColors = getTeamColors(duel.driverB.team);
  const fasterLap = Math.min(duel.driverA.lap_time_ms, duel.driverB.lap_time_ms);
  const slowerLap = Math.max(duel.driverA.lap_time_ms, duel.driverB.lap_time_ms);
  const totalDurationMs = slowerLap;
  const duelKey = `${duel.circuit.circuit_id}-${duel.driverA.driver_id}-${duel.driverB.driver_id}-${duel.selectedSeason ?? "all"}`;

  const startLine = useMemo(() => {
    const path = pathRef.current;
    if (!path) return null;
    const totalLength = path.getTotalLength();
    const p0 = path.getPointAtLength(0);
    const p1 = path.getPointAtLength(Math.min(totalLength, 2));
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const half = 12;
    return {
      x1: p0.x + nx * half,
      y1: p0.y + ny * half,
      x2: p0.x - nx * half,
      y2: p0.y - ny * half,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel.circuit.svg_path, carA]);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) {
      return;
    }

    const startTime = performance.now();
    const durationA = duel.driverA.lap_time_ms;
    const durationB = duel.driverB.lap_time_ms;
    setAnimating(true);

    const step = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const nextCarA = samplePoint(path, elapsed / durationA, 5);
      const nextCarB = samplePoint(path, elapsed / durationB, -5);

      setCarA(nextCarA);
      setCarB(nextCarB);
      setTailA(samplePoint(path, nextCarA.progress - 0.025, 5));
      setTailB(samplePoint(path, nextCarB.progress - 0.025, -5));

      if (elapsed < totalDurationMs) {
        animationFrameRef.current = window.requestAnimationFrame(step);
      } else {
        setAnimating(false);
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [duel, duelKey, fasterLap, replayToken, totalDurationMs]);

  const deltaState = useMemo(() => {
    if (!carA || !carB) {
      return null;
    }

    const leaderIsA = carA.progress >= carB.progress;
    const leadingProgress = leaderIsA ? carA.progress : carB.progress;
    const gapMs = Math.round(
      Math.abs(duel.driverA.lap_time_ms - duel.driverB.lap_time_ms) * leadingProgress,
    );
    const leaderName = leaderIsA ? duel.driverA.driver_name : duel.driverB.driver_name;

    return {
      x: (carA.x + carB.x) / 2,
      y: (carA.y + carB.y) / 2,
      label: `${driverCode(leaderName)} ${formatGap(gapMs)}`,
      color: leaderIsA ? driverAColors.primary : driverBColors.primary,
    };
  }, [carA, carB, duel.driverA.lap_time_ms, duel.driverB.lap_time_ms, duel.driverA.driver_name, duel.driverB.driver_name, driverAColors.primary, driverBColors.primary]);

  return (
    <section className="relative overflow-hidden rounded-[26px] border border-[#2a2a2a] bg-[linear-gradient(180deg,_rgba(255,255,255,0.05),_rgba(255,255,255,0.015))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.45)] sm:rounded-[32px] sm:p-5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,_#ff2d20,_rgba(255,255,255,0.12),_transparent)]" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#888888]">
            Track duel
          </p>
          <h2 className="text-xl font-semibold text-[#f5f5f5] sm:text-2xl">
            {flagEmoji(duel.circuit.country_code)} {CIRCUIT_DISPLAY_NAMES[duel.circuit.circuit_id] ?? duel.circuit.name}
          </h2>
          <p className="mt-1 text-sm text-[#888888]">
            {duel.circuit.name}
            {" · "}
            {duel.bestAcrossSeasons
              ? "Best qualifying lap across cached seasons"
              : `Season ${duel.selectedSeason} qualifying duel`}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <div className="flex items-center gap-2 rounded-full border border-[#232323] bg-[#111111] px-3 py-2">
            {!animating && carA ? (
              <span className="text-[10px] font-semibold uppercase leading-none tracking-wider text-[#666666]">
                {"\u{1F3C1}"} Lap complete
              </span>
            ) : (
              Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={`${duelKey}-${replayToken}-${index}`}
                  className="telemetry-light"
                  style={{ animationDelay: `${index * 100}ms` }}
                />
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => setReplayToken((token) => token + 1)}
            className="rounded-full border border-[#2a2a2a] px-4 py-2 text-sm font-medium text-[#f5f5f5] transition hover:border-[#444444] hover:bg-[#1c1c1c]"
          >
            Replay
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[24px] border border-[#232323] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.06),_#0f0f0f_70%)] p-2 sm:rounded-[28px] sm:p-3">
        <div className="telemetry-grid absolute inset-0 opacity-35" />
        <svg
          viewBox={duel.circuit.viewbox}
          className="h-[42svh] min-h-[260px] w-full sm:h-[48vh] sm:min-h-[320px]"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <filter id="track-glow">
              <feGaussianBlur stdDeviation="6" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            ref={pathRef}
            d={duel.circuit.svg_path}
            fill="none"
            stroke="#333333"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={duel.circuit.svg_path}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#track-glow)"
          />
          <path
            key={`${duelKey}-${replayToken}-sweep`}
            d={duel.circuit.svg_path}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="14 26"
            className="track-sweep"
          />

          {startLine ? (
            <g>
              <line
                x1={startLine.x1}
                y1={startLine.y1}
                x2={startLine.x2}
                y2={startLine.y2}
                stroke="white"
                strokeWidth="3"
                strokeDasharray="3 3"
                opacity="0.7"
              />
              <line
                x1={startLine.x1}
                y1={startLine.y1}
                x2={startLine.x2}
                y2={startLine.y2}
                stroke="#111111"
                strokeWidth="3"
                strokeDasharray="3 3"
                strokeDashoffset="3"
                opacity="0.7"
              />
            </g>
          ) : null}

          {tailA && carA ? (
            <line
              x1={tailA.x}
              y1={tailA.y}
              x2={carA.x}
              y2={carA.y}
              stroke={driverAColors.primary}
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.55"
            />
          ) : null}

          {tailB && carB ? (
            <line
              x1={tailB.x}
              y1={tailB.y}
              x2={carB.x}
              y2={carB.y}
              stroke={driverBColors.primary}
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.55"
            />
          ) : null}

          {carA ? (
            <g>
              <circle cx={carA.x} cy={carA.y} r="11" fill={driverAColors.primary} opacity="0.18" />
              <CarSprite
                fill={driverAColors.primary}
                secondary={driverAColors.secondary}
                x={carA.x}
                y={carA.y}
                angle={carA.angle}
              />
            </g>
          ) : null}

          {carB ? (
            <g>
              <circle cx={carB.x} cy={carB.y} r="11" fill={driverBColors.primary} opacity="0.18" />
              <CarSprite
                fill={driverBColors.primary}
                secondary={driverBColors.secondary}
                x={carB.x}
                y={carB.y}
                angle={carB.angle}
              />
            </g>
          ) : null}

          {deltaState ? (
            <g transform={`translate(${deltaState.x} ${deltaState.y - 24})`}>
              <rect
                x="-40"
                y="-13"
                width="80"
                height="18"
                rx="9"
                fill="#0f0f0f"
                stroke={deltaState.color}
              />
              <text
                x="0"
                y="0"
                fill={deltaState.color}
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {deltaState.label}
              </text>
            </g>
          ) : null}
        </svg>
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.22em] text-[#666666] sm:inset-x-4 sm:bottom-4 sm:text-[11px] sm:tracking-[0.24em]">
          <span className="max-w-[34%] truncate">{driverFlag(drivers.find((d) => d.driver_id === duel.driverA.driver_id)?.nationality ?? null)} {duel.driverA.driver_name}</span>
          <span>Telemetry view</span>
          <span className="max-w-[34%] truncate text-right">{driverFlag(drivers.find((d) => d.driver_id === duel.driverB.driver_id)?.nationality ?? null)} {duel.driverB.driver_name}</span>
        </div>
      </div>
    </section>
  );
}
