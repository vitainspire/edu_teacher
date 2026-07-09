-- Run after 001_substitute_teachers.sql, in the Supabase SQL editor.
-- Tracks whether a teacher's availability status was self-reported by the
-- teacher (the primary flow) or set by an admin as a fallback override.
alter table teacher_availability
  add column if not exists source text not null default 'admin' check (source in ('teacher','admin'));
