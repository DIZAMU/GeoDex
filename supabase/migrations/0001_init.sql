-- GeoDex schema (PLAN.md 5.6). Event tables are append-only: there are no update or delete
-- policies, so a signed-in client can only read and insert its own rows.

create table public.review_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id text not null,
  reviewed_at timestamptz not null,
  rating smallint not null check (rating between 1 and 4),
  mode text not null,
  input_setting text not null,
  correct boolean not null,
  chosen_answer text,
  response_ms integer,
  duration_ms integer,
  snippet_ids text[] not null default '{}',
  scheduled boolean not null default true,
  locale text not null,
  device_id text not null,
  server_seq bigint generated always as identity,
  created_at timestamptz not null default now()
);
create index review_events_user_seq on public.review_events (user_id, server_seq);
alter table public.review_events enable row level security;
create policy "select own" on public.review_events for select using (user_id = auth.uid());
create policy "insert own" on public.review_events for insert with check (user_id = auth.uid());

create table public.hook_vote_events (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id text not null,
  hook_id text not null,
  created_at_client timestamptz not null,
  device_id text not null,
  server_seq bigint generated always as identity
);
create index hook_vote_events_user_seq on public.hook_vote_events (user_id, server_seq);
alter table public.hook_vote_events enable row level security;
create policy "select own" on public.hook_vote_events for select using (user_id = auth.uid());
create policy "insert own" on public.hook_vote_events for insert with check (user_id = auth.uid());

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null
);
alter table public.user_settings enable row level security;
create policy "select own" on public.user_settings for select using (user_id = auth.uid());
create policy "insert own" on public.user_settings for insert with check (user_id = auth.uid());
create policy "update own" on public.user_settings for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
