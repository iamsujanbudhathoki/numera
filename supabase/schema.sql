-- Numera Supabase Schema
-- Run this in your Supabase project's SQL Editor.

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  operations jsonb not null default '{}'::jsonb,
  last_operation text not null default 'addition',
  last_mode text not null default 'practice',
  updated_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  timestamp bigint not null,
  operation text not null,
  level integer not null,
  mode text not null,
  expression text not null,
  correct_answer integer not null,
  user_answer integer,
  is_correct boolean not null,
  response_time_ms integer not null,
  strategy text,
  skill_tag text
);

create index if not exists idx_attempts_user_timestamp
  on public.attempts (user_id, timestamp desc);

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at bigint not null,
  ended_at bigint not null,
  mode text not null,
  operation text not null,
  level integer not null,
  total_questions integer not null,
  correct_count integer not null,
  average_response_time_ms integer not null,
  best_response_time_ms integer,
  leveled_up_to integer
);

create index if not exists idx_sessions_user_ended
  on public.sessions (user_id, ended_at desc);

-- Enable Row-Level Security (RLS)
alter table public.user_profiles enable row level security;
alter table public.attempts enable row level security;
alter table public.sessions enable row level security;

-- Policies: each authenticated user can only access their own rows
create policy "Users can manage their own profile"
  on public.user_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own attempts"
  on public.attempts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can manage their own sessions"
  on public.sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
