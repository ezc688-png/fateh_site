-- Run this ONCE in Supabase > SQL Editor, before pushing the new code.

-- YouTube link on projects
alter table public.projects add column if not exists video_url text;

-- One row per user who has set a display name / photo, or been given a role.
-- No row = a normal "user" with the name taken from their email.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  role text not null default 'user' check (role in ('administrator', 'user', 'banned')),
  updated_at timestamptz not null default now()
);

-- "Request a viewing" leads. project_name is copied so the lead survives if the project is deleted.
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  project_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text not null,
  email text,
  preferred_date text,
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

-- A user's saved projects.
create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

-- Reviews. Only rows with approved = true are shown on the site.
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  body text not null,
  rating int not null check (rating between 1 and 5),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- Who did what, and when (admin actions and key events).
create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_name text,
  action text not null,
  target text,
  detail text,
  created_at timestamptz not null default now()
);

-- Only the backend touches these tables, so lock them against direct browser access.
alter table public.profiles enable row level security;
alter table public.enquiries enable row level security;
alter table public.favorites enable row level security;
alter table public.testimonials enable row level security;
alter table public.activity_log enable row level security;
