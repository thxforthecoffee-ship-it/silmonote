const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('history.html','utf8'),panel=fs.readFileSync('strategy-panel.js','utf8');
test('verified integration explicitly reveals the strategy container',()=>{
 const setup=html.slice(html.indexOf('function setupStrategyPanel('),html.indexOf('function setupAdminReview('));
 assert.match(setup,/\$\('strategyPanel'\)\.hidden\s*=\s*false/);
 assert(setup.includes('AppAccess.requireAccess(client)'));
 assert(setup.includes('access.isAdmin!==identity.isAdmin'));
});
test('public printable path does not consult private evidence or editor text',()=>{
 const print=panel.slice(panel.indexOf('function getPrintableSummary('),panel.indexOf('controls();return{selectStudent'));
 assert(print.includes('publicRows()'));
 assert(!/privateRows|source_excerpt|input\.value/.test(print));
 const publicRows=panel.slice(panel.indexOf('function publicRows('),panel.indexOf('function renderSummary('));
 assert(publicRows.includes('is_published===true'));
 assert(html.includes('#strategyPanel [data-strategy-private]{display:none!important}'));
 assert(!html.includes(':not(#teacherAssignments)'));
});
test('student pathway gates private retrieval on verified admin rather than display style',()=>{
 const fetch=panel.slice(panel.indexOf('async function fetchPrivate('),panel.indexOf('async function refresh('));
 assert(fetch.indexOf('!actor.admin')<fetch.indexOf('client.from(PRIVATE_TABLE)'));
 const refresh=panel.slice(panel.indexOf('async function refresh('),panel.indexOf('async function loadPrivate('));
 assert(refresh.includes("else q=q.eq('is_published',true)"));
 assert(refresh.includes('if(actor.admin){try{await fetchPrivate'));
 assert(panel.includes("PUBLIC_TABLE='student_strategy_summaries',PRIVATE_TABLE='teacher_strategy_records'"));
});
