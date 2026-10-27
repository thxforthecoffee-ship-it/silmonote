const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('history.html','utf8');
test('strategy is separate from assignments and visible before rate priorities',()=>{
 assert(html.indexOf('id="strategyPanel"')<html.indexOf('id="adminReview"'));
 assert(html.includes('<script src="strategy-panel.js?v=20261027-compact"></script>'));
 assert(html.includes('id="teacherAssignments"'));
 assert(html.includes("$('strategyPanel').hidden=false;"));
 assert(html.includes('strategyPanel?.invalidate();strategyStudentId=null;'));
});
test('strategy selection follows actual account and preserves same-student drafts on refresh',()=>{
 const start=html.indexOf('if(reset&&strategyPanel)'),end=html.indexOf('\n if(reset){if(assignmentPanel)',start);
 assert(start>=0&&end>start);let selected=[],refresh=0;
 const state={reset:true,identity:{isAdmin:true,user:{id:'teacher'}},selectedId:'student-a',strategyStudentId:null,strategyPanel:{selectStudent:id=>selected.push(id),refresh:()=>refresh++}};
 const code=html.slice(start,end);vm.runInNewContext(code,state);vm.runInNewContext(code,state);
 assert.deepEqual(selected,['student-a']);assert.equal(refresh,1);
 state.selectedId='teacher';vm.runInNewContext(code,state);assert.equal(selected.at(-1),'');
 state.identity={isAdmin:false,user:{id:'student-b'}};state.selectedId='student-b';vm.runInNewContext(code,state);assert.equal(selected.at(-1),'student-b');
});
test('strategy access callback rejects changed account or role',async()=>{
 const source=html.slice(html.indexOf('function setupStrategyPanel('),html.indexOf('function setupAdminReview('));let config,current={user:{id:'student-a'},isAdmin:false,version:1};
 const state={strategyPanel:null,identity:{user:{id:'student-a'},isAdmin:false},client:{},$:()=>({}),StrategyPanel:{create:c=>{config=c;return{};}},AppAccess:{requireAccess:async()=>current,assertCurrent:()=>{}}};
 vm.runInNewContext(source+';setupStrategyPanel();',state);assert.equal((await config.verifyAccess()).user.id,'student-a');
 current={...current,user:{id:'student-b'}};await assert.rejects(config.verifyAccess(),/계정 또는 권한/);
 current={user:{id:'student-a'},isAdmin:true,version:1};await assert.rejects(config.verifyAccess(),/계정 또는 권한/);
});
test('print includes strategy summary section but explicitly excludes private content and existing private assignments',()=>{
 assert(html.includes(':not(#reviewLedger):not(#strategyPanel)'));
 assert(html.includes('#strategyPanel [data-strategy-private]{display:none!important}'));
 assert(!html.includes(':not(#teacherAssignments)'));
 for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new Function(m[1]);
});
