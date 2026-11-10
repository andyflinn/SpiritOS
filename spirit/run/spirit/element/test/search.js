'use strict';

// spirit/run/spirit/element/test/search.js
// The tests of spirit/element/search.js, and of no other module (spec: ./search.md). The browser file runs
// in node on a window of its own, ranking with the spirit's own probability files; the container is a stub that keeps
// a node per id the list draws, and hears the list's listeners.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require(path.join(path.resolve(__dirname, '..', '..', '..'), 'spirit', 'test', 'testReport.js'));

const RUN = path.join(__dirname, '..', '..', '..');
const FILE = path.join(__dirname, '..', 'search.js');
const SHELL_CSS = fs.existsSync(path.join(RUN, 'spirit', 'shell', 'shell.css')) ? fs.readFileSync(path.join(RUN, 'spirit', 'shell', 'shell.css'), 'utf8') : '';
const docHeard = [];
let docRemoved = 0;
global.document = {
  addEventListener: function (type, fn) { docHeard.push(fn); },
  removeEventListener: function (type, fn) { const i = docHeard.indexOf(fn); if (i !== -1) { docHeard.splice(i, 1); docRemoved += 1; } },
};
global.window = { spirit: { probability: {
  probabilityStringObjectMatch: require(path.join(RUN, 'spirit', 'probabilityStringObjectMatch.js')).probabilityStringObjectMatch,
  createProbabilityBucket: require(path.join(RUN, 'spirit', 'probabilityBucket.js')).createProbabilityBucket,
} } };
vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
const PS = window.spirit.element.search;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };

// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
function node(id) {
  return { id: id, value: '', hidden: false, focused: 0, innerHTML: '', inside: true,
    focus: function () { this.focused += 1; }, closest: function () { return null; }, getAttribute: function () { return null; },
    // What is appended into it: a selector the search mounts (goal/G41.26, the 🪣 row).
    kids: [], appendChild: function (k) { this.kids.push(k); k.parentNode = this; return k; },
    insertBefore: function (k) { this.kids.push(k); k.parentNode = this; return k; } };
}
function container() {
  const nodes = {}; const heard = {}; let html = '';
  const c = {
    nodes: nodes,
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; const re = /id="([^"]+)"/g; let m; while ((m = re.exec(v))) nodes[m[1]] = nodes[m[1]] || node(m[1]); },
    querySelector: function (sel) { return sel.charAt(0) === '#' ? nodes[sel.slice(1)] || null : null; },
    addEventListener: function (type, fn) { (heard[type] = heard[type] || []).push(fn); },
    contains: function (t) { return !!t && t.inside === true; },
    fire: function (type, e) { (heard[type] || []).forEach(function (fn) { fn(e); }); },
    pre: function () { return Object.keys(nodes).filter(function (k) { return /text$/.test(k); })[0].replace(/text$/, ''); },
    get: function (name) { return nodes[c.pre() + name]; },
    shown: function () { const l = c.get('list').innerHTML; const out = []; const re = /<tr data-key="([^"]*)"/g; let m; while ((m = re.exec(l))) out.push(m[1]); return out; },
    current: function () { const m = /<tr data-key="([^"]*)" class="current"/.exec(c.get('list').innerHTML); return m ? m[1] : null; },
    type: function (words) { const t = c.get('text'); t.value = words; c.fire('input', { target: t }); },
    key: function (key, target) { const e = { key: key, target: target || c.get('list'), prevented: false, preventDefault: function () { e.prevented = true; } }; c.fire('keydown', e); return e; },
  };
  return c;
}
function rowTarget(key, opts) {
  const o = opts || {};
  return { inside: true, getAttribute: function () { return null; },
    closest: function (sel) { if (sel === '[data-key]') return { getAttribute: function () { return key; } }; if (sel === '[data-action]' && o.action) return {}; return null; } };
}
function headTarget(field) { return { inside: true, getAttribute: function () { return null; }, closest: function (sel) { return sel === 'th[data-sort]' ? { getAttribute: function () { return field; } } : null; } }; }
function filterTarget(name, value) {
  return { inside: true, closest: function () { return null; },
    getAttribute: function (a) { return a === 'data-filter' ? name : a === 'data-value' ? value : null; } };
}
// A list's own data source (options.search(args, verb), goal/G43.24): every call kept as server.verb; held, a call waits
// until let go. And what it is told when its rows changed elsewhere (options.published(fn)).
function source(server) {
  const a = { calls: [], held: false, waiting: [], answer: { status: 200, body: { ok: true, items: [] } }, heard: null, off: 0 };
  a.search = function (args, verb) {
    a.calls.push({ name: server + '.' + verb, args: args });
    if (a.held) return new Promise(function (r) { a.waiting.push(r); });
    return Promise.resolve(a.answer);
  };
  a.published = function (fn) { a.heard = fn; return function () { a.off += 1; }; };
  a.release = function (answer) { const r = a.waiting.shift(); r(answer || a.answer); };
  return a;
}

// ── order: the pure heart ───────────────────────────────────────────────────────────────────────────────────────────
test.startTest('probabilitySearch.js: the standard shell list-tool');

test.subHeading('order: viewed, no words');
const keys = function (list) { return list.map(function (x) { return x.key; }).join(); };
const E = [{ key: 'c', row: { name: 'cy' }, at: 2 }, { key: 'a', row: { name: 'Al' }, at: 0 }, { key: 'b', row: { name: 'bo' }, at: 1 }];
let r = PS.order(E, {});
ok(keys(r) === 'a,b,c', 'without words or sort the rows come in arrival order', 'order: ' + keys(r));
ok(r[0].row === E[1].row && r[0].entry === E[1] && r[0].rank === 1, 'each answer carries key, row, entry and the filter product as rank',
  'answer: ' + JSON.stringify(r[0]));
ok(PS.order(null).length === 0 && PS.order([], null).length === 0, 'no entries and no state give []', 'order(null) not []');
r = PS.order(E.concat([{ key: 'g', row: { name: 'gone' }, at: 3, gone: true }]), {});
ok(keys(r) === 'a,b,c', 'a gone entry is dropped', 'order: ' + keys(r));
const elRow = [{ key: 'e', row: { name: 'old' }, at: 0, el: { row: { name: 'new' } } }];
r = PS.order(elRow, {});
ok(r[0].row.name === 'new', 'an element\'s row is read in place of the entry\'s', 'row: ' + JSON.stringify(r[0].row));

test.subHeading('order: filters drop and weigh');
const F = [{ key: 'w1', row: { v: 1 }, at: 0 }, { key: 'w0', row: { v: 0 }, at: 1 }, { key: 'wn', row: { v: -1 }, at: 2 },
  { key: 'wx', row: { v: 'x' }, at: 3 }, { key: 'wh', row: { v: 0.5 }, at: 4 }, { key: 'w2', row: { v: 2 }, at: 5 }];
