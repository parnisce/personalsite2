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
