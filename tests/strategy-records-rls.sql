-- Rollback-only role verification; run after the approved migration.
-- Existing identities are read only. No auth.users or administrator fixtures.
-- All test rows are created in the new strategy tables and rolled back.
begin;
select set_config('test.owner',(select a.user_id::text from silmo_private.administrators a join public.profiles p on p.id=a.user_id where p.is_approved is true order by a.user_id limit 1),true);
select set_config('test.student',(select p.id::text from public.profiles p where p.is_approved is true and not exists(select 1 from silmo_private.administrators a where a.user_id=p.id) and not exists(select 1 from public.student_strategy_summaries s where s.teacher_id=current_setting('test.owner')::uuid and s.student_id=p.id) and exists(select 1 from public.score_reports s where s.user_id<>p.id) order by p.id limit 1),true);
select set_config('test.other',(select p.id::text from public.profiles p where p.is_approved is true and p.id<>current_setting('test.student')::uuid and not exists(select 1 from silmo_private.administrators a where a.user_id=p.id) order by p.id limit 1),true),
 set_config('test.private',gen_random_uuid()::text,true),set_config('test.summary',gen_random_uuid()::text,true),
 set_config('test.other_private',gen_random_uuid()::text,true),set_config('test.other_summary',gen_random_uuid()::text,true);
select set_config('test.foreign_exam',(select s.id::text from public.score_reports s where s.user_id<>current_setting('test.student')::uuid order by s.id limit 1),true);
do $$ begin
 assert nullif(current_setting('test.owner'),'') is not null,'An approved administrator is required';
 assert nullif(current_setting('test.student'),'') is not null,'An approved student without an existing creator summary is required';
 assert nullif(current_setting('test.other'),'') is not null,'A second existing approved student is required';
end $$;
-- A server-created different-owner fixture tests that a real approved admin is
-- not a global reader. It creates no extra admin membership or login identity.
insert into public.teacher_strategy_records(id,teacher_id,student_id,source_key,source_excerpt)
values(current_setting('test.other_private')::uuid,current_setting('test.other')::uuid,current_setting('test.student')::uuid,current_setting('test.other_private'),'OTHER_OWNER_PRIVATE_SENTINEL');
insert into public.student_strategy_summaries(id,teacher_id,student_id,summary_text,is_published)
values(current_setting('test.other_summary')::uuid,current_setting('test.other')::uuid,current_setting('test.student')::uuid,'Other-owner draft sentinel',false);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
do $$ declare n integer; begin
 assert (select count(*)=0 from public.teacher_strategy_records where id=current_setting('test.other_private')::uuid),'Administrator can read another creator private record';
 assert (select count(*)=0 from public.student_strategy_summaries where id=current_setting('test.other_summary')::uuid),'Administrator can read another creator summary';
 update public.teacher_strategy_records set observation_text='Cross-owner update' where id=current_setting('test.other_private')::uuid;
 get diagnostics n=row_count; assert n=0,'Administrator can update another creator private record';
 update public.student_strategy_summaries set summary_text='Cross-owner update' where id=current_setting('test.other_summary')::uuid;
 get diagnostics n=row_count; assert n=0,'Administrator can update another creator summary';
 insert into public.teacher_strategy_records(id,student_id,source_key,source_excerpt,event_date,date_precision,record_type,reason_text,plan_text)
 values(current_setting('test.private')::uuid,current_setting('test.student')::uuid,current_setting('test.private'),'PRIVATE_SOURCE_MUST_NOT_LEAK','2026-10-10','exact','lesson_plan','Private reasoning','Planned order, not an outcome');
 assert (select count(*)=1 from public.teacher_strategy_records where id=current_setting('test.private')::uuid),'Creator private read failed';
 update public.teacher_strategy_records set observation_text='Observation sentinel' where id=current_setting('test.private')::uuid and revision=1;
 get diagnostics n=row_count; assert n=1,'Creator private update failed';
 assert (select revision=2 from public.teacher_strategy_records where id=current_setting('test.private')::uuid),'Private revision failed';
 begin update public.teacher_strategy_records set source_excerpt='Altered original' where id=current_setting('test.private')::uuid; raise exception 'Source overwrite allowed'; exception when insufficient_privilege then null; end;
 begin update public.teacher_strategy_records set teacher_id=current_setting('test.other')::uuid where id=current_setting('test.private')::uuid; raise exception 'Owner mutation allowed'; exception when insufficient_privilege then null; end;
 begin update public.teacher_strategy_records set student_id=current_setting('test.other')::uuid where id=current_setting('test.private')::uuid; raise exception 'Student mutation allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.teacher_strategy_records(student_id,source_key,score_report_id) values(current_setting('test.student')::uuid,gen_random_uuid()::text,current_setting('test.foreign_exam')::bigint); raise exception 'Cross-student exam association allowed'; exception when insufficient_privilege then null; end;
 insert into public.student_strategy_summaries(id,student_id,summary_text) values(current_setting('test.summary')::uuid,current_setting('test.student')::uuid,'Student-safe process only');
 assert (select revision=1 and is_published=false from public.student_strategy_summaries where id=current_setting('test.summary')::uuid),'Draft defaults failed';
 assert not has_table_privilege(current_user,'public.teacher_strategy_records','DELETE'),'Private hard delete granted';
 assert not has_table_privilege(current_user,'public.student_strategy_summaries','DELETE'),'Summary hard delete granted';
 begin insert into public.teacher_strategy_records(teacher_id,student_id,source_key) values(current_setting('test.other')::uuid,current_setting('test.student')::uuid,gen_random_uuid()::text); raise exception 'Spoofed creator allowed'; exception when insufficient_privilege then null; end;
 begin update public.student_strategy_summaries set summary_text=repeat('x',2001) where id=current_setting('test.summary')::uuid; raise exception 'Oversized summary allowed'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student'),'role','authenticated','user_metadata',jsonb_build_object('is_admin',true))::text,true);
