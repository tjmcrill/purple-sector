create table if not exists public.session_weather (
  id uuid primary key default gen_random_uuid(),
  circuit_id text not null references public.circuits(circuit_id) on delete cascade,
  season int not null,
  session_key int not null,
  air_temp_c numeric not null,
  track_temp_c numeric not null,
  humidity_pct numeric not null,
  wind_speed_ms numeric not null,
  wind_direction_deg int not null,
  rainfall boolean default false,
  pressure_mbar numeric,
  sampled_at timestamptz,
  created_at timestamptz default now(),
  unique (circuit_id, season)
);

alter table public.session_weather enable row level security;

create policy "Allow public read access"
  on public.session_weather
  for select
  using (true);
