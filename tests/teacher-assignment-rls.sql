begin;
select set_config('test.owner',(select a.user_id::text from silmo_private.administrators a join public.profiles p on p.id=a.user_id where p.is_approved is true order by a.user_id limit 1),true),
set_config('test.student',(select p.id::text from public.profiles p where p.is_approved is true and not exists(select 1 from silmo_private.administrators a where a.user_id=p.id) order by p.id limit 1),true),
set_config('test.assignment',gen_random_uuid()::text,true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.owner'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.owner'),'role','authenticated')::text,true);
do $$ declare n integer; begin
 insert into public.teacher_assignments(id,student_id,task_text) values(current_setting('test.assignment')::uuid,current_setting('test.student')::uuid,'Verification only; rolled back');
 assert (select count(*)=1 from public.teacher_assignments where id=current_setting('test.assignment')::uuid),'Owner select failed';
 assert (select revision=1 and teacher_id=auth.uid() and created_at=updated_at from public.teacher_assignments where id=current_setting('test.assignment')::uuid),'Defaults failed';
 update public.teacher_assignments set status='completed',result_text='Verification',followup_text='Verification',due_date='2026-11-01' where id=current_setting('test.assignment')::uuid and revision=1;
 get diagnostics n=row_count; assert n=1,'Owner update failed';
 assert (select revision=2 from public.teacher_assignments where id=current_setting('test.assignment')::uuid),'Revision failed';
 update public.teacher_assignments set task_text='Stale' where id=current_setting('test.assignment')::uuid and revision=1;
 get diagnostics n=row_count; assert n=0,'Stale write allowed';
 begin update public.teacher_assignments set teacher_id=current_setting('test.student')::uuid where id=current_setting('test.assignment')::uuid; raise exception 'Owner mutation allowed'; exception when insufficient_privilege then null; end;
 begin update public.teacher_assignments set student_id=current_setting('test.owner')::uuid where id=current_setting('test.assignment')::uuid; raise exception 'Student mutation allowed'; exception when insufficient_privilege then null; end;
 begin update public.teacher_assignments set revision=100 where id=current_setting('test.assignment')::uuid; raise exception 'Revision mutation allowed'; exception when insufficient_privilege then null; end;
 assert not has_table_privilege(current_user,'public.teacher_assignments','DELETE'),'Delete granted';
 begin insert into public.teacher_assignments(teacher_id,student_id,task_text) values(current_setting('test.student')::uuid,current_setting('test.owner')::uuid,'Spoof'); raise exception 'Spoof allowed'; exception when insufficient_privilege then null; end;
 begin update public.teacher_assignments set status='invalid' where id=current_setting('test.assignment')::uuid; raise exception 'Invalid status allowed'; exception when check_violation then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.student'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('test.student'),'role','authenticated','user_metadata',jsonb_build_object('is_admin',true))::text,true);
do $$ declare n integer; begin
 assert (select count(*)=0 from public.teacher_assignments),'Student read allowed';
 update public.teacher_assignments set task_text='Unauthorized' where id=current_setting('test.assignment')::uuid;
 get diagnostics n=row_count; assert n=0,'Student update allowed';
 begin insert into public.teacher_assignments(student_id,task_text) values(current_setting('test.owner')::uuid,'Unauthorized'); raise exception 'Student insert allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$ begin
 begin perform count(*) from public.teacher_assignments; raise exception 'Anonymous read allowed'; exception when insufficient_privilege then null; end;
 assert not has_table_privilege(current_user,'public.teacher_assignments','INSERT'),'Anon insert granted';
 assert not has_table_privilege(current_user,'public.teacher_assignments','UPDATE'),'Anon update granted';
 assert not has_table_privilege(current_user,'public.teacher_assignments','DELETE'),'Anon delete granted';
end $$;
reset role;
rollback;
select 'owner create/read/update, stale-write guard, immutable owner/student, spoofed admin, student and anon denials passed; rolled back' as result;