/* Print only in the user's browser; no upload or server-side export. */
(function(root){'use strict';
function create({document,window,isAdmin}){
 let snapshot=null,previousClass=false;
 function beforePrint(){if(snapshot!==null)return;const admin=Boolean(isAdmin());previousClass=document.body.classList.contains('teacher-report-print');snapshot=[...document.querySelectorAll('details')].map(el=>({el,open:el.open}));document.body.classList.toggle('teacher-report-print',admin);
  const selector=admin?'#reviewTrend, #reviewDomains, #reviewLedger, #domainCards .domain-loss-evidence':'#domainCards details';
  for(const el of document.querySelectorAll(selector))el.open=true;
 }
 function afterPrint(){if(snapshot===null)return;for(const {el,open} of snapshot)el.open=open;snapshot=null;document.body.classList.toggle('teacher-report-print',previousClass);}
 function print(){try{window.print();}catch(error){afterPrint();throw error;}}
 window.addEventListener('beforeprint',beforePrint);window.addEventListener('afterprint',afterPrint);
 const media=typeof window.matchMedia==='function'?window.matchMedia('print'):null;
 if(media?.addEventListener)media.addEventListener('change',event=>{if(event.matches)beforePrint();else afterPrint();});
 return {print,beforePrint,afterPrint};
}
const api={create};if(typeof module==='object'&&module.exports)module.exports=api;else root.ReportPrint=api;
})(typeof globalThis!=='undefined'?globalThis:this);
