-- Run after 004_personality_stories.sql, in the Supabase SQL editor.
-- Academic calendar: holidays, exam blocks, and term date-ranges — one table,
-- differentiated by category. Term boundaries are modeled as events too
-- (category 'term') rather than a separate table, since they're just another
-- named date range.
create table if not exists academic_events (
  id text primary key,
  school_id text not null,
  title text not null,
  category text not null check (category in ('holiday', 'exam', 'term')),
  start_date date not null,
  end_date date not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_academic_events_school_dates on academic_events (school_id, start_date, end_date);

alter table academic_events enable row level security;
-- No policies added — only ever touched via the server-side API route using
-- the Supabase service-role client, matching announcements / grade_subjects.
