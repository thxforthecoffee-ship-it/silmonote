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
  const db=JSON.parse(sessionStorage.getItem('synthetic-strategy-db')||'null')||{profiles:[{id:student,name:'가상 학생 A',is_approved:true},{id:otherStudent,name:'가상 학생 B',is_approved:true}],teacher_strategy_records:legacy?[imported,manual]:[imported],student_strategy_summaries:[summary],teacher_assignments:[],notes:[{id:'9007199254740993',record_id:'9007199254740993',user_id:student,exam_title:'가상 오답 시험',question_info:'31번',created_at:'2026-01-03T01:00:00Z',deleted_at:null,teacher_comment:'비공개 가상 피드백',p1_result:'오답 (X)'}],score_reports:[score]};
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
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await prepare(page,true);await page.goto(origin+'/history.html?student='+student);await loaded(page);
const fold=page.locator('#reviewRecords');assert.equal(await fold.evaluate(e=>e.open),false);assert.equal(await fold.evaluate(e=>e.nextElementSibling.id),'adminReview');
await fold.locator(':scope > summary').click();assert.equal(await fold.evaluate(e=>e.open),true);assert.equal(await page.locator('#records article').count(),2);assert.equal(await page.locator('#records .feedback,#records details').count(),0);
const note=page.locator('#records a').filter({hasText:'31번'});assert.equal(await note.count(),1);assert.equal(await note.getAttribute('href'),'view.html?id=9007199254740993');assert.equal(await note.getAttribute('target'),'_blank');assert.equal(await note.getAttribute('rel'),'noopener noreferrer');
assert.equal(await page.locator('#records a').filter({hasText:'[분석지]'}).getAttribute('href'),'score_view.html?id=1');
await page.locator('#type').selectOption('note');assert.equal(await page.locator('#records article').count(),1);await page.locator('#search').fill('없는 제목');assert.equal(await page.locator('#records article').count(),0);await page.locator('#search').fill('31번');assert.equal(await page.locator('#records article').count(),1);
await page.locator('#student').selectOption(otherStudent);await page.waitForFunction(()=>document.querySelector('#filterCount').textContent.includes('0건'));assert.equal(await page.locator('#records article').count(),0);await page.locator('#student').selectOption(student);await page.waitForFunction(()=>document.querySelector('#filterCount').textContent.includes('1건 표시'));assert.equal(await fold.evaluate(e=>e.open),true);
await fold.locator(':scope > summary').click();assert.equal(await fold.evaluate(e=>e.open),false);await page.reload();await loaded(page);assert.equal(await fold.evaluate(e=>e.open),false);
await page.setViewportSize({width:390,height:844});await fold.locator(':scope > summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.equal(await page.evaluate(()=>fixture.writes.length),0);assert.deepEqual(errors,[]);
const studentPage=await browser.newPage();await prepare(studentPage,false);await studentPage.goto(origin+'/history.html');await loaded(studentPage,false);assert.equal(await studentPage.locator('#reviewRecords').count(),0);assert.equal(await studentPage.locator('#records .feedback').count(),2);assert.equal(await studentPage.locator('#records a').count(),0);
console.log('PASS: admin order, default collapse, title-only index, safe bigint links, filters, student changes, repeated toggle, reload, mobile width, no writes and unchanged student feedback.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
