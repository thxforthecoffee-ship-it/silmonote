/* Synthetic-only browser regression. Every request is intercepted; no real account or database is used. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://silmonote.test';
const student='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',otherStudent='cccccccc-cccc-4ccc-cccc-cccccccccccc';
const sourceKey='app:manual-strategy:v1';
const legacyValues={order:'가상 순서 A → B',time:'연습 12분 / 검토 5분',types:'가상 유형 A · B'};
const values={steps:[{time:'처음 10분',task:'가상 유형 A 확인'},{time:'다음 7분',task:'가상 유형 B 풀이'}],deferred:'가상 추가 문항은 남는 시간에 검토'};
async function prepare(page,admin,legacy=false){
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({status:200,contentType:'application/javascript',body:''});
  if(url.origin!==origin)return route.abort();
  const relative=decodeURIComponent(url.pathname).replace(/^\//,'');
  if(!/^[a-z0-9-]+\.(?:html|js|css)$/.test(relative))return route.fulfill({status:404,body:'Not found'});
  const file=path.join(root,relative);if(!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
  return route.fulfill({status:200,contentType:relative.endsWith('.html')?'text/html':relative.endsWith('.js')?'application/javascript':'text/css',body:fs.readFileSync(file)});
 });
 await page.addInitScript(({admin,student,otherStudent,legacy,legacyValues})=>{
  const teacher='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const imported={id:'imported-fixture',teacher_id:teacher,student_id:student,source_key:'imported:fictional',source_label:'PRIVATE SOURCE LABEL',source_excerpt:'PRIVATE SOURCE',event_date:'2026-01-04',date_precision:'exact',record_type:'lesson_plan',exam_label:'가상 과거 계획',plan_text:'PRIVATE LEGACY PLAN',reason_text:'PRIVATE REASON',observation_text:'PRIVATE OBSERVATION',result_text:'PRIVATE RESULT',next_check_text:'PRIVATE CHECK',revision:1};
  const summary={id:'summary-fixture',teacher_id:teacher,student_id:student,summary_text:'PREVIOUS PUBLISHED SUMMARY',is_published:true,revision:1};
  const score={id:'1',record_id:'1',user_id:student,exam_title:'가상 시험',created_at:'2026-01-03T00:00:00Z',exam_date:'2026-01-02',exam_date_precision:'exact',real_score:80,real_grade:2,deleted_at:null,loss_grammar:{},loss_listening:{assessment:{version:1,correct:16,incorrect:1}},teacher_comment:'가상 듣기 피드백'};
  const manual={id:'manual-fixture',teacher_id:teacher,student_id:student,source_key:'app:manual-strategy:v1',source_label:'직접 입력 풀이 전략',source_excerpt:'',record_type:'lesson_plan',date_precision:'unknown',event_date:null,revision:1,plan_text:JSON.stringify({format:'silmonote.manual-strategy',version:1,...legacyValues})};
  const db=JSON.parse(sessionStorage.getItem('synthetic-strategy-db')||'null')||{profiles:[{id:student,name:'가상 학생 A',is_approved:true},{id:otherStudent,name:'가상 학생 B',is_approved:true}],teacher_strategy_records:legacy?[imported,manual]:[imported],student_strategy_summaries:[summary],teacher_assignments:[],notes:[],score_reports:[score]};
  window.fixture={admin,queries:[],writes:[],writeDelay:0,failNextWrite:false,db,originalImported:imported,originalSummary:summary};
  class Q{
   constructor(table){this.table=table;this.filters=[];this.filterLog=[];this.operation='select';this.start=0;this.max=Infinity;}
   select(fields){this.fields=fields;return this;}
   eq(key,value){this.filters.push(row=>row[key]===value);this.filterLog.push([key,value]);return this;}
   is(key,value){this.filters.push(row=>row[key]==value);return this;}
   lt(key,value){this.filters.push(row=>row[key]<value);return this;}
   order(){return this;}or(){return this;}range(start,end){this.start=start;this.max=end-start+1;return this;}limit(max){this.max=max;return this;}
   update(values){this.operation='update';this.values=values;return this;}insert(values){this.operation='insert';this.values=values;return this;}
   async execute(single=false){
    const f=window.fixture;f.queries.push({table:this.table,operation:this.operation,filters:this.filterLog,fields:this.fields});
    let rows=f.db[this.table]||[],selected=rows.filter(row=>this.filters.every(filter=>filter(row)));
    if(this.operation!=='select'){
     f.writes.push({table:this.table,operation:this.operation,values:structuredClone(this.values),filters:this.filterLog});
     if(f.writeDelay)await new Promise(resolve=>setTimeout(resolve,f.writeDelay));
     if(f.failNextWrite){f.failNextWrite=false;return {data:null,error:{message:'Synthetic network failure'}};}
     if(this.operation==='insert'){
      if(rows.some(row=>row.id===this.values.id||row.teacher_id===this.values.teacher_id&&row.student_id===this.values.student_id&&row.source_key===this.values.source_key))return {data:null,error:{code:'23505',message:'Duplicate'}};
      const row={revision:1,...this.values};rows.push(row);selected=[row];
     }else for(const row of selected)Object.assign(row,this.values,{revision:row.revision+1});
     sessionStorage.setItem('synthetic-strategy-db',JSON.stringify(f.db));
    }
    selected=selected.slice(this.start,this.start+this.max);return {data:structuredClone(single?(selected[0]||null):selected),error:null};
   }
   maybeSingle(){return this.execute(true);}then(resolve,reject){return this.execute().then(resolve,reject);}
  }
  window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:admin?teacher:student}}}),onAuthStateChange:()=>{}},rpc:async()=>({data:admin,error:null}),from:table=>new Q(table)})};
 },{admin,student,otherStudent,legacy,legacyValues});
}
async function loaded(page,admin=true){
 await page.locator('#content').waitFor({state:'visible'});
 if(admin){await page.locator('#strategyPanel .strategy-edit').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#strategyPanel .strategy-edit').disabled);}
}
async function capture(page,name){if(!process.env.STRATEGY_SCREENSHOT_DIR)return;fs.mkdirSync(process.env.STRATEGY_SCREENSHOT_DIR,{recursive:true});await page.locator('#strategyPanel').screenshot({path:path.join(process.env.STRATEGY_SCREENSHOT_DIR,name+'.png')});}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,true);
  const historyUrl=origin+'/history.html?student='+student;await page.goto(historyUrl);await loaded(page);
  const panel=page.locator('#strategyPanel'),form=panel.locator('form'),view=panel.locator('.strategy-current'),edit=panel.locator('.strategy-edit'),save=panel.getByRole('button',{name:'저장',exact:true}),cancel=panel.locator('.strategy-cancel');
  const stepTime=index=>panel.locator(`[name=step_time_${index}]`),stepTask=index=>panel.locator(`[name=step_task_${index}]`),deferred=panel.locator('[name=deferred]');
  assert.equal(await panel.locator('h2').innerText(),'현재 풀이 전략');assert.equal(await form.isVisible(),false);assert.equal(await edit.innerText(),'입력');assert.equal(await panel.locator('a,details,summary,[name=is_published]').count(),0);
  assert(!(await panel.textContent()).includes('PRIVATE'));assert(!(await panel.textContent()).includes('PREVIOUS PUBLISHED SUMMARY'));assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  const reads=await page.evaluate(()=>fixture.queries.filter(q=>q.table==='teacher_strategy_records'));assert(reads.length);for(const read of reads)assert(read.filters.some(([key,value])=>key==='source_key'&&value===sourceKey));
  assert.equal(await page.evaluate(()=>fixture.queries.some(q=>q.table==='student_strategy_summaries')),false);await capture(page,'schedule-empty');

  // Editing is explicit; default blank rows, repeated clicks and add/remove never save.
  await edit.evaluate(button=>{button.click();button.click();});assert.equal(await form.isVisible(),true);assert.equal(await panel.locator('.strategy-editor-row').count(),5);
  assert.equal(await view.isVisible(),false);assert.equal(await panel.locator('.strategy-legacy-fields').isVisible(),false);
  await save.click();assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  await stepTime(0).fill('한쪽만 입력');await save.click();assert.equal(await page.evaluate(()=>fixture.writes.length),0);await stepTime(0).fill('');
  await panel.getByRole('button',{name:'1번째 구간 삭제',exact:true}).click();assert.equal(await panel.locator('.strategy-editor-row').count(),4);
  await panel.locator('.strategy-add').click();assert.equal(await panel.locator('.strategy-editor-row').count(),5);
  for(let count=5;count<12;count++)await panel.locator('.strategy-add').click();assert.equal(await panel.locator('.strategy-editor-row').count(),12);assert.equal(await panel.locator('.strategy-add').isDisabled(),true);
  for(let count=12;count>1;count--)await panel.getByRole('button',{name:'1번째 구간 삭제',exact:true}).click();assert.equal(await panel.locator('.strategy-editor-row').count(),1);assert.equal(await panel.getByRole('button',{name:'1번째 구간 삭제',exact:true}).isDisabled(),true);
  await cancel.click();assert.equal(await form.isVisible(),false);assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  await edit.click();assert.equal(await panel.locator('.strategy-editor-row').count(),5);
  for(const [index,value]of values.steps.entries()){await stepTime(index).fill('  '+value.time+'  ');await stepTask(index).fill(value.task);}await deferred.fill(values.deferred);
  await page.evaluate(()=>{fixture.writeDelay=80;const form=document.querySelector('#strategyPanel form');form.requestSubmit();form.requestSubmit();});
  await page.waitForFunction(()=>fixture.writes.length===1&&document.querySelector('#strategyPanel form').hidden&&!document.querySelector('#strategyPanel .strategy-edit').disabled);
  assert.equal(await page.evaluate(()=>fixture.writes.length),1);const insert=await page.evaluate(()=>fixture.writes[0]);assert.equal(insert.table,'teacher_strategy_records');assert.equal(insert.operation,'insert');assert.equal(insert.values.source_key,sourceKey);
  assert.deepEqual(JSON.parse(insert.values.plan_text),{format:'silmonote.manual-strategy',version:2,...values});
  assert.equal(await edit.innerText(),'수정');assert.deepEqual(await view.locator('.strategy-step-time').allTextContents(),values.steps.map(step=>step.time));assert.deepEqual(await view.locator('.strategy-step-task').allTextContents(),values.steps.map(step=>step.task));assert.equal(await view.locator('.strategy-deferred p').innerText(),values.deferred);
  assert.deepEqual(await page.evaluate(()=>fixture.db.teacher_strategy_records.find(row=>row.id==='imported-fixture')),await page.evaluate(()=>fixture.originalImported));assert.deepEqual(await page.evaluate(()=>fixture.db.student_strategy_summaries[0]),await page.evaluate(()=>fixture.originalSummary));await capture(page,'schedule-readonly');

  // Cancel discards local edits, while readonly content remains the last confirmed row.
  await edit.click();await stepTask(0).fill('CANCEL THIS DRAFT');await deferred.fill('CANCEL DEFERRED');assert(!(await view.textContent()).includes('CANCEL'));await cancel.click();assert(!(await view.innerText()).includes('CANCEL'));assert.equal(await page.evaluate(()=>fixture.writes.length),1);
  await page.reload();await loaded(page);assert.equal(await form.isVisible(),false);assert.equal(await view.locator('.strategy-timeline li').count(),2);assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  await edit.click();assert.equal(await stepTime(0).inputValue(),values.steps[0].time);assert.equal(await deferred.inputValue(),values.deferred);
  await stepTask(0).fill('수정된 가상 풀이');await save.click();await page.waitForFunction(()=>fixture.writes.length===1&&document.querySelector('#strategyPanel form').hidden);
  const update=await page.evaluate(()=>fixture.writes[0]);assert.equal(update.operation,'update');assert.deepEqual(Object.keys(update.values),['plan_text']);assert(update.filters.some(([key,value])=>key==='revision'&&value===1));assert(update.filters.some(([key,value])=>key==='source_key'&&value===sourceKey));

  // Uncertain save keeps its draft. Cancel closes editing but cannot claim the server write was canceled.
  await edit.click();await stepTask(0).fill('실패 후 남겨둘 입력');await page.evaluate(()=>{fixture.failNextWrite=true;});await save.click();
  await page.waitForFunction(()=>fixture.writes.length===2&&document.querySelector('#strategyPanel [role=status]').textContent.includes('유지'));assert.equal(await save.isDisabled(),true);assert.equal(await stepTask(0).inputValue(),'실패 후 남겨둘 입력');
  assert.equal(await page.evaluate(()=>JSON.parse(fixture.db.teacher_strategy_records.find(row=>row.source_key==='app:manual-strategy:v1').plan_text).steps[0].task),'수정된 가상 풀이');
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await page.emulateMedia({media:'print'});assert.equal(await panel.isVisible(),false);await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await stepTask(0).inputValue(),'실패 후 남겨둘 입력');
  await cancel.click();assert.equal(await form.isVisible(),false);assert.equal(await edit.isDisabled(),true);assert((await view.innerText()).includes('수정된 가상 풀이'));assert(!(await view.innerText()).includes('실패 후'));
  await page.locator('#refresh').click();await loaded(page);assert.equal(await page.evaluate(()=>fixture.writes.length),2);

  // Switching students and navigation do not carry another student's editor or draft.
  await edit.click();await stepTask(0).fill('OLD STUDENT DRAFT');await page.locator('#student').selectOption(otherStudent);await loaded(page);assert.equal(await form.isVisible(),false);assert(!(await panel.textContent()).includes('OLD STUDENT'));await edit.click();assert.equal(await stepTask(0).inputValue(),'');await cancel.click();
  await page.locator('#student').selectOption(student);await loaded(page);assert((await view.innerText()).includes('수정된 가상 풀이'));assert.equal(await form.isVisible(),false);
  await page.evaluate(()=>history.pushState(null,'','#schedule-check'));await page.goBack();await page.waitForURL(historyUrl);assert.equal(await form.isVisible(),false);await page.goForward();await page.waitForURL(historyUrl+'#schedule-check');assert.equal(await form.isVisible(),false);
  await page.locator('#content details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));assert.equal(await page.locator('#content a').count(),0);assert((await page.locator('#records h3').first().innerText()).includes('가상 시험'));assert.equal(await page.locator('#homeLink').getAttribute('href'),'admin.html');
  await page.locator('#content details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=false;}));await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await capture(page,'schedule-mobile');await edit.click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await capture(page,'schedule-mobile-editor');await cancel.click();

  // Existing v1 rows display and edit losslessly, with no inferred conversion to a timetable.
  const legacyPage=await browser.newPage();legacyPage.on('pageerror',error=>errors.push(error.message));await prepare(legacyPage,true,true);await legacyPage.goto(historyUrl);await loaded(legacyPage);
  const legacyPanel=legacyPage.locator('#strategyPanel');assert.equal(await legacyPanel.locator('form').isVisible(),false);assert.equal(await legacyPanel.locator('.strategy-timeline').count(),0);assert.deepEqual(await legacyPanel.locator('.strategy-legacy-view dd').allTextContents(),Object.values(legacyValues));assert.equal(await legacyPage.evaluate(()=>fixture.writes.length),0);
  await legacyPanel.locator('.strategy-edit').click();assert.equal(await legacyPanel.locator('.strategy-schedule-fields').isVisible(),false);assert.equal(await legacyPanel.locator('[name=solving_order]').inputValue(),legacyValues.order);await legacyPanel.locator('[name=solving_order]').fill('LEGACY CANCEL');await legacyPanel.locator('.strategy-cancel').click();assert(!(await legacyPanel.locator('.strategy-current').innerText()).includes('LEGACY CANCEL'));
  await legacyPanel.locator('.strategy-edit').click();await legacyPanel.locator('[name=time_plan]').fill('가상 새 시간');await legacyPanel.getByRole('button',{name:'저장',exact:true}).click();await legacyPage.waitForFunction(()=>fixture.writes.length===1&&document.querySelector('#strategyPanel form').hidden);const legacySaved=await legacyPage.evaluate(()=>JSON.parse(fixture.writes[0].values.plan_text));assert.equal(legacySaved.version,1);assert.equal(legacySaved.order,legacyValues.order);assert.equal(legacySaved.types,legacyValues.types);assert.equal(legacySaved.time,'가상 새 시간');assert.equal(legacySaved.steps,undefined);

  const studentPage=await browser.newPage({viewport:{width:390,height:844}});studentPage.on('pageerror',error=>errors.push(error.message));await prepare(studentPage,false);await studentPage.goto(origin+'/history.html');await loaded(studentPage,false);
  assert.equal(await studentPage.locator('#strategyPanel').isVisible(),false);assert.equal(await studentPage.locator('#strategyPanel textarea').count(),0);assert.equal(await studentPage.evaluate(()=>fixture.queries.some(query=>['teacher_strategy_records','student_strategy_summaries','teacher_assignments'].includes(query.table))),false);assert.equal(await studentPage.evaluate(()=>fixture.writes.length),0);
  await studentPage.locator('#content details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));assert.equal(await studentPage.locator('#content a').count(),0);assert(!(await studentPage.locator('body').innerText()).includes('PRIVATE'));assert(!(await studentPage.locator('body').innerText()).includes('PREVIOUS PUBLISHED SUMMARY'));await studentPage.emulateMedia({media:'print'});assert.equal(await studentPage.locator('#strategyPanel').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('PASS strategy browser: readonly display, explicit edit/save/cancel, blank/add/remove/max rows, schedule/deferred persistence, v1 preservation, duplicate submit, uncertain-save protections, student switching, Back/Forward, print omission, no source anchors, student isolation, mobile. All data and requests were synthetic.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
