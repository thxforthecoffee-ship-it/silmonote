/* Pure Korean record rules. No inference of exam structure, grades or student ability. */
(function(root){
'use strict';
const AREAS=['독서','문학','언어·문법','화법','작문','매체','복합·기타','미분류'];
const TAGS=['개념·규칙 적용','정보·관계 파악','조건·선지 해석','근거 연결·추론','문학 상황·표현','시간·풀이 운영','기타','판단 보류'];
const STATUS={unreviewed:'미확인',confirmed:'확인',followup:'추가 확인'};
const HELP={'독서':'어떤 정보들의 관계를 어떻게 읽었고, 어느 근거에서 선지로 이어졌나요?','문학':'화자·인물의 상황과 태도, 표현·서술, 보기 중 무엇을 근거로 판단했나요?','언어·문법':'어떤 개념·규칙을 어떤 조건에 적용했나요?','화법':'목적·대상·상황, 자료, 제시 조건 가운데 무엇을 확인했나요?','작문':'목적·대상·상황, 자료, 제시 조건 가운데 무엇을 확인했나요?','매체':'목적·대상·상황, 자료, 제시 조건 가운데 무엇을 확인했나요?'};
const TABLES={note:'korean_notes',score:'korean_score_reports'};
const PRE=['해설 전 기록','해설 후 회상','기억나지 않음'];
function number(v,min=0,max=10000){if(v==null||String(v).trim()==='')return null;if(!/^\d+(?:\.\d+)?$/.test(String(v).trim()))return null;const n=Number(v);return Number.isFinite(n)&&n>=min&&n<=max?n:null;}
function score(c){const max=number(c.max_score,1),value=number(c.score,0,max===null?0:max);return max!==null&&value!==null?{value,max,rate:value/max*100}:null;}
function day(v){if(!v||!Number.isFinite(Date.parse(v)))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v));}
function compare(a,b){return (Date.parse(b.created_at)||0)-(Date.parse(a.created_at)||0)||String(b.id).localeCompare(String(a.id));}
function validate(kind,raw){
 if(!TABLES[kind])throw Error('기록 종류를 확인해 주세요.');
 const title=String(raw.exam_title||'').trim();if(!title||title.length>200)throw Error('시험명은 1~200자로 입력해 주세요.');
 const date=raw.test_date||null;if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error('시험일을 확인해 주세요.');
 const c={version:1};for(const [key,value]of Object.entries(raw.content||{})){if(Array.isArray(value)){c[key]=value.filter(v=>TAGS.includes(v));continue;}const s=String(value??'').trim();if(s.length>5000)throw Error('각 항목은 5,000자 이내로 입력해 주세요.');c[key]=s;}
 if(kind==='score'){
  const max=number(c.max_score,1);if(max===null)throw Error('만점은 1~10,000 사이의 숫자로 입력해 주세요.');c.max_score=max;
  if(c.score!==''){const value=number(c.score,0,max);if(value===null)throw Error('원점수는 0점부터 만점 사이로 입력해 주세요.');c.score=value;}else c.score=null;
  if(c.grade!==''&&(!/^[1-9]$/.test(c.grade)))throw Error('등급은 성적표의 1~9등급을 입력하거나 비워 주세요.');
 }else{
  if(!c.question)throw Error('문항 번호나 식별 정보를 입력해 주세요.');
  if(!AREAS.includes(c.area)||!PRE.includes(c.pre_status))throw Error('기록 영역과 해설 확인 상태를 선택해 주세요.');
 }
 return {exam_title:title,test_date:date,content:c};
}
function summarize(rows,start='',end=''){
 const selected=rows.filter(r=>!r.deleted_at&&(!start||day(r.created_at)>=start)&&(!end||day(r.created_at)<=end));
 const notes=selected.filter(r=>r.kind==='note'),scores=selected.filter(r=>r.kind==='score').sort(compare).reverse(),confirmed=selected.filter(r=>r.teacher_status==='confirmed');
 const tagCounts=Object.fromEntries(TAGS.map(t=>[t,0]));for(const r of confirmed)for(const tag of new Set(r.teacher_tags||[]))if(TAGS.includes(tag))tagCounts[tag]++;
 const rechecks=selected.filter(r=>String(r.recheck_task||'').trim());
 return {selected,notes,scores,confirmed,tagCounts,rechecks,recheckDone:rechecks.filter(r=>r.recheck_done).length};
}
const api={AREAS,TAGS,STATUS,HELP,TABLES,PRE,number,score,day,compare,validate,summarize};root.KoreanCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
