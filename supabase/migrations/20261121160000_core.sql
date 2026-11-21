-- BharatSim finale schema: apps, runs, per-profile results, device profiles, translations.
-- Every user-facing table is owner-scoped with row-level security.

create extension if not exists pgcrypto;

-- Test profiles: shared, read-only catalogue the web app and the worker agree on.
create table public.test_profiles (
  key text primary key check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null,
  summary text not null,
  sort_order int not null default 0,
  params jsonb not null,
  source text not null
);

create table public.device_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  manufacturer text check (char_length(manufacturer) <= 80),
  model text check (char_length(model) <= 80),
  android_version text check (char_length(android_version) <= 20),
  sdk_int int check (sdk_int between 1 and 100),
  total_ram_mb int check (total_ram_mb between 1 and 65536),
  screen_width int check (screen_width between 1 and 10000),
  screen_height int check (screen_height between 1 and 10000),
  network_type text check (char_length(network_type) <= 20),
  measured_down_kbps int check (measured_down_kbps between 0 and 10000000),
  measured_rtt_ms int check (measured_rtt_ms between 0 and 60000),
  created_at timestamptz not null default now()
);

create table public.apps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  package_name text check (char_length(package_name) <= 255),
  version_name text check (char_length(version_name) <= 80),
  storage_path text not null check (char_length(storage_path) <= 400),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  source text not null default 'upload' check (source in ('upload', 'device', 'sample')),
  created_at timestamptz not null default now()
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app_id uuid not null references public.apps(id) on delete cascade,
  device_profile_id uuid references public.device_profiles(id) on delete set null,
  profiles text[] not null check (cardinality(profiles) between 1 and 8),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  stage text,
  worker_id text,
  lease_expires_at timestamptz,
  attempts int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  readiness_score int check (readiness_score between 0 and 100),
  summary jsonb,
  created_at timestamptz not null default now()
);

create table public.run_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  profile_key text not null references public.test_profiles(key),
  verdict text not null check (verdict in ('pass', 'warn', 'fail', 'error')),
  metrics jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  logcat_excerpt text,
  created_at timestamptz not null default now(),
  unique (run_id, profile_key)
);

create table public.report_translations (
  run_id uuid not null references public.runs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  language text not null check (language ~ '^[a-z]{2}-IN$'),
  content jsonb not null,
  audio_path text,
  created_at timestamptz not null default now(),
  primary key (run_id, language)
);

create table public.workers (
  id text primary key check (char_length(id) <= 80),
  last_seen timestamptz not null default now(),
  info jsonb not null default '{}'::jsonb
);

create index apps_owner_idx on public.apps (owner_id, created_at desc);
create index runs_owner_idx on public.runs (owner_id, created_at desc);
create index runs_queue_idx on public.runs (status, created_at) where status in ('queued', 'running');
create index runs_app_idx on public.runs (app_id);
create index runs_device_idx on public.runs (device_profile_id);
create index run_results_run_idx on public.run_results (run_id);
create index run_results_owner_idx on public.run_results (owner_id);
create index run_results_profile_idx on public.run_results (profile_key);
create index device_profiles_owner_idx on public.device_profiles (owner_id);
create index report_translations_owner_idx on public.report_translations (owner_id);

-- Row-level security
alter table public.test_profiles enable row level security;
alter table public.device_profiles enable row level security;
alter table public.apps enable row level security;
alter table public.runs enable row level security;
alter table public.run_results enable row level security;
alter table public.report_translations enable row level security;
alter table public.workers enable row level security;

create policy "profiles readable by signed-in users" on public.test_profiles
  for select to authenticated using (true);

create policy "own device profiles: read" on public.device_profiles for select to authenticated using (owner_id = (select auth.uid()));
create policy "own device profiles: add" on public.device_profiles for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own device profiles: remove" on public.device_profiles for delete to authenticated using (owner_id = (select auth.uid()));

create policy "own apps: read" on public.apps for select to authenticated using (owner_id = (select auth.uid()));
create policy "own apps: add" on public.apps for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "own apps: remove" on public.apps for delete to authenticated using (owner_id = (select auth.uid()));

create policy "own runs: read" on public.runs for select to authenticated using (owner_id = (select auth.uid()));
create policy "own runs: add" on public.runs for insert to authenticated with check (owner_id = (select auth.uid()) and status = 'queued');
create policy "own runs: remove" on public.runs for delete to authenticated using (owner_id = (select auth.uid()));

