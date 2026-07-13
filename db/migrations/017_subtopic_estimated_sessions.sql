-- Run after 016_syllabus_subject.sql, in the Supabase SQL editor.
-- Sessions-per-topic already exists; this lets that estimate be split across
-- a topic's own sub-topics too, admin-set or AI-suggested the same way.
alter table syllabus_sub_topics
  add column if not exists estimated_sessions integer;
