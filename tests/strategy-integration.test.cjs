const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('history.html','utf8');
test('manual strategy is separate from assignments and before rate priorities',()=>{
 assert(html.indexOf('id="strategyPanel"')<html.indexOf('id="adminReview"'));
 assert.match(html,/<script src="strategy-panel\.js\?v=[^"]+"><\/script>/);
 assert(html.includes('id="teacherAssignments"'));
 assert(html.includes('strategyPanel?.invalidate();strategyStudentId=null;'));
});
test('manual strategy selection follows admin student selection and keeps same-student drafts on refresh',()=>{
 const start=html.indexOf('if(reset&&strategyPanel)'),end=html.indexOf('\n if(reset){if(assignmentPanel)',start);
 assert(start>=0&&end>start);let selected=[],refresh=0;
 const state={reset:true,identity:{isAdmin:true,user:{id:'teacher'}},selectedId:'student-a',strategyStudentId:null,strategyPanel:{selectStudent:id=>selected.push(id),refresh:()=>refresh++}};
 const code=html.slice(start,end);vm.runInNewContext(code,state);vm.runInNewContext(code,state);
 assert.deepEqual(selected,['student-a']);assert.equal(refresh,1);
 state.selectedId='teacher';vm.runInNewContext(code,state);assert.equal(selected.at(-1),'');
 state.identity={isAdmin:false,user:{id:'student-b'}};state.selectedId='student-b';state.strategyPanel=null;vm.runInNewContext(code,state);assert.equal(selected.length,2);
});
test('only verified admins get a strategy editor and its callback requires admin access',async()=>{
 const source=html.slice(html.indexOf('function setupStrategyPanel('),html.indexOf('function setupAdminReview('));let config,current={user:{id:'teacher-a'},isAdmin:true,version:1};const required=[];
 const host={hidden:true},state={strategyPanel:null,identity:{user:{id:'student-a'},isAdmin:false},client:{},$:()=>host,StrategyPanel:{create:c=>{config=c;return{};}},AppAccess:{requireAccess:async(client,adminOnly)=>{required.push(adminOnly);return current;},assertCurrent:()=>{}}};
 vm.runInNewContext(source+';setupStrategyPanel();',state);assert.equal(config,undefined);assert.equal(host.hidden,true);
 state.identity={user:{id:'teacher-a'},isAdmin:true};vm.runInNewContext('setupStrategyPanel();',state);assert(config);assert.equal(host.hidden,false);
 assert.equal((await config.verifyAccess()).user.id,'teacher-a');assert.deepEqual(required,[true]);
 current={...current,user:{id:'teacher-b'}};await assert.rejects(config.verifyAccess(),/계정 또는 권한/);
 current={user:{id:'teacher-a'},isAdmin:false,version:1};await assert.rejects(config.verifyAccess(),/계정 또는 권한/);
});
test('manual strategy is entirely excluded from both admin and student print',()=>{
 const section=html.match(/<section id="strategyPanel"[^>]*>/)?.[0];assert(section);assert.match(section,/class="[^"]*\bno-print\b/);assert.match(section,/\bhidden\b/);
 assert(!html.includes(':not(#strategyPanel)'));assert(!html.includes(':not(#teacherAssignments)'));
 assert.match(html,/@media print\{[^\n]*\.no-print\{display:none!important\}/);
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
});
