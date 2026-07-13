-- Run after 013_peer_pairings.sql, in the Supabase SQL editor.
-- Captures each student's average mastery (in the pairing's subject, or
-- overall if no subject was set) at the moment a pairing goes active, so a
-- later recheck can tell whether the pairing is actually helping — the
-- signal the teacher's Settings page uses to suggest reassigning a pair
-- that isn't showing progress.
alter table peer_pairings
  add column if not exists baseline_requester_mastery numeric,
  add column if not exists baseline_target_mastery numeric;
