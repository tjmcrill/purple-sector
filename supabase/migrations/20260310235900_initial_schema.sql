create extension if not exists pgcrypto;

create table if not exists public.circuits (
  circuit_id text primary key,
  name text not null,
  country text not null,
  country_code text not null,
  svg_path text not null,
  viewbox text not null,
  path_length numeric,
  sector_markers jsonb,
  start_finish_t numeric,
  length_km numeric
);

create table if not exists public.drivers (
  driver_id text primary key,
  driver_name text not null,
  code text,
  nationality text
);

create table if not exists public.lap_times (
  id uuid primary key default gen_random_uuid(),
  driver_id text not null references public.drivers(driver_id) on delete cascade,
  driver_name text not null,
  circuit_id text not null references public.circuits(circuit_id) on delete cascade,
  season int not null,
  team text not null,
  lap_time_ms int not null,
  lap_time_display text not null,
  sector_1_ms int,
  sector_2_ms int,
  sector_3_ms int,
  created_at timestamptz default now(),
  unique (driver_id, circuit_id, season)
);

create index if not exists lap_times_circuit_lap_time_idx
  on public.lap_times (circuit_id, lap_time_ms);

create index if not exists lap_times_driver_circuit_idx
  on public.lap_times (driver_id, circuit_id);

create index if not exists lap_times_circuit_season_idx
  on public.lap_times (circuit_id, season);

alter table public.circuits enable row level security;
alter table public.drivers enable row level security;
alter table public.lap_times enable row level security;
