const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'..','score.html'),'utf8');
const D=require('../english-domain-core');
test('compact English form requires only exam and score, with legacy details closed and score-table link',()=>{
 const form=s.slice(s.indexOf('<form inert'),s.indexOf('</form>'));
 const required=[...form.matchAll(/<input[^>]*\brequired[^>]*>/g)].map(m=>m[0].match(/id="([^"]+)"/)[1]);assert.deepEqual(required,['examTitle','realScore']);
 assert.match(form,/<details id="extraAnalysis" class="extra-analysis">/);assert.ok(form.indexOf('id="nextGoal"')<form.indexOf('id="extraAnalysis"'));assert.ok(form.includes('history.html#scoreTable'));assert.ok(!form.includes('id="examDate"'));assert.ok(!/name="markingError"[^>]*checked/.test(form));
});
test('basic edit sends no hidden detail fields, original feedback or exam date',()=>{
 const code=s.slice(s.indexOf('      let savedId = scoreId;'),s.indexOf('\n\n\n      if (scoreId)',s.indexOf('      let savedId = scoreId;')));
 const original={exam_title:'old',loss_listening:{nums:'3',unknown:{keep:true}},time_allocation:[{unknown:'legacy'}],teacher_comment:'keep'};
 const r={user_id:'me',exam_title:'new',real_score:'84',real_grade:'2',one_line_review:'short',next_goal:'goal',loss_listening:{nums:'changed'},time_allocation:[]};
 const c=vm.createContext({scoreId:'1',advancedDirty:false,reportData:r,EnglishDomains:D});vm.runInContext(code,c);assert.deepEqual(Object.keys(r),['user_id','exam_title','real_score','real_grade','one_line_review','next_goal']);assert.equal(original.loss_listening.unknown.keep,true);assert.equal(r.teacher_comment,undefined);
});
test('new minimal entry cannot infer whole-exam accuracy from sparse wrong-answer notes',()=>{
 const code=s.slice(s.indexOf('      let savedId = scoreId;'),s.indexOf('\n\n\n      if (scoreId)',s.indexOf('      let savedId = scoreId;')));
 const r={exam_title:'sample',user_id:'me',type:'score'};for(const d of D.domains)r['loss_'+d.key]={nums:'',reason:''};
 vm.runInNewContext(code,{scoreId:null,advancedDirty:false,reportData:r,EnglishDomains:D});
 for(const d of D.domains){assert.equal(r['loss_'+d.key].assessment_status,'unassessed');assert.equal(D.deriveRates([r],[{type:'note',user_id:'me',exam_title:'sample',question_info:'22',result:'wrong'}],d).total,0);}
 r.loss_listening.assessment={version:1,correct:15,incorrect:2};assert.equal(D.deriveRates([r],[],D.domains[0]).total,17);
});
test('all inline scripts parse and student save uses existing owner checks',()=>{for(const m of s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);assert.ok(s.includes("AppAccess.updateActive(supabaseClient, 'score_reports', scoreId, reportData, false, true)"));assert.ok(s.includes(".select('name').eq('id', access.user.id)"));assert.ok(s.includes('AppAccess.assertCurrent(access.version)'));});

test('optional time-row add/delete clicks mark existing details dirty without marking programmatic load',()=>{const listeners={};const code=s.slice(s.indexOf('  let advancedDirty = false;'),s.indexOf('  let editorReady = false;'));const c=vm.createContext({document:{getElementById:()=>({addEventListener:(name,fn)=>listeners[name]=fn})}});vm.runInContext(code,c);assert.equal(vm.runInContext('advancedDirty',c),false);listeners.click({target:{closest:()=>null}});assert.equal(vm.runInContext('advancedDirty',c),false);listeners.click({target:{closest:()=>({type:'button'})}});assert.equal(vm.runInContext('advancedDirty',c),true);});
