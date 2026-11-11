'use strict';

// spirit/run/spirit/element/test/search.js
// The tests of spirit/element/search.js, and of no other module (spec: ./search.md). The browser file runs
// in node on a window of its own, ranking with the spirit's own probability files; the container is a stub that keeps
// a node per id the list draws, and hears the list's listeners. After them, the parts once files of their own, each in a real
// Chrome on a scratch node: bubblePart (the bubble's rows laid out), folderPart (the search elements in spirit/element/search/),
// popupPart (the dropdown's list floats) and tilesPart (the face tiles). The one test file of search.js.

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
// goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
const PS = window.spirit.element.spirit.element.search;

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
    const bubbled = !!b && /border(-color)?\s*:[^;]*currentColor/.test(st) && /background(-color)?\s*:\s*transparent/.test(st) && /border-radius\s*:/.test(st);
    if (x[0] === 'with filters') ok(bubbled, 'with filters: the filters and the search row stand in one bubble, transparent, its border the type-face\'s colour', 'the innermost box holding both: ' + short(b && b.open));
    else if (x[0] === 'with none') ok(bubbled, 'with none: the filters and the search row stand in one bubble, transparent, its border the type-face\'s colour', 'the innermost box holding both: ' + short(b && b.open));
    else if (x[0] === 'in a dropdown\'s pane') ok(bubbled, 'in a dropdown\'s pane: the filters and the search row stand in one bubble, transparent, its border the type-face\'s colour', 'the innermost box holding both: ' + short(b && b.open));
    const outside = !!b && b.part.indexOf('id="' + pre + 'list"') === -1;
    if (x[0] === 'with filters') ok(outside, 'with filters: the list stands outside the bubble', 'the bubble holds the list');
    else if (x[0] === 'with none') ok(outside, 'with none: the list stands outside the bubble', 'the bubble holds the list');
    else if (x[0] === 'in a dropdown\'s pane') ok(outside, 'in a dropdown\'s pane: the list stands outside the bubble', 'the bubble holds the list');
    const row = !!b && b.part.indexOf('id="' + pre + 'text"') < b.part.indexOf('id="' + pre + 'search"');
    if (x[0] === 'with filters') ok(row, 'with filters: its search row is 🔎, the input, then the search button', 'bubble: ' + short(b && b.part));
    else if (x[0] === 'with none') ok(row, 'with none: its search row is 🔎, the input, then the search button', 'bubble: ' + short(b && b.part));
    else if (x[0] === 'in a dropdown\'s pane') ok(row, 'in a dropdown\'s pane: its search row is 🔎, the input, then the search button', 'bubble: ' + short(b && b.part));
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
    // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
    require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
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
    const P2 = window.spirit.element.spirit.element.search;
    let made = null; let threw = null;
    const c10 = container();
    try {
      made = P2.create(c10, { search: source('srv').search, server: 'srv', verb: 'search', rows: function () { return [{ key: 'b', name: 'bert' }, { key: 'z', name: 'zed' }]; },
        columns: [{ field: 'name', label: 'Name', sort: 'text' }], args: function (t) { return { q: t }; } });
      c10.type('ze');
    } catch (e) { threw = e && e.message; }
    ok(!threw && made && c10.shown()[0] === 'z', 'once loaded, with nothing preloaded, it draws and ranks: typing ze puts zed first', 'threw ' + JSON.stringify(threw) + ', shown ' + (made ? c10.shown() : ''));
  }

}()).catch(function (err) { test.fail('the test itself threw', String(err && err.stack || err)); })
  .then(async function () {
    // The parts that were once files of their own (search-bubble.js, search-folder.js, search-popup.js, search-tiles.js):
    // one test file per script (spirit/run/spirit/test/TEST_SYSTEM.md), each part a section of it, run in order.
    for (const [what, part] of [['bubble', bubblePart], ['folder', folderPart], ['popup', popupPart], ['tiles', tilesPart]]) {
      try { await part(); } catch (e) { test.fail('the ' + what + ' part threw ' + (e && e.stack || e)); }
    }
  })
  .then(function () { test.reportSuccessFailureCount(); process.exit(process.exitCode || 0); });

