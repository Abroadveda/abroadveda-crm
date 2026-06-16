-- ============================================================
--  ABROAD VEDA CRM — Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ── TEAM MEMBERS ─────────────────────────────────────────────
create table if not exists team_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text not null default 'Counsellor',
  country     text default '—',
  created_at  timestamptz default now()
);

-- ── STUDENTS ─────────────────────────────────────────────────
create table if not exists students (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  email           text,
  level           text default 'PG',
  country         text default 'UK',
  intake          text default 'September',
  field           text default 'Other',
  stage           text default 'lead',
  qualification   text,
  assigned_to     uuid references team_members(id) on delete set null,
  follow_up       date,
  gender          text,
  dob             date,
  nationality     text,
  city            text,
  consent_tc      boolean default false,
  consent_mkt     boolean default false,
  hear_source     text,
  fin_source      text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- auto-update updated_at
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger students_updated
  before update on students
  for each row execute function touch_updated_at();

-- ── NOTES ─────────────────────────────────────────────────────
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  text        text not null,
  created_at  timestamptz default now()
);

-- ── APPLICATIONS ──────────────────────────────────────────────
create table if not exists applications (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students(id) on delete cascade,
  course          text not null,
  institution     text,
  commence_date   date,
  status          text default 'Application Preparation',
  created_at      timestamptz default now()
);

-- ── DOCUMENTS ─────────────────────────────────────────────────
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  name        text not null,
  status      text default 'Pending',
  created_at  timestamptz default now()
);

-- ── SETTINGS (key-value store) ─────────────────────────────────
create table if not exists settings (
  key    text primary key,
  value  jsonb
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
-- For the free plan / quick start: enable RLS but allow all
-- authenticated users access. Lock this down properly when
-- you add Supabase Auth in production.

alter table students     enable row level security;
alter table team_members enable row level security;
alter table notes        enable row level security;
alter table applications enable row level security;
alter table documents    enable row level security;
alter table settings     enable row level security;

-- Allow all for now (replace with proper auth policies later)
create policy "allow_all_students"     on students     for all using (true) with check (true);
create policy "allow_all_team"         on team_members for all using (true) with check (true);
create policy "allow_all_notes"        on notes        for all using (true) with check (true);
create policy "allow_all_applications" on applications for all using (true) with check (true);
create policy "allow_all_documents"    on documents    for all using (true) with check (true);
create policy "allow_all_settings"     on settings     for all using (true) with check (true);

-- ── INDEXES ────────────────────────────────────────────────────
create index if not exists idx_students_stage       on students(stage);
create index if not exists idx_students_assigned    on students(assigned_to);
create index if not exists idx_notes_student        on notes(student_id);
create index if not exists idx_applications_student on applications(student_id);
create index if not exists idx_documents_student    on documents(student_id);

-- ── SEED: starter team (optional, delete if not needed) ────────
insert into team_members (name, role, country) values
  ('Priya Sharma', 'Counsellor', 'UK'),
  ('Rahul Verma',  'Counsellor', 'Canada'),
  ('Aman Gupta',   'BDE',        '—')
on conflict do nothing;
