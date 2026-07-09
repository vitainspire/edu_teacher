-- Run after 009_academic_events_published.sql, in the Supabase SQL editor.
-- Tags each grade's subject as 'core' (academic — Math/Science/English/...)
-- or 'special' (Sports/Library/Computer Lab/...), so the timetable generator
-- can space core periods apart instead of stacking them back-to-back.
alter table grade_subjects
  add column if not exists category text not null default 'core'
    check (category in ('core', 'special'));
