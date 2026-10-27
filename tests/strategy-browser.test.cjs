/* Synthetic-only browser regression. Every request is intercepted; no real account or database is used. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='https://silmonote.test';
const student='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',otherStudent='cccccccc-cccc-4ccc-cccc-cccccccccccc';
const sourceKey='app:manual-strategy:v1';
const values={order:'1–3번 → 4–6번 → 검토',time:'앞부분 12분 / 뒷부분 18분 / 검토 5분',types:'독해 · 빈칸 · 순서'};
async function prepare(page,admin){
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({status:200,contentType:'application/javascript',body:''});
  if(url.origin!==origin)return route.abort();
  const relative=decodeURIComponent(url.pathname).replace(/^\//,'');
  if(!/^[a-z0-9-]+\.(?:html|js|css)$/.test(relative))return route.fulfill({status:404,body:'Not found'});
  const file=path.join(root,relative);if(!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
  return route.fulfill({status:200,contentType:relative.endsWith('.html')?'text/html':relative.endsWith('.js')?'application/javascript':'text/css',body:fs.readFileSync(file)});
 });
 await page.addInitScript(({admin,student,otherStudent})=>{
  const teacher='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
  const imported={id:'imported-fixture',teacher_id:teacher,student_id:student,source_key:'imported:fictional',source_label:'PRIVATE SOURCE LABEL',source_excerpt:'PRIVATE SOURCE',event_date:'2026-01-04',date_precision:'exact',record_type:'lesson_plan',exam_label:'가상 과거 계획',plan_text:'PRIVATE LEGACY PLAN',reason_text:'PRIVATE REASON',observation_text:'PRIVATE OBSERVATION',result_text:'PRIVATE RESULT',next_check_text:'PRIVATE CHECK',revision:1};
  const summary={id:'summary-fixture',teacher_id:teacher,student_id:student,summary_text:'PREVIOUS PUBLISHED SUMMARY',is_published:true,revision:1};
  const score={id:'1',record_id:'1',user_id:student,exam_title:'가상 시험',created_at:'2026-01-03T00:00:00Z',exam_date:'2026-01-02',exam_date_precision:'exact',real_score:80,real_grade:2,deleted_at:null,loss_grammar:{},loss_listening:{assessment:{version:1,correct:16,incorrect:1}},teacher_comment:'가상 듣기 피드백'};
  const db=JSON.parse(sessionStorage.getItem('synthetic-strategy-db')||'null')||{profiles:[{id:student,name:'가상 학생 A',is_approved:true},{id:otherStudent,name:'가상 학생 B',is_approved:true}],teacher_strategy_records:[imported],student_strategy_summaries:[summary],teacher_assignments:[],notes:[],score_reports:[score]};
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
 },{admin,student,otherStudent});
}
async function loaded(page,admin=true){
 await page.locator('#content').waitFor({state:'visible'});
 if(admin){await page.locator('#strategyPanel [name=solving_order]').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#strategyPanel button[type=submit]').disabled);}
}
async function capture(page,name){if(!process.env.STRATEGY_SCREENSHOT_DIR)return;fs.mkdirSync(process.env.STRATEGY_SCREENSHOT_DIR,{recursive:true});await page.locator('#strategyPanel').screenshot({path:path.join(process.env.STRATEGY_SCREENSHOT_DIR,name+'.png')});}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await prepare(page,true);
  const historyUrl=origin+'/history.html?student='+student;await page.goto(historyUrl);await loaded(page);
  const panel=page.locator('#strategyPanel'),order=panel.locator('[name=solving_order]'),time=panel.locator('[name=time_plan]'),types=panel.locator('[name=question_types]'),save=panel.getByRole('button',{name:'저장',exact:true});
  assert.equal(await panel.locator('textarea').count(),3);assert.equal(await panel.locator('button').count(),1);assert.equal(await panel.locator('a,details,summary,[name=is_published]').count(),0);
  for(const field of [order,time,types])assert.equal(await field.inputValue(),'');
  assert(!(await panel.textContent()).includes('PRIVATE'));assert(!(await panel.textContent()).includes('PREVIOUS PUBLISHED SUMMARY'));
  assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  const reads=await page.evaluate(()=>fixture.queries.filter(q=>q.table==='teacher_strategy_records'));
  assert(reads.length);for(const read of reads)assert(read.filters.some(([key,value])=>key==='source_key'&&value===sourceKey));
  assert.equal(await page.evaluate(()=>fixture.queries.some(q=>q.table==='student_strategy_summaries')),false);
  await capture(page,'manual-default');

  // Empty input cannot persist; free text with ranges remains intact and is trimmed only at the ends.
  await save.click();assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  await order.fill('  '+values.order+'  ');await time.fill(values.time);await types.fill(values.types);
  await page.evaluate(()=>{fixture.writeDelay=80;const form=document.querySelector('#strategyPanel form');form.requestSubmit();form.requestSubmit();});
  await page.waitForFunction(()=>fixture.writes.length===1&&!document.querySelector('#strategyPanel button[type=submit]').disabled);
  assert.equal(await page.evaluate(()=>fixture.writes.length),1);
  const insert=await page.evaluate(()=>fixture.writes[0]);assert.equal(insert.table,'teacher_strategy_records');assert.equal(insert.operation,'insert');assert.equal(insert.values.source_key,sourceKey);
  assert.deepEqual(JSON.parse(insert.values.plan_text),{format:'silmonote.manual-strategy',version:1,...values});
  assert.deepEqual(await page.evaluate(()=>fixture.db.teacher_strategy_records.find(row=>row.id==='imported-fixture')),await page.evaluate(()=>fixture.originalImported));
  assert.deepEqual(await page.evaluate(()=>fixture.db.student_strategy_summaries[0]),await page.evaluate(()=>fixture.originalSummary));

  // Reload reads the saved manual row, without importing narratives or auto-writing.
  await page.reload();await loaded(page);assert.equal(await order.inputValue(),values.order);assert.equal(await time.inputValue(),values.time);assert.equal(await types.inputValue(),values.types);assert.equal(await page.evaluate(()=>fixture.writes.length),0);
  await order.fill('수정된 순서 → 마무리');await save.click();
  await page.waitForFunction(()=>fixture.writes.length===1&&!document.querySelector('#strategyPanel button[type=submit]').disabled);
  const update=await page.evaluate(()=>fixture.writes[0]);assert.equal(update.operation,'update');assert.deepEqual(Object.keys(update.values),['plan_text']);assert(update.filters.some(([key,value])=>key==='revision'&&value===1));assert(update.filters.some(([key,value])=>key==='source_key'&&value===sourceKey));

  // A failed save keeps the user's draft and does not overwrite the last stored row.
  await order.fill('실패 후 남겨둘 입력');await page.evaluate(()=>{fixture.failNextWrite=true;});await save.click();
  await page.waitForFunction(()=>fixture.writes.length===2&&document.querySelector('#strategyPanel [role=status]').textContent.includes('유지'));assert.equal(await save.isDisabled(),true);
  assert.equal(await order.inputValue(),'실패 후 남겨둘 입력');assert((await panel.getByRole('status').innerText()).length>0);
  assert.equal(await page.evaluate(()=>JSON.parse(fixture.db.teacher_strategy_records.find(row=>row.source_key==='app:manual-strategy:v1').plan_text).order),'수정된 순서 → 마무리');

  // Entire private strategy editor stays out of print, including unsaved values.
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));await page.emulateMedia({media:'print'});assert.equal(await panel.isVisible(),false);assert(!(await page.locator('body').innerText()).includes('실패 후 남겨둘 입력'));
  await page.emulateMedia({media:'screen'});await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));assert.equal(await panel.isVisible(),true);assert.equal(await order.inputValue(),'실패 후 남겨둘 입력');

  // Changing students clears the draft and returns to the selected student's saved values.
  await page.locator('#student').selectOption(otherStudent);await loaded(page);assert.equal(await order.inputValue(),'');assert.equal(await time.inputValue(),'');assert.equal(await types.inputValue(),'');
  await page.locator('#student').selectOption(student);await loaded(page);assert.equal(await order.inputValue(),'수정된 순서 → 마무리');assert.equal(await page.evaluate(()=>fixture.writes.length),2);
  await page.evaluate(()=>history.pushState(null,'','#manual-check'));await page.goBack();await page.waitForURL(historyUrl);assert.equal(await order.inputValue(),'수정된 순서 → 마무리');await page.goForward();await page.waitForURL(historyUrl+'#manual-check');assert.equal(await order.inputValue(),'수정된 순서 → 마무리');

  // All original-source links remain absent even when every report disclosure is opened.
  await page.locator('#content details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));assert.equal(await page.locator('#content a').count(),0);assert((await page.locator('#records h3').first().innerText()).includes('가상 시험'));
  assert.equal(await page.locator('#homeLink').getAttribute('href'),'admin.html');assert.equal(await page.locator('nav a[href="korean.html"]').count(),1);
  await page.locator('#content details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=false;}));await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await capture(page,'manual-mobile');

  const studentPage=await browser.newPage({viewport:{width:390,height:844}});studentPage.on('pageerror',error=>errors.push(error.message));await prepare(studentPage,false);await studentPage.goto(origin+'/history.html');await loaded(studentPage,false);
  assert.equal(await studentPage.locator('#strategyPanel').isVisible(),false);assert.equal(await studentPage.locator('#strategyPanel textarea').count(),0);
  assert.equal(await studentPage.evaluate(()=>fixture.queries.some(query=>['teacher_strategy_records','student_strategy_summaries','teacher_assignments'].includes(query.table))),false);
  assert.equal(await studentPage.evaluate(()=>fixture.writes.length),0);await studentPage.locator('#content details').evaluateAll(nodes=>nodes.forEach(node=>{node.open=true;}));assert.equal(await studentPage.locator('#content a').count(),0);
  assert(!(await studentPage.locator('body').innerText()).includes('PRIVATE'));assert(!(await studentPage.locator('body').innerText()).includes('PREVIOUS PUBLISHED SUMMARY'));
  await studentPage.emulateMedia({media:'print'});assert.equal(await studentPage.locator('#strategyPanel').isVisible(),false);assert.deepEqual(errors,[]);
  console.log('PASS manual strategy browser: three fields/save only, exact manual key, no legacy prefill, empty validation, free text/ranges, duplicate submit, save/reload/update, failed draft preservation, student switching, Back/Forward, print omission, all source anchors absent, student isolation, mobile width. All data and requests were synthetic.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
