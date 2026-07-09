-- Run after 007_academic_event_holiday_subtype.sql, in the Supabase SQL editor.
-- A teacher can teach several subjects (common in staff-scarce government
-- schools — one teacher covering Math for one grade and Science for
-- another). `subject` (singular) stays as-is for backward compatibility with
-- every existing read site — it's kept in sync as subjects[0].
alter table teachers
  add column if not exists subjects text[] not null default '{}';
