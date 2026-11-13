'use strict';

// spirit/run/spirit/app/desk/test/cacheRules.js
// The tests of spirit/app/desk/cacheRules.js, and of no other module (spec: ./cacheRules.md). Its own test, owed since the
// rule "every production script has its own test" (goal/G47.1, box v72).
// The desk family's cache rules, for node alone (goal/G41.28, goal/G41.12): what a subscribing appServer keeps of the
// desk's rows (keep), what it sheds past its limit, in Andy's order (shed), and the reads it answers from them (answer).
// Pure: rows in, rows out, so each test hands it its own rows, under names of its own (rules({ items, parts, state })),
// and a data set that is a plain map. One test.run per test (goal/G47.2).

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'cacheRules.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Names of this test's own: the rules take whatever data.js hands them.
const N = { items: 'tItems', parts: 'tParts', state: 'tState' };
// The rows as the desk sends them: an item's facts, a side row of one of its parts, a rule.
const facts = function (goal, item, more) { return Object.assign({ key: { goal: goal, item: item }, item: { id: 'goal/G' + goal + (item ? '.' + item : '') } }, more || {}); };
const chat = function (goal, item, at, by, text) { return { table: 'chat', id: 'goal/G' + goal + '.' + item, goal: goal, item: item, row: { at: at, by: by || 'wsl', text: text || 'x' } }; };
const side = function (table, goal, item, row) { return { table: table, id: 'goal/G' + goal + '.' + item, goal: goal, item: item, row: row }; };
const rule = function (name, text) { return { rule: name, text: text || '' }; };
const count = function (rows) { return rows.length; };
const tags = function (rows) { return rows.map(function (r) { return r.rule ? 'rule ' + r.rule : r.table ? r.table + ' ' + r.id + ' ' + JSON.stringify(r.row) : 'item ' + r.item.id; }); };
// A data set as the desk's translator keeps it: get(path) and nothing else.
const dataSet = function (map) { return { get: function (p) { return map[p]; } }; };

const C = {};
const NO_RULES = 'rules({ items, parts, state }) answered nothing: the world failed';

test.run('the world: rules({ items, parts, state }) answers keep, shed and answer', 0.2, function () {
  let rules = null;
  try { rules = require(FILE); } catch (e) { return 'it threw: ' + short(e && e.message); }
  if (typeof rules !== 'function') return 'it exports ' + short(typeof rules) + ', not the rules function';
  Object.assign(C, rules(N));
  return ['keep', 'shed', 'answer'].every(function (f) { return typeof C[f] === 'function'; }) || 'answered ' + short(Object.keys(C));
}, test.limit.quick);