r = PS.order(F, { filters: [{ name: 'f', test: function (row) { return row.v; } }] });
ok(keys(r) === 'w1,wh,w2', 'a test answering 0, a negative or not a number drops the row', 'kept: ' + keys(r));
ok(r[1].rank === 0.5 && r[2].rank === 1, 'a positive answer weighs the row, capped at 1', 'ranks: ' + r.map(function (x) { return x.rank; }));
let seenValue = null;
r = PS.order([{ key: 'a', row: { v: 1 }, at: 0 }], { values: { f: 'chosen' }, filters: [{ name: 'f', test: function (row, v) { seenValue = v; return 0.5; } },
  { name: 'g', test: function () { return 0.4; } }, { name: 'h' }] });
ok(seenValue === 'chosen', 'a test is handed the row and its filter\'s value', 'value: ' + seenValue);
ok(Math.abs(r[0].rank - 0.2) < 1e-12, 'the filters\' weights multiply; a filter without test is ignored', 'rank: ' + r[0].rank);

test.subHeading('order: ranked by the words');
const W = [{ key: 'z', row: { name: 'zed' }, at: 0 }, { key: 'b1', row: { name: 'bert' }, at: 1 }, { key: 'q', row: { name: 'quinn' }, at: 2 },
  { key: 'b2', row: { name: 'bert' }, at: 3 }];
