'use strict';

// goal/G6.5: the Rules tab in Desk: a new rule, a search with seven toggles, and the list of rules, each opening
// ruleDetails (goal/G6.4). Red on today's tree; wsl-claude wrote it from G6.5's box and does not build it.
//   The box: "A new tab "Rules" between "Team" and "Musings": 1. The new bubble: type, label, text and a new button:
//   rule.add (the rule comes in proposed; agents may add one too). 2. The search bubble: a search box and 7 toggles
//   (ui, code, design, desk; proposed, active, deleted): rules.search {text, types, statuses}. 3. The list, a row per
//   rule: status (proposed ICON.EDIT, active ICON.LOCK, deleted ICON.DEAD), label, type, key; a row opens ruleDetails
//   (goal/G6.4). A rule's text is a paragraph of up to 2048 bytes, line breaks kept (goal/G5.5)." Andy: "split as
//   proposed"; his Go.
//
// THE CONTRACT (wsl-claude's picks where the box names no shape; the builder may argue them in Desk first):
//   - The tab is data-tab="rules" in #desk-tabs; its pane data-pane="rules" holds #desk-rules, which takes every click
//     and input of the tab (one listener, as #dd-body does in deskDetails).
//   - The new bubble: #desk-rule-type (its value one of ui, code, design, desk), #desk-rule-label, #desk-rule-text (a
//     textarea) and the button #desk-rule-add, which sends rule.add {type, label, text}, the text as typed.
//   - The search bubble: #desk-rule-search, read on an input event; seven toggles, each an element carrying
//     data-rule-toggle="<ui|code|design|desk|proposed|active|deleted>". Opening the tab asks rules.search; a toggle
//     click or a search input asks it again with {text, types, statuses} as they now stand.
//   - The list, drawn into #desk-rule-list from rules.search's items ({key, label: JSON {label, type, status}}): a row
//     per rule carrying data-rule="<key>", showing the status icon, label, type and key; a click on a row is
//     callDialog('shell/ruleDetails', {key}).
// LEFT OPEN, with the reason, not asserted here:
//   - which toggles start on: the box names none; only that a toggle flips its own type or status in the next search.
//   - the 2048-byte limit: the desk server holds it (rule.add refuses, goal/G5.5), and its refusal is shown as any is.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const DESK = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const OWED = 'OWED by goal/G6.5: ';
const ICON = kernel.core.const.ICON;

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {}, offsetHeight: 40,
  };
  el.style.setProperty = function (k, v) { el.style[k] = v; };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() { const byId = {}; return { byId: byId, getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } }; }
function load(script, doc) {
  let b = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(script, 'utf8'))({ shell: { activateApp: function (x) { b = x; } }, core: kernel.core }, doc, {});
  return b;
}
async function settled() { for (let i = 0; i < 8; i++) await new Promise(function (r) { setImmediate(r); }); }
// A click target as a browser hands it: its own id and attributes, and closest() finding itself by attribute.
function target(attrs) {
  const t = { id: attrs.id || '', value: attrs.value || '', parentNode: null, getAttribute: function (n) { return attrs[n] === undefined ? null : attrs[n]; } };
  t.closest = function (sel) { const m = /^\[([\w-]+)\]$/.exec(sel); return m && attrs[m[1]] !== undefined ? t : null; };
  return t;
}

const RULES = [
  { key: 'rule/1', label: JSON.stringify({ label: 'LABEL-ONE', type: 'ui', status: 'proposed' }) },
  { key: 'rule/2', label: JSON.stringify({ label: 'LABEL-TWO', type: 'code', status: 'active' }) },
  { key: 'rule/3', label: JSON.stringify({ label: 'LABEL-THREE', type: 'desk', status: 'deleted' }) },
];

