-- 0003_shoutouts_and_student_profile.sql

-- ── Link students to their auth users ────────────────────────────────────────
-- auth_user_id is the auth.users UUID for the student's own login.
-- Used in RLS so students can only read their own shoutouts.
alter table public.students
  add column if not exists auth_user_id     uuid references auth.users(id) on delete set null,
  add column if not exists career_goals     text,
  add column if not exists community_assets text;

create unique index if not exists students_auth_user_id_idx
  on public.students(auth_user_id)
  where auth_user_id is not null;

-- ── Private teacher notes (Option B: isolated table for proper RLS) ───────────
create table if not exists public.student_teacher_notes (
  id         uuid        primary key default gen_random_uuid(),
  student_id uuid        not null references public.students(id)  on delete cascade,
  teacher_id uuid        not null references public.teachers(id)  on delete restrict,
  notes      text,
  updated_at timestamptz not null default now(),
  unique (student_id, teacher_id)
);

alter table public.student_teacher_notes enable row level security;

-- Teachers have full access to their own notes only
create policy "Teachers manage own notes"
  on public.student_teacher_notes
  for all
  using     (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

create trigger student_teacher_notes_updated_at
  before update on public.student_teacher_notes
  for each row execute function public.trigger_set_updated_at();

-- ── student_shoutouts ─────────────────────────────────────────────────────────
create table if not exists public.student_shoutouts (
  id            uuid        primary key default gen_random_uuid(),
  student_id    uuid        not null references public.students(id)  on delete cascade,
  teacher_id    uuid        not null references public.teachers(id)  on delete restrict,
  shoutout_type text        not null check (shoutout_type in ('strength', 'growth', 'character')),
  shoutout_text text        not null,
  personal_note text,
  week_number   integer,
  school_year   text,
  created_at    timestamptz not null default now()
);

alter table public.student_shoutouts enable row level security;

create index if not exists shoutouts_student_id_idx on public.student_shoutouts(student_id);
create index if not exists shoutouts_teacher_id_idx on public.student_shoutouts(teacher_id);
create index if not exists shoutouts_created_at_idx on public.student_shoutouts(created_at desc);

-- Teachers: insert shoutouts only for students in their own advisory
create policy "Teachers insert shoutouts for own students"
  on public.student_shoutouts
  for insert
  with check (
    auth.uid() = teacher_id
    and exists (
      select 1
      from   public.advisory_classes ac
      join   public.students         s on s.advisory_class_id = ac.id
      where  ac.teacher_id = auth.uid()
      and    s.id           = student_id
    )
  );

-- Teachers: read all shoutouts they created
create policy "Teachers read own shoutouts"
  on public.student_shoutouts
  for select
  using (auth.uid() = teacher_id);

-- Students: read their own shoutouts via auth_user_id
create policy "Students read own shoutouts"
  on public.student_shoutouts
  for select
  using (
    student_id in (
      select id from public.students
      where  auth_user_id = auth.uid()
    )
  );
