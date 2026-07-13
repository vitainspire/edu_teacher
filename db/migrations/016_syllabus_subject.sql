-- Run after 015_syllabus_prerequisites.sql, in the Supabase SQL editor.
-- Syllabus authoring is moving from each teacher to admin (per grade+subject,
-- shared across every section) — this column lets a topic actually record
-- which subject it belongs to, so admin can manage more than one subject's
-- syllabus per grade without them being mixed together.
alter table syllabus_topics
  add column if not exists subject text;
