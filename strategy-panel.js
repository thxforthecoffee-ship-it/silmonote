/* Instructor-only manual strategy. Imported records and published summaries are never changed here. */
(function(root){'use strict';
const TABLE='teacher_strategy_records',SOURCE_KEY='app:manual-strategy:v1',FORMAT='silmonote.manual-strategy';
const FIELDS='id,teacher_id,student_id,source_key,source_label,source_excerpt,record_type,date_precision,event_date,plan_text,revision';
function encodePlan(values){
 const plan={format:FORMAT,version:1};
 for(const key of ['order','time','types']){if(typeof values[key]!=='string')throw Error('풀이 순서, 시간, 유형을 모두 입력해 주세요.');const value=values[key].trim();if(!value||value.length>1000)throw Error('풀이 순서, 시간, 유형을 각각 1~1000자로 입력해 주세요.');plan[key]=value;}
 const encoded=JSON.stringify(plan);if(encoded.length>4000)throw Error('입력 내용이 너무 깁니다. 특수문자나 줄바꿈을 줄여 주세요.');return encoded;
}
function decodePlan(value){
 let plan;try{plan=JSON.parse(value);}catch{throw Error('저장된 풀이 전략 형식을 확인할 수 없습니다. 원본을 덮어쓰지 않았습니다.');}
 if(!plan||Array.isArray(plan)||plan.format!==FORMAT||plan.version!==1||Object.keys(plan).sort().join(',')!=='format,order,time,types,version')throw Error('저장된 풀이 전략 형식을 확인할 수 없습니다. 원본을 덮어쓰지 않았습니다.');
 encodePlan(plan);return {order:plan.order,time:plan.time,types:plan.types};
}
function create({container,client,verifyAccess,assertCurrent=()=>{},document=container.ownerDocument,makeId=()=>root.crypto.randomUUID()}){
 let studentId='',actor=null,generation=0,busy=false,destroyed=false,loaded=false,dirty=false,row=null,draftId=makeId(),pending=null;
 function el(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
 const heading=el('h2','풀이 전략'),form=el('form');form.className='strategy-input-form';form.setAttribute('data-strategy-private','');
 const inputs={};for(const [key,name,title,placeholder]of [['order','solving_order','풀이 순서','문제를 풀 순서를 입력하세요'],['time','time_plan','시간','분, 시간대 또는 구간별 시간을 입력하세요'],['types','question_types','유형','문항 번호나 유형을 입력하세요']]){const label=el('label',title),input=el('textarea');input.name=name;input.maxLength=1000;input.required=true;input.placeholder=placeholder;label.appendChild(input);form.appendChild(label);inputs[key]=input;}
 const save=el('button','저장');save.type='submit';save.className='primary';form.appendChild(save);const message=el('p');message.className='strategy-status';message.setAttribute('role','status');message.setAttribute('aria-live','polite');container.replaceChildren(heading,form,message);container.hidden=true;
 form.addEventListener('input',()=>{dirty=true;});form.addEventListener('submit',event=>{event.preventDefault();savePlan();});
 function controls(){const editable=Boolean(actor?.admin&&studentId&&!busy&&!destroyed);for(const input of Object.values(inputs))input.disabled=!editable;save.disabled=!(editable&&loaded);container.hidden=!actor?.admin||destroyed;}
 function fill(values={}){for(const key of Object.keys(inputs))inputs[key].value=values[key]||'';}
 function clear(){loaded=false;dirty=false;row=null;pending=null;draftId=makeId();fill();}
 function current(ticket,student){return !destroyed&&ticket===generation&&student===studentId;}
 function failIdentity(){clear();actor=null;controls();}
 async function access(ticket,student){let verified;try{verified=await verifyAccess();assertCurrent(verified.version);}catch(error){if(current(ticket,student))failIdentity();throw error;}if(!current(ticket,student))return null;const next={id:verified.user?.id,admin:verified.isAdmin===true};if(!next.id||!next.admin||(actor&&(actor.id!==next.id||actor.admin!==next.admin))||(student&&student===next.id)){failIdentity();throw Error('계정 또는 조회 권한이 변경되었습니다. 새로고침해 주세요.');}actor=next;return verified;}
 function validateRow(value,student){if(!value||value.teacher_id!==actor.id||value.student_id!==student||value.source_key!==SOURCE_KEY||value.source_label!=='직접 입력 풀이 전략'||value.source_excerpt!==''||value.record_type!=='lesson_plan'||value.date_precision!=='unknown'||value.event_date!==null||typeof value.id!=='string'||!value.id||!Number.isSafeInteger(value.revision)||value.revision<1)throw Error('풀이 전략 조회 범위 또는 형식이 일치하지 않습니다. 원본을 덮어쓰지 않았습니다.');return decodePlan(value.plan_text);}
 function draftMatches(value){try{return encodePlan(Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value])))===value;}catch{return false;}}
 function sameVersion(a,b){return a===null&&b===null||Boolean(a&&b&&a.id===b.id&&a.revision===b.revision);}
 async function refresh(){
  if(busy||destroyed)return;const ticket=generation,student=studentId;busy=true;controls();message.textContent=student?'풀이 전략을 불러오는 중입니다.':'풀이 전략을 입력할 학생을 선택해 주세요.';
  try{const a=await access(ticket,student);if(!a)return;if(!student){loaded=false;return;}
   const result=await client.from(TABLE).select(FIELDS).eq('teacher_id',a.user.id).eq('student_id',student).eq('source_key',SOURCE_KEY).maybeSingle();
   if(!current(ticket,student))return;await access(ticket,student);if(!current(ticket,student))return;
   if(result.error)throw Error('풀이 전략을 불러오지 못했습니다. 입력 내용은 유지했습니다.');const next=result.data||null,values=next?validateRow(next,student):{};
   if(dirty&&pending&&next?.plan_text===pending.plan_text&&next.id===pending.id){row=next;pending=null;loaded=true;if(draftMatches(next.plan_text)){dirty=false;fill(values);message.textContent='저장된 풀이 전략을 확인했습니다.';}else message.textContent='이전 저장을 확인했습니다. 입력 중인 변경 내용은 아직 저장되지 않았습니다.';}
   else if(dirty&&!sameVersion(row,next)){loaded=false;message.textContent='다른 화면에서 변경되었습니다. 입력 내용을 따로 보관한 후 브라우저를 새로고침해 주세요.';}
   else{if(!dirty){row=next;fill(values);}pending=null;loaded=true;message.textContent='';}
  }catch(error){if(current(ticket,student)){loaded=false;message.textContent=error.message||'풀이 전략을 불러오지 못했습니다.';}}
  finally{if(current(ticket,student)){busy=false;controls();}}
 }
 async function savePlan(){
  if(busy||!loaded||!studentId||!actor?.admin||destroyed)return;let plan_text;try{plan_text=encodePlan(Object.fromEntries(Object.entries(inputs).map(([key,input])=>[key,input.value])));}catch(error){message.textContent=error.message;return;}
  const ticket=generation,student=studentId,edit=row?{id:row.id,revision:row.revision}:null,id=edit?.id||draftId;busy=true;dirty=true;pending={id,plan_text};controls();message.textContent='저장 중입니다.';
  try{const a=await access(ticket,student);if(!a)return;let query;
   if(edit)query=client.from(TABLE).update({plan_text}).eq('id',edit.id).eq('teacher_id',a.user.id).eq('student_id',student).eq('source_key',SOURCE_KEY).eq('revision',edit.revision);
   else query=client.from(TABLE).insert({id,teacher_id:a.user.id,student_id:student,source_key:SOURCE_KEY,source_label:'직접 입력 풀이 전략',source_excerpt:'',record_type:'lesson_plan',date_precision:'unknown',event_date:null,plan_text});
   const result=await query.select(FIELDS).maybeSingle();if(!current(ticket,student))return;await access(ticket,student);if(!current(ticket,student))return;
   if(result.error)throw Error('저장 결과를 확인하지 못했습니다. 입력 내용은 유지했습니다. 새로고침으로 저장 여부를 확인해 주세요.');
   if(!result.data)throw Error('다른 화면에서 변경되었습니다. 입력 내용을 따로 보관한 후 브라우저를 새로고침해 주세요.');
   const values=validateRow(result.data,student);if(result.data.id!==id||result.data.plan_text!==plan_text||result.data.revision!==(edit?edit.revision+1:1))throw Error('저장 결과가 일치하지 않습니다. 새로고침으로 확인해 주세요.');
   row=result.data;pending=null;dirty=false;loaded=true;fill(values);message.textContent='저장했습니다.';
  }catch(error){if(current(ticket,student)){loaded=false;message.textContent=error.message||'저장하지 못했습니다. 입력 내용은 유지했습니다.';}}
  finally{if(current(ticket,student)){busy=false;controls();}}
 }
 function selectStudent(id){generation++;studentId=String(id||'');busy=false;clear();controls();return refresh();}
 function invalidate(){generation++;studentId='';actor=null;busy=false;clear();message.textContent='로그인 상태를 다시 확인해 주세요.';controls();}
 function destroy(){invalidate();destroyed=true;container.replaceChildren();container.hidden=true;}
 controls();return {selectStudent,refresh,invalidate,destroy};
}
const api={create,encodePlan,decodePlan};if(typeof module==='object'&&module.exports)module.exports=api;else root.StrategyPanel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
