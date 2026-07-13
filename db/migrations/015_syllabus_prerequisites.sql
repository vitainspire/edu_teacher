-- Run after 014_peer_pairing_progress.sql, in the Supabase SQL editor.
-- Lets a teacher mark that one syllabus topic should be mastered before
-- another. Stored as a `definition_id` reference (not a raw topic id) because
-- a topic is duplicated one row per section — definition_id is the one thing
-- shared across all of a grade's sections, so a prerequisite set on one
-- section's topic resolves correctly in every other section too.
alter table syllabus_topics
  add column if not exists prerequisite_definition_id uuid;
