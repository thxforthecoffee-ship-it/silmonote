const assert=require('node:assert/strict');const K=require('../korean-core.js');
for(const x of ['',null,undefined,'  ','-1','0x10','Infinity','NaN','1e3'])assert.equal(K.number(x),null);assert.equal(K.number('0'),0);
assert.deepEqual(K.score({score:0,max_score:100}),{value:0,max:100,rate:0});assert.equal(K.score({score:null,max_score:100}),null);assert.equal(K.score({score:101,max_score:100}),null);
const raw={exam_title:' 시험 ',test_date:'2026-10-20',content:{score:'0',max_score:'100',grade:''}};assert.equal(K.validate('score',raw).content.score,0);assert.equal(K.validate('score',raw).exam_title,'시험');
assert.throws(()=>K.validate('score',{...raw,content:{score:'90',max_score:'100',grade:'10'}}));assert.equal(K.validate('score',{...raw,content:{score:'90',max_score:'100',grade:''}}).content.grade,'');
assert.throws(()=>K.validate('note',{...raw,content:{area:'문학',question:'',pre_status:'해설 전 기록'}}));
const rows=[{id:'1',kind:'note',created_at:'2026-10-19T15:00:00Z',teacher_status:'confirmed',teacher_tags:['근거 연결·추론','근거 연결·추론'],recheck_task:'다시',recheck_done:true},{id:'2',kind:'note',created_at:'2026-10-18T00:00:00Z',teacher_status:'unreviewed',teacher_tags:['근거 연결·추론'],recheck_task:'다시',recheck_done:false},{id:'3',kind:'score',deleted_at:'2026-10-20',created_at:'2026-10-19T00:00:00Z'}];
const s=K.summarize(rows);assert.equal(s.selected.length,2);assert.equal(s.tagCounts['근거 연결·추론'],1);assert.equal(s.recheckDone,1);assert.equal(s.rechecks.length,2);assert.equal(K.summarize(rows,'2026-10-20').selected.length,1);assert.equal(K.day('2026-10-19T15:00:00Z'),'2026-10-20');
assert.equal(K.TABLES.note,'korean_notes');assert.equal(K.TABLES.score,'korean_score_reports');console.log('PASS Korean pure rules: zero/missing, grade no inference, dates, confirmed-only counts, trash exclusion, tag dedup.');

