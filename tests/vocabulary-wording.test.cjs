const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const D = require('../english-domain-core.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('English generated suggestions use 낱말, including long questions 41–42', () => {
  const long = D.domains.find(domain => domain.key === 'long');
  assert.equal(long.range, '41–42');
  assert.match(long.plan, /문맥상 낱말을/);
  assert.match(D.domains.find(domain => domain.key === 'flow').plan, /반복 낱말을/);
  for (const domain of D.domains) {
    assert.doesNotMatch(domain.label + domain.plan, /어휘/);
    for (const stats of [{total: 0, incorrect: 0}, {total: 2, incorrect: 1}, {total: 2, incorrect: 0}]) {
      for (const hasLoss of [false, true]) {
        const output = D.suggestion(domain, stats, hasLoss);
        assert.ok(output.includes(domain.plan));
        assert.doesNotMatch(output, /어휘/);
      }
    }
  }
});

test('legacy 어휘 keyword matching and stored student/teacher originals are unchanged', () => {
  const grammar = D.domains.find(domain => domain.key === 'grammar');
  assert.deepEqual(grammar.words, ['어법', '문법', '낱말', '어휘']);
  const old = {feedback: '어휘를 문맥에서 확인하세요.', loss_grammar: {nums: '30', reason: '어휘가 어려웠다.'}};
  const newer = {feedback: '낱말을 문맥에서 확인하세요.'};
  const rows = [old, newer, {feedback: '대본을 확인하세요.'}];
  const before = JSON.stringify(rows);
  const matches = D.feedbackCandidates(rows, grammar);
  assert.deepEqual(matches, [old, newer]);
  assert.equal(matches[0], old);
  assert.equal(D.lossForEdit(old, 'grammar'), old.loss_grammar);
  assert.equal(D.mergeLoss(old, 'grammar', {nums: '29,30'}).reason, '어휘가 어려웠다.');
  assert.equal(JSON.stringify(rows), before);
});

class Element {
  constructor(tag, text = '') { this.tag = tag; this.textContent = text; this.children = []; }
  appendChild(node) { this.children.push(node); return node; }
  addEventListener() {}
  replaceChildren() { this.children = []; }
  allText() { return this.textContent + ' ' + this.children.map(node => node.allText()).join(' '); }
}

test('report cards render new suggestions alongside unchanged saved originals', () => {
  const html = read('history.html');
  const host = new Element('div');
  const element = (tag, text) => new Element(tag, text === undefined ? '' : String(text));
  const rows = [{type: 'score', exam_title: '가상 시험', feedback: '어휘를 문맥에서 확인하세요.',
    loss_grammar: {reason: '어휘가 어려웠다.', assessment: {version: 1, correct: 1, incorrect: 1}},
    loss_long: {assessment: {version: 1, correct: 1, incorrect: 1}}}];
  const before = JSON.stringify(rows);
  const render = new Function('EnglishDomains', '$', 'element', 'present', 'reportSource', 'recordLink', 'records',
    html.slice(html.indexOf('function renderDomains('), html.indexOf('\nfunction renderPlans(')) + ';return renderDomains;')(
      D, () => host, element, value => value != null && String(value).trim() !== '',
      row => element('p', row.exam_title), (_, title) => element('a', title), rows);
  render(rows);
  const long = host.children.find(card => card.id === 'domain-long');
  assert.match(long.allText(), /문항 범위: 41–42/);
  assert.match(long.allText(), /문맥상 낱말을/);
  assert.doesNotMatch(long.allText(), /문맥상 어휘/);
  assert.match(host.allText(), /반복 낱말을/);
  const grammar = host.children.find(card => card.id === 'domain-grammar');
  assert.ok(grammar.allText().includes(rows[0].feedback));
  assert.ok(grammar.allText().includes(rows[0].loss_grammar.reason));
  assert.equal(JSON.stringify(rows), before);
});

test('admin priority suggestions use the updated long and flow wording', () => {
  const html = read('history.html');
  const nodes = {adminRateCards: new Element('div'), adminPriorities: new Element('ol'), adminRecent: new Element('div'), reportDateBasis: {value:'exam'}};
  const rows = [{type: 'score', loss_grammar: {},
    loss_long: {assessment: {version: 1, correct: 1, incorrect: 1}},
    loss_flow: {assessment: {version: 1, correct: 3, incorrect: 2}}}];
  const render = new Function('identity', '$', 'element', 'AdminReview', 'EnglishDomains', 'records', 'more',
    html.slice(html.indexOf('function reviewEvidenceLink('), html.indexOf('function renderReport(')) + ';return renderAdminReview;')(
      {isAdmin: true}, id => nodes[id], (tag, text) => new Element(tag, text), require('../admin-review-core.js'), D, rows, {score:false});
  render(rows, rows);
  assert.match(nodes.adminPriorities.allText(), /문맥상 낱말을/);
  rows[0].loss_long.assessment.incorrect=0; rows[0].loss_long.assessment.correct=2; render(rows,rows); assert.match(nodes.adminPriorities.allText(), /반복 낱말을/);
  assert.doesNotMatch(nodes.adminPriorities.allText(), /어휘/);
});

test('note viewer preserves original vocabulary and teacher text in both viewer modes', () => {
  const html = read('view.html');
  const access = new Function('window', read('app-access.js') + ';return window.AppAccess;')({});
  const render = new Function('note', 'AppAccess', 'IS_ADMIN', 'container',
    html.slice(html.indexOf('      let data = { ...note };'), html.indexOf('      recordReady = true;')));
  const note = {p2_words: '어휘 원문 <word>', teacher_comment: '어휘를 먼저 확인하세요.'};
  const before = JSON.stringify(note);
  for (const admin of [false, true]) {
    const container = {};
    render(note, access, admin, container);
    assert.ok(container.innerHTML.includes('몰랐던 낱말/표현 정리'));
    assert.ok(container.innerHTML.includes('어휘 원문 &lt;word&gt;'));
    assert.ok(container.innerHTML.includes(note.teacher_comment));
    assert.equal(JSON.stringify(note), before);
  }
});

test('note labels change but legacy checkbox values still restore and save unchanged', () => {
  const html = read('note.html');
  assert.ok(html.includes('몰랐던 낱말/표현 정리'));
  assert.ok(html.includes('value="어휘력 부족"> 낱말 이해 부족</label>'));
  assert.doesNotMatch(html.replace('value="어휘력 부족"', ''), /어휘/);
  const checkbox = {value: '어휘력 부족', checked: false};
  const document = {querySelectorAll: query => query.endsWith(':checked') ? (checkbox.checked ? [checkbox] : []) : [checkbox]};
  const restoreSource = html.slice(html.indexOf('    const setCheckedValues ='), html.indexOf('    if (data.p2_reasons_a)'));
  const restore = new Function('document', restoreSource + ';return setCheckedValues;')(document);
  restore('p3_check', ['어휘력 부족']);
  assert.equal(checkbox.checked, true);
  const saveSource = html.slice(html.indexOf('    const getCheckedValues ='), html.indexOf('    const noteData ='));
  const save = new Function('document', saveSource + ';return getCheckedValues;')(document);
  assert.deepEqual(save('p3_check'), ['어휘력 부족']);
  restore('p3_check', []);
  assert.deepEqual(save('p3_check'), []);
  for (const file of ['note.html', 'view.html']) {
    const source = read(file);
    assert.ok(source.includes('몰랐던 낱말/표현 정리'));
    assert.ok(source.includes('p2_words'));
    for (const match of source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
  }
});