function mount() {
  const fake = require('./deskFake.js').fromFiles({ 'log/log.json': '[]', 'seen.json': JSON.stringify({ rows: {}, team: 0, agents: {} }) });
  fake.items = [];
  const calls = [];
  const dialogs = [];
  const verb = function (name, body) {
    const ask = name === 'jobs.api' && body && body.ask && body.ask.desk;
    const v = ask && Object.keys(ask)[0];
    if (v === 'rules.search') { calls.push({ verb: v, args: ask[v] }); return Promise.resolve({ status: 200, body: { items: RULES.slice(), more: false } }); }
    if (v === 'rule.add') { calls.push({ verb: v, args: ask[v] }); return Promise.resolve({ status: 200, body: { key: 'rule/4' } }); }
    return fake.verb(name, body);
  };
  const doc = fakeDocument();
  const root = fakeElement('container');
  load(DESK, doc).mount(root, {
    fs: { loadFile: function (f) { return f === 'log/log.json' ? '[]' : f === 'seen.json' ? JSON.stringify({ rows: {}, team: 0, agents: {} }) : null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: verb, onPublished: function () {}, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function (app, params) { dialogs.push({ app: app, params: params }); return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  const fire = function (type, attrs) { doc.getElementById('desk-rules').fire(type, { target: target(attrs), preventDefault: function () {}, stopPropagation: function () {} }); };
  return { doc: doc, root: root, calls: calls, dialogs: dialogs, fire: fire, sent: function (v) { return calls.filter(function (c) { return c.verb === v; }); } };
}

test.startTest('goal/G6.5: the Rules tab: new rule, search with seven toggles, the list opening ruleDetails');

(async function () {
  const d = mount();
  await settled();

  test.subHeading('1. a Rules tab between Team and Musings');
  const tabs = d.doc.getElementById('desk-tabs').innerHTML;
  const at = function (t) { return tabs.indexOf('data-tab="' + t + '"'); };
  if (at('rules') !== -1 && at('team') < at('rules') && at('rules') < at('musings')) test.check('#desk-tabs holds data-tab="rules" between team and musings');
  else test.fail(OWED + 'tab positions: team ' + at('team') + ', rules ' + at('rules') + ', musings ' + at('musings'));
  const tabsEl = d.doc.getElementById('desk-tabs');
  tabsEl.fire('click', { target: target({ 'data-tab': 'rules' }), currentTarget: tabsEl });
  await settled();
  // Counted here, before anything else can search (a rule.add may search again: found verifying 2cd2accb).
  const openedAtTab = d.sent('rules.search').length;
  // The mount container holds the panes; each element the app fetched by id holds what it drew there.
  const all = function () { return [d.root.innerHTML].concat(Object.keys(d.doc.byId).map(function (k) { return d.doc.byId[k].innerHTML; })).join('\n'); };
  if (/data-pane="rules"/.test(all()) && /id="desk-rules"/.test(all())) test.check('a pane data-pane="rules" holds #desk-rules');
  else test.fail(OWED + 'no data-pane="rules" holding #desk-rules');

  test.subHeading('2. the new bubble: type, label, text and a button sending rule.add');
  const ids = ['desk-rule-type', 'desk-rule-label', 'desk-rule-text', 'desk-rule-add'];
  const missing = ids.filter(function (id) { return all().indexOf('id="' + id + '"') === -1; });
  if (!missing.length && /<textarea[^>]*id="desk-rule-text"/.test(all())) test.check('#desk-rule-type, #desk-rule-label, the textarea #desk-rule-text and #desk-rule-add are drawn');
  else test.fail(OWED + 'missing: ' + (missing.join(', ') || 'the text is not a textarea'));
  d.doc.getElementById('desk-rule-type').value = 'design';
  d.doc.getElementById('desk-rule-label').value = 'NEW-LABEL';
  d.doc.getElementById('desk-rule-text').value = 'first line\nsecond line';
  d.fire('click', { id: 'desk-rule-add' });
  await settled();
  const added = d.sent('rule.add');
  if (added.length === 1 && added[0].args.type === 'design' && added[0].args.label === 'NEW-LABEL' && added[0].args.text === 'first line\nsecond line') test.check('#desk-rule-add sends rule.add {type, label, text}, the line break kept');
  else test.fail(OWED + 'rule.add sent ' + JSON.stringify(added.map(function (c) { return c.args; })));

  test.subHeading('3. the search bubble: a box and seven toggles, each asking rules.search again');
  const toggles = ['ui', 'code', 'design', 'desk', 'proposed', 'active', 'deleted'];
  const noToggle = toggles.filter(function (t) { return all().indexOf('data-rule-toggle="' + t + '"') === -1; });
  if (all().indexOf('id="desk-rule-search"') !== -1 && !noToggle.length) test.check('#desk-rule-search and the seven toggles are drawn');
  else test.fail(OWED + 'search box ' + (all().indexOf('id="desk-rule-search"') !== -1) + ', toggles missing: ' + noToggle.join(', '));
  const opened = d.sent('rules.search').length;
  if (openedAtTab >= 1) test.check('opening the tab asks rules.search');
  else test.fail(OWED + 'opening the tab asked rules.search ' + openedAtTab + ' times');
  const last = function () { const s = d.sent('rules.search'); return s.length ? s[s.length - 1].args : null; };
  const has = function (args, field, v) { return !!args && Array.isArray(args[field]) && args[field].indexOf(v) !== -1; };
  const before = last();
  d.fire('click', { 'data-rule-toggle': 'deleted' });
  await settled();
  const afterStatus = last();
  d.fire('click', { 'data-rule-toggle': 'desk' });
  await settled();
  const afterType = last();
  const n1 = d.sent('rules.search').length;
  if (before && afterStatus && afterType && n1 >= opened + 2 && has(before, 'statuses', 'deleted') !== has(afterStatus, 'statuses', 'deleted') &&
      has(afterStatus, 'types', 'desk') !== has(afterType, 'types', 'desk')) test.check('a status toggle and a type toggle each flip their own value in the next rules.search');
  else test.fail(OWED + 'toggles: ' + JSON.stringify({ before: before, afterStatus: afterStatus, afterType: afterType }));
  d.doc.getElementById('desk-rule-search').value = 'needle';
  d.fire('input', { id: 'desk-rule-search', value: 'needle' });
  await settled();
  const searched = last();
  if (d.sent('rules.search').length > n1 && searched && searched.text === 'needle') test.check('typing in the search box asks rules.search with that text');
  else test.fail(OWED + 'after typing, rules.search ' + JSON.stringify(searched));

  test.subHeading('4. the list: a row per rule with its status icon, label, type and key; a row opens ruleDetails');
  const list = d.doc.getElementById('desk-rule-list').innerHTML;
  const rowOf = function (key) { const i = list.indexOf('data-rule="' + key + '"'); if (i === -1) return ''; const j = list.indexOf('data-rule="', i + 1); return list.slice(i, j === -1 ? undefined : j); };
  const want = [['rule/1', ICON.EDIT, 'LABEL-ONE', 'ui'], ['rule/2', ICON.LOCK, 'LABEL-TWO', 'code'], ['rule/3', ICON.DEAD, 'LABEL-THREE', 'desk']];
  const wrong = want.filter(function (w) { const r = rowOf(w[0]); return !r || r.indexOf(w[1]) === -1 || r.indexOf(w[2]) === -1 || r.indexOf(w[3]) === -1 || r.indexOf(w[0]) === -1; });
  if (!wrong.length) test.check('three rows, each with its status icon (EDIT, LOCK, DEAD), label, type and key');
  else test.fail(OWED + 'rows wrong for ' + wrong.map(function (w) { return w[0]; }).join(', ') + ' — list: ' + list.replace(/\s+/g, ' ').slice(0, 240));
  d.fire('click', { 'data-rule': 'rule/2' });
  await settled();
  const opens = d.dialogs.filter(function (x) { return x.app === 'shell/ruleDetails'; });
  if (opens.length === 1 && opens[0].params && opens[0].params.key === 'rule/2') test.check('a click on a row is callDialog(\'shell/ruleDetails\', {key})');
  else test.fail(OWED + 'dialogs opened: ' + JSON.stringify(d.dialogs));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
