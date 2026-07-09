-- Run after 003_teacher_workload_limits.sql, in the Supabase SQL editor.
-- One AI-generated personality-development story per student per calendar day.
-- The unique constraint is what makes "one story a day" durable across
-- serverless cold starts and multiple devices — the API checks this table
-- before calling the AI, not an in-memory cache.
create table if not exists personality_stories (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  date date not null,
  trait text not null,
  story jsonb not null,
  created_at timestamptz not null default now(),
  unique (student_id, date)
);
create index if not exists idx_personality_stories_student_date on personality_stories (student_id, date);

alter table personality_stories enable row level security;
-- No policies added — only ever touched via the server-side API route using
-- the Supabase service-role client, matching teacher_availability / timetable_substitutions.
