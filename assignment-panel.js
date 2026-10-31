/* Teacher-private assignments. Database RLS is authoritative; no student sharing or messaging. */
(function(root){'use strict';
const STATUSES={planned:'예정',deferred:'보류',completed:'완료'};
function localDateLabel(value){const d=new Date(value);if(!value||!Number.isFinite(d.getTime()))return '날짜 미상';return String(d.getFullYear()).padStart(4,'0')+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function validate(values){
 const task_text=String(values.task_text||'').trim(),result_text=String(values.result_text||'').trim(),followup_text=String(values.followup_text||'').trim(),due_date=values.due_date||null,status=values.status;
 if(!task_text||task_text.length>2000)throw new Error('과제 내용을 1~2000자로 입력해 주세요.');
 if(!Object.hasOwn(STATUSES,status))throw new Error('과제 상태를 확인해 주세요.');
 if(result_text.length>4000||followup_text.length>4000)throw new Error('결과와 후속 기록은 각각 4000자 이내로 입력해 주세요.');
 if(due_date&&(!/^\d{4}-\d{2}-\d{2}$/.test(due_date)||due_date.startsWith('0000-')||!Number.isFinite(Date.parse(due_date+'T00:00:00Z'))||new Date(due_date+'T00:00:00Z').toISOString().slice(0,10)!==due_date))throw new Error('마감 날짜를 확인해 주세요.');
 return {task_text,due_date,status,result_text,followup_text};
}
function create({container,client,verifyAccess,assertCurrent=()=>{},document=container.ownerDocument,makeId=()=>root.crypto.randomUUID()}){
 let studentId='',teacherId='',generation=0,busy=false,destroyed=false,editing=null,draftId=makeId(),rows=[],offset=0;
 const nodes={};
 function el(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
 function button(label,action){const b=el('button',label);b.type='button';b.addEventListener('click',action);return b;}
 const title=el('h3','과제 기록'),privateLabel=el('p','작성한 강사만 볼 수 있는 기록입니다. 학생에게 전송되지 않습니다.'),message=el('p');message.setAttribute('role','status');
 const form=el('form');form.addEventListener('submit',event=>{event.preventDefault();save();});
 function field(key,label,tag='textarea',type){const wrap=el('label',label),input=el(tag);if(type)input.type=type;input.name=key;wrap.appendChild(input);form.appendChild(wrap);nodes[key]=input;return input;}
 field('task_text','이번 과제').maxLength=2000;field('due_date','마감일 (선택)','input','date');const status=field('status','상태','select');for(const [value,label] of Object.entries(STATUSES)){const o=el('option',label);o.value=value;status.appendChild(o);}status.value='planned';
 field('result_text','결과 기록').maxLength=4000;field('followup_text','후속 과제 · 확인할 점').maxLength=4000;
 const saveButton=el('button','과제 저장');saveButton.type='submit';form.appendChild(saveButton);const cancelButton=button('새 과제 작성',()=>{resetDraft();message.textContent='';});form.appendChild(cancelButton);
 const refreshButton=button('기록 새로고침',()=>refresh()),list=el('div'),moreButton=button('이전 과제 더 보기',()=>load(true));moreButton.hidden=true;
 const history=el('section'),historySummary=el('h4','저장한 과제 기록');history.className='assignment-history';history.appendChild(historySummary);history.appendChild(refreshButton);history.appendChild(list);history.appendChild(moreButton);const composer=el('details'),composerSummary=el('summary','과제 작성');composer.className='assignment-composer';composer.open=false;composer.appendChild(composerSummary);composer.appendChild(form);container.replaceChildren(title,privateLabel,message,history,composer);
 function controls(){for(const n of Object.values(nodes))n.disabled=busy||!studentId||destroyed;saveButton.disabled=busy||!studentId||destroyed;cancelButton.disabled=busy||!studentId||destroyed;refreshButton.disabled=busy||!studentId||destroyed;moreButton.disabled=busy||!studentId||destroyed;}
 function resetDraft(){editing=null;draftId=makeId();for(const k of ['task_text','due_date','result_text','followup_text'])nodes[k].value='';nodes.status.value='planned';saveButton.textContent='과제 저장';}
 function clearRows(){rows=[];offset=0;list.replaceChildren();moreButton.hidden=true;}
 function clear(){clearRows();composer.open=false;resetDraft();}
 function current(ticket,student){return !destroyed&&ticket===generation&&student===studentId;}
 async function access(ticket,student){let a;try{a=await verifyAccess();assertCurrent(a.version);}catch(error){if(current(ticket,student))clear();throw error;}if(!current(ticket,student))return null;if(!a.isAdmin||!a.user?.id){clear();throw new Error('관리자 권한을 다시 확인해 주세요.');}if(teacherId&&teacherId!==a.user.id){clear();throw new Error('로그인 계정이 변경되었습니다. 페이지를 새로고침해 주세요.');}teacherId=a.user.id;return a;}
 function render(){list.replaceChildren();for(const row of rows){const item=el('article');item.appendChild(el('strong',row.task_text));item.appendChild(el('p',STATUSES[row.status]+' · 작성 '+localDateLabel(row.created_at)+(row.due_date?' · 마감 '+row.due_date:'')));if(row.result_text)item.appendChild(el('p','결과: '+row.result_text));if(row.followup_text)item.appendChild(el('p','후속: '+row.followup_text));item.appendChild(button('수정 · 결과 기록',()=>{if(busy||destroyed||row.student_id!==studentId||row.teacher_id!==teacherId)return;editing={id:row.id,revision:row.revision};for(const k of Object.keys(nodes))nodes[k].value=row[k]||'';saveButton.textContent='변경 저장';composer.open=true;nodes.task_text.focus();}));list.appendChild(item);}if(!rows.length)list.appendChild(el('p','아직 저장한 과제가 없습니다.'));}
 async function load(append=false){if(busy||!studentId||destroyed)return;const ticket=generation,student=studentId;busy=true;controls();message.textContent='과제 기록을 불러오는 중입니다.';
  try{const a=await access(ticket,student);if(!a)return;const start=append?offset:0;const result=await client.from('teacher_assignments').select('*').eq('teacher_id',a.user.id).eq('student_id',student).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+100);if(!current(ticket,student))return;await access(ticket,student);if(!current(ticket,student))return;if(result.error||!Array.isArray(result.data))throw new Error('과제 기록을 불러오지 못했습니다. 권한과 연결을 확인한 뒤 다시 시도해 주세요.');if(result.data.some(r=>r.teacher_id!==a.user.id||r.student_id!==student))throw new Error('과제 조회 범위가 일치하지 않습니다.');const page=result.data.slice(0,100);rows=append?[...rows,...page.filter(r=>!rows.some(old=>old.id===r.id))]:page;offset=start+page.length;moreButton.hidden=result.data.length<=100;render();message.textContent='';
  }catch(e){if(current(ticket,student)){clearRows();message.textContent=e.message||'과제 기록을 불러오지 못했습니다.';}}finally{if(current(ticket,student)){busy=false;controls();}}
 }
 async function save(){if(busy||!studentId||destroyed)return;const ticket=generation,student=studentId;let values;try{values=validate(Object.fromEntries(Object.entries(nodes).map(([k,n])=>[k,n.value])));}catch(e){message.textContent=e.message;return;}const edit=editing?{...editing}:null,id=draftId;busy=true;controls();message.textContent='과제를 저장하는 중입니다.';
  try{const a=await access(ticket,student);if(!a)return;let query;if(edit)query=client.from('teacher_assignments').update(values).eq('id',edit.id).eq('teacher_id',a.user.id).eq('student_id',student).eq('revision',edit.revision);else query=client.from('teacher_assignments').insert({id,teacher_id:a.user.id,student_id:student,...values});const result=await query.select('*').maybeSingle();if(!current(ticket,student))return;await access(ticket,student);if(!current(ticket,student))return;if(result.error)throw new Error('저장 결과를 확인하지 못했습니다. 기록을 새로고침해 저장 여부를 확인해 주세요.');if(!result.data)throw new Error('다른 기기에서 변경되었거나 접근 권한이 바뀌었습니다. 기록을 새로고침한 뒤 해당 과제의 수정 버튼을 다시 눌러 주세요.');if(result.data.teacher_id!==a.user.id||result.data.student_id!==student)throw new Error('저장 범위를 확인하지 못했습니다. 페이지를 새로고침해 주세요.');resetDraft();composer.open=false;rows=[result.data,...rows.filter(r=>r.id!==result.data.id)].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))||String(b.id).localeCompare(String(a.id)));render();message.textContent='과제를 저장했습니다.';
  }catch(e){if(current(ticket,student))message.textContent=e.message||'과제를 저장하지 못했습니다.';}finally{if(current(ticket,student)){busy=false;controls();}}
 }
 function selectStudent(id){generation++;studentId=String(id||'');busy=false;clear();message.textContent=studentId?'':'과제 기록을 남길 학생을 선택해 주세요.';controls();if(studentId)return load();return Promise.resolve();}
 function setSuggestion(text,action='edit'){if(!studentId||busy||destroyed)return false;resetDraft();nodes.task_text.value=String(text||'');nodes.status.value=action==='defer'?'deferred':'planned';message.textContent=action==='defer'?'보류할 과제를 확인한 뒤 저장해 주세요.':'과제를 확인하거나 수정한 뒤 저장해 주세요.';composer.open=true;nodes.task_text.focus();return true;}
 function invalidate(){generation++;studentId='';teacherId='';busy=false;clear();message.textContent='로그인 상태를 다시 확인해 주세요.';controls();}
 function refresh(){return load(false);}
 function destroy(){invalidate();destroyed=true;container.replaceChildren();}
 controls();return {selectStudent,setSuggestion,refresh,invalidate,destroy};
}
const api={create,validate,localDateLabel,STATUSES};if(typeof module==='object'&&module.exports)module.exports=api;else root.AssignmentPanel=api;
})(typeof globalThis!=='undefined'?globalThis:this);

