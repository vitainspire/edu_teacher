-- Run after 011_teacher_availability_and_shared_resources.sql, in the Supabase SQL editor.
-- Best-effort parallel archive of scanned papers to a school's Google Drive
-- folder (via Apps Script), alongside the existing Supabase Storage copy
-- used for the in-app "View Paper" viewer. NULL = the Drive upload wasn't
-- configured or failed for that scan — the Supabase copy is still there.
alter table marks
  add column if not exists drive_url text;

alter table worksheet_marks
  add column if not exists drive_url text;
