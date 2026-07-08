-- Run after 002_availability_source.sql, in the Supabase SQL editor.
-- Optional per-teacher workload caps, used to keep substitute assignment
-- from overloading a teacher. Null = no cap (existing teachers are
-- unaffected until an admin sets a limit).
alter table teachers
  add column if not exists max_periods_per_day integer,
  add column if not exists max_periods_per_week integer;
