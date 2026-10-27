/* Synthetic-only browser regression. Every request is intercepted; no real account or database is used. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const origin='https://silmonote.test';
const student='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const otherStudent='cccccccc-cccc-4ccc-cccc-cccccccccccc';
const published='가상 전략: 조건을 먼저 확인합니다.\n\n모아 제안: 실제 종료 시각을 적습니다.';
const privateMarkers=['PRIVATE SOURCE','PRIVATE REASON','PRIVATE OBSERVATION','PRIVATE RESULT'];

async function prepare(page,admin){
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.hostname==='cdn.jsdelivr.net')return route.fulfill({status:200,contentType:'application/javascript',body:''});
    if(url.origin!==origin)return route.abort();
    const relative=decodeURIComponent(url.pathname).replace(/^\//,'');
    if(!/^[a-z0-9-]+\.(?:html|js|css)$/.test(relative))return route.fulfill({status:404,body:'Not found'});
    const file=path.join(root,relative);
    if(!fs.existsSync(file))return route.fulfill({status:404,body:'Not found'});
    return route.fulfill({status:200,contentType:relative.endsWith('.html')?'text/html':relative.endsWith('.js')?'application/javascript':'text/css',body:fs.readFileSync(file)});
  });
  await page.addInitScript(({admin,student,otherStudent,published})=>{
    const teacher='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
    const summary={id:'summary-fixture',teacher_id:teacher,student_id:student,summary_text:published,is_published:true,revision:1};
    const privateRow={id:'private-fixture',teacher_id:teacher,student_id:student,source_key:'synthetic',source_label:'가상 원문',source_excerpt:'PRIVATE SOURCE — fictional fixture only',event_date:'2026-01-04',date_precision:'exact',record_type:'lesson_plan',exam_label:'가상 수업 계획',reason_text:'PRIVATE REASON',plan_text:'가상 계획: 조건을 먼저 표시합니다. 근거를 대조합니다.',observation_text:'PRIVATE OBSERVATION',result_text:'PRIVATE RESULT',next_check_text:'가상 확인 첫째.\n가상 확인 둘째.\n가상 확인 셋째.\n가상 확인 넷째.'};
    const score={id:'1',record_id:'1',user_id:student,exam_title:'가상 시험',created_at:'2026-01-03T00:00:00Z',exam_date:'2026-01-02',exam_date_precision:'exact',real_score:80,real_grade:2,deleted_at:null,loss_grammar:{},loss_listening:{assessment:{version:1,correct:16,incorrect:1}},teacher_comment:'가상 듣기 피드백'};
    window.fixture={admin,queries:[],writes:[],writeDelay:0,db:{profiles:[{id:student,name:'가상 학생 A',is_approved:true},{id:otherStudent,name:'가상 학생 B',is_approved:true}],student_strategy_summaries:[summary],teacher_strategy_records:[privateRow],teacher_assignments:[],notes:[],score_reports:[score]}};
    class Q{
      constructor(table){this.table=table;this.filters=[];this.filterLog=[];this.operation='select';this.start=0;this.max=Infinity;}
      select(){return this;}
      eq(key,value){this.filters.push(row=>row[key]===value);this.filterLog.push([key,value]);return this;}
      is(key,value){this.filters.push(row=>row[key]==value);return this;}
      lt(key,value){this.filters.push(row=>row[key]<value);return this;}
      order(){return this;}
      or(){return this;}
      range(start,end){this.start=start;this.max=end-start+1;return this;}
      limit(max){this.max=max;return this;}
      update(values){this.operation='update';this.values=values;return this;}
      insert(values){this.operation='insert';this.values=values;return this;}
      async execute(single=false){
        const f=window.fixture;
        f.queries.push({table:this.table,operation:this.operation,filters:this.filterLog});
        let rows=f.db[this.table]||[],selected=rows.filter(row=>this.filters.every(filter=>filter(row)));
        if(this.operation!=='select'){
          f.writes.push({table:this.table,operation:this.operation,values:structuredClone(this.values)});
          if(f.writeDelay)await new Promise(resolve=>setTimeout(resolve,f.writeDelay));
          if(this.operation==='insert'){
            const row={revision:1,...this.values};rows.push(row);selected=[row];
          }else for(const row of selected)Object.assign(row,this.values,{revision:row.revision+1});
        }
        selected=selected.slice(this.start,this.start+this.max);
        return {data:structuredClone(single?(selected[0]||null):selected),error:null};
      }
      maybeSingle(){return this.execute(true);}
      then(resolve,reject){return this.execute().then(resolve,reject);}
    }
    window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:{id:admin?teacher:student}}}),onAuthStateChange:()=>{}},rpc:async()=>({data:admin,error:null}),from:table=>new Q(table)})};
  },{admin,student,otherStudent,published});
}

async function loaded(page,admin=true){
  await page.locator('#content').waitFor({state:'visible'});
  if(admin)await page.locator('.strategy-teacher-focus .strategy-current').waitFor();
  else await page.locator('.strategy-summary').getByText(/가상 전략/).waitFor();
  await page.waitForFunction(()=>!document.querySelector('#strategyPanel button[type=submit]').disabled||!window.fixture.admin);
}
async function checkNoPrivateVisible(page){
  const text=await page.locator('#strategyPanel').innerText();
  for(const marker of privateMarkers)assert(!text.includes(marker),`${marker} should not be visible`);
}
async function capture(page,name){
  if(!process.env.STRATEGY_SCREENSHOT_DIR)return;
  fs.mkdirSync(process.env.STRATEGY_SCREENSHOT_DIR,{recursive:true});
  await page.locator('#strategyPanel').screenshot({path:path.join(process.env.STRATEGY_SCREENSHOT_DIR,name+'.png')});
}

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await prepare(page,true);
    const historyUrl=origin+'/history.html?student='+student;
    await page.goto(historyUrl);await loaded(page);
    const panel=page.locator('#strategyPanel'),management=panel.locator('.strategy-management > details'),details=panel.locator('details.strategy-details');
    const menu=management.locator(':scope > summary'),detailToggle=details.locator(':scope > summary');
    const input=panel.locator('[name=summary_text]'),publish=panel.locator('[name=is_published]');
    const save=panel.getByRole('button',{name:'요약 · 공개 여부 저장',exact:true});
    assert.equal(await management.evaluate(el=>el.open),false);
    assert.equal(await details.evaluate(el=>el.open),false);
    assert.equal(await panel.locator('.strategy-summary').isVisible(),false);
    assert.equal(await input.isVisible(),false);
    assert.equal(await panel.locator('.strategy-teacher-focus ul li').count(),3);
    await checkNoPrivateVisible(page);
    assert.equal(await panel.locator('a:visible').count(),0);
    assert.equal(await page.locator('#adminReview a:visible').count(),0);
    await capture(page,'admin-default');

    // Details retain all originals without duplicating them in the default view.
    for(let i=0;i<2;i++){
      await detailToggle.click();assert.equal(await details.evaluate(el=>el.open),true);
      assert((await details.textContent()).includes('가상 확인 넷째.'));
      for(const marker of privateMarkers)assert((await details.textContent()).includes(marker));
      assert((await details.textContent()).includes(published));
      await detailToggle.click();assert.equal(await details.evaluate(el=>el.open),false);
    }
    await checkNoPrivateVisible(page);

    // Close is non-destructive, Cancel restores saved values, and neither writes.
    await menu.click();await input.fill('UNSAVED DRAFT');await publish.uncheck();
    await management.getByRole('button',{name:'닫기',exact:true}).click();
    assert.equal(await management.evaluate(el=>el.open),false);
    await menu.click();assert.equal(await input.inputValue(),'UNSAVED DRAFT');assert.equal(await publish.isChecked(),false);
    await management.getByRole('button',{name:'취소',exact:true}).click();
    assert.equal(await management.evaluate(el=>el.open),false);
    await menu.click();assert.equal(await input.inputValue(),published);assert.equal(await publish.isChecked(),true);
    await input.fill('DISCARD WITH RESET');
    await management.getByRole('button',{name:'저장된 요약으로 되돌리기',exact:true}).click();
    assert.equal(await input.inputValue(),published);
    assert.equal(await page.evaluate(()=>fixture.writes.length),0);
    await menu.click();await menu.click();assert.equal(await input.inputValue(),published);

    // Repeated submit events while the request is in flight must create one write.
    const updated='가상 공개 수정 — 저장된 요약만 출력합니다.';
    await input.fill(updated);
    await page.evaluate(()=>{fixture.writeDelay=80;const form=document.querySelector('#strategyPanel form');form.requestSubmit();form.requestSubmit();});
    await page.waitForFunction(()=>fixture.writes.length===1&&!document.querySelector('#strategyPanel button[type=submit]').disabled);
    assert.equal(await page.evaluate(()=>fixture.writes.length),1);
    assert((await panel.locator('.strategy-summary').textContent()).includes(updated));
    assert.equal(await page.evaluate(()=>fixture.writes[0].table),'student_strategy_summaries');

    // Open menus must never bring private or draft text into a print/PDF render.
    await input.fill('PRIVATE UNSAVED PRINT DRAFT');
    if(!await details.evaluate(el=>el.open))await detailToggle.click();
    const openState=await page.locator('details').evaluateAll(nodes=>nodes.map(node=>node.open));
    await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
    await page.emulateMedia({media:'print'});
    assert.equal(await panel.locator('[data-strategy-private]:visible').count(),0);
    assert.equal(await input.isVisible(),false);
    assert.equal(await panel.locator('.strategy-summary').isVisible(),true);
    const printText=await panel.innerText();assert(printText.includes(updated));
    for(const marker of [...privateMarkers,'PRIVATE UNSAVED PRINT DRAFT'])assert(!printText.includes(marker));
    await page.emulateMedia({media:'screen'});
    await page.evaluate(()=>window.dispatchEvent(new Event('afterprint')));
    assert.deepEqual(await page.locator('details').evaluateAll(nodes=>nodes.map(node=>node.open)),openState);
    assert.equal(await input.inputValue(),'PRIVATE UNSAVED PRINT DRAFT');
    await management.getByRole('button',{name:'취소',exact:true}).click();
    await detailToggle.click();

    // A student change closes both surfaces and does not carry the prior draft.
    await menu.click();await input.fill('OLD STUDENT DRAFT');
    await page.locator('#student').selectOption(otherStudent);
    await page.waitForFunction(()=>document.querySelector('#content').hidden===false&&document.querySelector('#strategyPanel [name=summary_text]').value==='');
    assert.equal(await management.evaluate(el=>el.open),false);assert.equal(await details.evaluate(el=>el.open),false);
    assert(!(await panel.textContent()).includes('PRIVATE SOURCE'));
    await page.locator('#student').selectOption(student);await loaded(page);
    assert.equal(await page.evaluate(()=>fixture.writes.length),1);

    // Same-page Back/Forward does not lose the selected student's content or auto-open controls.
    await page.evaluate(()=>history.pushState(null,'','#strategy-check'));
    await page.goBack();await page.waitForURL(historyUrl);
    assert.equal(await management.evaluate(el=>el.open),false);assert.equal(await details.evaluate(el=>el.open),false);
    assert.equal(await page.locator('#student').inputValue(),student);
    await page.goForward();await page.waitForURL(historyUrl+'#strategy-check');
    assert.equal(await page.locator('#student').inputValue(),student);
    await checkNoPrivateVisible(page);

    // Original student records remain reachable through the existing collapsed records section.
    await page.locator('#reviewRecords > summary').click();
    assert.equal(await page.locator('#records h3 a').first().getAttribute('href'),'score_view.html?id=1');
    await page.locator('#reviewRecords > summary').click();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await capture(page,'admin-mobile');
    await menu.click();assert.equal(await input.isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await capture(page,'admin-mobile-management');

    const studentPage=await browser.newPage({viewport:{width:390,height:844}});
    studentPage.on('pageerror',error=>errors.push(error.message));
    await prepare(studentPage,false);await studentPage.goto(origin+'/history.html');await loaded(studentPage,false);
    assert.equal(await studentPage.locator('[data-strategy-private]:visible').count(),0);
    assert.equal(await studentPage.evaluate(()=>fixture.queries.some(query=>['teacher_strategy_records','teacher_assignments'].includes(query.table))),false);
    assert.equal(await studentPage.locator('.strategy-summary').innerText().then(text=>text.includes(published)),true);
    await checkNoPrivateVisible(studentPage);
    assert.equal(await studentPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await studentPage.emulateMedia({media:'print'});
    assert.equal(await studentPage.locator('.strategy-summary').isVisible(),true);
    assert.equal(await studentPage.locator('[data-strategy-private]:visible').count(),0);
    await checkNoPrivateVisible(studentPage);
    assert.equal(await studentPage.evaluate(()=>fixture.writes.length),0);
    assert.deepEqual(errors,[]);
    console.log('PASS strategy browser: admin default/details/menu, repeated toggles, close/cancel/reset, duplicate-save guard, student switching, Back/Forward, preserved records, student query isolation, print privacy/state restore, mobile width. All data and requests were synthetic.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
