/* Pure validation for score-only records. Does not grant write access. */
(function(root){
'use strict';
function date(value){if(!value)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('시험일을 확인해 주세요.');const d=new Date(value+'T00:00:00Z');if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw Error('시험일을 확인해 주세요.');return value;}
function gradeFromScore(value){const s=String(value??'').trim();if(!/^\d{1,3}$/.test(s)||Number(s)>100)return null;return String(Math.max(1,Math.min(9,10-Math.floor(Number(s)/10))));}
function requiredGrade(value){const grade=gradeFromScore(value);if(grade===null)throw Error('점수는 0~100의 정수로 입력해 주세요.');return grade;}
function payload(input,student){
 if(!student||!student.is_approved||!student.id)throw Error('승인된 학생을 선택해 주세요.');
 const title=String(input.title||'').trim();if(!title||title.length>200)throw Error('시험명은 1~200자로 입력해 주세요.');
 const score=String(input.score??'').trim();if(!/^\d{1,3}$/.test(score)||Number(score)>100)throw Error('점수는 0~100의 정수로 입력해 주세요.');
 const grade=requiredGrade(input.score);
 return {user_id:student.id,user_name:student.name||null,exam_title:title,exam_date:date(input.date),record_kind:'score_only',real_score:String(Number(score)),real_grade:grade||null};
}
const api={date,payload,gradeFromScore,requiredGrade};if(typeof module==='object'&&module.exports)module.exports=api;else root.ScoreEntry=api;
})(typeof globalThis!=='undefined'?globalThis:this);
