-- Add a two-letter state code to the schools table.

alter table public.schools
  add column if not exists state varchar(2);

comment on column public.schools.state is 'Two-letter US state code for the school, e.g. AR';
