const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261023035230_private_strategy_records_and_student_summaries.sql'),'utf8');
const roleTests=fs.readFileSync(path.join(__dirname,'strategy-records-rls.sql'),'utf8');
test('student summaries are physically separate and have no private source fields',()=>{
 const summary=sql.split('create table public.student_strategy_summaries (')[1].split('\n);')[0];
 assert.match(summary,/summary_text text/);assert.match(summary,/is_published boolean not null default false/);
 assert.doesNotMatch(summary,/source_excerpt|source_label|reason_text|observation_text|score_report_id/);
});
test('both tables force RLS and grant no hard delete',()=>{
 for(const table of ['teacher_strategy_records','student_strategy_summaries']){
  assert.ok(sql.includes(`alter table public.${table} force row level security;`));
 }
 assert.doesNotMatch(sql,/grant\s+(all|delete)/i);
 assert.doesNotMatch(sql,/create policy[^;]*for delete/i);
});
test('private read policy has only approved creator-admin access',()=>{
 const policy=sql.split('create policy teacher_strategy_records_select')[1].split(';')[0];
 assert.match(policy,/teacher_id=\(select auth.uid\(\)\)/);
 assert.match(policy,/silmo_private.is_admin/);assert.match(policy,/is_approved is true/);
 assert.doesNotMatch(policy,/\bor\b|student_id=\(select auth.uid/i);
});
test('student summary visibility requires publication and own approved identity',()=>{
 const policy=sql.split('create policy student_strategy_summaries_select')[1].split(';')[0];
 assert.match(policy,/student_id=\(select auth.uid\(\)\) and is_published/);
 assert.match(policy,/is_approved is true/);
});
test('immutable provenance and owner guard, no security-definer helper added',()=>{
 assert.match(sql,/language plpgsql security invoker set search_path=''/);
 assert.match(sql,/NEW.teacher_id is distinct from OLD.teacher_id/);
 assert.match(sql,/NEW.student_id is distinct from OLD.student_id/);
 assert.match(sql,/NEW.source_excerpt is distinct from OLD.source_excerpt/);
 assert.match(sql,/s.id=NEW.score_report_id and s.user_id=NEW.student_id/);
 assert.doesNotMatch(sql,/security definer|insert into auth.users|insert into silmo_private.administrators/i);
});
test('live test draft uses rollback-only new-table fixtures and tests direct student leakage',()=>{
 assert.match(roleTests,/^begin;$/m);assert.match(roleTests,/^rollback;$/m);
 assert.doesNotMatch(roleTests,/insert into auth.users|insert into silmo_private.administrators|update public.profiles/i);
 for(const label of ['Student can read private source rows','Student can read unpublished summary','Other student can read published summary','Cross-student exam association allowed','Unpublish failed','Administrator can update another creator private record'])assert.ok(roleTests.includes(label));
});