// ── keep (Andy, Q2: "it sits at the receiving end of the stream, it owns the cache") ──
test.run('keep places the row last', 0.2, function () {
  if (!C.keep) return NO_RULES;
  const out = C.keep([facts(1, 1), facts(1, 2)], chat(1, 1, 't1'));
  return (out.length === 3 && out[2].table === 'chat') || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('an item\'s facts again take the old facts of that item out', 0.2, function () {
  if (!C.keep) return NO_RULES;
  const out = C.keep([facts(1, 1, { v: 'old' }), facts(1, 2)], facts(1, 1, { v: 'new' }));
  return (out.length === 2 && out[0].item.id === 'goal/G1.2' && out[1].v === 'new') || 'kept ' + short(out);
}, test.limit.quick);
test.run('a chat line again, the same time and author, takes the old one out; another line stays beside it', 0.2, function () {
  if (!C.keep) return NO_RULES;
  const out = C.keep(C.keep([chat(1, 1, 't1', 'wsl', 'first')], chat(1, 1, 't2', 'wsl', 'second')), chat(1, 1, 't1', 'wsl', 'first, edited'));
  return (out.length === 2 && out[0].row.text === 'second' && out[1].row.text === 'first, edited') || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('an item\'s box is one row: a new box takes the old out', 0.2, function () {
  if (!C.keep) return NO_RULES;
  const out = C.keep([side('box', 1, 1, { box: 'v1' }), side('box', 1, 2, { box: 'other item' })], side('box', 1, 1, { box: 'v2' }));
  return (out.length === 2 && out[1].row.box === 'v2' && out[0].row.box === 'other item') || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('a check is kept by its number, a file by its author and path', 0.2, function () {
  if (!C.keep) return NO_RULES;
  let out = C.keep([side('checks', 1, 1, { number: 1, ok: false }), side('checks', 1, 1, { number: 2 })], side('checks', 1, 1, { number: 1, ok: true }));
  const checks = out.length === 2 && out[1].row.ok === true;
  out = C.keep([side('files', 1, 1, { by: 'wsl', path: 'a.js' }), side('files', 1, 1, { by: 'cw', path: 'a.js' })], side('files', 1, 1, { by: 'wsl', path: 'a.js', n: 2 }));
  const files = out.length === 2 && out[0].row.by === 'cw' && out[1].row.n === 2;
  return (checks && files) || 'checks ' + checks + ', files ' + files;
}, test.limit.quick);
test.run('a rule again takes the old rule out', 0.2, function () {
  if (!C.keep) return NO_RULES;
  const out = C.keep([rule('r1', 'old'), rule('r2')], rule('r1', 'new'));
  return (out.length === 2 && out[0].rule === 'r2' && out[1].text === 'new') || 'kept ' + short(out);
}, test.limit.quick);
test.run('a row of a part it does not know takes nothing out', 0.2, function () {
  if (!C.keep) return NO_RULES;
  const out = C.keep([side('weird', 1, 1, { a: 1 })], side('weird', 1, 1, { a: 1 }));
  return out.length === 2 || 'kept ' + short(tags(out));
}, test.limit.quick);

// ── shed: Andy's order (Q2) ──
// "FIRST YOU shed the longest untouched goal, lock, stock and barrel / when there is only one goal, then you shed the
// longest untouched item, LOCK, stock and barrel, / when there is only one goal with one item you shed the oldest chat
// line." Rows of no goal (the rules) are never shed. Here a row's size is one: the limit counts rows.
test.run('within its limit it sheds nothing', 0.2, function () {
  if (!C.shed) return NO_RULES;
  const rows = [facts(1, 1), facts(2, 1), rule('r')];
  const out = C.shed(rows, 3, count);
  return (out.length === 3 && out !== rows) || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('past it, with two goals or more, it sheds the longest untouched goal whole, lock, stock and barrel', 0.2, function () {
  if (!C.shed) return NO_RULES;
  // Goal 1 was touched last by its chat line at index 3; goal 2 at index 4: goal 1 is the longest untouched.
  const rows = [facts(1, 0), facts(1, 1), facts(2, 1), chat(1, 1, 't1'), chat(2, 1, 't2'), rule('r')];
  const out = C.shed(rows, 4, count);
  const left = out.filter(function (r) { return (r.goal || (r.key && r.key.goal)) === 1; });
  return (left.length === 0 && out.length === 3) || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('the touched one stays: a goal touched last is kept over an older one', 0.2, function () {
  if (!C.shed) return NO_RULES;
  const rows = [facts(1, 1), facts(2, 1), chat(1, 1, 'late')];
  const out = C.shed(rows, 2, count);
  return (out.length === 2 && out.every(function (r) { return (r.goal || r.key.goal) === 1; })) || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('with one goal, it sheds the longest untouched item whole; the goal\'s own row stays', 0.2, function () {
  if (!C.shed) return NO_RULES;
  const rows = [facts(1, 0), facts(1, 1), facts(1, 2), chat(1, 1, 't1'), chat(1, 2, 't2')];
  const out = C.shed(rows, 3, count);
  return (out.length === 3 && !out.some(function (r) { return (r.item === 1) || (r.key && r.key.item === 1); }) && out.some(function (r) { return r.key && r.key.item === 0; }))
    || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('with one goal of one item, it sheds the oldest chat line', 0.2, function () {
  if (!C.shed) return NO_RULES;
  const rows = [facts(1, 1), chat(1, 1, 't1', 'wsl', 'oldest'), chat(1, 1, 't2', 'wsl', 'newer'), chat(1, 1, 't3', 'wsl', 'newest')];
  const out = C.shed(rows, 3, count);
  return (out.length === 3 && out.filter(function (r) { return r.table === 'chat'; }).map(function (r) { return r.row.text; }).join() === 'newer,newest') || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('the rules are never shed, and with nothing of a goal left to shed it stops', 0.2, function () {
  if (!C.shed) return NO_RULES;
  const rows = [rule('r1'), rule('r2'), facts(1, 1), chat(1, 1, 't1')];
  const out = C.shed(rows, 0, count);
  return (out.length === 3 && out.filter(function (r) { return r.rule; }).length === 2) || 'kept ' + short(tags(out));
}, test.limit.quick);
test.run('it sheds by the size it is handed: the cache file\'s bytes', 0.2, function () {
  if (!C.shed) return NO_RULES;
  const rows = [facts(1, 1, { pad: 'x'.repeat(400) }), facts(2, 1)];
  const bytes = function (r) { return Buffer.byteLength(JSON.stringify(r), 'utf8'); };
  const out = C.shed(rows, bytes([rows[1]]) + 10, bytes);
  return (out.length === 1 && out[0].item.id === 'goal/G2.1') || 'kept ' + short(tags(out));
}, test.limit.quick);

// ── answer: the cache answers a read as the desk would (goal/G41.11; box v15) ──
const ID = 'goal/G1.1';
const held = function (whole, row) {
  const m = {}; m[N.items + '/' + ID] = row === undefined ? { id: ID, version: 4, title: 't' } : row; m[N.parts + '/' + ID] = whole; m[N.state + '/change'] = 17;
  return dataSet(m);
};
test.run('item.get answers from the facts: the item as JSON, its version and the desk\'s change', 0.2, function () {
  if (!C.answer) return NO_RULES;
  const a = C.answer('item.get', { id: ID }, held(null), 10000);
  return (!!a && JSON.parse(a.item).title === 't' && a.version === 4 && a.change === 17) || 'answered ' + short(a);
}, test.limit.quick);
test.run('null when the cache does not hold it, so the desk is asked: no facts, facts with no version, no parts', 0.2, function () {
  if (!C.answer) return NO_RULES;
  const none = C.answer('item.get', { id: 'goal/G9.9' }, held({ box: 'b' }), 10000);
  const noVersion = C.answer('item.get', { id: ID }, held({ box: 'b' }, { id: ID }), 10000);
  const noParts = C.answer('item.box', { id: ID }, held(null), 10000);
  return (none === null && noVersion === null && noParts === null) || 'answered ' + short([none, noVersion, noParts]);
}, test.limit.quick);
test.run('item.box answers the box and its version; item.checks the checks', 0.2, function () {
  if (!C.answer) return NO_RULES;
  const box = C.answer('item.box', { id: ID }, held({ box: 'the box', version: 3, checks: [{ number: 1 }] }), 10000);
  const checks = C.answer('item.checks', { id: ID }, held({ box: 'the box', version: 3, checks: [{ number: 1 }] }), 10000);
  return (!!box && box.box === 'the box' && box.version === 3 && !!checks && checks.checks.length === 1) || 'answered ' + short([box, checks]);
}, test.limit.quick);
test.run('item.chat answers the newest lines that fit its room, oldest first, chatMore when some were left out', 0.2, function () {
  if (!C.answer) return NO_RULES;
  const lines = [1, 2, 3, 4, 5].map(function (i) { return { at: 't' + i, by: 'wsl', text: 'line ' + i + ' ' + 'x'.repeat(40) }; });
  const room = Buffer.byteLength(JSON.stringify({ chat: lines.slice(3), chatMore: true }), 'utf8');
  const a = C.answer('item.chat', { id: ID }, held({ chat: lines }), room);
  return (!!a && a.chat.map(function (l) { return l.at; }).join() === 't4,t5' && a.chatMore === true) || 'answered ' + short(a);
}, test.limit.quick);
test.run('all lines fitting, chatMore is false, unless the stream brought only the newest (chatMore kept)', 0.2, function () {
  if (!C.answer) return NO_RULES;
  const lines = [{ at: 't1', by: 'a', text: 'x' }];
  const all = C.answer('item.chat', { id: ID }, held({ chat: lines }), 10000);
  const streamed = C.answer('item.chat', { id: ID }, held({ chat: lines, chatMore: true }), 10000);
  return (!!all && all.chatMore === false && !!streamed && streamed.chatMore === true) || 'answered ' + short([all, streamed]);
}, test.limit.quick);
// goal/G33.7: "deskClient's kept file list (filled to one answer)".
test.run('item.files answers as many as fit one answer, under the path asked, filesMore when some were left out', 0.2, function () {
  if (!C.answer) return NO_RULES;
  const files = ['spirit/a.js', 'spirit/b.js', 'other/c.js'].map(function (p) { return { by: 'wsl', path: p }; });
  const under = C.answer('item.files', { id: ID, under: 'spirit/' }, held({ files: files }), 10000);
  const room = Buffer.byteLength(JSON.stringify({ files: files.slice(0, 1), filesMore: true }), 'utf8');
  const cut = C.answer('item.files', { id: ID }, held({ files: files }), room);
  return (!!under && under.files.length === 2 && under.filesMore === false && !!cut && cut.files.length === 1 && cut.filesMore === true) || 'answered ' + short([under, cut]);
}, test.limit.quick);
test.run('a file list kept only in part is not answered: the desk is asked', 0.2, function () {
  if (!C.answer) return NO_RULES;
  const a = C.answer('item.files', { id: ID }, held({ files: [{ by: 'wsl', path: 'a' }], filesMore: true }), 10000);
  return a === null || 'answered ' + short(a);
}, test.limit.quick);
test.run('a verb it does not keep is not answered', 0.2, function () {
  if (!C.answer) return NO_RULES;
  const a = C.answer('item.history', { id: ID }, held({ box: 'b', chat: [], checks: [] }), 10000);
  return a === null || 'answered ' + short(a);
}, test.limit.quick);