do $$ begin
 assert (select count(*)=0 from public.teacher_strategy_records),'Student can read private source rows';
 assert (select count(*)=0 from public.student_strategy_summaries where id=current_setting('test.summary')::uuid),'Student can read unpublished summary';
 begin insert into public.teacher_strategy_records(student_id,source_key) values(current_setting('test.owner')::uuid,gen_random_uuid()::text); raise exception 'Student private insert allowed'; exception when insufficient_privilege then null; end;
 begin insert into public.student_strategy_summaries(student_id,summary_text,is_published) values(current_setting('test.owner')::uuid,'Student injected summary',true); raise exception 'Student insert allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
do $$ declare n integer; begin
 update public.student_strategy_summaries set is_published=true where id=current_setting('test.summary')::uuid and revision=1;
 get diagnostics n=row_count; assert n=1,'Publish failed';
 assert (select revision=2 from public.student_strategy_summaries where id=current_setting('test.summary')::uuid),'Summary revision failed';
 update public.student_strategy_summaries set summary_text='Stale write' where id=current_setting('test.summary')::uuid and revision=1;
 get diagnostics n=row_count; assert n=0,'Stale summary write allowed';
 begin update public.student_strategy_summaries set student_id=current_setting('test.other')::uuid where id=current_setting('test.summary')::uuid; raise exception 'Summary reassignment allowed'; exception when insufficient_privilege then null; end;
 begin update public.student_strategy_summaries set teacher_id=current_setting('test.other')::uuid where id=current_setting('test.summary')::uuid; raise exception 'Summary creator mutation allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student'),'role','authenticated')::text,true);
do $$ declare n integer; begin
 assert (select count(*)=1 from public.student_strategy_summaries where id=current_setting('test.summary')::uuid and summary_text='Student-safe process only'),'Own published summary read failed';
 assert (select count(*)=0 from public.teacher_strategy_records),'Published summary exposes private rows';
 update public.student_strategy_summaries set summary_text='Student overwrite' where id=current_setting('test.summary')::uuid;
 get diagnostics n=row_count; assert n=0,'Student summary update allowed';
 update public.teacher_strategy_records set observation_text='Student overwrite' where id=current_setting('test.private')::uuid;
 get diagnostics n=row_count; assert n=0,'Student private update allowed';
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.other'),'role','authenticated')::text,true);
do $$ begin
 assert (select count(*)=0 from public.student_strategy_summaries where id=current_setting('test.summary')::uuid),'Other student can read published summary';
 assert (select count(*)=0 from public.teacher_strategy_records),'Non-admin fixture owner can read private rows';
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
update public.student_strategy_summaries set is_published=false where id=current_setting('test.summary')::uuid and revision=2;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student'),'role','authenticated')::text,true);
do $$ begin assert (select count(*)=0 from public.student_strategy_summaries where id=current_setting('test.summary')::uuid),'Unpublish failed'; end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform count(*) from public.teacher_strategy_records; raise exception 'Anonymous private read allowed'; exception when insufficient_privilege then null; end;
 begin perform count(*) from public.student_strategy_summaries; raise exception 'Anonymous summary read allowed'; exception when insufficient_privilege then null; end;
 assert not has_table_privilege(current_user,'public.teacher_strategy_records','INSERT'),'Anon private insert granted';
 assert not has_table_privilege(current_user,'public.student_strategy_summaries','UPDATE'),'Anon summary update granted';
end $$;
reset role;
rollback;
select 'Strategy ownership, draft/publish/unpublish, student/anonymous isolation, source immutability and revision checks passed; rolled back' as result;
