create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  email text not null,
  full_name text,
  current_role text,
  years_of_experience numeric,
  target_role text,
  location_preference text,
  technical_background text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null,
  raw_text text not null,
  source_type text not null default 'text'
    check (source_type in ('text', 'markdown', 'pdf', 'docx', 'image')),
  source_file_name text,
  source_mime_type text,
  source_size_bytes integer check (source_size_bytes is null or source_size_bytes >= 0),
  source_storage_path text,
  docling_json jsonb,
  import_status text not null default 'not_required'
    check (import_status in ('not_required', 'pending', 'processing', 'succeeded', 'failed')),
  import_error text,
  structured_json jsonb,
  is_primary boolean not null default false,
  parse_status text not null default 'not_parsed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  company text not null,
  title text not null,
  job_url text,
  location text,
  work_type text,
  raw_description text not null,
  structured_json jsonb,
  parse_status text not null default 'not_parsed',
  contact_name text,
  contact_email text,
  contact_linkedin_url text,
  contact_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_clerk_user_id_idx
  on public.user_profiles (clerk_user_id);

create index if not exists resumes_user_id_created_at_idx
  on public.resumes (user_id, created_at desc);

create index if not exists jobs_user_id_created_at_idx
  on public.jobs (user_id, created_at desc);

alter table public.user_profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.jobs enable row level security;

-- The FastAPI service will use the Supabase service role after verifying Clerk
-- identity. Browser clients must not write these tables directly in Period 1.

