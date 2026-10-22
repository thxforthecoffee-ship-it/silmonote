/* Admin review is a read-only presentation of the existing English rate calculation. */
(function(root){'use strict';
function build(D,scores,notes,allRecords){
 const analyses=scores.filter(r=>r.record_kind!=='score_only');
 const domains=D.domains.map((domain,order)=>{const stats=D.deriveRates(analyses,notes,domain,allRecords);return {domain,order,stats,feedback:D.feedbackCandidates([...analyses,...notes],domain),basis:stats.estimated?'기록 기반 추정'+(stats.explicit?' 포함':''):'확인 문항 기준'};});
 const priorities=domains.filter(x=>x.stats.total>0&&x.stats.incorrect>0&&Number.isFinite(x.stats.errorRate)).slice().sort((a,b)=>b.stats.errorRate-a.stats.errorRate||b.stats.incorrect-a.stats.incorrect||a.order-b.order).slice(0,3);
 return {domains,priorities};
}
const api={build};if(typeof module==='object'&&module.exports)module.exports=api;else root.AdminReview=api;
})(typeof globalThis!=='undefined'?globalThis:this);
