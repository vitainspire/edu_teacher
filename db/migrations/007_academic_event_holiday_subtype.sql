-- Run after 006_exam_plan_items.sql, in the Supabase SQL editor.
-- Distinguishes WHY a holiday-category event blocks the calendar (public /
-- school-declared / cultural), and lets any event opt out of blocking
-- working-day capacity — a cultural event (Annual Day, Sports Day) doesn't
-- always cancel regular class periods, unlike a public/school holiday.
alter table academic_events
  add column if not exists holiday_subtype text check (holiday_subtype in ('public', 'school', 'cultural')),
  add column if not exists counts_as_non_working boolean not null default true;
