const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('history.html','utf8'),panel=fs.readFileSync('strategy-panel.js','utf8');
test('manual strategy integration gates creation on the verified admin identity',()=>{
 const setup=html.slice(html.indexOf('function setupStrategyPanel('),html.indexOf('function setupAdminReview('));
 assert(setup.indexOf('if(!identity?.isAdmin)return')<setup.indexOf('StrategyPanel.create'));
 assert(setup.includes('AppAccess.requireAccess(client,true)'));
 assert(setup.includes('access.isAdmin!==identity.isAdmin'));
});
test('manual strategy has no published-summary pathway or printable private summary',()=>{
 assert(!panel.includes('student_strategy_summaries'));
 assert(!panel.includes('getPrintableSummary'));
 assert(!panel.includes('summaryElement'));
 assert(!panel.includes('is_published'));
 assert(!html.includes(':not(#strategyPanel)'));
 assert.match(html,/<section id="strategyPanel" class="[^"]*\bno-print\b/);
});
test('manual storage uses a distinct source key and never renders imported source fields',()=>{
 assert(panel.includes("'teacher_strategy_records'"));assert(panel.includes("'app:manual-strategy:v1'"));
 assert(panel.includes('silmonote.manual-strategy'));
 assert(!/el\([^,]+,\s*(?:value|row|r)\.(?:source_excerpt|source_label|reason_text|observation_text|result_text|next_check_text)\b/.test(panel));
 assert(!/innerHTML|insertAdjacentHTML/.test(panel));
 for(const name of ['solving_order','time_plan','question_types'])assert(panel.includes(name));
 assert(!/el\('(?:a|details|summary)'/.test(panel));
});
test('all report source anchors are removed without removing primary navigation',()=>{
 assert(!html.includes('function recordLink('));assert(!html.includes('function reviewEvidenceLink('));
 assert(!/\.href\s*=\s*\(r\.type|view\.html\?id=|score_view\.html\?id=/.test(html));
 assert(!/element\('a'/.test(html));
 for(const link of ['href="main.html"','href="history.html"','href="korean.html"'])assert(html.includes(link));
 assert(html.includes("$('homeLink').href='admin.html'"));
});
