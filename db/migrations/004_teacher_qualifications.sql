-- Run after 003_teacher_workload_limits.sql, in the Supabase SQL editor.
-- Explicit teacher qualifications (subject + grade + optional section) —
-- replaces inferring "what does this teacher teach" from their timetable
-- history. An empty section means "qualified for every section of this
-- grade"; a specific section narrows it to just that one.
create table teacher_qualifications (
  id text primary key,
  school_id text not null,
  teacher_id text not null,
  subject text not null,
  grade text not null,
  section text not null default '',
  created_at timestamptz not null default now(),
  unique (teacher_id, subject, grade, section)
);
create index idx_teacher_qualifications_teacher on teacher_qualifications (teacher_id);
create index idx_teacher_qualifications_school on teacher_qualifications (school_id);

alter table teacher_qualifications enable row level security;
-- No policies added — only touched via server-side API routes using the
-- Supabase service-role client (bypasses RLS), same as the other new tables.