r = PS.order(W, { words: '  be  ' });
ok(r.length === 4, 'nothing is cut: a row the words miss still stands', 'length ' + r.length);
ok(r[0].key === 'b1' && r[1].key === 'b2' && r[0].rank > 0, 'the best match is on top, an equal one in arrival order', 'order: ' + keys(r));
ok(r[2].rank === 0 && r[3].rank === 0 && r[2].key === 'z' && r[3].key === 'q', 'the misses stand last at 0, in arrival order', 'tail: ' + keys(r));
r = PS.order(W, { words: 'be', filters: [{ name: 'f', test: function (row) { return row === W[3].row ? 0.5 : 1; } }] });
ok(r[0].key === 'b1' && Math.abs(r[1].rank - r[0].rank * 0.5) < 1e-12, 'the rank is the match times the filters\' product', 'ranks: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; })));
r = PS.order(W, { words: 'be', score: function (row) { return row.name === 'quinn' ? 5 : row.name === 'zed' ? -3 : null; } });
ok(r[0].key === 'q' && r[0].rank === 1, 'a score answer replaces the match, clamped to 1', 'score: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; })));
ok(r.filter(function (x) { return x.key === 'z'; })[0].rank === 0 && r.filter(function (x) { return x.key === 'b1'; })[0].rank > 0,
  'a negative score is clamped to 0, and a null score falls back to the match', 'ranks: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; })));
// THE WHOLE ROW, ALWAYS (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole
// row, as cached in spirit.data."): what a list shows, or a matched() it hands, narrows nothing.
r = PS.order(W, { words: 'qu', matched: function (row) { return { other: row.name === 'zed' ? 'quiz' : 'nothing' }; } });
ok(r[0].key === 'q' && r[0].rank > 0 && r.filter(function (x) { return x.key === 'z'; })[0].rank === 0, 'a matched(row) a list hands is not used: the whole row is matched', 'matched: ' + keys(r));
const C = [{ key: 'x', row: { label: 'shown', hidden: 'secret' }, at: 0 }, { key: 'y', row: { label: 'plain', hidden: 'none' }, at: 1 }];
r = PS.order(C, { words: 'secret', columns: [{ field: 'label' }] });
ok(r[0].key === 'x' && r[0].rank > 0 && r[1].rank === 0, 'with columns the whole row is matched, its fields not shown too', 'ranks: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; })));
r = PS.order(C, { words: 'secret', columns: [{ field: 'label', from: 'hidden' }] });
ok(r[0].key === 'x' && r[0].rank > 0, 'a column\'s value is read from its from', 'from: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; })));
r = PS.order(C, { words: 'secret' });
ok(r[0].key === 'x' && r[0].rank > 0, 'without columns the row itself is matched', 'row: ' + keys(r));

test.subHeading('order: a column sort');
const S = [{ key: 'k1', row: { t: 'beta', n: '10', d: '2026-01-02', p: 'docs-old' }, at: 0 },
  { key: 'k2', row: { t: 'Alpha', n: '9', d: 'garbage', p: 'docs/z.txt' }, at: 1 },
  { key: 'k3', row: { t: 'gamma', n: 'x', d: '2025-12-31', p: 'docs' }, at: 2 },
  { key: 'k4', row: { t: 'alpha', n: '9', d: '2026-01-02', p: 'Docs/a.txt' }, at: 3 }];
const cols = [{ field: 't', sort: 'text' }, { field: 'n', sort: 'number' }, { field: 'd', sort: 'date' }, { field: 'p', sort: 'path' }, { field: 'u' },
  { field: 'shown', from: 't', sort: 'text' }];
const sorted = function (field, direction) { return keys(PS.order(S, { columns: cols, sort: { field: field, direction: direction } })); };
ok(sorted('t', 'asc') === 'k2,k4,k1,k3', 'text sorts ignoring case, equal ones in arrival order', 'text: ' + sorted('t', 'asc'));
ok(sorted('t', 'desc') === 'k3,k1,k2,k4', 'desc reverses, equal ones still in arrival order', 'text desc: ' + sorted('t', 'desc'));
ok(sorted('n', 'asc') === 'k3,k2,k4,k1', 'number sorts by value, a non-number reading 0', 'number: ' + sorted('n', 'asc'));
ok(sorted('d', 'asc') === 'k2,k3,k1,k4', 'date sorts by Date.parse, an unreadable date first', 'date: ' + sorted('d', 'asc'));
ok(sorted('p', 'asc') === 'k3,k4,k2,k1', 'path sorts folder by folder: a folder\'s contents before its next sibling', 'path: ' + sorted('p', 'asc'));
ok(sorted('u', 'asc') === 'k1,k2,k3,k4' && sorted('nosuch', 'asc') === 'k1,k2,k3,k4', 'a column without sort, or no column, keeps arrival order',
  'unsortable: ' + sorted('u', 'asc'));
ok(sorted('shown', 'asc') === 'k2,k4,k1,k3', 'a sort reads the column\'s from', 'from: ' + sorted('shown', 'asc'));
r = PS.order(S, { words: 'gamma', columns: cols, sort: { field: 't', direction: 'asc' } });
ok(r[0].key === 'k3' && r[0].rank > 0, 'with words the ranking wins over a sort', 'words and sort: ' + keys(r));

test.subHeading('matchRanges: the one marking rule');
const M = window.spirit.matchRanges;
ok(JSON.stringify(M('Anna and ANNE', 'an')) === '[[0,2],[5,7],[9,11]]', 'every place a word stands, partial and any case, in order',
  'ranges: ' + JSON.stringify(M('Anna and ANNE', 'an')));
ok(JSON.stringify(M('bert and zed', 'zed  be')) === '[[0,2],[9,12]]', 'every word is marked', 'ranges: ' + JSON.stringify(M('bert and zed', 'zed  be')));
ok(JSON.stringify(M('a.b axb', '.')) === '[[1,2]]' && JSON.stringify(M('f(x)', '(x')) === '[[1,3]]', 'a word\'s regex characters are literal',
  'ranges: ' + JSON.stringify([M('a.b axb', '.'), M('f(x)', '(x')]));
ok(M('anything', '').length === 0 && M('anything', '   ').length === 0 && M(null, 'a').length === 0, 'no words, or no text, gives []', 'empty words marked');

// ── create: the list on a page ──────────────────────────────────────────────────────────────────────────────────────
(async function () {
  test.subHeading('create: a pane drawn from the page\'s rows');
  let page = [{ key: 'b', name: 'bert', size: 2 }, { key: 'z', name: 'zed', size: 9 }, { key: 'q', name: 'quinn', size: 5 }];
  const A = source('srv');
  const picks = [];
  const c1 = container();
  const L = PS.create(c1, { search: A.search, published: A.published, server: 'srv', verb: 'search', rows: function () { return page; },
    columns: [{ field: 'name', label: 'Name', sort: 'text' }, { field: 'size', sort: 'number' }, { field: 'note' }],
    args: function (text, values) { return { q: text, v: values }; }, pick: function (row, key) { picks.push([row, key]); }, empty: 'No one.' });
  ok(c1.get('text') && c1.get('list') && c1.get('search') && c1.get('clear'), 'the pane draws its field, its search and clear buttons and its list',
    'nodes: ' + Object.keys(c1.nodes));
  ok(c1.shown().join() === 'b,z,q', 'with rows() it draws at once, in the page\'s order', 'shown: ' + c1.shown());
  const head = c1.get('list').innerHTML;
  ok(/data-sort="name"/.test(head) && /data-sort="size"/.test(head) && !/data-sort="note"/.test(head) && />Name</.test(head),
    'a header with sort is a trigger, one without is not; the label is shown', 'head: ' + head.slice(0, 300));
  ok(A.calls.length === 0, 'drawing asks nobody', 'calls: ' + A.calls.length);

  test.subHeading('create: typing ranks the cache and asks');
  c1.type('be');
  ok(c1.shown()[0] === 'b' && c1.shown().length === 3, 'typing re-ranks at once, nothing cut', 'shown: ' + c1.shown());
  ok(/<mark>be<\/mark>rt/.test(c1.get('list').innerHTML), 'the matched letters are marked', 'no mark in the list');
  ok(!/data-sort=/.test(c1.get('list').innerHTML), 'while the field holds words no header is a sort trigger', 'a trigger while searching');
  ok(A.calls.length === 1 && A.calls[0].name === 'srv.search' && A.calls[0].args.q === 'be' && typeof A.calls[0].args.v === 'object',
    'the server is asked server.verb with args(words, values)', 'call: ' + JSON.stringify(A.calls[0]));
  ok(L.words() === 'be', 'words() is the field\'s text', 'words: ' + L.words());
  await tick(); await tick();

  test.subHeading('create: one call on the wire');
  A.calls.length = 0;
  A.held = true;
  c1.type('q'); c1.type('qu'); c1.type('quin');
  ok(A.calls.length === 1 && A.calls[0].args.q === 'q', 'typing while a search is out sends nothing more', 'calls: ' + JSON.stringify(A.calls.map(function (x) { return x.args.q; })));
  ok(c1.shown()[0] === 'q', 'the list is ranked against the words as they stand now', 'shown: ' + c1.shown());
  A.release({ status: 200, body: { ok: true, items: [{ key: 'n', label: JSON.stringify({ key: 'n', name: 'quincy' }) }] } });
  await tick(); await tick();
  ok(A.calls.length === 2 && A.calls[1].args.q === 'quin', 'when it returns, one search goes with the words as they then stand',
    'calls: ' + JSON.stringify(A.calls.map(function (x) { return x.args.q; })));
  ok(c1.shown().indexOf('n') !== -1, 'an answer\'s rows join the cache and the list', 'shown: ' + c1.shown());
  A.release({ status: 500, body: { ok: false, error: 'down' } });
  await tick(); await tick();
  ok(c1.shown().indexOf('n') !== -1 && c1.shown().length === 4, 'a failed answer leaves the cache standing', 'shown: ' + c1.shown());
  A.held = false;
  A.answer = { status: 200, body: { ok: true, items: [{ key: 'n', label: JSON.stringify({ key: 'n', name: 'quill' }) }, { key: 'bad', label: 'not json' }, { label: '{}' }] } };
  c1.get('search').id && c1.fire('click', { target: c1.get('search') });
  await tick(); await tick();
  ok(/quill/.test(c1.get('list').innerHTML) && !/quincy/.test(c1.get('list').innerHTML), 'a later answer replaces the row of the same key', 'list lacks quill');
  ok(c1.shown().indexOf('bad') === -1 && c1.shown().length === 4, 'an item without key or with a label not JSON is skipped', 'shown: ' + c1.shown());
  A.answer = { status: 200, body: { ok: true, items: [] } };

  test.subHeading('create: clear, headers and sort');
  c1.fire('click', { target: c1.get('clear') });
  ok(c1.get('text').value === '' && L.words() === '', 'clear empties the field', 'text: ' + c1.get('text').value);
  const cleared = c1.shown().join();
  // With the field empty every row is back; their order is not asserted. Andy, goal/G40.13: "empty searches generally
  // just bring back the most recent rows of an object table, search only becomes sortable against user input".
  ok(c1.shown().slice().sort().join() === 'b,n,q,z', 'with the field empty every row is back, the page\'s and the server\'s', 'shown: ' + cleared);
  c1.fire('click', { target: headTarget('size') });
  ok(c1.shown().join() === 'n,b,q,z' && /▲/.test(c1.get('list').innerHTML), 'a header press sorts ascending by its column (no size reads 0)', 'shown: ' + c1.shown());
  c1.fire('click', { target: headTarget('size') });
  ok(c1.shown().join() === 'z,q,b,n' && /▼/.test(c1.get('list').innerHTML), 'a second press reverses it', 'shown: ' + c1.shown());
  L.sort('name', 'asc');
  ok(c1.shown().join() === 'b,n,q,z' && /▲/.test(c1.get('list').innerHTML), 'sort(field, direction) sorts the same way (bert, quill, quinn, zed)', 'shown: ' + c1.shown());
  L.sort();
  ok(c1.shown().join() === cleared && !/[▲▼]/.test(c1.get('list').innerHTML), 'sort() clears the sort', 'shown: ' + c1.shown());

  test.subHeading('create: the page\'s rows come and go');
  page = [{ key: 'z', name: 'zed', size: 10 }, { key: 'b', name: 'bert', size: 2 }];
  L.redraw();
  ok(c1.shown().indexOf('q') === -1, 'a row the page no longer has is gone from the list', 'shown: ' + c1.shown());
  ok(/>10</.test(c1.get('list').innerHTML), 'a page row\'s new values are drawn', 'no 10 in the list');
  ok(c1.shown().indexOf('z') < c1.shown().indexOf('b'), 'the page\'s rows stand in the page\'s order', 'shown: ' + c1.shown());
  page = [{ key: 'q', name: 'quinn', size: 5 }].concat(page);
  L.redraw();
  ok(c1.shown().indexOf('q') !== -1, 'a row the page brings back stands again', 'shown: ' + c1.shown());

  test.subHeading('create: picking, details and fold');
  c1.fire('click', { target: rowTarget('z') });
  ok(picks.length === 1 && picks[0][1] === 'z' && picks[0][0].name === 'zed' && L.value === 'z' && L.row.name === 'zed',
    'a row press picks it: pick(row, key), value and row set', 'picks: ' + JSON.stringify(picks));
  ok(c1.current() === 'z', 'the pressed row is the current one', 'current: ' + c1.current());
  c1.fire('click', { target: rowTarget('b', { action: true }) });
  ok(picks.length === 1, 'a press inside a row\'s own action is not a row press', 'picks: ' + picks.length);
  c1.fire('click', { target: rowTarget('nosuch') });
  ok(picks.length === 1, 'a press on no known row picks nothing', 'picks: ' + picks.length);

  test.subHeading('create: the keys move the current row');
  const pick0 = picks.length;
  const order0 = c1.shown();
  let e = c1.key('Home');
  ok(c1.current() === order0[0] && e.prevented, 'Home goes to the first row, the key taken', 'current: ' + c1.current());
  c1.key('ArrowDown');
  ok(c1.current() === order0[1], 'ArrowDown moves one down', 'current: ' + c1.current());
  c1.key('ArrowUp'); c1.key('ArrowUp');
  ok(c1.current() === order0[0], 'ArrowUp moves up and stops at the top', 'current: ' + c1.current());
  c1.key('End');
  ok(c1.current() === order0[order0.length - 1], 'End goes to the last row', 'current: ' + c1.current());
  c1.key('PageDown');
  ok(c1.current() === order0[order0.length - 1], 'PageDown stops at the bottom', 'current: ' + c1.current());
  c1.key('PageUp');
  ok(c1.current() === order0[0], 'PageUp moves a page up, at least to the top', 'current: ' + c1.current());
  e = c1.key('x');
  ok(!e.prevented && c1.current() === order0[0], 'another key is left alone', 'x was taken');
  await tick(); await tick();
  const calls0 = A.calls.length;
  c1.key('Enter');
  ok(picks.length === pick0 + 1 && picks[picks.length - 1][1] === order0[0] && A.calls.length === calls0, 'Enter on the list presses the current row',
    'picks: ' + picks.length);
  c1.key('Enter', c1.get('text'));
  ok(picks.length === pick0 + 1 && A.calls.length === calls0 + 1, 'Enter in the search field searches, and only that', 'calls: ' + (A.calls.length - calls0));
  await tick(); await tick();
  const ek = { key: 'Enter', repeat: true, target: c1.get('list'), preventDefault: function () {} };
  c1.fire('keydown', ek);
  ok(picks.length === pick0 + 1, 'a held-down Enter does not press again', 'picks: ' + picks.length);

  test.subHeading('create: ask lends the wire');
  A.answer = { status: 200, body: { ok: true, n: 7 } };
  const lent = await L.ask('count', { a: 1 });
  ok(lent.n === 7 && A.calls[A.calls.length - 1].name === 'srv.count' && A.calls[A.calls.length - 1].args.a === 1, 'ask(verb, args) asks server.verb and answers the body',
    'lent: ' + JSON.stringify(lent));
  A.answer = { status: 200, body: { ok: false, error: 'refused' } };
  let why = null;
  try { await L.ask('count'); } catch (err) { why = err.message; }
  ok(why === 'refused', 'a failed answer rejects with its error', 'why: ' + why);
  A.answer = { status: 404, body: null };
  why = null;
  try { await L.ask('count'); } catch (err) { why = err.message; }
  ok(why === 'no answer', 'no body rejects too', 'why: ' + why);
  A.answer = { status: 200, body: { ok: true, items: [] } };
  await tick(); await tick();
  A.held = true;
  const n0 = A.calls.length;
  c1.type('ze');
  const lentLater = L.ask('later');
  ok(A.calls.length === n0 + 1, 'a lent call waits while a search is out', 'calls: ' + (A.calls.length - n0));
  A.release(); await tick(); await tick();
  ok(A.calls.length === n0 + 2 && A.calls[n0 + 1].name === 'srv.later', 'then it goes', 'calls: ' + JSON.stringify(A.calls.slice(n0).map(function (x) { return x.name; })));
  A.release({ status: 200, body: { ok: true, done: 1 } });
  ok((await lentLater).done === 1, 'and it answers its own answer', 'later did not answer');
  A.held = false;

  test.subHeading('create: published re-asks; destroy stops everything');
  await tick(); await tick();
  ok(typeof A.heard === 'function', 'it listens through options.published', 'published was handed nothing');
  const n1 = A.calls.length;
  A.heard();
  ok(A.calls.length === n1 + 1 && A.calls[n1].name === 'srv.search', 'a publish asks the search again', 'calls: ' + (A.calls.length - n1));
  await tick(); await tick();
  L.destroy();
  ok(A.off === 1, 'destroy stops listening to publishes', 'off: ' + A.off);
  const drawn = c1.get('list').innerHTML;
  page = [{ key: 'new', name: 'newcomer' }];
  L.redraw();
  c1.type('ne');
  await tick();
  ok(c1.get('list').innerHTML === drawn && A.calls.length === n1 + 1, 'after destroy nothing draws and nothing is asked', 'drew after destroy');

  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "every element that accesses ANY api must require them
  // themselves"): handed no source, the list asks server.verb through the spirit object, a family on spirit.ready or one
  // spirit.require binds, a dotted verb walked as a path; it takes no api from its options.
  test.subHeading('create: handed no source, it asks through the spirit object');
  const SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  ok(!/\b(?:o|opts|options)\s*\.\s*api\b|\bapi\s*\.\s*verb\b/.test(SRC), 'its code reads no api off its options', 'it still reads an api handed to it');
  const asked = [];
  let refuse = null;
  const fam = function (name) {
    return new Proxy({}, { get: function (t, verb) {
      if (verb === 'then') return undefined;
      const at = function (args) { asked.push({ name: name + '.' + String(verb), args: args }); return refuse ? Promise.reject(refuse) : Promise.resolve({ ok: true, items: [{ key: 'r1', label: JSON.stringify({ key: 'r1', name: 'roxy' }) }], n: 3 }); };
      return name === 'desk' && verb === 'items' ? { search: function (args) { asked.push({ name: 'desk.items.search', args: args }); return Promise.resolve({ ok: true, items: [] }); } } : at;
    } });
  };
  const bound = [];
  const S = window.spirit;
  S.ready = Promise.resolve({ srv: fam('srv'), desk: fam('desk') });
  S.familyPath = function (n) { return 'spirit/app/' + n + '/api.js'; };
  S.require = function (p) { bound.push(p); return Promise.resolve(fam(/^spirit\/app\/([^/]+)\//.exec(p)[1])); };
  S.outcome = function (c) {
    return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; },
      function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; });
  };
  const cs = container();
  const Ls = PS.create(cs, { server: 'srv', verb: 'search', rows: function () { return []; }, columns: [{ field: 'name' }] });
  cs.type('ro');
  await tick(); await tick(); await tick();
  ok(asked.length === 1 && asked[0].name === 'srv.search' && asked[0].args.text === 'ro', 'typing asks srv.search on the family spirit.ready holds', 'asked: ' + short(asked));
  ok(cs.shown().indexOf('r1') !== -1, 'and its answer joins the list', 'shown: ' + cs.shown());
  ok((await Ls.ask('count', { a: 1 })).n === 3 && asked[asked.length - 1].name === 'srv.count', 'ask(verb, args) goes the same way', 'asked: ' + short(asked[asked.length - 1]));
  refuse = { status: 403, body: { ok: false, code: 'owner-only', error: 'not yours' } };
  let refused = null;
  try { await Ls.ask('count'); } catch (err) { refused = err.message; }
  ok(refused === 'not yours', 'a refused call rejects ask with the node\'s words', 'why: ' + refused);
  refuse = null;
  Ls.destroy();
  const co = container();
  const Lo = PS.create(co, { server: 'other', verb: 'find', rows: function () { return []; }, columns: [{ field: 'name' }] });
  co.type('x');
  await tick(); await tick(); await tick();
  ok(bound.indexOf('spirit/app/other/api.js') !== -1 && asked[asked.length - 1].name === 'other.find',
    'a family not on spirit.ready is bound through spirit.require(spirit.familyPath(name))', 'bound: ' + short(bound) + ', asked ' + short(asked[asked.length - 1]));
  Lo.destroy();
  const cd = container();
  const Ld = PS.create(cd, { server: 'desk', verb: 'items.search', rows: function () { return []; }, columns: [{ field: 'name' }] });
  cd.type('g');
  await tick(); await tick(); await tick();
  ok(asked[asked.length - 1].name === 'desk.items.search', 'a dotted verb is a path into the family', 'asked: ' + short(asked[asked.length - 1]));
  Ld.destroy();
  const cn = container();
  const n2 = asked.length;
  const Ln = PS.create(cn, { rows: function () { return []; }, columns: [{ field: 'name' }] });
  cn.type('y');
  await tick(); await tick();
  ok(asked.length === n2, 'with neither a source nor a server and verb it asks nobody', 'asked: ' + short(asked.slice(n2)));
  Ln.destroy();
  delete S.ready; delete S.require; delete S.familyPath; delete S.outcome;

  test.subHeading('create: an empty list, and no rows given');
  const c2 = container();
  PS.create(c2, { rows: function () { return []; }, empty: 'No one.' });
  ok(/No one\./.test(c2.get('list').innerHTML), 'with nothing to show it shows its empty words', 'list: ' + c2.get('list').innerHTML);
  const c3 = container();
  const L3 = PS.create(c3, {});
  ok(c3.get('list').innerHTML === '', 'with no rows() and no data it draws nothing at once', 'list: ' + c3.get('list').innerHTML);
  L3.redraw();
  ok(/Nothing matches\./.test(c3.get('list').innerHTML), 'the empty words default to "Nothing matches."', 'list: ' + c3.get('list').innerHTML);

  test.subHeading('create: filter buttons');
  const c4 = container();
  const A4 = source('s');
  const L4 = PS.create(c4, { search: A4.search, server: 's', verb: 'v', columns: [{ field: 'name' }],
    rows: function () { return [{ key: 'a', name: 'a', mine: true, kind: 'x', n: 9 }, { key: 'b', name: 'b', mine: false, kind: 'y', n: 1 }]; },
    filters: [{ name: 'mine', toggle: true, word: 'Mine', test: function (row, v) { return v ? (row.mine ? 1 : 0) : 1; } },
      { name: 'kind', multi: true, choices: [{ value: 'x', word: 'X' }, { value: 'y', word: 'Y' }], test: function (row, v) { return v[row.kind] ? 0 : 1; } },
      { name: 'size', choices: [{ value: 'all', word: 'All' }, { value: 'big', word: 'Big' }], test: function (row, v) { return v === 'big' ? (row.n > 5 ? 1 : 0) : 1; } }] });
  const fhtml = c4.get('filters').innerHTML;
  ok(/data-filter="mine" data-value="toggle"/.test(fhtml) && /data-value="x"/.test(fhtml) && /data-value="big"/.test(fhtml), 'the filters are drawn as buttons',
    'filters: ' + fhtml);
  ok(c4.shown().join() === 'a,b', 'a toggle starts off, a multi with every choice on, a plain choice at its first', 'shown: ' + c4.shown());
  c4.fire('click', { target: filterTarget('mine', 'toggle') });
  ok(c4.shown().join() === 'a' && A4.calls.length === 1, 'a toggle press flips it on, re-ranks and asks', 'shown: ' + c4.shown() + ' calls ' + A4.calls.length);
  c4.fire('click', { target: filterTarget('mine', 'toggle') });
  ok(c4.shown().join() === 'a,b', 'pressed again it flips off', 'shown: ' + c4.shown());
  c4.fire('click', { target: filterTarget('kind', 'x') });
  ok(c4.shown().join() === 'b', 'a multi choice pressed goes off', 'shown: ' + c4.shown());
  c4.fire('click', { target: filterTarget('kind', 'x') });
  ok(c4.shown().join() === 'a,b', 'pressed again it is back on', 'shown: ' + c4.shown());
  c4.fire('click', { target: filterTarget('size', 'big') });
  ok(c4.shown().join() === 'a', 'a plain choice takes its value', 'shown: ' + c4.shown());
  await tick(); await tick();

  test.subHeading('create: the filter row starts with 🗜, the search row with 🔎 (goal/G41.26)');
  // Andy, on G41.26: "in probablitySearch, if there is a filter row, it must start wit a '🗜' icon, and the search input
  // row must start with a '🔎' icon". What is seen up to the search input, its markup taken away: 🗜, the filters' own
  // words, then 🔎 at once before the input.
  const seen = function (h) { return String(h).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, '').replace(/\s+/g, ''); };
  const upToInput = function (c) { const h = c.innerHTML; const at = h.indexOf('id="' + c.pre() + 'text"'); return at === -1 ? null : seen(h.slice(0, h.lastIndexOf('<', at))); };
  const fWords = seen(fhtml).replace(/🗜/g, '');
  const u4 = upToInput(c4);
  ok(u4 === '🗜' + fWords + '🔎', 'with filters: 🗜 starts the filter row, its words follow, and 🔎 starts the search row', 'seen up to the input: ' + JSON.stringify(u4) + ', the filters\' words ' + JSON.stringify(fWords));
  const before4 = c4.innerHTML.slice(0, c4.innerHTML.indexOf('id="' + c4.pre() + 'filters"'));
  ok(/^🗜/.test(seen(c4.get('filters').innerHTML)) || /🗜/.test(seen(before4)), 'and a press that redraws the filters keeps their 🗜', 'filters now: ' + c4.get('filters').innerHTML.slice(0, 200));
  const c4b = container();
  PS.create(c4b, { rows: function () { return [{ key: 'a', name: 'a' }]; }, columns: [{ field: 'name' }] });
  const u4b = upToInput(c4b);
  ok(u4b === '🔎', 'with no filters there is no filter row and no 🗜: 🔎 starts the search row', 'seen up to the input: ' + JSON.stringify(u4b));
  const c4c = container();
  PS.create(c4c, { face: 'dropdown', placeholder: 'pick one', rows: function () { return [{ key: 'a', name: 'a' }]; }, columns: [{ field: 'name' }],
    filters: [{ name: 'mine', toggle: true, word: 'Mine', test: function () { return 1; } }] });
  const u4c = upToInput(c4c);
  ok(u4c !== null && /^[^🗜🔎]*🗜Mine🔎$/u.test(u4c), 'and in a dropdown\'s pane alike', 'seen up to the input: ' + JSON.stringify(u4c));

  test.subHeading('create: the filter row and the search row in one bubble (goal/G41.26)');
  // Andy, on G41.26: "the filer row and search-input row must be set in a transparent bubble, with a border that has the
  // same color as the type-face", "NO! the filtel row and the search-input row int eh SAME bubble", and
  //   | 🗜 [filter1] [filter2] ...
  //   | 🔎[search-input][search-button]
  // "if there's no filters, there's no filer row." The bubble: the innermost element holding the filters and the search
  // row, its border the type-face's colour, its background transparent; the list stays outside it.
  const bubbleOf = function (c) {
    const h = c.innerHTML; const pre = c.pre();
    const has = function (part) { return part.indexOf('id="' + pre + 'filters"') !== -1 && part.indexOf('id="' + pre + 'text"') !== -1 && part.indexOf('id="' + pre + 'search"') !== -1; };
    let best = null;
    const re = /<div\b[^>]*>/g; let m;
    while ((m = re.exec(h))) {
      let depth = 0; const tags = /<(\/?)div\b[^>]*>/g; tags.lastIndex = m.index; let t; let end = -1;
      while ((t = tags.exec(h))) { depth += t[1] ? -1 : 1; if (!depth) { end = tags.lastIndex; break; } }
      const part = end === -1 ? '' : h.slice(m.index, end);
      if (has(part) && (!best || part.length < best.part.length)) best = { open: m[0], part: part };
    }
    return best;
  };
  [['with filters', c4], ['with none', c4b], ['in a dropdown\'s pane', c4c]].forEach(function (x) {
    const b = bubbleOf(x[1]); const pre = x[1].pre();
    // Its look: its own style, or since goal/G41.27 the shared bubble class shell.css draws ("The bubble is one shared
    // style, the same probabilitySearch's search bubble uses.").
    const cls = b ? ((/class="([^"]*)"/.exec(b.open) || [])[1] || '').split(/\s+/).filter(Boolean) : [];
    const st = b ? ((/style="([^"]*)"/.exec(b.open) || [])[1] || '') + ';' + cls.map(function (k) { const h = new RegExp('\\.' + k.replace(/-/g, '\\-') + '\\s*\\{([^}]*)\\}').exec(SHELL_CSS); return h ? h[1] : ''; }).join(';') : '';
    ok(!!b && /border(-color)?\s*:[^;]*currentColor/.test(st) && /background(-color)?\s*:\s*transparent/.test(st) && /border-radius\s*:/.test(st),
      x[0] + ': the filters and the search row stand in one bubble, transparent, its border the type-face\'s colour', 'the innermost box holding both: ' + short(b && b.open));
    ok(!!b && b.part.indexOf('id="' + pre + 'list"') === -1, x[0] + ': the list stands outside the bubble', 'the bubble holds the list');
    ok(!!b && b.part.indexOf('id="' + pre + 'text"') < b.part.indexOf('id="' + pre + 'search"'), x[0] + ': its search row is 🔎, the input, then the search button', 'bubble: ' + short(b && b.part));
  });
  ok(seen(c4b.get('filters').innerHTML) === '' && !/🗜/.test(seen(c4b.innerHTML)), 'with no filters there is no filter row in the bubble', 'filters: ' + short(c4b.get('filters').innerHTML));
  L4.destroy();

  test.subHeading('create: the 🪣 row of selectors, on top of the bubble (goal/G41.26)');
  // Andy, on G41.26: "so the client probabilitySearch needs to provide a selectorRow, on top of the filter row. the
  // selectorRow must start with a\n🪣icon, and be hidden, if no selectors are present.", "any searchSelector in our
  // system must go into the probabilitySearch's selectorRow, so that the user-can see, which elements belong to the
  // search.", and "do it for all probabilitySearch object in the new face-shell. go." The shape (cw, on G41.26, under
  // that go): selectors [{ name, element, test(row) }], each element a selector its mounter made, mounted in the 🪣 row;
  // its change redraws the list and its test narrows it; a pick narrows the rows already fetched.
  const selEl = function () { const heard = {}; return { tagName: 'SPAN', value: '', heard: heard,
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); }, removeEventListener: function () {},
    fire: function (t) { (heard[t] || []).forEach(function (fn) { fn({ type: t, target: this }); }, this); } }; };
  const s1 = selEl(); const s2 = selEl();
  const c11 = container();
  const A11 = source('s');
  PS.create(c11, { search: A11.search, server: 's', verb: 'v', columns: [{ field: 'name' }],
    rows: function () { return [{ key: 'a', name: 'a', who: 'ann', kind: 'x' }, { key: 'b', name: 'b', who: 'bob', kind: 'y' }]; },
    selectors: [{ name: 'who', element: s1, test: function (row) { return !s1.value || row.who === s1.value ? 1 : 0; } },
      { name: 'kind', element: s2, test: function (row) { return !s2.value || row.kind === s2.value ? 1 : 0; } }],
    filters: [{ name: 'mine', toggle: true, word: 'Mine', test: function () { return 1; } }] });
  await tick();
  const p11 = c11.pre();
  const hostOf = function (e) { return e && e.parentNode && typeof e.parentNode.id === 'string' ? e.parentNode.id : ''; };
  const h11 = c11.innerHTML;
  const at = function (id) { return id ? h11.indexOf('id="' + id + '"') : -1; };
  // Each mounted in a box of the search's own markup (a slot each, or one row: the search's choice).
  ok(!!hostOf(s1) && !!hostOf(s2) && at(hostOf(s1)) !== -1 && at(hostOf(s2)) !== -1, 'each selector it is handed is mounted in the search', 'mounted in: ' + short([hostOf(s1), hostOf(s2)]));
  ok(at(hostOf(s1)) !== -1 && (hostOf(s1) === hostOf(s2) ? (c11.nodes[hostOf(s1)].kids || []).indexOf(s1) < (c11.nodes[hostOf(s1)].kids || []).indexOf(s2) : at(hostOf(s1)) < at(hostOf(s2))), 'in the order they are handed', 'at ' + short([at(hostOf(s1)), at(hostOf(s2))]));
  const b11 = bubbleOf(c11);
  ok(!!b11 && b11.part.indexOf('id="' + hostOf(s1) + '"') !== -1 && b11.part.indexOf('id="' + hostOf(s2) + '"') !== -1, 'the 🪣 row stands in the bubble', 'bubble: ' + short(b11 && b11.open));
  ok(at(hostOf(s1)) !== -1 && at(hostOf(s2)) < at(p11 + 'filters') && at(hostOf(s1)) < at(p11 + 'filters') && at(p11 + 'filters') < at(p11 + 'text'), 'on top of the bubble: the 🪣 row, then the 🗜 row, then the 🔎 row', 'at ' + short([at(hostOf(s1)), at(p11 + 'filters'), at(p11 + 'text')]));
  const u11 = upToInput(c11);
  ok(u11 === '🪣🗜Mine🔎', 'its row starts with 🪣, before its selectors', 'seen up to the input: ' + JSON.stringify(u11));
  ok(c11.shown().join() === 'a,b', 'no selector picked: every row', 'shown: ' + c11.shown());
  const asked11 = A11.calls.length;
  s1.value = 'bob'; s1.fire('change');
  ok(c11.shown().join() === 'b', 'a selector\'s change redraws the list, its test narrowing it', 'shown: ' + c11.shown());
  ok(A11.calls.length === asked11, 'and narrows the rows already fetched, asking nothing', 'calls: ' + (A11.calls.length - asked11));
  s2.value = 'x'; s2.fire('change');
  ok(c11.shown().join() === '', 'every selector\'s test counts', 'shown: ' + c11.shown());
  s1.value = ''; s1.fire('change');
  ok(c11.shown().join() === 'a', 'and a selector cleared lets its rows back', 'shown: ' + c11.shown());
  ok(!/🪣/.test(seen(c4.innerHTML)) && !/🪣/.test(seen(c4b.innerHTML)), 'with no selectors there is no 🪣 row', 'seen: ' + short(seen(c4.innerHTML)));
  const c12 = container();
  const s3 = selEl();
  PS.create(c12, { face: 'dropdown', placeholder: 'pick', columns: [{ field: 'name' }], rows: function () { return [{ key: 'a', name: 'a' }]; },
    selectors: [{ name: 'who', element: s3, test: function () { return 1; } }] });
  await tick();
  const u12 = upToInput(c12);
  ok(!!hostOf(s3) && u12 !== null && /^[^🪣🔎]*🪣🔎$/u.test(u12), 'a dropdown\'s pane alike: 🪣 and its selector, no filter row, then 🔎', 'seen up to the input: ' + JSON.stringify(u12) + ', mounted in ' + short(hostOf(s3)));

  test.subHeading('create: details in a pane, and fold');
  const c5 = container();
  const det = []; const pk5 = []; let folding = true;
  PS.create(c5, { rows: function () { return [{ key: 'a', name: 'a' }]; }, columns: [{ field: 'name' }],
    fold: function () { return folding; }, details: function (row, key, el) { det.push([row, key, el]); }, pick: function (row, key) { pk5.push(key); } });
  c5.fire('click', { target: rowTarget('a') });
  ok(det.length === 0 && pk5.length === 0 && c5.current() === 'a', 'a press fold claims opens nothing and picks nothing, the row current', 'det ' + det.length + ' pk ' + pk5.length);
  folding = false;
  c5.fire('click', { target: rowTarget('a') });
  ok(det.length === 1 && det[0][1] === 'a' && det[0][0].name === 'a' && det[0][2] === null && pk5.length === 0,
    'with details a press opens details(row, key, el) and picks nothing', 'det: ' + JSON.stringify(det));

  test.subHeading('create: rows drawn by elements');
  const c6 = container();
  let made = 0; let destroyed = 0;
  let page6 = [{ key: 'a', name: 'ann' }];
  const L6 = PS.create(c6, { rows: function () { return page6; }, columns: [{ field: 'name' }],
    element: function (row, key) { made += 1; return { key: key, row: Object.assign({}, row), apply: function (r) { Object.assign(this.row, r); }, mount: function () {}, destroy: function () { destroyed += 1; } }; } });
  L6.redraw(); L6.redraw();
  ok(made === 1, 'a row\'s element is made once per key', 'made ' + made);
  ok(!/ann/.test(c6.get('list').innerHTML) && c6.shown().join() === 'a', 'a row with an element leaves its cells to the element', 'list: ' + c6.get('list').innerHTML);
  page6 = [{ key: 'a', name: 'anne' }];
  L6.redraw();
  ok(made === 1, 'a page row\'s new values reach the element it already has', 'made ' + made);
  L6.destroy();
  ok(destroyed === 1, 'destroy destroys every element', 'destroyed ' + destroyed);

  test.subHeading('create: a view of the data layer');
  const watched = []; const seatedIn = []; let unwatched = 0;
  window.spirit.data = { rowsOf: function (type) { return type === 'people' ? [{ key: 'p1', name: 'pia' }] : []; },
    seatRows: function (type, items) { seatedIn.push([type, items]); },
    watchPath: function (type, fn) { watched.push([type, fn]); return function () { unwatched += 1; }; } };
  const c7 = container();
  const A7 = source('s');
  A7.answer = { status: 200, body: { ok: true, items: [{ key: 'p2', label: '{"name":"per"}' }] } };
  const L7 = PS.create(c7, { search: A7.search, server: 's', verb: 'v', data: 'people', columns: [{ field: 'name' }] });
  ok(c7.shown().join() === 'p1', 'with data its rows are the branch\'s, drawn at once', 'shown: ' + c7.shown());
  ok(watched.length === 1 && watched[0][0] === 'people', 'it watches its branch', 'watched: ' + watched.length);
  c7.type('pe');
  await tick(); await tick();
  ok(seatedIn.length === 1 && seatedIn[0][0] === 'people' && seatedIn[0][1][0].key === 'p2' && c7.shown().indexOf('p2') === -1,
    'an answer is seated into the branch, not into the list\'s own cache', 'seated: ' + JSON.stringify(seatedIn));
  window.spirit.data.rowsOf = function () { return [{ key: 'p1', name: 'pia' }, { key: 'p2', name: 'per' }]; };
  watched[0][1]('people/p2', {});
  ok(c7.shown().length === 2, 'a write to the branch redraws the list', 'shown: ' + c7.shown());
  L7.destroy();
  ok(unwatched === 1, 'destroy drops the watch', 'unwatched ' + unwatched);
  delete window.spirit.data;

  test.subHeading('create: the dropdown');
  const c8 = container();
  const pk8 = [];
  const heard0 = docHeard.length;
  const L8 = PS.create(c8, { face: 'dropdown', placeholder: 'pick one', all: 'everyone', columns: [{ field: 'name' }],
    rows: function () { return [{ key: 'a', name: 'ann' }, { key: 'b', name: 'bo' }]; }, name: function (row) { return 'N:' + row.name; },
    details: function () { throw new Error('a dropdown opens no details'); }, pick: function (row, key) { pk8.push([row, key]); } });
  ok(c8.get('popup').hidden === true && c8.get('list').innerHTML === '', 'a dropdown starts shut, its list not drawn', 'popup hidden ' + c8.get('popup').hidden);
  ok(/everyone/.test(c8.get('field').innerHTML), 'the field shows the all words while nothing is chosen', 'field: ' + c8.get('field').innerHTML);
  ok(docHeard.length === heard0 + 1, 'it listens for a press elsewhere', 'document listeners: ' + docHeard.length);
  c8.fire('click', { target: c8.get('field') });
  ok(c8.get('popup').hidden === false && c8.shown().join() === 'a,b' && c8.get('text').focused === 1, 'a press on the field opens it, drawn, the search focused',
    'open: ' + c8.get('popup').hidden + ' ' + c8.shown());
  ok(/id="[^"]*none"/.test(c8.get('list').innerHTML), 'all adds a None button', 'no None button');
  c8.fire('click', { target: rowTarget('b') });
  ok(pk8.length === 1 && pk8[0][1] === 'b' && L8.value === 'b', 'a press picks the row, details never asked', 'picks: ' + JSON.stringify(pk8));
  ok(c8.get('popup').hidden === true && /N:bo/.test(c8.get('field').innerHTML), 'a pick shuts it and the field shows the row\'s name', 'field: ' + c8.get('field').innerHTML);
  c8.fire('click', { target: c8.get('field') });
  c8.key('Escape');
  ok(c8.get('popup').hidden === true, 'Escape shuts it', 'still open after Escape');
  c8.fire('click', { target: c8.get('field') });
  docHeard[docHeard.length - 1]({ target: { inside: false } });
  ok(c8.get('popup').hidden === true, 'a press elsewhere shuts it', 'still open after a press elsewhere');
  c8.fire('click', { target: c8.get('field') });
  docHeard[docHeard.length - 1]({ target: { inside: false, isConnected: false } });
  ok(c8.get('popup').hidden === false, 'a press on something drawn away is not elsewhere', 'shut by a detached target');
  c8.fire('click', { target: { id: c8.pre() + 'none', inside: true, closest: function () { return null; }, getAttribute: function () { return null; } } });
  ok(pk8.length === 2 && pk8[1][0] === null && pk8[1][1] === '' && L8.value === '' && L8.row === null, 'None picks nothing', 'picks: ' + JSON.stringify(pk8[1]));
  ok(/everyone/.test(c8.get('field').innerHTML), 'with nothing chosen the field says the all words again', 'field: ' + c8.get('field').innerHTML);
  c8.key('ArrowDown');
  ok(c8.get('popup').hidden === false && /N:ann/.test(c8.get('field').innerHTML), 'the keys open it and the field says the current row', 'field: ' + c8.get('field').innerHTML);
  L8.destroy();
  ok(docHeard.length === heard0 && docRemoved === 1, 'destroy stops listening for a press elsewhere', 'document listeners: ' + docHeard.length);
  const c9 = container();
  PS.create(c9, { face: 'dropdown', placeholder: 'pick one' });
  ok(/pick one/.test(c9.get('field').innerHTML), 'without all the field shows the placeholder', 'field: ' + c9.get('field').innerHTML);

  test.subHeading('it loads the spirit\'s probability files itself (rule/26; goal/G41.18)');
  // Found by the shell's general rules on a bare page (spirit/test/spirit-sibling-generalRules.js): the Apps and Grants
  // lists threw "createProbabilityBucket is not a function", since only boot loaded these files. rule/26: every element
  // loads its own parts via spirit.require; nothing is preloaded. This loader answers in the reverse of the order it was
  // asked, as a page's fetches may: whatever order the files land in, the list must work once they are in.
  {
    const asked = [];
    global.window = { spirit: { element: {} } };
    let wait = 60;
    global.window.spirit.require = function (p) {
      const rel = String(p).replace(/^\/+/, '');
      asked.push(rel);
      const delay = (wait = Math.max(0, wait - 20));
      return new Promise(function (resolve) {
        setTimeout(function () {
          if (/^spirit\/probability\w*\.js$/.test(rel)) vm.runInThisContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), { filename: rel });
          resolve(true);
        }, delay);
      });
    };
    vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
    await new Promise(function (r) { setTimeout(r, 300); });
    const NEED = ['spirit/probabilityStringMatch.js', 'spirit/probabilityStringObjectMatch.js', 'spirit/probabilityBucket.js'];
    ok(NEED.every(function (n) { return asked.indexOf(n) !== -1; }), 'it requires probabilityStringMatch.js, probabilityStringObjectMatch.js and probabilityBucket.js', 'asked: ' + JSON.stringify(asked));
    const P2 = window.spirit.element.search;
    let made = null; let threw = null;
    const c10 = container();
    try {
      made = P2.create(c10, { search: source('srv').search, server: 'srv', verb: 'search', rows: function () { return [{ key: 'b', name: 'bert' }, { key: 'z', name: 'zed' }]; },
        columns: [{ field: 'name', label: 'Name', sort: 'text' }], args: function (t) { return { q: t }; } });
      c10.type('ze');
    } catch (e) { threw = e && e.message; }
    ok(!threw && made && c10.shown()[0] === 'z', 'once loaded, with nothing preloaded, it draws and ranks: typing ze puts zed first', 'threw ' + JSON.stringify(threw) + ', shown ' + (made ? c10.shown() : ''));
  }

  test.reportSuccessFailureCount();
}()).catch(function (err) { test.fail('the test itself threw', String(err && err.stack || err)); test.reportSuccessFailureCount(); });
