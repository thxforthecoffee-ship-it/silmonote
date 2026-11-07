const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const K=require('../korean-core.js'),E=require('../korean-exam-core.js');
const src=fs.readFileSync(require.resolve('../korean.js'),'utf8');
const valid={exam_analysis_version:2,exam_mode:E.CURRENT,elective:'화법과 작문',score:75,max_score:100,grade:'',question_reviews:[]};
const run=c=>K.validate('score',{exam_title:'가상 시험',content:{...valid,...c}}).content;
assert.equal(run({area_reading_score:0,area_reading_max:34}).area_reading_score,'0');
assert.equal(run({area_reading_score:'',area_reading_max:''}).area_reading_score,'');
assert.equal(run({area_reading_score:15}).area_reading_score,'15');
assert.throws(()=>run({area_reading_score:35,area_reading_max:34}),/만점/);
assert.throws(()=>run({area_literature_score:-1}),/영역별/);
assert.throws(()=>run({area_elective_max:0}),/만점/);
assert.throws(()=>run({area_literature_score:'oops'}),/영역별/);
for(const [file,mode] of [['korean-analysis.html','score'],['korean-notes.html','note']]){
 const html=fs.readFileSync(require.resolve('../'+file),'utf8');
 assert.ok(html.includes('data-entry-mode="'+mode+'"'));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length);
 for(const required of ['recordForm','formFields','teacherForm','student','status','records','report'])assert.ok(ids.includes(required));
 for(const href of ['korean-analysis.html','korean-notes.html','korean.html'])assert.ok(html.includes('href="'+href+'"'));
 assert.ok(html.includes('korean.js?v=20261107-split'));assert.ok(html.includes('korean-exam-core.js?v=20261107-split'));
}
assert.match(src,/if\(\(c.question_reviews\|\|\[\]\)\.length\)/);
assert.match(src,/if\(model.row\)\{for\(const \[key,value\]/);
assert.match(src,/\(!entryMode\|\|r.kind===entryMode\)/);
assert.match(src,/owner===identity.user.id&&!editing/);
assert.match(src,/\.eq\('updated_at',model.row.updated_at\)/);
assert.match(src,/if\(!canLeave\(\)\)\{e.preventDefault\(\);return;\}/);
assert.doesNotMatch(src,/innerHTML\s*=/);
const css=fs.readFileSync(require.resolve('../korean.css'),'utf8');assert.match(css,/body\[data-entry-mode\] #report/);assert.match(css,/@media\(max-width:650px\)/);
console.log('PASS split pages, navigation, owner/concurrency guards, legacy preservation, optional area score validation (0/blank/partial/invalid)');
