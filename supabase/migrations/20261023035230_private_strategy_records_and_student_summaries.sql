-- Applied migration: private strategy evidence and student-safe summaries.
-- Physically separate private teacher evidence from student-visible summaries.
-- Existing records, administrator membership, and existing policies are unchanged.
create table public.teacher_strategy_records (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null default auth.uid() references public.profiles(id),
 student_id uuid not null references public.profiles(id),
 source_key text not null check (char_length(btrim(source_key)) between 1 and 250),
 source_label text not null default '' check (char_length(source_label)<=500),
 source_excerpt text not null default '' check (char_length(source_excerpt)<=8000),
 event_date date,
 date_precision text not null default 'unknown' check (date_precision in ('exact','month','unknown')),
 record_type text not null default 'exam_note' check (record_type in ('exam_note','lesson_plan','historical_context')),
 exam_label text not null default '' check (char_length(exam_label)<=300),
 score_report_id bigint references public.score_reports(id),
 reason_text text not null default '' check (char_length(reason_text)<=4000),
 plan_text text not null default '' check (char_length(plan_text)<=4000),
 observation_text text not null default '' check (char_length(observation_text)<=4000),
 result_text text not null default '' check (char_length(result_text)<=4000),
 next_check_text text not null default '' check (char_length(next_check_text)<=4000),
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 revision integer not null default 1 check (revision>0),
 unique (teacher_id,student_id,source_key),
 check (teacher_id<>student_id),
 check ((date_precision='unknown' and event_date is null) or (date_precision<>'unknown' and event_date is not null)),
 check (event_date is null or event_date between date '0001-01-01' and date '9999-12-31')
);
create table public.student_strategy_summaries (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null default auth.uid() references public.profiles(id),
 student_id uuid not null references public.profiles(id),
 summary_text text not null check (char_length(btrim(summary_text)) between 1 and 2000),
 is_published boolean not null default false,
 created_at timestamptz not null default statement_timestamp(),
 updated_at timestamptz not null default statement_timestamp(),
 revision integer not null default 1 check (revision>0),
 unique (teacher_id,student_id),
 check (teacher_id<>student_id)
);
alter table public.teacher_strategy_records enable row level security;
alter table public.teacher_strategy_records force row level security;
alter table public.student_strategy_summaries enable row level security;
alter table public.student_strategy_summaries force row level security;
revoke all on public.teacher_strategy_records,public.student_strategy_summaries from public,anon,authenticated;
grant select on public.teacher_strategy_records,public.student_strategy_summaries to authenticated;
grant insert (id,teacher_id,student_id,source_key,source_label,source_excerpt,event_date,date_precision,record_type,exam_label,score_report_id,reason_text,plan_text,observation_text,result_text,next_check_text) on public.teacher_strategy_records to authenticated;
grant update (reason_text,plan_text,observation_text,result_text,next_check_text) on public.teacher_strategy_records to authenticated;
grant insert (id,teacher_id,student_id,summary_text,is_published) on public.student_strategy_summaries to authenticated;
grant update (summary_text,is_published) on public.student_strategy_summaries to authenticated;
create index teacher_strategy_records_owner_student_date on public.teacher_strategy_records (teacher_id,student_id,event_date desc,id);
create index teacher_strategy_records_student on public.teacher_strategy_records (student_id);
create index teacher_strategy_records_score on public.teacher_strategy_records (score_report_id);
create index student_strategy_summaries_student on public.student_strategy_summaries (student_id);

create function silmo_private.guard_strategy_record() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
  NEW.created_at:=statement_timestamp(); NEW.updated_at:=NEW.created_at; NEW.revision:=1;
  if TG_TABLE_NAME='teacher_strategy_records' then
   if NEW.score_report_id is not null and not exists (
    select 1 from public.score_reports s where s.id=NEW.score_report_id and s.user_id=NEW.student_id
   ) then
    raise exception 'Strategy source must belong to the selected student' using errcode='42501';
   end if;
  end if;
 else
  if NEW.id is distinct from OLD.id or NEW.teacher_id is distinct from OLD.teacher_id
   or NEW.student_id is distinct from OLD.student_id or NEW.created_at is distinct from OLD.created_at then
   raise exception 'Strategy ownership and creation fields are immutable' using errcode='42501';
  end if;
  if TG_TABLE_NAME='teacher_strategy_records' then
   if NEW.source_key is distinct from OLD.source_key or NEW.source_label is distinct from OLD.source_label
    or NEW.source_excerpt is distinct from OLD.source_excerpt or NEW.event_date is distinct from OLD.event_date
    or NEW.date_precision is distinct from OLD.date_precision or NEW.record_type is distinct from OLD.record_type
    or NEW.exam_label is distinct from OLD.exam_label or NEW.score_report_id is distinct from OLD.score_report_id then
    raise exception 'Imported strategy source fields are immutable' using errcode='42501';
   end if;
  end if;
  NEW.updated_at:=statement_timestamp(); NEW.revision:=OLD.revision+1;
 end if;
 return NEW;
end $$;
revoke all on function silmo_private.guard_strategy_record() from public,anon,authenticated;
create trigger guard_teacher_strategy_record before insert or update on public.teacher_strategy_records
for each row execute function silmo_private.guard_strategy_record();
create trigger guard_student_strategy_summary before insert or update on public.student_strategy_summaries
for each row execute function silmo_private.guard_strategy_record();

create policy teacher_strategy_records_select on public.teacher_strategy_records for select to authenticated
using (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true));
create policy teacher_strategy_records_insert on public.teacher_strategy_records for insert to authenticated
with check (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true)
 and exists(select 1 from public.profiles p where p.id=teacher_strategy_records.student_id and p.is_approved is true));
create policy teacher_strategy_records_update on public.teacher_strategy_records for update to authenticated
using (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true))
with check (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true)
 and exists(select 1 from public.profiles p where p.id=teacher_strategy_records.student_id and p.is_approved is true));

create policy student_strategy_summaries_select on public.student_strategy_summaries for select to authenticated
using (
 (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true))
 or (student_id=(select auth.uid()) and is_published
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true))
);
create policy student_strategy_summaries_insert on public.student_strategy_summaries for insert to authenticated
with check (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true)
 and exists(select 1 from public.profiles p where p.id=student_strategy_summaries.student_id and p.is_approved is true));
create policy student_strategy_summaries_update on public.student_strategy_summaries for update to authenticated
using (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true))
with check (teacher_id=(select auth.uid()) and (select silmo_private.is_admin())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_approved is true)
 and exists(select 1 from public.profiles p where p.id=student_strategy_summaries.student_id and p.is_approved is true));
