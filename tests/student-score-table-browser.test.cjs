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
  const db=JSON.parse(sessionStorage.getItem('synthetic-strategy-db')||'null')||{profiles:[{id:student,name:'가상 학생 A',is_approved:true},{id:otherStudent,name:'가상 학생 B',is_approved:true}],teacher_strategy_records:legacy?[imported,manual]:[imported],student_strategy_summaries:[summary],teacher_assignments:[],notes:[{id:'9007199254740993',record_id:'9007199254740993',user_id:student,exam_title:'가상 오답 시험',question_info:'31번',created_at:'2026-01-03T01:00:00Z',deleted_at:null,teacher_comment:'비공개 가상 피드백',p1_result:'오답 (X)'}],score_reports:[...Array.from({length:105},(_,i)=>({...score,id:String(105-i),record_id:String(105-i),created_at:null,record_kind:i%2?'score_only':'analysis',exam_title:'누적 시험 '+(105-i),real_score:i===0?0:80,exam_date:i===1?null:'2026-01-02'})),{...score,id:'999',record_id:'999',user_id:otherStudent,exam_title:'다른 학생 비공개 점수'},{...score,id:'998',record_id:'998',deleted_at:'2026-01-01',exam_title:'삭제된 점수'}]};
  window.fixture={admin,queries:[],writes:[],writeDelay:0,failNextWrite:false,db,originalImported:imported,originalSummary:summary};
  class Q{
   constructor(table){this.table=table;this.filters=[];this.filterLog=[];this.operation='select';this.start=0;this.max=Infinity;}
   select(fields){this.fields=fields;return this;}
   eq(key,value){this.filters.push(row=>row[key]===value);this.filterLog.push([key,value]);return this;}
   is(key,value){this.filters.push(row=>row[key]==value);return this;}
   lt(key,value){this.filters.push(row=>BigInt(row[key])<BigInt(value));return this;}
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

(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await prepare(page,false);await page.goto(origin+'/history.html?student='+otherStudent+'#scoreTable');
 await page.locator('#content').waitFor({state:'visible'});
 assert.equal(await page.locator('#scoreTitle').textContent(),'모의고사 누적 점수표');
 assert.equal(await page.locator('#scoreTable').evaluate(e=>e.previousElementSibling.classList.contains('report-hero')),true);
 assert.equal(await page.locator('#scoreRows tr').count(),100);
 assert.match(await page.locator('#scoreTableCoverage').textContent(),/100건 불러옴.*이전 점수가 더/);
 assert.equal(await page.locator('#scoreRows').getByText('0점',{exact:true}).count(),1);
 assert.equal(await page.locator('#scoreRows').getByText('날짜 미상',{exact:true}).count(),1);
 assert.equal(await page.locator('#scoreRows').getByText('누적 시험 104',{exact:true}).count(),1);
 await page.locator('#scoreTableMore').click();
 await page.waitForFunction(()=>document.querySelectorAll('#scoreRows tr').length===105);
 assert.match(await page.locator('#scoreTableCoverage').textContent(),/105건 불러옴.*모든 성적 기록/);
 assert.equal(await page.locator('#scoreTableMore').isVisible(),false);
 assert.equal(await page.locator('#scoreRows').textContent().then(t=>/다른 학생|삭제된 점수/.test(t)),false);
 await page.locator('#reportStart').fill('2026-02-01');
 assert.match(await page.locator('#scoreTableCoverage').textContent(),/선택 기간 0건 표시/);
 assert.match(await page.locator('#scoreRows').textContent(),/성적 기록이 없습니다/);
 await page.locator('#resetPeriod').click();assert.equal(await page.locator('#scoreRows tr').count(),105);
 await page.locator('#reportDateBasis').selectOption('submission');assert.equal(await page.locator('#scoreRows tr').count(),105);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.evaluate(()=>fixture.writes.length),0);
 const queries=await page.evaluate(()=>fixture.queries);
 assert(queries.every(q=>!['teacher_strategy_records','teacher_assignments','student_strategy_summaries'].includes(q.table)));
 assert(queries.filter(q=>['notes','score_reports'].includes(q.table)).every(q=>q.filters.some(([key,value])=>key==='user_id'&&value===student)));
 assert.deepEqual(errors,[]);
 assert.match(fs.readFileSync(path.join(root,'main.html'),'utf8'),/href="history.html#scoreTable"[^>]*>📊 모의고사 누적 점수표 보기/);
 console.log('PASS: student direct table, 105-row paging, teacher scores, zero/missing dates, private/deleted exclusions, period/reset, mobile, no writes.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
