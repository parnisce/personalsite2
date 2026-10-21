-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Then: Authentication -> Users -> Add user (your admin email + password),
-- and Authentication -> Sign In / Providers -> turn OFF "Allow new users to sign up".

-- 1. Your task manager data: one private row per signed-in user.
create table if not exists public.admin_state (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.admin_state enable row level security;
drop policy if exists "own state" on public.admin_state;
create policy "own state" on public.admin_state
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 2. Messages from the website contact form. Anyone can send one; only you can read them.
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (char_length(phone) <= 60),
  interest text check (char_length(interest) <= 120),
  message text not null check (char_length(message) between 1 and 5000),
  read boolean not null default false
);
alter table public.enquiries enable row level security;
drop policy if exists "anyone can send" on public.enquiries;
create policy "anyone can send" on public.enquiries
  for insert to anon, authenticated
  with check (read = false);
drop policy if exists "owner reads" on public.enquiries;
create policy "owner reads" on public.enquiries for select to authenticated using (true);
drop policy if exists "owner updates" on public.enquiries;
create policy "owner updates" on public.enquiries for update to authenticated using (true) with check (true);
drop policy if exists "owner deletes" on public.enquiries;
create policy "owner deletes" on public.enquiries for delete to authenticated using (true);

-- 3. Website content you can edit from the admin (projects, testimonials, stats).
create table if not exists public.site_content (
  key text primary key check (key in ('projects', 'testimonials', 'stats')),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
drop policy if exists "public reads content" on public.site_content;
create policy "public reads content" on public.site_content for select to anon, authenticated using (true);
drop policy if exists "owner writes content" on public.site_content;
create policy "owner writes content" on public.site_content
  for all to authenticated using (true) with check (true);

-- 4. Resources: the articles shown at /resources/ (managed from Admin -> Resources).
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 200),
  summary text not null default '' check (char_length(summary) <= 300),
  tags text[] not null default '{}',
  body text not null default '',
  github_url text,
  github jsonb,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.resources enable row level security;
drop policy if exists "public reads published" on public.resources;
create policy "public reads published" on public.resources for select to anon, authenticated using (published = true);
drop policy if exists "owner reads all" on public.resources;
create policy "owner reads all" on public.resources for select to authenticated using (true);
drop policy if exists "owner writes resources" on public.resources;
create policy "owner writes resources" on public.resources for all to authenticated using (true) with check (true);

-- 5. First-party analytics (page views and events). No cookies, no IP addresses stored.
-- Anyone can add a row; only you can read or delete them.
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  session_id text not null check (char_length(session_id) between 8 and 40),
  type text not null check (type in ('pageview', 'event')),
  name text check (char_length(name) <= 80),
  detail text check (char_length(detail) <= 200),
  path text not null check (char_length(path) <= 300),
  referrer text check (char_length(referrer) <= 200),
  utm_source text check (char_length(utm_source) <= 100),
  utm_medium text check (char_length(utm_medium) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 100),
  device text check (device in ('mobile', 'tablet', 'desktop'))
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
alter table public.analytics_events enable row level security;
drop policy if exists "anyone can record" on public.analytics_events;
create policy "anyone can record" on public.analytics_events for insert to anon, authenticated with check (true);
drop policy if exists "owner reads analytics" on public.analytics_events;
create policy "owner reads analytics" on public.analytics_events for select to authenticated using (true);
drop policy if exists "owner deletes analytics" on public.analytics_events;
create policy "owner deletes analytics" on public.analytics_events for delete to authenticated using (true);

-- 6. "Like this portfolio" counter. Anyone can add a like; the total is read through a function
-- so the public key never gets permission to read the table itself.
create table if not exists public.portfolio_likes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);
alter table public.portfolio_likes enable row level security;
drop policy if exists "anyone can like" on public.portfolio_likes;
create policy "anyone can like" on public.portfolio_likes for insert to anon, authenticated with check (true);
drop policy if exists "owner reads likes" on public.portfolio_likes;
create policy "owner reads likes" on public.portfolio_likes for select to authenticated using (true);

create or replace function public.get_likes() returns bigint
language sql security definer set search_path = public as
$$ select count(*) from public.portfolio_likes $$;
grant execute on function public.get_likes() to anon, authenticated;
