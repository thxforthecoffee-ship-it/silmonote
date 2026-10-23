-- New, teacher-private records only. Existing student tables/policies are unchanged.
create table public.teacher_assignments (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null default auth.uid() references public.profiles(id),
 student_id uuid not null references public.profiles(id),
 task_text text not null check (char_length(btrim(task_text)) between 1 and 2000),
 due_date date,
 status text not null default 'planned' check (status in ('planned','deferred','completed')),
 result_text text not null default '' check (char_length(result_text)<=4000),
 followup_text text not null default '' check (char_length(followup_text)<=4000),
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 revision integer not null default 1 check (revision>0),
 check (teacher_id<>student_id),
 check (due_date is null or due_date between date '0001-01-01' and date '9999-12-31')
);
alter table public.teacher_assignments enable row level security;
alter table public.teacher_assignments force row level security;
revoke all on public.teacher_assignments from public, anon, authenticated;
grant select on public.teacher_assignments to authenticated;
grant insert (id,teacher_id,student_id,task_text,due_date,status,result_text,followup_text) on public.teacher_assignments to authenticated;
grant update (task_text,due_date,status,result_text,followup_text) on public.teacher_assignments to authenticated;
create index teacher_assignments_owner_student_created on public.teacher_assignments (teacher_id,student_id,created_at desc,id);
create index teacher_assignments_student on public.teacher_assignments (student_id);
create function silmo_private.guard_teacher_assignment() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
  NEW.created_at:=statement_timestamp(); NEW.updated_at:=NEW.created_at; NEW.revision:=1;
 else
  if NEW.id is distinct from OLD.id or NEW.teacher_id is distinct from OLD.teacher_id
     or NEW.student_id is distinct from OLD.student_id or NEW.created_at is distinct from OLD.created_at then
   raise exception 'Assignment ownership and creation fields are immutable' using errcode='42501';
  end if;
  NEW.updated_at:=statement_timestamp(); NEW.revision:=OLD.revision+1;
 end if;
 return NEW;
end $$;
revoke all on function silmo_private.guard_teacher_assignment() from public,anon,authenticated;
create trigger guard_teacher_assignment before insert or update on public.teacher_assignments
for each row execute function silmo_private.guard_teacher_assignment();
create policy teacher_assignments_select on public.teacher_assignments for select to authenticated
using (teacher_id=(select auth.uid()) and (select silmo_private.is_admin()));
create policy teacher_assignments_insert on public.teacher_assignments for insert to authenticated
with check (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=teacher_assignments.student_id and p.is_approved is true));
create policy teacher_assignments_update on public.teacher_assignments for update to authenticated
using (teacher_id=(select auth.uid()) and (select silmo_private.is_admin()))
with check (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=teacher_assignments.student_id and p.is_approved is true));