async function bubblePart() {
  // The bubble part (once search-bubble.js).
  // The tests of spirit/element/search.js in a real browser, its bubble's rows laid out (spec:
  // ./search.md, its bubble section; goal/G41.26). Its other tests run in node: the first part of ./search.js. Here
  // ./search-bubble-laid.html, on a scratch node with its DEBUG on, draws a pane and a dropdown with a filter.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  const same = function (a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 0.5; };

  const ADDRESS = '/DEBUG/spirit/element/test/search-bubble-laid.html';
  test.subHeading('search-bubble: probabilitySearch.js in a browser: the bubble\'s rows aligned');

  await (async function () {
    const chrome = H.findChrome();
    if (!chrome) { test.fail('no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name'); return; }
    const node = await H.scratchNode();
    let page = null;
    try {
      if (!node.up || !node.debug) { test.fail('the scratch node did not come up with its DEBUG on'); return; }
      page = await H.chromePage(chrome);
      if (page.error) { test.fail(page.error); return; }
      await page.send('Page.navigate', { url: node.base + ADDRESS });
      await H.until(function () { return page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
      const s = await page.evaluate('window.laid()').catch(function () { return ''; });
      let m = null;
      try { m = JSON.parse(s); } catch (e) { m = null; }
      if (!m || !m.made) { test.fail('the page measured nothing: ' + JSON.stringify(s).slice(0, 300)); return; }
      // Andy, on G41.26: "why do the icons in the probabilitySearch row have different width's? do they not use the icon
      // element? I'd like it, if the controls in the search bubble look better aligned."
      [['a pane', m.pane], ['a dropdown', m.dropdown]].forEach(function (x) {
        test.subHeading(x[0]);
        const r = x[1] || {};
        ok(/\bshell-icon\b/.test(r.filterIconClass) && /\bshell-icon\b/.test(r.searchIconClass), 'its 🗜 and 🔎 are the icon element (spirit/element/icon.js)', 'classes: ' + short([r.filterIconClass, r.searchIconClass]));
        // The icon element is a square of 1em whatever its glyph, so no glyph's own width moves what follows it: here a
        // bare glyph is 20px wide at 16px, where a browser on another machine draws each glyph its own width.
        ok(!!r.filterIcon && !!r.searchIcon && same(r.filterIcon.w, r.filterIconSize) && same(r.searchIcon.w, r.searchIconSize), 'each icon is a square of its font size, whatever its glyph', 'icons: ' + short([r.filterIcon, r.filterIconSize, r.searchIcon, r.searchIconSize]));
        ok(!!r.filterIcon && !!r.searchIcon && same(r.filterIcon.w, r.searchIcon.w) && same(r.filterIcon.left, r.searchIcon.left), 'the two icons are as wide and stand one under the other', 'icons: ' + short([r.filterIcon, r.searchIcon]));
        // And the 🪣 row of selectors on top (goal/G41.26: "the selectorRow must start with a\n🪣icon").
        ok(/\bshell-icon\b/.test(r.bucketIconClass) && !!r.bucketIcon && same(r.bucketIcon.w, r.bucketIconSize) && !!r.filterIcon && same(r.bucketIcon.left, r.filterIcon.left),
          'its 🪣 is the icon element too, a square of its font size, over the 🗜', 'bucket: ' + short([r.bucketIconClass, r.bucketIcon, r.bucketIconSize]));
        ok(!!r.firstSelector && !!r.input && same(r.firstSelector.left, r.input.left), 'the first selector starts where the search input does', 'first selector ' + short(r.firstSelector) + ', input ' + short(r.input));
        ok(!!r.firstFilter && !!r.input && same(r.firstFilter.left, r.input.left), 'each row\'s first control starts at the same place: the first filter over the search input', 'first filter ' + short(r.firstFilter) + ', input ' + short(r.input));
      });
    } finally {
      if (page && page.kid) page.kid.kill();
      if (node.child) node.child.kill();
      try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
      try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    }
  }());
}

async function popupPart() {
  // The popup part (once search-popup.js).
  // THE DROPDOWN'S LIST FLOATS (goal/G43.18; spec: ./search.md, its popup section). Andy: "is it possible to have a "popup" element, which
  // floats it's contents above all windows, but only one in the whole browser window can be active? only bound by the window
  // size but not neccessarily filling it? all dropdown panels should be part of that", then "and the actual dropdown control
  // stays where it is? just the popped list would "float"? then do that for the lists in the search-dropdown please." Real
  // clicks and keys in a real Chrome on a scratch node's face page: two search dropdowns, each in a small box that cuts off
  // what overflows it, as a row of a panel does, and a third low in the window. Neither Andy's node nor an agent's is touched.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

  test.subHeading('search-popup: a search dropdown\'s list floats above everything, one at a time (goal/G43.18)');

  await (async function () {
    const node = await scratchNode();
    const chrome = await chromePage(findChrome());
    try {
      if (!node.up || chrome.error) { test.fail('no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '')); return; }
      await chrome.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
      // Each box cuts off what overflows it (overflow hidden), and stands under a sibling drawn later on the same spot's level.
      const made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search.js"); }).then(function () { ' +
        'var rows = []; for (var i = 0; i < 40; i++) rows.push({ key: "r" + i, name: "row " + i }); window.__z = {}; ' +
        '[["a", 40, 100], ["b", 500, 100], ["low", 40, window.innerHeight - 70]].forEach(function (x) { var b = document.createElement("div"); b.id = "zz-" + x[0]; ' +
        'b.style.cssText = "position:absolute;left:" + x[1] + "px;top:" + x[2] + "px;width:320px;height:48px;overflow:hidden;border:1px solid"; document.body.appendChild(b); ' +
        'spirit.element.spirit.element.search.create(b, { face: "dropdown", rows: function () { return rows; }, columns: [{ field: "name", label: "Name" }], name: function (r) { return r.name; }, pick: function () {} }); ' +
        'window.__z[x[0]] = { box: b, list: b.querySelector("[id$=list]"), field: b.querySelector("[id$=field]") }; }); ' +
        'var cover = document.createElement("div"); cover.id = "zz-cover"; cover.style.cssText = "position:absolute;left:0;top:160px;width:900px;height:200px;background:#333;z-index:20"; document.body.appendChild(cover); ' +
        'return Object.keys(window.__z).every(function (k) { return !!window.__z[k].list && !!window.__z[k].field; }) ? "made" : "no list or field"; }, function (e) { return String(e); })');
      ok(made === 'made', 'the world: three search dropdowns of 40 rows, each in a 48 px box that cuts off its overflow, and a block drawn over the space below the first two', 'nothing made: ' + short(made));
      if (made !== 'made') return;
      await sleep(800);

      // What one dropdown shows: where its field is, whether its list is open, where it lies, and whether it is what is seen there.
      const look = function (k) {
        return chrome.evaluate('(function () { var z = window.__z[' + JSON.stringify(k) + ']; var f = z.field.getBoundingClientRect(); var l = z.list.getBoundingClientRect(); var b = z.box.getBoundingClientRect(); ' +
          'var open = l.height > 0 && getComputedStyle(z.list).visibility !== "hidden"; var x = Math.round(l.left + Math.min(l.width / 2, 60)), y = Math.round(Math.min(l.bottom - 4, Math.max(l.top + 4, b.bottom + 40))); ' +
          'var hit = open ? document.elementFromPoint(x, y) : null; ' +
          'return JSON.stringify({ field: [Math.round(f.left), Math.round(f.top)], fieldInBox: f.top >= b.top - 1 && f.bottom <= b.bottom + 1, open: open, list: [Math.round(l.left), Math.round(l.top), Math.round(l.right), Math.round(l.bottom)], ' +
          'below: l.bottom > b.bottom + 20, seen: !!hit && z.list.contains(hit), inWindow: l.top >= 0 && l.left >= 0 && l.bottom <= window.innerHeight && l.right <= window.innerWidth, fills: l.height >= window.innerHeight - 2 && l.width >= window.innerWidth - 2 }); }())').then(JSON.parse);
      };
      const press = function (k) { return chrome.evaluate('window.__z[' + JSON.stringify(k) + '].field.click(); true').then(function () { return sleep(600); }); };
      const key = async function (k, code) {
        await chrome.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code: k, windowsVirtualKeyCode: code });
        await chrome.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code: k, windowsVirtualKeyCode: code });
        await sleep(400);
      };

      test.subHeading('Andy: "the actual dropdown control stays where it is", "just the popped list would float"');
      const a0 = await look('a');
      await press('a');
      const a1 = await look('a');
      ok(a1.open, 'the world: pressed, the first dropdown\'s list opens', 'the list did not open: ' + short(a1));
      ok(a1.fieldInBox && a1.field[0] === a0.field[0] && a1.field[1] === a0.field[1], 'its field stays where it was, in its box', 'the field moved: ' + short(a0.field) + ' to ' + short(a1.field));
      ok(a1.open && a1.below && a1.seen, '"floats it\'s contents above all windows": the list reaches past its box, over the block drawn on top, and is what is seen there', 'the list: ' + short(a1));
      ok(a1.open && a1.inWindow && !a1.fills, '"only bound by the window size but not neccessarily filling it"', 'the list: ' + short(a1));

      test.subHeading('Andy: "only one in the whole browser window can be active"');
      await press('b');
      const b1 = await look('b');
      const a2 = await look('a');
      ok(b1.open && b1.seen, 'the second dropdown pressed: its list opens, seen', 'the second list: ' + short(b1));
      ok(b1.open && !a2.open, 'and the first one\'s list is closed', 'the first list is still open: ' + short(a2));
      await key('Escape', 27);
      ok(!(await look('b')).open, 'Escape closes it', 'after Escape: ' + short(await look('b')));
      await press('a');
      await chrome.evaluate('(function () { var e = document.elementFromPoint(window.innerWidth - 5, 5) || document.body; e.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); e.click(); }()); true');
      await sleep(500);
      ok(!(await look('a')).open, 'a press outside closes it', 'after a press outside: ' + short(await look('a')));

      test.subHeading('low in the window, its list still inside the window');
      await press('low');
      const l1 = await look('low');
      ok(l1.open && l1.inWindow && l1.seen, 'a dropdown low in the window opens its list inside the window, seen', 'the low list: ' + short(l1));
    } finally {
      try { if (chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
      try { if (chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
      try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
      try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}

async function tilesPart() {
  // The tiles part (once search-tiles.js).
  // probabilitySearch's third face (spec: ./search.md, its tiles section; goal/G43.6). Andy, box: "probabilitySearch gets a third face,
  // 'tiles', beside 'pane' and 'dropdown': the same ranked rows, drawn as tiles. Any list can use it." A real Chrome on a scratch
  // node's page, what a tile looks like measured there, rows of the test's own; and the one scan, from the module itself.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const match = require(path.join(RUN, 'spirit', 'probabilityStringObjectMatch.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500); }

  test.subHeading('search-tiles: probabilitySearch: the face tiles (goal/G43.6)');

  await (async function () {
    // Andy, box: "assembled by scanning the row without knowing its meaning, with the one scan probabilityStringObjectMatch uses:
    // the scan also hands each string's js object path."
    test.subHeading('the one scan: each string with its js object path');
    ok(typeof match.measureObject === 'function', 'probabilityStringObjectMatch hands out its scan, measureObject', 'it exports ' + short(Object.keys(match)));
    if (typeof match.measureObject === 'function') {
      const table = match.measureObject({ label: 'Nest', stats: { cpu: 12 }, files: [{ name: 'a.txt' }] });
      const at = function (s) { return table.filter(function (r) { return r.objectString === s; })[0] || {}; };
      ok(at('Nest').path === 'label', 'a value carries its path: label', 'Nest: ' + short(at('Nest')));
      ok(at('12').path === 'stats.cpu', 'a nested one: stats.cpu', '12: ' + short(at('12')));
      ok(at('a.txt').path === 'files[0].name', 'one in an array: files[0].name', 'a.txt: ' + short(at('a.txt')));
      ok(match.probabilityStringObjectMatch('Nest', { label: 'Nest' }) > 0, 'the match still scores with it', 'the match answered 0');
    }

    const node = await scratchNode();
    const chrome = await chromePage(findChrome());
    try {
      await chrome.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
      const js = function (s) { return chrome.evaluate(s); };
      const loaded = await js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search.js"); }).then(function () { return "loaded"; }, function (e) { return "ERR " + e; })');
      ok(loaded === 'loaded', 'the world: it loads', short(loaded));
      await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:500px;display:flex;flex-direction:column;background:#111"; window.__box = d; window.__picked = []; window.__rows = [{ key: "alpha", label: "Alpha", icon: "🅰️" }, { key: "nest", label: "Nest", icon: "🧩", stats: { cpu: 12 }, files: [{ name: "a.txt" }] }, { key: "gamma", label: "Gamma", icon: "🍀" }]; window.__made = window.spirit.element.spirit.element.search.create(d, { face: "tiles", rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }], pick: function (row, key) { window.__picked.push(key); } }); if (window.__made.refresh) window.__made.refresh(); return true; })()');
      await until(function () { return js('window.__box.querySelectorAll(".app-icon").length > 0'); }, 3000);
      const read = async function () {
        return JSON.parse(await js('(function () { var c = window.__box; var tiles = [].map.call(c.querySelectorAll(".app-icon"), function (t) { var r = t.getBoundingClientRect(); var bar = t.querySelector(".list-rank"); var fill = bar ? (bar.querySelector("div div") || bar.firstElementChild) : null; var img = [].filter.call(t.querySelectorAll("*"), function (e) { return !e.children.length && /[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(e.textContent); })[0]; var lab = [].filter.call(t.querySelectorAll("*"), function (e) { return !e.children.length && /^(Alpha|Nest|Gamma)$/.test(e.textContent.trim()); })[0]; var rect = function (e) { if (!e) return null; var b = e.getBoundingClientRect(); return { t: Math.round(b.top - r.top), b: Math.round(b.bottom - r.top), l: Math.round(b.left - r.left), r: Math.round(b.right - r.left), w: Math.round(b.width), h: Math.round(b.height) }; }; return { text: t.innerText.replace(/\\s+/g, " ").trim(), w: Math.round(r.width), h: Math.round(r.height), img: rect(img), lab: rect(lab), hasBar: !!bar, bar: rect(bar), fill: rect(fill), colour: fill ? getComputedStyle(fill).borderTopColor : "", number: bar ? bar.getAttribute("title") : "", title: t.getAttribute("title") }; }); var inputs = [].filter.call(c.querySelectorAll("input"), function (i) { return i.getClientRects().length && i.type !== "checkbox"; }); return JSON.stringify({ tiles: tiles, inputs: inputs.length, headers: c.querySelectorAll("th").length, sorts: c.querySelectorAll("[data-sort]").length, tables: c.querySelectorAll("table").length }); })()'));
      };
      const type = async function (w) { await js('(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = ' + JSON.stringify(w) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()'); await sleep(500); };
      const plain = await read();
      test.subHeading('"the same ranked rows, drawn as tiles", "No column headers or sorting"');
      ok(plain.tiles.length === 3, 'one tile per row', short(plain.tiles.length) + ' tiles');
      ok(plain.headers === 0 && plain.sorts === 0 && plain.tables === 0, 'no table, no column headers, no sort trigger', short({ h: plain.headers, s: plain.sorts, t: plain.tables }));
      ok(plain.inputs === 1, 'one search field', plain.inputs + ' search fields');
      const nest = plain.tiles.filter(function (t) { return /Nest/.test(t.text); })[0] || {};
      ok(!!nest.img && !!nest.lab && nest.img.b <= nest.lab.t + 1, '"A tile: its image, the relevance, its label": image above label', 'the tile: ' + short(nest));
      test.subHeading('"With no search words there is no bar. Its space stays, so the tiles do not jump."');
      ok(plain.tiles.every(function (t) { return !t.hasBar || !t.fill || t.fill.w === 0; }), 'no words: no bar shows', short(plain.tiles.map(function (t) { return t.fill; })));
      await type('Nest');
      const searching = await read();
      const nest2 = searching.tiles.filter(function (t) { return /Nest/.test(t.text); })[0] || {};
      ok(!!nest2.lab && !!nest.lab && nest2.lab.t === nest.lab.t && nest2.h === nest.h, 'with words the label stands where it stood', 'label ' + short(nest.lab) + ' then ' + short(nest2.lab));
      test.subHeading('"The relevance is a centered, horizontal bar, between the tile image and the tile label: the bar the lists draw, the same colour and number."');
      ok(/Nest/.test(searching.tiles[0].text), 'the row that fits comes first', 'first: ' + short(searching.tiles[0].text));
      const best = searching.tiles[0];
      ok(best.hasBar && !!best.bar && !!best.img && !!best.lab && best.bar.t >= best.img.b - 1 && best.bar.b <= best.lab.t + 1, 'its bar stands between image and label', short({ bar: best.bar, img: best.img, lab: best.lab }));
      ok(best.hasBar && !!best.fill && best.fill.w > best.fill.h, 'horizontal', short(best.fill));
      ok(best.hasBar && !!best.bar && Math.abs((best.bar.l + best.bar.r) / 2 - best.w / 2) <= 2, 'centered in the tile', short({ bar: best.bar, w: best.w }));
      ok(best.number === '1.00', 'the same number as a list: its rank against the best row\'s', 'number: ' + short(best.number));
      const expected = await js('getComputedStyle(document.documentElement).getPropertyValue("--spirit-match")');
      const probe = await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.style.borderTop = "1px solid var(--spirit-match, rgba(130,180,240,0.55))"; var c = getComputedStyle(d).borderTopColor; d.remove(); return c; })()');
      ok(best.colour === probe, 'the same colour as a list\'s bar', 'colour ' + short(best.colour) + ', a list\'s ' + short(probe) + ' (' + short(expected) + ')');
      test.subHeading('"A tile the words miss stays, last, with an empty bar. Nothing is cut."');
      await type('Nest');
      const missed = searching.tiles.slice(1);
      ok(searching.tiles.length === 3, 'all three tiles stay', short(searching.tiles.length) + ' tiles');
      await type('qqqqzzzzxxxx');
      const none = await read();
      ok(none.tiles.length === 3 && none.tiles.every(function (t) { return t.hasBar && (!t.fill || t.fill.w === 0); }), 'words nothing fits: the tiles stay, every bar empty', short(none.tiles.map(function (t) { return { text: t.text, fill: t.fill }; })));
      ok(missed.length === 2, 'the world: two others behind the best', short(missed.length));
      await type('');
      test.subHeading('"arrow keys also go left and right": Enter picks where they went');
      // Each key goes where the focus really is, as a real key does: from the empty search field an arrow moves into the tiles.
      await js('[].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0].focus(); true');
      const press = async function (key) { await js('(function () { var at = document.activeElement || document.body; at.dispatchEvent(new KeyboardEvent("keydown", { key: ' + JSON.stringify(key) + ', bubbles: true, cancelable: true })); return true; })()'); await sleep(120); };
      const order = (await read()).tiles.map(function (t) { return t.text; });
      await press('ArrowRight'); await press('ArrowRight'); await press('ArrowLeft'); await press('Enter');
      const picked1 = JSON.parse(await js('JSON.stringify(window.__picked)'));
      ok(picked1.length === 1, 'Right, Right, Left, Enter picks one tile', 'picked: ' + short(picked1) + ', order ' + short(order));
      await press('ArrowRight'); await press('Enter');
      const picked2 = JSON.parse(await js('JSON.stringify(window.__picked)'));
      ok(picked2.length === 2 && picked2[0] !== picked2[1], 'a further Right, Enter picks the next one', 'picked: ' + short(picked2));
      test.subHeading('"A press opens": a pressed tile is the list\'s pick');
      await js('window.__picked.length = 0; [].filter.call(window.__box.querySelectorAll(".app-icon"), function (t) { return /Gamma/.test(t.innerText); })[0].click(); true');
      await sleep(150);
      ok(await js('window.__picked[0] === "gamma"'), 'pressing Gamma picks gamma', 'picked: ' + short(await js('JSON.stringify(window.__picked)')));
      test.subHeading('"The tooltip shows the contents of the row, one above the other", "If the object is nested, it shows the js object path", "It drops the icon row"');
      const tip = async function (label) {
        return js('(function () { var t = [].filter.call(window.__box.querySelectorAll(".app-icon"), function (x) { return x.innerText.indexOf(' + JSON.stringify(label) + ') !== -1; })[0]; t.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); t.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); var own = t.getAttribute("title") || ""; var pop = [].map.call(document.querySelectorAll("[role=tooltip]"), function (e) { return e.innerText; }).join("\\n"); return own || pop; })()');
      };
      const tipNest = String(await tip('Nest'));
      const lines = tipNest.split('\n').map(function (l) { return l.trim(); });
      ok(lines.indexOf('key: nest') !== -1 && lines.indexOf('label: Nest') !== -1, 'its row, one above the other', 'the tooltip: ' + short(tipNest));
      ok(lines.indexOf('stats.cpu: 12') !== -1 && lines.indexOf('files[0].name: a.txt') !== -1, 'nested: stats.cpu: 12, files[0].name: a.txt', 'the tooltip: ' + short(tipNest));
      ok(!/icon/.test(tipNest), 'no icon row', 'the tooltip: ' + short(tipNest));
      test.subHeading('"Any list can use it": the other two faces stay');
      const pane = await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:500px;height:200px"; window.spirit.element.spirit.element.search.create(d, { rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }] }); return new Promise(function (r) { setTimeout(function () { var n = JSON.stringify({ tiles: d.querySelectorAll(".app-icon").length, headers: d.querySelectorAll("th").length }); d.remove(); r(n); }, 300); }); })()');
      const pn = JSON.parse(pane);
      ok(pn.tiles === 0 && pn.headers > 0, 'a pane stays a table with headers', short(pn));

      // Named here for the builder: the toggle is .list-toggle, and the owner hears through the option onFace(face).
      test.subHeading('the box: "A new option, toggle: true. Without it nothing changes for any other list."');
      const make = function (opts) { return js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:500px;display:flex;flex-direction:column;background:#111"; window.__t = d; window.__faces = []; window.__tl = window.spirit.element.spirit.element.search.create(d, Object.assign({ rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }], onFace: function (f) { window.__faces.push(f); } }, ' + JSON.stringify(opts) + ')); if (window.__tl.refresh) window.__tl.refresh(); return new Promise(function (r) { setTimeout(function () { r(true); }, 300); }); })()'); };
      const drop = function () { return js('(function () { window.__t.remove(); return true; })()'); };
      const toggles = function () { return js('window.__t.querySelectorAll(".list-toggle").length'); };
      await make({ face: 'pane' });
      ok(await toggles() === 0, 'a pane without the option has no toggle', 'a pane without the option has a toggle');
      await drop();
      await make({ face: 'tiles' });
      ok(await toggles() === 0, 'tiles without the option have no toggle', 'tiles without the option have a toggle');
      await drop();
      test.subHeading('the box: "It flips pane and tiles only. Dropdown closes to a field, so it never shows the toggle."');
      await make({ face: 'dropdown', toggle: true });
      ok(await toggles() === 0, 'a dropdown with the option has no toggle', 'a dropdown shows a toggle');
      await drop();
      await make({ face: 'pane', toggle: true });
      ok(await toggles() === 1, 'a pane with the option has one toggle', 'toggles on a pane with the option: ' + short(await toggles()));
      test.subHeading('the box: "The toggle sits on the search row, right after the Search button."');
      const placed = await js('(function () { var t = window.__t.querySelector(".list-toggle"); if (!t) return "none"; var b = [].filter.call(window.__t.querySelectorAll("button"), function (x) { return x.textContent === "Search"; })[0]; if (!b) return "no Search button"; return t.previousElementSibling === b ? "after" : "elsewhere"; })()');
      ok(placed === 'after', 'it follows the Search button', 'the toggle stands: ' + short(placed));
      test.subHeading('the box: "The face can change while the list lives, keeping the search words."');
      await js('(function () { var i = [].filter.call(window.__t.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; if (!i) return false; i.value = "Nest"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
      const seen = function () { return js('JSON.stringify({ tiles: window.__t.querySelectorAll(".app-icon").length, headers: window.__t.querySelectorAll("th").length, words: ([].filter.call(window.__t.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0] || {}).value, faces: window.__faces })'); };
      const click = function () { return js('(function () { var t = window.__t.querySelector(".list-toggle"); if (t) t.click(); return !!t; })()'); };
      const asPane = JSON.parse(await seen());
      ok(asPane.tiles === 0 && asPane.headers > 0, 'it starts as a pane', short(asPane));
      await click();
      await until(function () { return js('window.__t.querySelectorAll(".app-icon").length > 0'); }, 3000);
      const asTiles = JSON.parse(await seen());
      ok(asTiles.tiles === 3 && asTiles.headers === 0, 'a press draws tiles, one per row', short(asTiles));
      ok(asTiles.words === 'Nest', 'the search words stay', 'the words after a press: ' + short(asTiles.words));
      ok(await toggles() === 1, 'the toggle stays, to go back', 'no toggle on the tiles');
      test.subHeading('the box: "It tells its owner the new face."');
      ok(JSON.stringify(asTiles.faces) === '["tiles"]', 'the owner hears tiles', 'the owner heard: ' + short(asTiles.faces));
      await click();
      await until(function () { return js('window.__t.querySelectorAll("th").length > 0'); }, 3000);
      const back = JSON.parse(await seen());
      ok(back.tiles === 0 && back.headers > 0 && back.words === 'Nest' && JSON.stringify(back.faces) === '["tiles","pane"]', 'a second press goes back, words kept, the owner told', short(back));
      await drop();
    } finally {
      if (chrome && chrome.kid) chrome.kid.kill();
      if (node.child) node.child.kill();
      try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
      try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    }
  }());
}

// Last in the file: the folder part's scan reads this file up to here (see ownCut).
async function folderPart() {
  // The folder part (once search-folder.js).
  // The tests of goal/G43.18, the search elements of spirit/element/ renamed into spirit/element/search/ (spec: ./search.md, its folder section).
  // Andy, the box: "Every search element in spirit/element/ becomes spirit/element/search/<name>.js, with its companion folder
  // spirit/element/search/<name>/ holding its list and row elements, the same pattern for all", and "renaming only". The tree read
  // as it is: what is there, what is gone, and what the code names; and each one loaded on a page. That nothing else changed is the moved elements' own suites.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '../../..');
  const REPO = path.resolve(RUN, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
  const E = path.join(RUN, 'spirit', 'element');
  const SEARCH = path.join(E, 'search');

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400); }
  function there(rel) { return fs.existsSync(path.join(RUN, rel)); }
  function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
  function filesUnder(dir) {
    const out = [];
    (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (VENDORED_FOLDERS.holds(path.join(d, e.name)) || e.name === 'state' || e.name === 'agents') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
    return out;
  }

  // The list, with the remarks: each search element today, and where it goes.
  const GONE = [
    'spirit/element/probabilitySearch.js',
    // "appServerSelector.js ... becomes search/api.js", "apiFamilySelector.js ... folds into search/api.js", "apiVerbSelector.js is the
    // verb dropdown filter: search/api/verb.js"
    'spirit/element/appServerSelector.js', 'spirit/element/apiFamilySelector.js', 'spirit/element/apiVerbSelector.js',
    'spirit/element/contactSelector.js', 'spirit/element/contact',
    'spirit/element/files',
    'spirit/element/iconSelector.js', 'spirit/element/icons',
    'spirit/element/bundleSelector.js', 'spirit/element/bundleSelector',
    'spirit/element/branchSelector.js', 'spirit/element/branchSelector',
    'spirit/element/grantSelector',
    'spirit/element/valued.js',
    // Andy: "contactDetails.js should really be spirit/run/spirit/element/search/contact/detailElement.js"
    'spirit/element/contactDetails',
    // Andy: "spirit/run/spirit/element/relayPanel.js really should be  spirit/run/spirit/element/search/contact/relayPanel.js"
    'spirit/element/relayPanel.js',
    // goal/G43.32 (Andy: "the contact list already knows the difference between contact types. so should the detail panel."): one
    // contact detail draws a relay too.
    'spirit/element/search/contact/relayPanel.js',
    // app: its list and row, today in spirit/app/appSelector/.
    'spirit/app/appSelector/listElement.js', 'spirit/app/appSelector/rowElement.js',
  ];
  const THERE = [
    'spirit/element/search.js',
    'spirit/element/search/api.js', 'spirit/element/search/api/verb.js',
    'spirit/element/search/app.js', 'spirit/element/search/app/rowElement.js',
    'spirit/element/search/contact.js', 'spirit/element/search/contact/listElement.js', 'spirit/element/search/contact/rowElement.js',
    'spirit/element/search/contact/detailElement.js',
    // "files/ and grantSelector/ ...: their listElement becomes search/file.js and search/grant.js, their rowElement stays in the folder."
    'spirit/element/search/file.js', 'spirit/element/search/file/rowElement.js',
    'spirit/element/search/icon.js', 'spirit/element/search/icon/listElement.js', 'spirit/element/search/icon/rowElement.js',
    'spirit/element/search/bundle.js', 'spirit/element/search/bundle/listElement.js', 'spirit/element/search/bundle/rowElement.js',
    'spirit/element/search/branch.js', 'spirit/element/search/branch/listElement.js', 'spirit/element/search/branch/rowElement.js',
    'spirit/element/search/grant.js', 'spirit/element/search/grant/rowElement.js',
    'spirit/element/search/valued.js',
  ];
  // An old path as code names it: the module path a require or a script tag carries.
  const OLD = GONE.map(function (p) { return p.replace(/\.js$/, ''); });

  test.subHeading('search-folder: the search elements in spirit/element/search/ (goal/G43.18)');

  test.subHeading('the box: "spirit/element/probabilitySearch.js becomes spirit/element/search.js", and every one of the list after it');
  const missing = THERE.filter(function (p) { return !there(p); });
  ok(!missing.length, 'all are there: search.js, and api, app, contact, file, icon, bundle, branch, grant and valued under search/', 'missing ' + missing.length + ' of ' + THERE.length + ': ' + short(missing));
  ok(there('spirit/element/search.js'), 'spirit/element/search.js is there', 'no spirit/element/search.js');
  ok(there('spirit/element/search/api.js'), 'spirit/element/search/api.js is there', 'no spirit/element/search/api.js');
  ok(there('spirit/element/search/api/verb.js'), 'spirit/element/search/api/verb.js is there', 'no spirit/element/search/api/verb.js');
  ok(there('spirit/element/search/app.js'), 'spirit/element/search/app.js is there', 'no spirit/element/search/app.js');
  ok(there('spirit/element/search/app/rowElement.js'), 'spirit/element/search/app/rowElement.js is there', 'no spirit/element/search/app/rowElement.js');
  ok(there('spirit/element/search/contact.js'), 'spirit/element/search/contact.js is there', 'no spirit/element/search/contact.js');
  ok(there('spirit/element/search/contact/listElement.js'), 'spirit/element/search/contact/listElement.js is there', 'no spirit/element/search/contact/listElement.js');
  ok(there('spirit/element/search/contact/rowElement.js'), 'spirit/element/search/contact/rowElement.js is there', 'no spirit/element/search/contact/rowElement.js');
  ok(there('spirit/element/search/contact/detailElement.js'), 'spirit/element/search/contact/detailElement.js is there', 'no spirit/element/search/contact/detailElement.js');
  ok(there('spirit/element/search/file.js'), 'spirit/element/search/file.js is there', 'no spirit/element/search/file.js');
  ok(there('spirit/element/search/file/rowElement.js'), 'spirit/element/search/file/rowElement.js is there', 'no spirit/element/search/file/rowElement.js');
  ok(there('spirit/element/search/icon.js'), 'spirit/element/search/icon.js is there', 'no spirit/element/search/icon.js');
  ok(there('spirit/element/search/icon/listElement.js'), 'spirit/element/search/icon/listElement.js is there', 'no spirit/element/search/icon/listElement.js');
  ok(there('spirit/element/search/icon/rowElement.js'), 'spirit/element/search/icon/rowElement.js is there', 'no spirit/element/search/icon/rowElement.js');
  ok(there('spirit/element/search/bundle.js'), 'spirit/element/search/bundle.js is there', 'no spirit/element/search/bundle.js');
  ok(there('spirit/element/search/bundle/listElement.js'), 'spirit/element/search/bundle/listElement.js is there', 'no spirit/element/search/bundle/listElement.js');
  ok(there('spirit/element/search/bundle/rowElement.js'), 'spirit/element/search/bundle/rowElement.js is there', 'no spirit/element/search/bundle/rowElement.js');
  ok(there('spirit/element/search/branch.js'), 'spirit/element/search/branch.js is there', 'no spirit/element/search/branch.js');
  ok(there('spirit/element/search/branch/listElement.js'), 'spirit/element/search/branch/listElement.js is there', 'no spirit/element/search/branch/listElement.js');
  ok(there('spirit/element/search/branch/rowElement.js'), 'spirit/element/search/branch/rowElement.js is there', 'no spirit/element/search/branch/rowElement.js');
  ok(there('spirit/element/search/grant.js'), 'spirit/element/search/grant.js is there', 'no spirit/element/search/grant.js');
  ok(there('spirit/element/search/grant/rowElement.js'), 'spirit/element/search/grant/rowElement.js is there', 'no spirit/element/search/grant/rowElement.js');
  ok(there('spirit/element/search/valued.js'), 'spirit/element/search/valued.js is there', 'no spirit/element/search/valued.js');

  test.subHeading('the old names go');
  ok(!there('spirit/element/probabilitySearch.js'), 'spirit/element/probabilitySearch.js is gone', 'spirit/element/probabilitySearch.js is still there');
  ok(!there('spirit/element/appServerSelector.js'), 'spirit/element/appServerSelector.js is gone', 'spirit/element/appServerSelector.js is still there');
  ok(!there('spirit/element/apiFamilySelector.js'), 'spirit/element/apiFamilySelector.js is gone', 'spirit/element/apiFamilySelector.js is still there');
  ok(!there('spirit/element/apiVerbSelector.js'), 'spirit/element/apiVerbSelector.js is gone', 'spirit/element/apiVerbSelector.js is still there');
  ok(!there('spirit/element/contactSelector.js'), 'spirit/element/contactSelector.js is gone', 'spirit/element/contactSelector.js is still there');
  ok(!there('spirit/element/contact'), 'spirit/element/contact is gone', 'spirit/element/contact is still there');
  ok(!there('spirit/element/files'), 'spirit/element/files is gone', 'spirit/element/files is still there');
  ok(!there('spirit/element/iconSelector.js'), 'spirit/element/iconSelector.js is gone', 'spirit/element/iconSelector.js is still there');
  ok(!there('spirit/element/icons'), 'spirit/element/icons is gone', 'spirit/element/icons is still there');
  ok(!there('spirit/element/bundleSelector.js'), 'spirit/element/bundleSelector.js is gone', 'spirit/element/bundleSelector.js is still there');
  ok(!there('spirit/element/bundleSelector'), 'spirit/element/bundleSelector is gone', 'spirit/element/bundleSelector is still there');
  ok(!there('spirit/element/branchSelector.js'), 'spirit/element/branchSelector.js is gone', 'spirit/element/branchSelector.js is still there');
  ok(!there('spirit/element/branchSelector'), 'spirit/element/branchSelector is gone', 'spirit/element/branchSelector is still there');
  ok(!there('spirit/element/grantSelector'), 'spirit/element/grantSelector is gone', 'spirit/element/grantSelector is still there');
  ok(!there('spirit/element/valued.js'), 'spirit/element/valued.js is gone', 'spirit/element/valued.js is still there');
  ok(!there('spirit/element/contactDetails'), 'spirit/element/contactDetails is gone', 'spirit/element/contactDetails is still there');
  ok(!there('spirit/element/relayPanel.js'), 'spirit/element/relayPanel.js is gone', 'spirit/element/relayPanel.js is still there');
  ok(!there('spirit/element/search/contact/relayPanel.js'), 'spirit/element/search/contact/relayPanel.js is gone', 'spirit/element/search/contact/relayPanel.js is still there');
  ok(!there('spirit/app/appSelector/listElement.js'), 'spirit/app/appSelector/listElement.js is gone', 'spirit/app/appSelector/listElement.js is still there');
  ok(!there('spirit/app/appSelector/rowElement.js'), 'spirit/app/appSelector/rowElement.js is gone', 'spirit/app/appSelector/rowElement.js is still there');

  test.subHeading('the box: "the same pattern for all": under search/ a <name>.js and its <name>/ folder, each name a word');
  const top = fs.existsSync(SEARCH) ? fs.readdirSync(SEARCH, { withFileTypes: true }).filter(function (d) { return d.name !== 'test'; }) : [];
  const odd = top.filter(function (d) { return d.isDirectory() ? !/^[a-z]+$/.test(d.name) || !fs.existsSync(path.join(SEARCH, d.name + '.js')) : !/^[a-z]+\.js$/.test(d.name); }).map(function (d) { return d.name; });
  ok(top.length > 0 && !odd.length, 'every name under search/ is a word, and every folder sits beside its <name>.js', top.length ? 'off the pattern: ' + short(odd) : 'no spirit/element/search/');

  test.subHeading('the box: "The apps and elements that require them name the new paths"');
  // Once its own file, search-folder.js skipped itself; folded into search.js, it reads search.js up to this part, which
  // holds the old paths in its own lists.
  const own = path.resolve(__filename);
  const ownCut = function (c) { const at = c.indexOf('async function folderPart()'); return at === -1 ? c : c.slice(0, at); };
  const scripts = filesUnder(RUN).concat(filesUnder(path.join(REPO, 'spirit', 'test')))
    .filter(function (f) { return /\.(js|html|css)$/.test(f); });
  const naming = [];
  scripts.forEach(function (f) {
    const c = path.resolve(f) === own ? ownCut(code(f)) : code(f);
    OLD.forEach(function (o) { if (new RegExp(o.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?![A-Za-z])').test(c)) naming.push(path.relative(REPO, f) + ': ' + o); });
  });
  ok(scripts.length > 100 && !naming.length, 'no code names an old path, in more than a hundred scripts and their tests', naming.length + ' of ' + scripts.length + ' still name one, the first: ' + short(naming.slice(0, 8)));
  // "apiVerbSelector.js is the verb dropdown filter: search/api/verb.js, which branch names too."
  const verbUsers = ['spirit/element/search/api.js', 'spirit/element/search/branch.js', 'spirit/element/search/branch/listElement.js']
    .filter(function (p) { return /spirit\/element\/search\/api\/verb\.js/.test(code(path.join(RUN, p))); });
  ok(verbUsers.indexOf('spirit/element/search/api.js') !== -1 && verbUsers.some(function (p) { return /branch/.test(p); }), 'api and branch both load the one verb filter, search/api/verb.js', 'loading it: ' + short(verbUsers));

  // "renaming only": what loaded before still loads. A real Chrome on a scratch node's face.html, each file required through
  // spirit.require and answered within its time. Folding apiFamilySelector into search/api.js made it and search/api/verb.js
  // require each other, and neither ever loaded: the agent's bundle opened no tab (Andy: "the bundles fail to pop into a tab,
  // when i click on a bundle, no network activity, no console activity.").
  await (async function () {
    test.subHeading('the box: "renaming only": every one of them loads on a page');
    const { scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
    const node = await scratchNode();
    const chrome = await chromePage(findChrome());
    try {
      await chrome.send('Page.navigate', { url: node.base + '/face.html' });
      await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
      // Each one written out, so that each check has a plain title of its own.
      const loads = async function (p) {
        const got = await chrome.evaluate('window.spirit.ready.then(function () { return Promise.race([window.spirit.require(' + JSON.stringify(p) + ').then(function () { return "loaded"; }, function (e) { return "refused: " + e; }), new Promise(function (r) { setTimeout(function () { r("never answered"); }, 8000); })]); })');
        return { fine: got === 'loaded', why: p + ': ' + short(got) };
      };
      let ld;
      ld = await loads('spirit/element/search.js'); ok(ld.fine, 'spirit/element/search.js loads', ld.why);
      ld = await loads('spirit/element/search/api.js'); ok(ld.fine, 'spirit/element/search/api.js loads', ld.why);
      ld = await loads('spirit/element/search/api/verb.js'); ok(ld.fine, 'spirit/element/search/api/verb.js loads', ld.why);
      ld = await loads('spirit/element/search/app.js'); ok(ld.fine, 'spirit/element/search/app.js loads', ld.why);
      ld = await loads('spirit/element/search/app/rowElement.js'); ok(ld.fine, 'spirit/element/search/app/rowElement.js loads', ld.why);
      ld = await loads('spirit/element/search/contact.js'); ok(ld.fine, 'spirit/element/search/contact.js loads', ld.why);
      ld = await loads('spirit/element/search/contact/listElement.js'); ok(ld.fine, 'spirit/element/search/contact/listElement.js loads', ld.why);
      ld = await loads('spirit/element/search/contact/rowElement.js'); ok(ld.fine, 'spirit/element/search/contact/rowElement.js loads', ld.why);
      ld = await loads('spirit/element/search/contact/detailElement.js'); ok(ld.fine, 'spirit/element/search/contact/detailElement.js loads', ld.why);
      ld = await loads('spirit/element/search/file.js'); ok(ld.fine, 'spirit/element/search/file.js loads', ld.why);
      ld = await loads('spirit/element/search/file/rowElement.js'); ok(ld.fine, 'spirit/element/search/file/rowElement.js loads', ld.why);
      ld = await loads('spirit/element/search/icon.js'); ok(ld.fine, 'spirit/element/search/icon.js loads', ld.why);
      ld = await loads('spirit/element/search/icon/listElement.js'); ok(ld.fine, 'spirit/element/search/icon/listElement.js loads', ld.why);
      ld = await loads('spirit/element/search/icon/rowElement.js'); ok(ld.fine, 'spirit/element/search/icon/rowElement.js loads', ld.why);
      ld = await loads('spirit/element/search/bundle.js'); ok(ld.fine, 'spirit/element/search/bundle.js loads', ld.why);
      ld = await loads('spirit/element/search/bundle/listElement.js'); ok(ld.fine, 'spirit/element/search/bundle/listElement.js loads', ld.why);
      ld = await loads('spirit/element/search/bundle/rowElement.js'); ok(ld.fine, 'spirit/element/search/bundle/rowElement.js loads', ld.why);
      ld = await loads('spirit/element/search/branch.js'); ok(ld.fine, 'spirit/element/search/branch.js loads', ld.why);
      ld = await loads('spirit/element/search/branch/listElement.js'); ok(ld.fine, 'spirit/element/search/branch/listElement.js loads', ld.why);
      ld = await loads('spirit/element/search/branch/rowElement.js'); ok(ld.fine, 'spirit/element/search/branch/rowElement.js loads', ld.why);
      ld = await loads('spirit/element/search/grant.js'); ok(ld.fine, 'spirit/element/search/grant.js loads', ld.why);
      ld = await loads('spirit/element/search/grant/rowElement.js'); ok(ld.fine, 'spirit/element/search/grant/rowElement.js loads', ld.why);
      ld = await loads('spirit/element/search/valued.js'); ok(ld.fine, 'spirit/element/search/valued.js loads', ld.why);
    } finally {
      if (chrome && chrome.kid) chrome.kid.kill();
      if (node.child) node.child.kill();
      try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
      try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
    }
  }());
}
