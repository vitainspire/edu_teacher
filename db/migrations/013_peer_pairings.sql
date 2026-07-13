-- Run after 012_drive_url.sql, in the Supabase SQL editor.
-- Student-initiated peer study-buddy pairings. A row moves through its
-- lifecycle via `status` rather than living in separate request/pair tables:
-- 'pending'  — requester sent it, target hasn't accepted yet
-- 'active'   — target accepted; both students and the teacher can see it
-- 'dissolved'— teacher (or the requester, while still pending) ended it
create table if not exists peer_pairings (
  id                    uuid primary key,
  class_id              uuid not null,
  subject               text,
  requester_student_id  uuid not null,
  target_student_id     uuid not null,
  status                text not null default 'pending',
  activity              text,
  created_at            timestamptz not null default now(),
  responded_at          timestamptz
);

create index if not exists peer_pairings_class_idx      on peer_pairings(class_id);
create index if not exists peer_pairings_requester_idx  on peer_pairings(requester_student_id);
create index if not exists peer_pairings_target_idx     on peer_pairings(target_student_id);
