-- Run after 008_teacher_subjects.sql, in the Supabase SQL editor.
-- Draft/publish state for the academic calendar — an admin can freely
-- add/edit/delete events (drafts, invisible to teachers) and only make them
-- visible school-wide via an explicit "Publish Calendar" action.
alter table academic_events
  add column if not exists published boolean not null default false;
