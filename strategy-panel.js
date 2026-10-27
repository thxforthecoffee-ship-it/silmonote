/* Instructor-only manual strategy. Imported records and published summaries are never changed here. */
(function(root){'use strict';
const TABLE='teacher_strategy_records',SOURCE_KEY='app:manual-strategy:v1',FORMAT='silmonote.manual-strategy';
const FIELDS='id,teacher_id,student_id,source_key,source_label,source_excerpt,record_type,date_precision,event_date,plan_text,revision';
function encodePlan(values){
 if(!values||![undefined,1,2].includes(values.version))throw Error('지원하지 않는 풀이 전략 형식입니다.');
 const plan={format:FORMAT,version:values.version===2?2:1};
 if(plan.version===2){
  if(!Array.isArray(values.steps)||values.steps.length>12||typeof values.deferred!=='string'||values.deferred.length>1000)throw Error('시간 구간은 최대 12개, 배제 항목은 1000자까지 입력할 수 있습니다.');
  plan.steps=[];
  for(const step of values.steps){
   if(!step||typeof step.time!=='string'||typeof step.task!=='string')throw Error('각 구간의 시간과 풀이 내용을 확인해 주세요.');
   const time=step.time.trim(),task=step.task.trim();if(!time&&!task)continue;
   if(!time||!task||time.length>200||task.length>500)throw Error('각 구간에 시간(200자 이내)과 풀이 내용(500자 이내)을 함께 입력해 주세요.');
   plan.steps.push({time,task});
  }
  if(!plan.steps.length)throw Error('시간과 풀이 내용을 한 구간 이상 입력해 주세요.');
  plan.deferred=values.deferred.trim();
 }else for(const key of ['order','time','types']){if(typeof values[key]!=='string')throw Error('풀이 순서, 시간, 유형을 모두 입력해 주세요.');const value=values[key].trim();if(!value||value.length>1000)throw Error('풀이 순서, 시간, 유형을 각각 1~1000자로 입력해 주세요.');plan[key]=value;}
 const encoded=JSON.stringify(plan);if(encoded.length>4000)throw Error('입력 내용이 너무 깁니다. 특수문자나 줄바꿈을 줄여 주세요.');return encoded;
}
function decodePlan(value){
 let plan;try{plan=JSON.parse(value);}catch{throw Error('저장된 풀이 전략 형식을 확인할 수 없습니다. 원본을 덮어쓰지 않았습니다.');}
 const invalid=()=>{throw Error('저장된 풀이 전략 형식을 확인할 수 없습니다. 원본을 덮어쓰지 않았습니다.');};
 if(!plan||Array.isArray(plan)||plan.format!==FORMAT)invalid();
 if(plan.version===2){
  if(Object.keys(plan).sort().join(',')!=='deferred,format,steps,version'||!Array.isArray(plan.steps)||!plan.steps.length||plan.steps.some(step=>!step||Array.isArray(step)||Object.keys(step).sort().join(',')!=='task,time'||typeof step.time!=='string'||typeof step.task!=='string'||!step.time.trim()||!step.task.trim()))invalid();
  encodePlan(plan);return {version:2,steps:plan.steps.map(step=>({...step})),deferred:plan.deferred};
 }
 if(plan.version!==1||Object.keys(plan).sort().join(',')!=='format,order,time,types,version')invalid();
 encodePlan(plan);return {order:plan.order,time:plan.time,types:plan.types};
}
function create({container,client,verifyAccess,assertCurrent=()=>{},document=container.ownerDocument,makeId=()=>root.crypto.randomUUID()}){
 let studentId='',actor=null,generation=0,busy=false,destroyed=false,loaded=false,dirty=false,editing=false,row=null,draftId=makeId(),pending=null,mode=2,steps=[];
 function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 const heading=el('h2','현재 풀이 전략'),header=el('div'),edit=el('button','수정'),view=el('div'),form=el('form');header.className='strategy-header';edit.type='button';edit.className='strategy-edit';header.appendChild(heading);header.appendChild(edit);view.className='strategy-current';view.setAttribute('data-strategy-private','');form.className='strategy-input-form';form.setAttribute('data-strategy-private','');
 const legacy=el('div');legacy.className='strategy-legacy-fields';const inputs={};for(const [key,name,title,placeholder]of [['order','solving_order','풀이 순서','문제를 풀 순서를 입력하세요'],['time','time_plan','시간','분, 시간대 또는 구간별 시간을 입력하세요'],['types','question_types','유형','문항 번호나 유형을 입력하세요']]){const label=el('label',title),input=el('textarea');input.name=name;input.maxLength=1000;input.required=true;input.placeholder=placeholder;label.appendChild(input);legacy.appendChild(label);inputs[key]=input;}form.appendChild(legacy);
 const schedule=el('div'),rows=el('div'),add=el('button','구간 추가'),deferredLabel=el('label','배제 및 시간 남으면 풀이'),deferred=el('textarea');schedule.className='strategy-schedule-fields';rows.className='strategy-editor-rows';add.type='button';add.className='strategy-add';deferred.name='deferred';deferred.maxLength=1000;deferred.placeholder='필요한 경우에만 입력하세요';deferredLabel.appendChild(deferred);schedule.appendChild(rows);schedule.appendChild(add);schedule.appendChild(deferredLabel);form.appendChild(schedule);
 const actions=el('div'),save=el('button','저장'),cancel=el('button','취소');actions.className='strategy-editor-actions';save.type='submit';save.className='primary';cancel.type='button';cancel.className='strategy-cancel';actions.appendChild(save);actions.appendChild(cancel);form.appendChild(actions);const message=el('p');message.className='strategy-status';message.setAttribute('role','status');message.setAttribute('aria-live','polite');container.replaceChildren(header,view,form,message);container.hidden=true;
 form.addEventListener('input',()=>{dirty=true;});form.addEventListener('submit',event=>{event.preventDefault();savePlan();});
 edit.addEventListener('click',()=>{if(edit.disabled||editing)return;editing=true;message.textContent='';controls();(mode===2?steps[0]?.time:inputs.order)?.focus?.();});
 cancel.addEventListener('click',()=>{if(busy||!editing)return;editing=false;dirty=false;fill(row?decodePlan(row.plan_text):undefined);message.textContent=loaded?'수정을 취소했습니다.':'편집을 닫았습니다. 저장 여부는 상단 새로고침으로 확인해 주세요.';controls();edit.focus?.();});
 add.addEventListener('click',()=>{if(add.disabled||!editing)return;const values=readValues();values.steps.push({time:'',task:''});fill(values);dirty=true;controls();steps.at(-1).time.focus?.();});
 function readValues(){return mode===2?{version:2,steps:steps.map(step=>({time:step.time.value,task:step.task.value})),deferred:deferred.value}:Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value]));}
 function controls(){
  const editable=Boolean(actor?.admin&&studentId&&!busy&&!destroyed);container.hidden=!actor?.admin||destroyed;view.hidden=editing;form.hidden=!editing;edit.hidden=editing;edit.textContent=row?'수정':'입력';edit.disabled=!(editable&&loaded);save.disabled=!(editable&&loaded&&editing);cancel.disabled=!editable;
  legacy.hidden=mode!==1;schedule.hidden=mode!==2;for(const input of Object.values(inputs))input.disabled=!(editable&&editing&&mode===1);
  for(const step of steps){step.time.disabled=step.task.disabled=!(editable&&editing&&mode===2);step.remove.disabled=!(editable&&editing&&steps.length>1);}deferred.disabled=!(editable&&editing&&mode===2);add.disabled=!(editable&&editing&&steps.length<12);renderView();
 }
 function fill(values){
  mode=values&&values.version!==2?1:2;for(const key of Object.keys(inputs))inputs[key].value=mode===1?values[key]||'':'';deferred.value=mode===2?values?.deferred||'':'';rows.replaceChildren();steps=[];
  for(const [index,value]of (mode===2?(values?.steps||Array.from({length:5},()=>({time:'',task:''}))):[]).entries()){
   const group=el('div'),timeLabel=el('label',`${index+1}. 시간`),taskLabel=el('label','풀이 내용 · 문항 / 유형'),time=el('textarea'),task=el('textarea'),remove=el('button','삭제');group.className='strategy-editor-row';time.name=`step_time_${index}`;task.name=`step_task_${index}`;time.maxLength=200;task.maxLength=500;time.rows=2;task.rows=2;time.placeholder='시간 또는 구간';task.placeholder='풀이 순서에 맞는 문항·유형';time.value=value.time;task.value=value.task;timeLabel.appendChild(time);taskLabel.appendChild(task);remove.type='button';remove.setAttribute('aria-label',`${index+1}번째 구간 삭제`);remove.addEventListener('click',()=>{if(remove.disabled||!editing)return;const next=readValues();next.steps.splice(index,1);fill(next);dirty=true;controls();(steps[Math.min(index,steps.length-1)]?.time)?.focus?.();});group.appendChild(timeLabel);group.appendChild(taskLabel);group.appendChild(remove);rows.appendChild(group);steps.push({time,task,remove});
  }
 }
 function renderView(){
  view.replaceChildren();if(!row){const empty=el('p',!studentId?'학생을 선택하면 현재 전략을 볼 수 있습니다.':loaded?'아직 저장된 풀이 전략이 없습니다.':'저장된 풀이 전략을 확인해 주세요.');empty.className='muted';view.appendChild(empty);return;}
  const values=decodePlan(row.plan_text);
  if(values.version===2){const list=el('ol');list.className='strategy-timeline';for(const step of values.steps){const item=el('li'),time=el('strong',step.time),task=el('span',step.task);time.className='strategy-step-time';task.className='strategy-step-task';item.appendChild(time);item.appendChild(task);list.appendChild(item);}view.appendChild(list);if(values.deferred){const block=el('div'),title=el('strong','배제 및 시간 남으면 풀이'),text=el('p',values.deferred);block.className='strategy-deferred';block.appendChild(title);block.appendChild(text);view.appendChild(block);}}
  else{const list=el('dl');list.className='strategy-legacy-view';for(const [key,title]of [['order','풀이 순서'],['time','시간'],['types','유형']]){list.appendChild(el('dt',title));list.appendChild(el('dd',values[key]));}view.appendChild(list);}
 }
 function clear(){loaded=false;dirty=false;editing=false;row=null;pending=null;draftId=makeId();fill();}
 function current(ticket,student){return !destroyed&&ticket===generation&&student===studentId;}
 function failIdentity(){clear();actor=null;controls();}
 async function access(ticket,student){let verified;try{verified=await verifyAccess();assertCurrent(verified.version);}catch(error){if(current(ticket,student))failIdentity();throw error;}if(!current(ticket,student))return null;const next={id:verified.user?.id,admin:verified.isAdmin===true};if(!next.id||!next.admin||(actor&&(actor.id!==next.id||actor.admin!==next.admin))||(student&&student===next.id)){failIdentity();throw Error('계정 또는 조회 권한이 변경되었습니다. 새로고침해 주세요.');}actor=next;return verified;}
 function validateRow(value,student){if(!value||value.teacher_id!==actor.id||value.student_id!==student||value.source_key!==SOURCE_KEY||value.source_label!=='직접 입력 풀이 전략'||value.source_excerpt!==''||value.record_type!=='lesson_plan'||value.date_precision!=='unknown'||value.event_date!==null||typeof value.id!=='string'||!value.id||!Number.isSafeInteger(value.revision)||value.revision<1)throw Error('풀이 전략 조회 범위 또는 형식이 일치하지 않습니다. 원본을 덮어쓰지 않았습니다.');return decodePlan(value.plan_text);}
 function draftMatches(value){try{return encodePlan(readValues())===value;}catch{return false;}}
 function sameVersion(a,b){return a===null&&b===null||Boolean(a&&b&&a.id===b.id&&a.revision===b.revision);}
 async function refresh(){
  if(busy||destroyed)return;const ticket=generation,student=studentId;busy=true;controls();message.textContent=student?'풀이 전략을 불러오는 중입니다.':'풀이 전략을 입력할 학생을 선택해 주세요.';
  try{const a=await access(ticket,student);if(!a)return;if(!student){loaded=false;return;}
   const result=await client.from(TABLE).select(FIELDS).eq('teacher_id',a.user.id).eq('student_id',student).eq('source_key',SOURCE_KEY).maybeSingle();
   if(!current(ticket,student))return;await access(ticket,student);if(!current(ticket,student))return;
   if(result.error)throw Error('풀이 전략을 불러오지 못했습니다. 입력 내용은 유지했습니다.');const next=result.data||null,values=next?validateRow(next,student):undefined;
   if(dirty&&pending&&next?.plan_text===pending.plan_text&&next.id===pending.id){row=next;pending=null;loaded=true;if(draftMatches(next.plan_text)){dirty=false;editing=false;fill(values);message.textContent='저장된 풀이 전략을 확인했습니다.';}else message.textContent='이전 저장을 확인했습니다. 입력 중인 변경 내용은 아직 저장되지 않았습니다.';}
   else if(dirty&&!sameVersion(row,next)){loaded=false;message.textContent='다른 화면에서 변경되었습니다. 입력 내용을 따로 보관한 후 브라우저를 새로고침해 주세요.';}
   else{if(!dirty){row=next;fill(values);}pending=null;loaded=true;message.textContent='';}
  }catch(error){if(current(ticket,student)){loaded=false;message.textContent=error.message||'풀이 전략을 불러오지 못했습니다.';}}
  finally{if(current(ticket,student)){busy=false;controls();}}
 }
 async function savePlan(){
  if(busy||!loaded||!editing||!studentId||!actor?.admin||destroyed)return;let plan_text;try{plan_text=encodePlan(readValues());}catch(error){message.textContent=error.message;return;}
  const ticket=generation,student=studentId,edit=row?{id:row.id,revision:row.revision}:null,id=edit?.id||draftId;busy=true;dirty=true;pending={id,plan_text};controls();message.textContent='저장 중입니다.';
  try{const a=await access(ticket,student);if(!a)return;let query;
   if(edit)query=client.from(TABLE).update({plan_text}).eq('id',edit.id).eq('teacher_id',a.user.id).eq('student_id',student).eq('source_key',SOURCE_KEY).eq('revision',edit.revision);
   else query=client.from(TABLE).insert({id,teacher_id:a.user.id,student_id:student,source_key:SOURCE_KEY,source_label:'직접 입력 풀이 전략',source_excerpt:'',record_type:'lesson_plan',date_precision:'unknown',event_date:null,plan_text});
   const result=await query.select(FIELDS).maybeSingle();if(!current(ticket,student))return;await access(ticket,student);if(!current(ticket,student))return;
   if(result.error)throw Error('저장 결과를 확인하지 못했습니다. 입력 내용은 유지했습니다. 새로고침으로 저장 여부를 확인해 주세요.');
   if(!result.data)throw Error('다른 화면에서 변경되었습니다. 입력 내용을 따로 보관한 후 브라우저를 새로고침해 주세요.');
   const values=validateRow(result.data,student);if(result.data.id!==id||result.data.plan_text!==plan_text||result.data.revision!==(edit?edit.revision+1:1))throw Error('저장 결과가 일치하지 않습니다. 새로고침으로 확인해 주세요.');
   row=result.data;pending=null;dirty=false;editing=false;loaded=true;fill(values);message.textContent='저장했습니다.';
  }catch(error){if(current(ticket,student)){loaded=false;message.textContent=error.message||'저장하지 못했습니다. 입력 내용은 유지했습니다.';}}
  finally{if(current(ticket,student)){busy=false;controls();}}
 }
 function selectStudent(id){generation++;studentId=String(id||'');busy=false;clear();controls();return refresh();}
 function invalidate(){generation++;studentId='';actor=null;busy=false;clear();message.textContent='로그인 상태를 다시 확인해 주세요.';controls();}
 function destroy(){invalidate();destroyed=true;container.replaceChildren();container.hidden=true;}
 fill();controls();return {selectStudent,refresh,invalidate,destroy};
}
const api={create,encodePlan,decodePlan};if(typeof module==='object'&&module.exports)module.exports=api;else root.StrategyPanel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
