/* Admin review is a read-only presentation of the existing English rate calculation. */
(function(root){'use strict';
function build(D,scores,notes,allRecords){
 const analyses=scores.filter(r=>r.record_kind!=='score_only');
 const domains=D.domains.map((domain,order)=>{const stats=D.deriveRates(analyses,notes,domain,allRecords);const guessed=analyses.reduce((n,r)=>{const loss=D.lossForEdit?D.lossForEdit(r,domain.key):null,counts=D.assessed?D.assessed(loss?.assessment,domain.size):null,qs=D.questionMap?.[domain.key]||[];const marked=[...new Set(Array.isArray(loss?.provenance?.guessed_correct_questions)?loss.provenance.guessed_correct_questions:[])].filter(q=>qs.includes(q));return n+(counts&&marked.length<=counts.correct?marked.length:0);},0);return {domain,order,stats,guessed,feedback:D.feedbackCandidates([...analyses,...notes],domain),basis:stats.estimated?'기록 기반 추정'+(stats.explicit?' 포함':''):'확인 문항 기준'};});
 const priorities=domains.filter(x=>x.stats.total>0&&x.stats.incorrect>0&&Number.isFinite(x.stats.errorRate)).slice().sort((a,b)=>b.stats.errorRate-a.stats.errorRate||b.stats.incorrect-a.stats.incorrect||a.order-b.order).slice(0,2);
 return {domains,priorities};
}
function scoreWindow(scores,{basis='exam',partial=false}={}){
 const valid=scores.filter(r=>r.real_score!==null&&r.real_score!==undefined&&String(r.real_score).trim()!==''&&Number.isInteger(Number(r.real_score))&&Number(r.real_score)>=0&&Number(r.real_score)<=100);
 const empty=reason=>({recent:[],previous:[],delta:null,reason});
 if(partial)return empty('기록을 모두 불러온 뒤 비교');
 if(basis!=='exam')return empty('시험일 기준에서 최근 응시 비교');
 if(valid.some(r=>r.exam_date_precision!=='exact'||!/^\d{4}-\d{2}-\d{2}$/.test(r.exam_date||'')||!Number.isFinite(Date.parse(r.exam_date+'T00:00:00Z'))||new Date(r.exam_date+'T00:00:00Z').toISOString().slice(0,10)!==r.exam_date))return empty('임의 날짜·미상 날짜의 응시 순서 확인 필요');
 const ordered=valid.slice().sort((a,b)=>b.exam_date.localeCompare(a.exam_date));
 for(const cut of [3,6])if(ordered[cut-1]&&ordered[cut]&&ordered[cut-1].exam_date===ordered[cut].exam_date)return empty('같은 날짜 시험의 응시 순서 확인 필요');
 const recent=ordered.slice(0,3),previous=ordered.slice(3,6),mean=rows=>rows.reduce((n,r)=>n+Number(r.real_score),0)/rows.length;
 return {recent,previous,delta:recent.length===3&&previous.length===3?mean(recent)-mean(previous):null,reason:ordered.length<6?'두 묶음 비교에는 6회 필요':''};
}
const api={build,scoreWindow};if(typeof module==='object'&&module.exports)module.exports=api;else root.AdminReview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
