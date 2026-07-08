-- Substitute-teacher automation — run this in the Supabase SQL editor.
-- (This repo has no migration tooling / DATABASE_URL, so this file is not
-- applied automatically by anything — it's a record of what was run.)

-- Per-teacher, per-date unavailability. Absence of a row = Available.
create table teacher_availability (
  id text primary key,
  school_id text not null,
  teacher_id text not null,
  date date not null,
  reason text not null check (reason in ('on_leave','late_arrival','official_duty','other')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, date)
);
create index idx_teacher_availability_school_date on teacher_availability (school_id, date);

-- One row per class/period/date that needed coverage.
create table timetable_substitutions (
  id text primary key,
  school_id text not null,
  date date not null,
  day_of_week int not null,
  period_number int not null,
  class_id text not null,
  subject text,
  original_teacher_id text not null,
  substitute_teacher_id text,              -- null = unresolved, needs manual admin pick
  status text not null default 'assigned' check (status in ('assigned','unresolved','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, date, period_number)
);
create index idx_tt_subs_school_date on timetable_substitutions (school_id, date);
create index idx_tt_subs_original_teacher on timetable_substitutions (original_teacher_id, date);
create index idx_tt_subs_substitute_teacher on timetable_substitutions (substitute_teacher_id, date);

alter table teacher_availability enable row level security;
alter table timetable_substitutions enable row level security;
-- No policies added — both tables are only ever touched via server-side API
-- routes using the Supabase service-role client (bypasses RLS), matching the
-- existing pattern for teachers/classes/timetable/school_timetable_periods.