create policy "own results: read" on public.run_results for select to authenticated using (owner_id = (select auth.uid()));
create policy "own translations: read" on public.report_translations for select to authenticated using (owner_id = (select auth.uid()));
-- workers: no policies; only the server (service role) reads and writes it.

-- Integrity and quotas on run creation
create or replace function public.check_run_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count int;
  daily_count int;
begin
  if not exists (select 1 from public.apps a where a.id = new.app_id and a.owner_id = new.owner_id) then
    raise exception 'app not found' using errcode = '42501';
  end if;
  if new.device_profile_id is not null and not exists (
    select 1 from public.device_profiles d where d.id = new.device_profile_id and d.owner_id = new.owner_id) then
    raise exception 'device profile not found' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(new.profiles) p where p not in (select key from public.test_profiles)) then
    raise exception 'unknown test profile' using errcode = '22023';
  end if;
  select count(*) into active_count from public.runs r
    where r.owner_id = new.owner_id and r.status in ('queued', 'running');
  if active_count >= 2 then
    raise exception 'You already have 2 runs in progress. Wait for one to finish.' using errcode = 'P0001';
  end if;
  select count(*) into daily_count from public.runs r
    where r.owner_id = new.owner_id and r.created_at > now() - interval '24 hours';
  if daily_count >= 20 then
    raise exception 'Daily limit of 20 runs reached.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger runs_before_insert before insert on public.runs
  for each row execute function public.check_run_insert();

-- Worker queue: claim the oldest queued run (or one whose lease expired) atomically.
create or replace function public.claim_next_run(p_worker_id text, p_lease_seconds int default 900)
returns setof public.runs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.runs r
     set status = 'running',
         worker_id = p_worker_id,
         stage = 'claimed',
         attempts = r.attempts + 1,
         started_at = coalesce(r.started_at, now()),
         lease_expires_at = now() + make_interval(secs => p_lease_seconds)
   where r.id = (
     select id from public.runs
      where (status = 'queued' or (status = 'running' and lease_expires_at < now()))
        and attempts < 3
      order by created_at
      limit 1
      for update skip locked)
  returning r.*;
end;
$$;

revoke all on function public.claim_next_run(text, int) from public, anon, authenticated;
grant execute on function public.claim_next_run(text, int) to service_role;
revoke all on function public.check_run_insert() from public, anon, authenticated;

-- Private storage: APKs live under <user id>/..., audio is written by the server only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('apks', 'apks', false, 52428800, array['application/vnd.android.package-archive', 'application/octet-stream', 'application/zip']),
  ('audio', 'audio', false, 10485760, array['audio/wav', 'audio/x-wav'])
on conflict (id) do nothing;

create policy "own apks: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'apks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own apks: read" on storage.objects for select to authenticated
  using (bucket_id = 'apks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "own apks: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'apks' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Profile catalogue. Network values are the Android Emulator's built-in presets
-- (network speed / network delay console commands) until calibrated to field data.
insert into public.test_profiles (key, name, summary, sort_order, params, source) values
  ('baseline', 'Baseline', 'Full-speed network, no constraints. Every other profile is compared against this run.', 0,
   '{"network_speed": "full", "network_delay": "none", "battery_saver": false}', 'Reference run'),
  ('rural_2g', 'Rural 2G', 'EDGE-class bandwidth with high, variable latency, like a village tower at the edge of coverage.', 10,
   '{"network_speed": "edge", "network_delay": "edge", "battery_saver": false}', 'Android Emulator EDGE presets'),
  ('station_3g', 'Crowded station 3G', 'UMTS bandwidth and latency, like a busy railway platform on 3G.', 20,
   '{"network_speed": "umts", "network_delay": "umts", "battery_saver": false}', 'Android Emulator UMTS presets'),
  ('congested_4g', 'Congested 4G', '4G signal shared by too many people: about 1 Mbps down with 150 to 400 ms delay.', 30,
   '{"network_speed": "512:1024", "network_delay": "150:400", "battery_saver": false}', 'Custom emulator limits'),
  ('metro_tunnel', 'Metro tunnel', 'The network drops for 20 seconds mid-session and then comes back. Measures crash, freeze or recovery.', 40,
   '{"network_speed": "lte", "network_delay": "umts", "drop_seconds": 20, "battery_saver": false}', 'Emulator data on/off toggle'),
  ('low_end', 'Low storage, battery saver', 'Battery saver on and the device filled until about 300 MB of storage is left.', 50,
   '{"network_speed": "full", "network_delay": "none", "battery_saver": true, "free_storage_mb": 300}', 'Emulator settings and storage fill');
