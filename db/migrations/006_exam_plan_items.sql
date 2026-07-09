-- Run after 005_academic_events.sql, in the Supabase SQL editor.
-- School-wide exam structure — "how many of each exam type this year"
-- (e.g. Unit Test x3, Half-Yearly x1) as a planning quota, separate from the
-- actual dated exam blocks in academic_events (category 'exam'), which get
-- created from these rows via the "Schedule" action in the admin UI.
create table if not exists exam_plan_items (
  id text primary key,
  school_id text not null,
  name text not null,
  count integer not null default 1,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_exam_plan_items_school on exam_plan_items (school_id);

alter table exam_plan_items enable row level security;
-- No policies added — only ever touched via the server-side API route using
-- the Supabase service-role client, matching grade_subjects / academic_events.
