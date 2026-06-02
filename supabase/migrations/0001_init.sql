-- Supabase schema for The Kitchen Table advisory teacher dashboard

create extension if not exists pgcrypto;

-- schools
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  district text,
  semester_weeks int not null default 18,
  semester_start_date date not null default current_date,
  timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schools enable row level security;
create policy "Allow authenticated select on schools" on public.schools
  for select using (auth.role() = 'authenticated');
create index if not exists schools_semester_weeks_idx on public.schools(semester_weeks);

-- teachers
create table if not exists public.teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  preferred_name text,
  school_id uuid not null references public.schools(id) on delete restrict,
  role text not null default 'teacher' check (role in ('teacher', 'admin', 'counselor', 'student_support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.teachers enable row level security;
create policy "Allow authenticated select on teachers" on public.teachers
  for select using (auth.role() = 'authenticated');
create index if not exists teachers_school_id_idx on public.teachers(school_id);
create index if not exists teachers_role_idx on public.teachers(role);

-- advisory classes
create table if not exists public.advisory_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  grade_level text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.advisory_classes enable row level security;
create policy "Allow authenticated select on advisory_classes" on public.advisory_classes
  for select using (auth.role() = 'authenticated');
create index if not exists advisory_classes_school_id_idx on public.advisory_classes(school_id);
create index if not exists advisory_classes_teacher_id_idx on public.advisory_classes(teacher_id);

-- students
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  student_id_external text unique,
  first_name text not null,
  last_name text not null,
  preferred_name text,
  grade_level text,
  gender text,
  birth_date date,
  school_id uuid not null references public.schools(id) on delete restrict,
  advisory_class_id uuid references public.advisory_classes(id) on delete set null,
  target_gpa numeric(3,2),
  status text not null default 'active' check (status in ('active', 'inactive', 'alumni')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.students enable row level security;
create policy "Allow authenticated select on students" on public.students
  for select using (auth.role() = 'authenticated');
create index if not exists students_school_id_idx on public.students(school_id);
create index if not exists students_advisory_class_id_idx on public.students(advisory_class_id);
create index if not exists students_external_id_idx on public.students(student_id_external);

-- classes
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  advisory_class_id uuid not null references public.advisory_classes(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  name text not null,
  subject text,
  period text,
  semester text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes enable row level security;
create policy "Allow authenticated select on classes" on public.classes
  for select using (auth.role() = 'authenticated');
create index if not exists classes_advisory_class_id_idx on public.classes(advisory_class_id);
create index if not exists classes_teacher_id_idx on public.classes(teacher_id);

-- weekly GPA snapshots
create table if not exists public.weekly_gpa_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  school_year text not null,
  week_number int not null,
  gpa numeric(3,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year, week_number)
);

alter table public.weekly_gpa_snapshots enable row level security;
create policy "Allow authenticated select on weekly_gpa_snapshots" on public.weekly_gpa_snapshots
  for select using (auth.role() = 'authenticated');
create index if not exists weekly_gpa_snapshots_student_id_idx on public.weekly_gpa_snapshots(student_id);
create index if not exists weekly_gpa_snapshots_week_number_idx on public.weekly_gpa_snapshots(week_number);
create index if not exists weekly_gpa_snapshots_school_year_idx on public.weekly_gpa_snapshots(school_year);

-- weekly class grades
create table if not exists public.weekly_class_grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  school_year text not null,
  week_number int not null,
  grade text,
  grade_points numeric(4,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, class_id, school_year, week_number)
);

alter table public.weekly_class_grades enable row level security;
create policy "Allow authenticated select on weekly_class_grades" on public.weekly_class_grades
  for select using (auth.role() = 'authenticated');
create index if not exists weekly_class_grades_student_id_idx on public.weekly_class_grades(student_id);
create index if not exists weekly_class_grades_class_id_idx on public.weekly_class_grades(class_id);
create index if not exists weekly_class_grades_week_number_idx on public.weekly_class_grades(week_number);
create index if not exists weekly_class_grades_school_year_idx on public.weekly_class_grades(school_year);

-- weekly attendance
create table if not exists public.weekly_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid references public.classes(id) on delete set null,
  advisory_class_id uuid references public.advisory_classes(id) on delete set null,
  school_year text not null,
  week_number int not null,
  present_days int not null default 0,
  absent_days int not null default 0,
  tardies int not null default 0,
  excused_days int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year, week_number)
);

alter table public.weekly_attendance enable row level security;
create policy "Allow authenticated select on weekly_attendance" on public.weekly_attendance
  for select using (auth.role() = 'authenticated');
create index if not exists weekly_attendance_student_id_idx on public.weekly_attendance(student_id);
create index if not exists weekly_attendance_class_id_idx on public.weekly_attendance(class_id);
create index if not exists weekly_attendance_advisory_class_id_idx on public.weekly_attendance(advisory_class_id);
create index if not exists weekly_attendance_week_number_idx on public.weekly_attendance(week_number);
create index if not exists weekly_attendance_school_year_idx on public.weekly_attendance(school_year);

-- audit trigger to keep updated_at current
create or replace function public.trigger_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger schools_updated_at
  before update on public.schools
  for each row execute function public.trigger_set_updated_at();

create trigger teachers_updated_at
  before update on public.teachers
  for each row execute function public.trigger_set_updated_at();

create trigger advisory_classes_updated_at
  before update on public.advisory_classes
  for each row execute function public.trigger_set_updated_at();

create trigger students_updated_at
  before update on public.students
  for each row execute function public.trigger_set_updated_at();

create trigger classes_updated_at
  before update on public.classes
  for each row execute function public.trigger_set_updated_at();

create trigger weekly_gpa_snapshots_updated_at
  before update on public.weekly_gpa_snapshots
  for each row execute function public.trigger_set_updated_at();

create trigger weekly_class_grades_updated_at
  before update on public.weekly_class_grades
  for each row execute function public.trigger_set_updated_at();

create trigger weekly_attendance_updated_at
  before update on public.weekly_attendance
  for each row execute function public.trigger_set_updated_at();
