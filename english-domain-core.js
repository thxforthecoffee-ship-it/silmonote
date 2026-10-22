(function(root){
'use strict';
const domains=[
 {key:'listening',label:'듣기',range:'1–17',size:17,words:['듣기','청해'],plan:'대본 없이 다시 듣고 근거가 들리는 구간을 표시하세요. 놓친 표현을 대본과 대조한 뒤 같은 구간을 다시 들어 확인하세요.'},
 {key:'main',label:'대의 파악',range:'22–24',size:3,words:['대의','주제','요지','제목'],plan:'문단의 핵심 주장과 반복 표현을 한 문장으로 요약하고, 선택지가 글 전체를 포괄하는지 비교하세요.'},
 {key:'infer',label:'추론 / 함축 / 요약',range:'21, 31–34, 40',size:6,words:['추론','함축','요약','빈칸'],plan:'정답 근거 문장과 연결어를 먼저 표시하고, 빈칸이나 함축 표현을 쉬운 말로 바꾼 뒤 선택지의 범위를 대조하세요.'},
 {key:'flow',label:'흐름 / 순서 / 삽입',range:'35–39',size:5,words:['흐름','순서','삽입'],plan:'지시어가 가리키는 대상, 연결어, 반복 어휘를 표시하고 문장 앞뒤의 연결 근거를 설명하며 다시 배열하세요.'},
 {key:'grammar',label:'어법 / 낱말',range:'29–30',size:2,words:['어법','문법','낱말','어휘'],plan:'어법은 주어·동사와 수식 관계를 표시하고, 낱말은 앞뒤 문맥의 대조·인과 관계로 적절성을 설명하세요.'},
 {key:'long',label:'장문',range:'41–42',size:2,words:['장문'],plan:'문단별 핵심 내용을 짧게 메모한 뒤 전체 주제와 문맥상 어휘를 각각 근거 문장에 연결하세요.'},
 {key:'easy',label:'쉬운 독해',range:'18–20, 25–28, 43–45',size:10,words:['쉬운 독해','목적','심경','도표','일치','불일치'],plan:'문항에서 묻는 조건을 먼저 표시하고 수치·인물·시간 등 선택지의 세부 정보를 지문과 하나씩 대조하세요.'}
];
function assessed(value,size){if(!value||value.version!==1)return null;const c=value.correct,w=value.incorrect;if(!Number.isInteger(c)||!Number.isInteger(w)||c<0||w<0||c+w<1||c+w>size)return null;return {correct:c,incorrect:w,total:c+w};}
function parseInput(correct,incorrect,size){if(correct.trim()===''&&incorrect.trim()==='')return null;if(!/^\d+$/.test(correct.trim())||!/^\d+$/.test(incorrect.trim()))throw Error('정답·오답 수를 모두 0 이상의 정수로 입력하세요. 미확인 문항은 포함하지 마세요.');const value={version:1,correct:Number(correct),incorrect:Number(incorrect)};if(!assessed(value,size))throw Error('확인한 문항 수는 1~'+size+'문항이어야 합니다. 두 칸을 비우면 산출에서 제외됩니다.');return value;}
function lossForEdit(row,key){if(!row.loss_grammar){if(key==='grammar')return null;if(key==='long')return row.loss_long2||null;}return row['loss_'+key]||null;}
function mergeLoss(row,key,fields){const old=lossForEdit(row,key);const result={...(old&&typeof old==='object'&&!Array.isArray(old)?old:{}),...fields};if(key==='grammar'&&!row.loss_grammar&&row.loss_long)result.legacy_unclassified=row.loss_long;return result;}
function aggregate(rows,domain){let correct=0,incorrect=0,covered=0;for(const r of rows){const a=assessed(lossForEdit(r,domain.key)?.assessment,domain.size);if(a){correct+=a.correct;incorrect+=a.incorrect;covered++;}}const total=correct+incorrect;return {correct,incorrect,total,covered,excluded:rows.length-covered,possible:rows.length*domain.size,correctRate:total?100*correct/total:null,errorRate:total?100*incorrect/total:null};}
function suggestion(domain,stats,hasLoss){if(!stats.total)return '자료가 부족해 취약 정도를 판단하지 않았습니다. '+(hasLoss?'저장된 오답·이유를 점검할 때 시도할 일반 연습: ':'정오답 수를 먼저 기록하세요. 이후 시도할 일반 연습: ')+domain.plan;return (stats.incorrect?'확인된 '+stats.total+'문항 중 오답 '+stats.incorrect+'문항을 우선 복습하세요. ':'확인된 '+stats.total+'문항에서는 오답이 없습니다. 미확인 문항까지 강점으로 단정하지 말고 근거 설명을 점검하세요. ')+domain.plan+' 다음 기록에서 같은 유형의 확인 문항 수와 결과를 함께 비교하세요.';}
function feedbackCandidates(rows,domain){return rows.filter(r=>typeof r.feedback==='string'&&r.feedback.trim()&&domain.words.some(word=>r.feedback.includes(word)));}
const api={domains,assessed,parseInput,aggregate,suggestion,feedbackCandidates,lossForEdit,mergeLoss};if(typeof module==='object'&&module.exports)module.exports=api;else root.EnglishDomains=api;
})(typeof globalThis!=='undefined'?globalThis:this);
