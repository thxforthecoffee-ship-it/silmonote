const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'korean.js'),'utf8');
const html=fs.readFileSync(path.join(root,'korean.html'),'utf8');
const K=require('../korean-core.js'),E=require('../korean-exam-core.js');
function context(){const nodes=new Map();const sandbox={KoreanCore:K,KoreanExam:E,location:{href:'korean.html'},URLSearchParams,TextEncoder,console,document:{getElementById(id){if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,replaceChildren(){}});return nodes.get(id);}},AppAccess:{assertCurrent(){}}};vm.createContext(sandbox);vm.runInContext(source.slice(0,source.indexOf("for(const area of ['',...K.AREAS])")),sandbox);return sandbox;}
(async()=>{
assert.match(source,/basicScoreFields=new Set\(\['exam_mode','elective','score','review','next_goal'\]\)/);
assert.match(source,/questionEditor=makeQuestionEditor\(extra,/);
assert.match(source,/extra.open=false/);
assert.match(html,/>누적 점수표<\/h2>/);
assert.ok(html.indexOf('id="scoreRows"')<html.indexOf('id="scoreChart"'));
const c=context();
vm.runInContext(`identity={user:{id:'own'},isAdmin:false};owner='own';access=async()=>({version:1});controls=()=>{};render=()=>{};status=()=>{};globalThis.calls=[];page=async(kind,who,cursor,trash)=>{calls.push({kind,who,cursor,trash});if(kind==='note')return [];const start=cursor?Number(cursor.id)+1:0;return Array.from({length:Math.min(41,85-start)},(_,i)=>({id:String(start+i),kind:'score',user_id:who,created_at:'2026-10-01',deleted_at:null}));};`,c);
await vm.runInContext('load(true)',c);
assert.equal(vm.runInContext('rows.length',c),85);
assert.equal(vm.runInContext('more.score',c),false);
assert.equal(c.calls.filter(x=>x.kind==='score').length,3);
assert.ok(c.calls.every(x=>x.who==='own'&&x.trash===false));
// Exercise the actual save validation section without persistence or DOM.
const saveBody=source.slice(source.indexOf('const values=formValues'),source.indexOf("}catch(e){const details=$('formFields')"));
const legacy={version:1,score:0,max_score:100,grade:'',time_plan:'  existing  ',extension:{keep:true},custom_list:['legacy'],question_reviews:[{number:'9',area:'독서',result:'오답',reason:'reason',evidence:'evidence',next_action:'next',chosen:'',correct:'',extra:'retain'}]};
const baseline=Object.fromEntries(vm.runInContext('scoreFields.map(([name])=>[name,\'\'])',c));Object.assign(baseline,{exam_title:'new title',test_date:'',exam_mode:E.OTHER,elective:'',score:'0',max_score:'100',time_plan:'  existing  '});
c.fixture={legacy,baseline};
vm.runInContext(`globalThis.model={kind:'score',row:{content:fixture.legacy},initialValues:fixture.baseline,initialReviews:JSON.stringify(fixture.legacy.question_reviews)};formValues=()=>fixture.baseline;questionEditor={values:()=>fixture.legacy.question_reviews};globalThis.data=null;`,c);
vm.runInContext(saveBody,c);
for(const key of Object.keys(legacy))assert.deepEqual(c.data.content[key],legacy[key],key);
console.log('PASS compact Korean form structure, full 85-score pagination with owner scope, legacy content preservation');
})().catch(e=>{console.error(e);process.exitCode=1;});
