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
  createElement: function (tag) { return elt(tag); },
};
// A STAND-IN ELEMENT (goal/G47.1, the cycle "the search keeps its rows": the list makes its table and its rows as elements
// once, and moves, hides and repaints them). Its children are kept; innerHTML set is held as text; innerHTML read is that
// text and its children as markup, a hidden element left out: what shows, as the checks below read it.
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function elt(tag) {
  const e = { tagName: String(tag || 'div').toUpperCase(), nodeType: 1, attrs: {}, kids: [], parentNode: null, raw: '', hidden: false,
    className: '', title: '', id: '', type: '', style: { cssText: '', display: '', background: '', width: '' } };
  e.classList = {
    contains: function (c) { return String(e.className).split(/\s+/).indexOf(c) !== -1; },
    toggle: function (c, on) { const l = String(e.className).split(/\s+/).filter(Boolean).filter(function (x) { return x !== c; }); if (on) l.push(c); e.className = l.join(' '); },
  };
  e.setAttribute = function (k, v) { e.attrs[k] = String(v); };
  e.getAttribute = function (k) { return k === 'id' ? (e.id || null) : Object.prototype.hasOwnProperty.call(e.attrs, k) ? e.attrs[k] : null; };
  e.appendChild = function (k) { if (k.parentNode && k.parentNode.removeChild) k.parentNode.removeChild(k); e.kids.push(k); k.parentNode = e; return k; };
  e.insertBefore = function (k, ref) {
    if (!ref) return e.appendChild(k);
    if (k.parentNode && k.parentNode.removeChild) k.parentNode.removeChild(k);
    const i = e.kids.indexOf(ref);
    e.kids.splice(i === -1 ? e.kids.length : i, 0, k); k.parentNode = e; return k;
  };
  e.removeChild = function (k) { const i = e.kids.indexOf(k); if (i !== -1) e.kids.splice(i, 1); k.parentNode = null; return k; };
  e.replaceChild = function (k, old) { e.insertBefore(k, old); return e.removeChild(old); };
  Object.defineProperty(e, 'firstChild', { get: function () { return e.kids[0] || null; } });
  Object.defineProperty(e, 'firstElementChild', { get: function () { return e.kids[0] || null; } });
  Object.defineProperty(e, 'nextSibling', { get: function () { const p = e.parentNode; if (!p || !p.kids) return null; return p.kids[p.kids.indexOf(e) + 1] || null; } });
  Object.defineProperty(e, 'innerHTML', {
    get: function () { return e.raw + e.kids.map(markup).join(''); },
    set: function (v) { e.raw = String(v); e.kids.forEach(function (k) { k.parentNode = null; }); e.kids = []; },
  });
  Object.defineProperty(e, 'textContent', {
    get: function () { return e.raw.replace(/<[^>]*>/g, '') + e.kids.map(function (k) { return k.textContent || ''; }).join(''); },
    set: function (v) { e.innerHTML = esc(v); },
  });
  // tag[attr] and tag[attr="value"], every element under it that matches.
  e.querySelectorAll = function (sel) {
    const m = /^([a-z]*)(?:\[([\w-]+)(?:="([^"]*)")?\])?$/i.exec(String(sel)) || [];
    const out = [];
    (function walk(x) { x.kids.forEach(function (k) {
      if (k.kids && (!m[1] || k.tagName === m[1].toUpperCase()) && (!m[2] || (k.getAttribute(m[2]) !== null && (m[3] === undefined || k.getAttribute(m[2]) === m[3])))) out.push(k);
      if (k.kids) walk(k);
    }); }(e));
    return out;
  };
  e.querySelector = function (sel) { return e.querySelectorAll(sel)[0] || null; };
  return e;
}
function markup(k) {
  if (!k || !k.kids) return '';
  if (k.hidden || (k.style && k.style.display === 'none')) return '';
  const t = k.tagName.toLowerCase();
  let a = '';
  if (k.attrs['data-key'] !== undefined) a += ' data-key="' + esc(k.attrs['data-key']) + '"';
  if (k.className) a += ' class="' + esc(k.className) + '"';
  if (k.id) a += ' id="' + esc(k.id) + '"';
  Object.keys(k.attrs).forEach(function (n) { if (n !== 'data-key') a += ' ' + n + '="' + esc(k.attrs[n]) + '"'; });
  if (k.title) a += ' title="' + esc(k.title) + '"';
  return '<' + t + a + '>' + k.innerHTML + '</' + t + '>';
}
global.window = { spirit: { probability: {
  probabilityStringObjectMatch: require(path.join(RUN, 'spirit', 'probabilityStringObjectMatch.js')).probabilityStringObjectMatch,
  createProbabilityBucket: require(path.join(RUN, 'spirit', 'probabilityBucket.js')).createProbabilityBucket,
} } };
// goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
// The element, once the first test has run its file.
let PS = null;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };

// ── the stubs ──────────────────────────────────────────────────────────────────────────────────────────────────────
// A node per id the list draws: a stand-in element (what is appended into it, its kids: a selector the search mounts,
// goal/G41.26, the 🪣 row; the list's table and rows).
function node(id) {
  const n = elt('div');
  n.id = id;
  return Object.assign(n, { value: '', focused: 0, inside: true,
    focus: function () { this.focused += 1; }, closest: function () { return null; } });
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
// What the tests make, shared by the tests after them.
let E, r, elRow, F, seenValue, W, C, S, cols, M;
const keys = function (list) { return list.map(function (x) { return x.key; }).join(); };
test.run('without words or sort the rows come in arrival order', 0.2, function () {
  // order: viewed, no words
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  PS = window.spirit.element.spirit.element.search;
  E = [{ key: 'c', row: { name: 'cy' }, at: 2 }, { key: 'a', row: { name: 'Al' }, at: 0 }, { key: 'b', row: { name: 'bo' }, at: 1 }];
  r = PS.order(E, {});
  return (keys(r) === 'a,b,c') ? true : 'order: ' + keys(r);
}, test.limit.quick);
test.run('each answer carries key, row, entry and the filter product as rank', 0.2, function () {
  return (r[0].row === E[1].row && r[0].entry === E[1] && r[0].rank === 1) ? true : 'answer: ' + JSON.stringify(r[0]);
}, test.limit.quick);
test.run('no entries and no state give []', 0.2, function () {
  return (PS.order(null).length === 0 && PS.order([], null).length === 0) ? true : 'order(null) not []';
}, test.limit.quick);
test.run('a gone entry is dropped', 0.2, function () {
  r = PS.order(E.concat([{ key: 'g', row: { name: 'gone' }, at: 3, gone: true }]), {});
  return (keys(r) === 'a,b,c') ? true : 'order: ' + keys(r);
}, test.limit.quick);
test.run('an element\'s row is read in place of the entry\'s', 0.2, function () {
  elRow = [{ key: 'e', row: { name: 'old' }, at: 0, el: { row: { name: 'new' } } }];
  r = PS.order(elRow, {});
  return (r[0].row.name === 'new') ? true : 'row: ' + JSON.stringify(r[0].row);
}, test.limit.quick);
test.run('a test answering 0, a negative or not a number drops the row', 0.2, function () {
  // order: filters drop and weigh
  F = [{ key: 'w1', row: { v: 1 }, at: 0 }, { key: 'w0', row: { v: 0 }, at: 1 }, { key: 'wn', row: { v: -1 }, at: 2 },
    { key: 'wx', row: { v: 'x' }, at: 3 }, { key: 'wh', row: { v: 0.5 }, at: 4 }, { key: 'w2', row: { v: 2 }, at: 5 }];
  r = PS.order(F, { filters: [{ name: 'f', test: function (row) { return row.v; } }] });
  return (keys(r) === 'w1,wh,w2') ? true : 'kept: ' + keys(r);
}, test.limit.quick);
test.run('a positive answer weighs the row, capped at 1', 0.2, function () {
  return (r[1].rank === 0.5 && r[2].rank === 1) ? true : 'ranks: ' + r.map(function (x) { return x.rank; });
}, test.limit.quick);
test.run('a test is handed the row and its filter\'s value', 0.2, function () {
  seenValue = null;
  r = PS.order([{ key: 'a', row: { v: 1 }, at: 0 }], { values: { f: 'chosen' }, filters: [{ name: 'f', test: function (row, v) { seenValue = v; return 0.5; } },
    { name: 'g', test: function () { return 0.4; } }, { name: 'h' }] });
  return (seenValue === 'chosen') ? true : 'value: ' + seenValue;
}, test.limit.quick);
test.run('the filters\' weights multiply; a filter without test is ignored', 0.2, function () {
  return (Math.abs(r[0].rank - 0.2) < 1e-12) ? true : 'rank: ' + r[0].rank;
}, test.limit.quick);
test.run('nothing is cut: a row the words miss still stands', 0.2, function () {
  // order: ranked by the words
  W = [{ key: 'z', row: { name: 'zed' }, at: 0 }, { key: 'b1', row: { name: 'bert' }, at: 1 }, { key: 'q', row: { name: 'quinn' }, at: 2 },
    { key: 'b2', row: { name: 'bert' }, at: 3 }];
  r = PS.order(W, { words: '  be  ' });
  return (r.length === 4) ? true : 'length ' + r.length;
}, test.limit.quick);
test.run('the best match is on top, an equal one in arrival order', 0.2, function () {
  return (r[0].key === 'b1' && r[1].key === 'b2' && r[0].rank > 0) ? true : 'order: ' + keys(r);
}, test.limit.quick);
test.run('the misses stand last at 0, in arrival order', 0.2, function () {
  return (r[2].rank === 0 && r[3].rank === 0 && r[2].key === 'z' && r[3].key === 'q') ? true : 'tail: ' + keys(r);
}, test.limit.quick);
test.run('the rank is the match times the filters\' product', 0.2, function () {
  r = PS.order(W, { words: 'be', filters: [{ name: 'f', test: function (row) { return row === W[3].row ? 0.5 : 1; } }] });
  return (r[0].key === 'b1' && Math.abs(r[1].rank - r[0].rank * 0.5) < 1e-12) ? true : 'ranks: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; }));
}, test.limit.quick);
test.run('a score answer replaces the match, clamped to 1', 0.2, function () {
  r = PS.order(W, { words: 'be', score: function (row) { return row.name === 'quinn' ? 5 : row.name === 'zed' ? -3 : null; } });
  return (r[0].key === 'q' && r[0].rank === 1) ? true : 'score: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; }));
}, test.limit.quick);
test.run('a negative score is clamped to 0, and a null score falls back to the match', 0.2, function () {
  return (r.filter(function (x) { return x.key === 'z'; })[0].rank === 0 && r.filter(function (x) { return x.key === 'b1'; })[0].rank > 0) ? true : 'ranks: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; }));
}, test.limit.quick);
test.run('a matched(row) a list hands is not used: the whole row is matched', 0.2, function () {
  // THE WHOLE ROW, ALWAYS (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole
  // row, as cached in spirit.data."): what a list shows, or a matched() it hands, narrows nothing.
  r = PS.order(W, { words: 'qu', matched: function (row) { return { other: row.name === 'zed' ? 'quiz' : 'nothing' }; } });
  return (r[0].key === 'q' && r[0].rank > 0 && r.filter(function (x) { return x.key === 'z'; })[0].rank === 0) ? true : 'matched: ' + keys(r);
}, test.limit.quick);
test.run('with columns the whole row is matched, its fields not shown too', 0.2, function () {
  C = [{ key: 'x', row: { label: 'shown', hidden: 'secret' }, at: 0 }, { key: 'y', row: { label: 'plain', hidden: 'none' }, at: 1 }];
  r = PS.order(C, { words: 'secret', columns: [{ field: 'label' }] });
  return (r[0].key === 'x' && r[0].rank > 0 && r[1].rank === 0) ? true : 'ranks: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; }));
}, test.limit.quick);
test.run('a column\'s value is read from its from', 0.2, function () {
  r = PS.order(C, { words: 'secret', columns: [{ field: 'label', from: 'hidden' }] });
  return (r[0].key === 'x' && r[0].rank > 0) ? true : 'from: ' + JSON.stringify(r.map(function (x) { return [x.key, x.rank]; }));
}, test.limit.quick);
test.run('without columns the row itself is matched', 0.2, function () {
  r = PS.order(C, { words: 'secret' });
  return (r[0].key === 'x' && r[0].rank > 0) ? true : 'row: ' + keys(r);
}, test.limit.quick);
const sorted = function (field, direction) { return keys(PS.order(S, { columns: cols, sort: { field: field, direction: direction } })); };
test.run('text sorts ignoring case, equal ones in arrival order', 0.2, function () {
  // order: a column sort
  S = [{ key: 'k1', row: { t: 'beta', n: '10', d: '2026-01-02', p: 'docs-old' }, at: 0 },
    { key: 'k2', row: { t: 'Alpha', n: '9', d: 'garbage', p: 'docs/z.txt' }, at: 1 },
    { key: 'k3', row: { t: 'gamma', n: 'x', d: '2025-12-31', p: 'docs' }, at: 2 },
    { key: 'k4', row: { t: 'alpha', n: '9', d: '2026-01-02', p: 'Docs/a.txt' }, at: 3 }];
  cols = [{ field: 't', sort: 'text' }, { field: 'n', sort: 'number' }, { field: 'd', sort: 'date' }, { field: 'p', sort: 'path' }, { field: 'u' },
    { field: 'shown', from: 't', sort: 'text' }];
  return (sorted('t', 'asc') === 'k2,k4,k1,k3') ? true : 'text: ' + sorted('t', 'asc');
}, test.limit.quick);
test.run('desc reverses, equal ones still in arrival order', 0.2, function () {
  return (sorted('t', 'desc') === 'k3,k1,k2,k4') ? true : 'text desc: ' + sorted('t', 'desc');
}, test.limit.quick);
test.run('number sorts by value, a non-number reading 0', 0.2, function () {
  return (sorted('n', 'asc') === 'k3,k2,k4,k1') ? true : 'number: ' + sorted('n', 'asc');
}, test.limit.quick);
test.run('date sorts by Date.parse, an unreadable date first', 0.2, function () {
  return (sorted('d', 'asc') === 'k2,k3,k1,k4') ? true : 'date: ' + sorted('d', 'asc');
}, test.limit.quick);
test.run('path sorts folder by folder: a folder\'s contents before its next sibling', 0.2, function () {
  return (sorted('p', 'asc') === 'k3,k4,k2,k1') ? true : 'path: ' + sorted('p', 'asc');
}, test.limit.quick);
test.run('a column without sort, or no column, keeps arrival order', 0.2, function () {
  return (sorted('u', 'asc') === 'k1,k2,k3,k4' && sorted('nosuch', 'asc') === 'k1,k2,k3,k4') ? true : 'unsortable: ' + sorted('u', 'asc');
}, test.limit.quick);
test.run('a sort reads the column\'s from', 0.2, function () {
  return (sorted('shown', 'asc') === 'k2,k4,k1,k3') ? true : 'from: ' + sorted('shown', 'asc');
}, test.limit.quick);
test.run('with words the ranking wins over a sort', 0.2, function () {
  r = PS.order(S, { words: 'gamma', columns: cols, sort: { field: 't', direction: 'asc' } });
  return (r[0].key === 'k3' && r[0].rank > 0) ? true : 'words and sort: ' + keys(r);
}, test.limit.quick);
test.run('every place a word stands, partial and any case, in order', 0.2, function () {
  // matchRanges: the one marking rule
  M = window.spirit.matchRanges;
  return (JSON.stringify(M('Anna and ANNE', 'an')) === '[[0,2],[5,7],[9,11]]') ? true : 'ranges: ' + JSON.stringify(M('Anna and ANNE', 'an'));
}, test.limit.quick);
test.run('every word is marked', 0.2, function () {
  return (JSON.stringify(M('bert and zed', 'zed  be')) === '[[0,2],[9,12]]') ? true : 'ranges: ' + JSON.stringify(M('bert and zed', 'zed  be'));
}, test.limit.quick);
test.run('a word\'s regex characters are literal', 0.2, function () {
  return (JSON.stringify(M('a.b axb', '.')) === '[[1,2]]' && JSON.stringify(M('f(x)', '(x')) === '[[1,3]]') ? true : 'ranges: ' + JSON.stringify([M('a.b axb', '.'), M('f(x)', '(x')]);
}, test.limit.quick);
test.run('no words, or no text, gives []', 0.2, function () {
  return (M('anything', '').length === 0 && M('anything', '   ').length === 0 && M(null, 'a').length === 0) ? true : 'empty words marked';
}, test.limit.quick);
// ── create: the list on a page ──────────────────────────────────────────────────────────────────────────────────────
// What the tests make, shared by the tests after them.
let page, A, picks, c1, L, head, cleared, pick0, order0, e, calls0, ek, lent, why, n0, lentLater, n1, drawn, SRC,
  asked, refuse, bound, SP, cs, Ls, refused, co, Lo, cd, Ld, cn, n2, Ln, c2, c3, L3, c4, A4, L4, fhtml, fWords, u4,
  before4, c4b, u4b, c4c, u4c, bF, preF, clsF, stF, bN, preN, clsN, stN, bD, preD, clsD, stD, s1, s2, c11, A11, p11,
  h11, b11, u11, asked11, c12, s3, u12, c5, det, pk5, folding, c6, made, destroyed, page6, L6, watched, seatedIn,
  unwatched, c7, A7, L7, c8, pk8, heard0, L8, c9, asked10, wait, NEED, P2, made10, threw, c10;
test.run('the pane draws its field, its search and clear buttons and its list', 0.2, function () {
  // create: a pane drawn from the page's rows
  page = [{ key: 'b', name: 'bert', size: 2 }, { key: 'z', name: 'zed', size: 9 }, { key: 'q', name: 'quinn', size: 5 }];
  A = source('srv');
  picks = [];
  c1 = container();
  L = PS.create(c1, { search: A.search, published: A.published, server: 'srv', verb: 'search', rows: function () { return page; },
    columns: [{ field: 'name', label: 'Name', sort: 'text' }, { field: 'size', sort: 'number' }, { field: 'note' }],
    args: function (text, values) { return { q: text, v: values }; }, pick: function (row, key) { picks.push([row, key]); }, empty: 'No one.' });
  return (c1.get('text') && c1.get('list') && c1.get('search') && c1.get('clear')) ? true : 'nodes: ' + Object.keys(c1.nodes);
}, test.limit.quick);
test.run('with rows() it draws at once, in the page\'s order', 0.2, function () {
  return (c1.shown().join() === 'b,z,q') ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('a header with sort is a trigger, one without is not; the label is shown', 0.2, function () {
  head = c1.get('list').innerHTML;
  return (/data-sort="name"/.test(head) && /data-sort="size"/.test(head) && !/data-sort="note"/.test(head) && />Name</.test(head)) ? true : 'head: ' + head.slice(0, 300);
}, test.limit.quick);
test.run('drawing asks nobody', 0.2, function () {
  return (A.calls.length === 0) ? true : 'calls: ' + A.calls.length;
}, test.limit.quick);
test.run('typing re-ranks at once, nothing cut', 0.2, function () {
  // create: typing ranks the cache and asks
  c1.type('be');
  return (c1.shown()[0] === 'b' && c1.shown().length === 3) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('the matched letters are marked', 0.2, function () {
  return (/<mark>be<\/mark>rt/.test(c1.get('list').innerHTML)) ? true : 'no mark in the list';
}, test.limit.quick);
test.run('while the field holds words no header is a sort trigger', 0.2, function () {
  return (!/data-sort=/.test(c1.get('list').innerHTML)) ? true : 'a trigger while searching';
}, test.limit.quick);
test.run('the server is asked server.verb with args(words, values)', 0.2, function () {
  return (A.calls.length === 1 && A.calls[0].name === 'srv.search' && A.calls[0].args.q === 'be' && typeof A.calls[0].args.v === 'object') ? true : 'call: ' + JSON.stringify(A.calls[0]);
}, test.limit.quick);
test.run('words() is the field\'s text', 0.2, function () {
  return (L.words() === 'be') ? true : 'words: ' + L.words();
}, test.limit.quick);
test.run('typing while a search is out sends nothing more', 0.2, async function () {
  await tick();
  await tick();
  // create: one call on the wire
  A.calls.length = 0;
  A.held = true;
  c1.type('q');
  c1.type('qu');
  c1.type('quin');
  return (A.calls.length === 1 && A.calls[0].args.q === 'q') ? true : 'calls: ' + JSON.stringify(A.calls.map(function (x) { return x.args.q; }));
}, test.limit.quick);
test.run('the list is ranked against the words as they stand now', 0.2, function () {
  return (c1.shown()[0] === 'q') ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('when it returns, one search goes with the words as they then stand', 0.2, async function () {
  A.release({ status: 200, body: { ok: true, items: [{ key: 'n', label: JSON.stringify({ key: 'n', name: 'quincy' }) }] } });
  await tick();
  await tick();
  return (A.calls.length === 2 && A.calls[1].args.q === 'quin') ? true : 'calls: ' + JSON.stringify(A.calls.map(function (x) { return x.args.q; }));
}, test.limit.quick);
test.run('an answer\'s rows join the cache and the list', 0.2, function () {
  return (c1.shown().indexOf('n') !== -1) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('a failed answer leaves the cache standing', 0.2, async function () {
  A.release({ status: 500, body: { ok: false, error: 'down' } });
  await tick();
  await tick();
  return (c1.shown().indexOf('n') !== -1 && c1.shown().length === 4) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('a later answer replaces the row of the same key', 0.2, async function () {
  A.held = false;
  A.answer = { status: 200, body: { ok: true, items: [{ key: 'n', label: JSON.stringify({ key: 'n', name: 'quill' }) }, { key: 'bad', label: 'not json' }, { label: '{}' }] } };
  c1.get('search').id && c1.fire('click', { target: c1.get('search') });
  await tick();
  await tick();
  return (/quill/.test(c1.get('list').innerHTML) && !/quincy/.test(c1.get('list').innerHTML)) ? true : 'list lacks quill';
}, test.limit.quick);
test.run('an item without key or with a label not JSON is skipped', 0.2, function () {
  return (c1.shown().indexOf('bad') === -1 && c1.shown().length === 4) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('clear empties the field', 0.2, function () {
  A.answer = { status: 200, body: { ok: true, items: [] } };
  // create: clear, headers and sort
  c1.fire('click', { target: c1.get('clear') });
  return (c1.get('text').value === '' && L.words() === '') ? true : 'text: ' + c1.get('text').value;
}, test.limit.quick);
test.run('with the field empty every row is back, the page\'s and the server\'s', 0.2, function () {
  cleared = c1.shown().join();
  // With the field empty every row is back; their order is not asserted. Andy, goal/G40.13: "empty searches generally
  // just bring back the most recent rows of an object table, search only becomes sortable against user input".
  return (c1.shown().slice().sort().join() === 'b,n,q,z') ? true : 'shown: ' + cleared;
}, test.limit.quick);
test.run('a header press sorts ascending by its column (no size reads 0)', 0.2, function () {
  c1.fire('click', { target: headTarget('size') });
  return (c1.shown().join() === 'n,b,q,z' && /▲/.test(c1.get('list').innerHTML)) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('a second press reverses it', 0.2, function () {
  c1.fire('click', { target: headTarget('size') });
  return (c1.shown().join() === 'z,q,b,n' && /▼/.test(c1.get('list').innerHTML)) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('sort(field, direction) sorts the same way (bert, quill, quinn, zed)', 0.2, function () {
  L.sort('name', 'asc');
  return (c1.shown().join() === 'b,n,q,z' && /▲/.test(c1.get('list').innerHTML)) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('sort() clears the sort', 0.2, function () {
  L.sort();
  return (c1.shown().join() === cleared && !/[▲▼]/.test(c1.get('list').innerHTML)) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('a row the page no longer has is gone from the list', 0.2, function () {
  // create: the page's rows come and go
  page = [{ key: 'z', name: 'zed', size: 10 }, { key: 'b', name: 'bert', size: 2 }];
  L.redraw();
  return (c1.shown().indexOf('q') === -1) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('a page row\'s new values are drawn', 0.2, function () {
  return (/>10</.test(c1.get('list').innerHTML)) ? true : 'no 10 in the list';
}, test.limit.quick);
test.run('the page\'s rows stand in the page\'s order', 0.2, function () {
  return (c1.shown().indexOf('z') < c1.shown().indexOf('b')) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('a row the page brings back stands again', 0.2, function () {
  page = [{ key: 'q', name: 'quinn', size: 5 }].concat(page);
  L.redraw();
  return (c1.shown().indexOf('q') !== -1) ? true : 'shown: ' + c1.shown();
}, test.limit.quick);
test.run('a row press picks it: pick(row, key), value and row set', 0.2, function () {
  // create: picking, details and fold
  c1.fire('click', { target: rowTarget('z') });
  return (picks.length === 1 && picks[0][1] === 'z' && picks[0][0].name === 'zed' && L.value === 'z' && L.row.name === 'zed') ? true : 'picks: ' + JSON.stringify(picks);
}, test.limit.quick);
test.run('the pressed row is the current one', 0.2, function () {
  return (c1.current() === 'z') ? true : 'current: ' + c1.current();
}, test.limit.quick);
test.run('a press inside a row\'s own action is not a row press', 0.2, function () {
  c1.fire('click', { target: rowTarget('b', { action: true }) });
  return (picks.length === 1) ? true : 'picks: ' + picks.length;
}, test.limit.quick);
test.run('a press on no known row picks nothing', 0.2, function () {
  c1.fire('click', { target: rowTarget('nosuch') });
  return (picks.length === 1) ? true : 'picks: ' + picks.length;
}, test.limit.quick);
test.run('Home goes to the first row, the key taken', 0.2, function () {
  // create: the keys move the current row
  pick0 = picks.length;
  order0 = c1.shown();
  e = c1.key('Home');
  return (c1.current() === order0[0] && e.prevented) ? true : 'current: ' + c1.current();
}, test.limit.quick);
test.run('ArrowDown moves one down', 0.2, function () {
  c1.key('ArrowDown');
  return (c1.current() === order0[1]) ? true : 'current: ' + c1.current();
}, test.limit.quick);
test.run('ArrowUp moves up and stops at the top', 0.2, function () {
  c1.key('ArrowUp');
  c1.key('ArrowUp');
  return (c1.current() === order0[0]) ? true : 'current: ' + c1.current();
}, test.limit.quick);
test.run('End goes to the last row', 0.2, function () {
  c1.key('End');
  return (c1.current() === order0[order0.length - 1]) ? true : 'current: ' + c1.current();
}, test.limit.quick);
test.run('PageDown stops at the bottom', 0.2, function () {
  c1.key('PageDown');
  return (c1.current() === order0[order0.length - 1]) ? true : 'current: ' + c1.current();
}, test.limit.quick);
test.run('PageUp moves a page up, at least to the top', 0.2, function () {
  c1.key('PageUp');
  return (c1.current() === order0[0]) ? true : 'current: ' + c1.current();
}, test.limit.quick);
test.run('another key is left alone', 0.2, function () {
  e = c1.key('x');
  return (!e.prevented && c1.current() === order0[0]) ? true : 'x was taken';
}, test.limit.quick);
test.run('Enter on the list presses the current row', 0.2, async function () {
  await tick();
  await tick();
  calls0 = A.calls.length;
  c1.key('Enter');
  return (picks.length === pick0 + 1 && picks[picks.length - 1][1] === order0[0] && A.calls.length === calls0) ? true : 'picks: ' + picks.length;
}, test.limit.quick);
test.run('Enter in the search field searches, and only that', 0.2, function () {
  c1.key('Enter', c1.get('text'));
  return (picks.length === pick0 + 1 && A.calls.length === calls0 + 1) ? true : 'calls: ' + (A.calls.length - calls0);
}, test.limit.quick);
test.run('a held-down Enter does not press again', 0.2, async function () {
  await tick();
  await tick();
  ek = { key: 'Enter', repeat: true, target: c1.get('list'), preventDefault: function () {} };
  c1.fire('keydown', ek);
  return (picks.length === pick0 + 1) ? true : 'picks: ' + picks.length;
}, test.limit.quick);
test.run('ask(verb, args) asks server.verb and answers the body', 0.2, async function () {
  // create: ask lends the wire
  A.answer = { status: 200, body: { ok: true, n: 7 } };
  lent = await L.ask('count', { a: 1 });
  return (lent.n === 7 && A.calls[A.calls.length - 1].name === 'srv.count' && A.calls[A.calls.length - 1].args.a === 1) ? true : 'lent: ' + JSON.stringify(lent);
}, test.limit.quick);
test.run('a failed answer rejects with its error', 0.2, async function () {
  A.answer = { status: 200, body: { ok: false, error: 'refused' } };
  why = null;
  try { await L.ask('count'); } catch (err) { why = err.message; }
  return (why === 'refused') ? true : 'why: ' + why;
}, test.limit.quick);
test.run('no body rejects too', 0.2, async function () {
  A.answer = { status: 404, body: null };
  why = null;
  try { await L.ask('count'); } catch (err) { why = err.message; }
  return (why === 'no answer') ? true : 'why: ' + why;
}, test.limit.quick);
test.run('a lent call waits while a search is out', 0.2, async function () {
  A.answer = { status: 200, body: { ok: true, items: [] } };
  await tick();
  await tick();
  A.held = true;
  n0 = A.calls.length;
  c1.type('ze');
  lentLater = L.ask('later');
  return (A.calls.length === n0 + 1) ? true : 'calls: ' + (A.calls.length - n0);
}, test.limit.quick);
test.run('then it goes', 0.2, async function () {
  A.release();
  await tick();
  await tick();
  return (A.calls.length === n0 + 2 && A.calls[n0 + 1].name === 'srv.later') ? true : 'calls: ' + JSON.stringify(A.calls.slice(n0).map(function (x) { return x.name; }));
}, test.limit.quick);
test.run('and it answers its own answer', 0.2, async function () {
  A.release({ status: 200, body: { ok: true, done: 1 } });
  return ((await lentLater).done === 1) ? true : 'later did not answer';
}, test.limit.quick);
test.run('it listens through options.published', 0.2, async function () {
  A.held = false;
  // create: published re-asks; destroy stops everything
  await tick();
  await tick();
  return (typeof A.heard === 'function') ? true : 'published was handed nothing';
}, test.limit.quick);
test.run('a publish asks the search again', 0.2, function () {
  n1 = A.calls.length;
  A.heard();
  return (A.calls.length === n1 + 1 && A.calls[n1].name === 'srv.search') ? true : 'calls: ' + (A.calls.length - n1);
}, test.limit.quick);
test.run('destroy stops listening to publishes', 0.2, async function () {
  await tick();
  await tick();
  L.destroy();
  return (A.off === 1) ? true : 'off: ' + A.off;
}, test.limit.quick);
test.run('after destroy nothing draws and nothing is asked', 0.2, async function () {
  drawn = c1.get('list').innerHTML;
  page = [{ key: 'new', name: 'newcomer' }];
  L.redraw();
  c1.type('ne');
  await tick();
  return (c1.get('list').innerHTML === drawn && A.calls.length === n1 + 1) ? true : 'drew after destroy';
}, test.limit.quick);
test.run('its code reads no api off its options', 0.2, function () {
  // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24; Andy: "every element that accesses ANY api must require them
  // themselves"): handed no source, the list asks server.verb through the spirit object, a family on spirit.ready or one
  // spirit.require binds, a dotted verb walked as a path; it takes no api from its options.
  // create: handed no source, it asks through the spirit object
  SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  return (!/\b(?:o|opts|options)\s*\.\s*api\b|\bapi\s*\.\s*verb\b/.test(SRC)) ? true : 'it still reads an api handed to it';
}, test.limit.quick);
const fam = function (name) {
  return new Proxy({}, { get: function (t, verb) {
    if (verb === 'then') return undefined;
    const at = function (args) { asked.push({ name: name + '.' + String(verb), args: args }); return refuse ? Promise.reject(refuse) : Promise.resolve({ ok: true, items: [{ key: 'r1', label: JSON.stringify({ key: 'r1', name: 'roxy' }) }], n: 3 }); };
    return name === 'desk' && verb === 'items' ? { search: function (args) { asked.push({ name: 'desk.items.search', args: args }); return Promise.resolve({ ok: true, items: [] }); } } : at;
  } });
};
test.run('typing asks srv.search on the family spirit.ready holds', 0.2, async function () {
  asked = [];
  refuse = null;
  bound = [];
  SP = window.spirit;
  SP.ready = Promise.resolve({ srv: fam('srv'), desk: fam('desk') });
  SP.familyPath = function (n) { return 'spirit/app/' + n + '/api.js'; };
  SP.require = function (p) { bound.push(p); return Promise.resolve(fam(/^spirit\/app\/([^/]+)\//.exec(p)[1])); };
  SP.outcome = function (c) {
    return Promise.resolve(c).then(function (body) { return { status: 200, body: body }; },
      function (e) { return { status: (e && e.status) || 0, body: (e && e.body) || null }; });
  };
  cs = container();
  Ls = PS.create(cs, { server: 'srv', verb: 'search', rows: function () { return []; }, columns: [{ field: 'name' }] });
  cs.type('ro');
  await tick();
  await tick();
  await tick();
  return (asked.length === 1 && asked[0].name === 'srv.search' && asked[0].args.text === 'ro') ? true : 'asked: ' + short(asked);
}, test.limit.quick);
test.run('and its answer joins the list', 0.2, function () {
  return (cs.shown().indexOf('r1') !== -1) ? true : 'shown: ' + cs.shown();
}, test.limit.quick);
test.run('ask(verb, args) goes the same way', 0.2, async function () {
  return ((await Ls.ask('count', { a: 1 })).n === 3 && asked[asked.length - 1].name === 'srv.count') ? true : 'asked: ' + short(asked[asked.length - 1]);
}, test.limit.quick);
test.run('a refused call rejects ask with the node\'s words', 0.2, async function () {
  refuse = { status: 403, body: { ok: false, code: 'owner-only', error: 'not yours' } };
  refused = null;
  try { await Ls.ask('count'); } catch (err) { refused = err.message; }
  return (refused === 'not yours') ? true : 'why: ' + refused;
}, test.limit.quick);
test.run('a family not on spirit.ready is bound through spirit.require(spirit.familyPath(name))', 0.2, async function () {
  refuse = null;
  Ls.destroy();
  co = container();
  Lo = PS.create(co, { server: 'other', verb: 'find', rows: function () { return []; }, columns: [{ field: 'name' }] });
  co.type('x');
  await tick();
  await tick();
  await tick();
  return (bound.indexOf('spirit/app/other/api.js') !== -1 && asked[asked.length - 1].name === 'other.find') ? true : 'bound: ' + short(bound) + ', asked ' + short(asked[asked.length - 1]);
}, test.limit.quick);
test.run('a dotted verb is a path into the family', 0.2, async function () {
  Lo.destroy();
  cd = container();
  Ld = PS.create(cd, { server: 'desk', verb: 'items.search', rows: function () { return []; }, columns: [{ field: 'name' }] });
  cd.type('g');
  await tick();
  await tick();
  await tick();
  return (asked[asked.length - 1].name === 'desk.items.search') ? true : 'asked: ' + short(asked[asked.length - 1]);
}, test.limit.quick);
test.run('with neither a source nor a server and verb it asks nobody', 0.2, async function () {
  Ld.destroy();
  cn = container();
  n2 = asked.length;
  Ln = PS.create(cn, { rows: function () { return []; }, columns: [{ field: 'name' }] });
  cn.type('y');
  await tick();
  await tick();
  return (asked.length === n2) ? true : 'asked: ' + short(asked.slice(n2));
}, test.limit.quick);
test.run('with nothing to show it shows its empty words', 0.2, function () {
  Ln.destroy();
  delete SP.ready;
  delete SP.require;
  delete SP.familyPath;
  delete SP.outcome;
  // create: an empty list, and no rows given
  c2 = container();
  PS.create(c2, { rows: function () { return []; }, empty: 'No one.' });
  return (/No one\./.test(c2.get('list').innerHTML)) ? true : 'list: ' + c2.get('list').innerHTML;
}, test.limit.quick);
test.run('with no rows() and no data it draws nothing at once', 0.2, function () {
  c3 = container();
  L3 = PS.create(c3, {});
  return (c3.get('list').innerHTML === '') ? true : 'list: ' + c3.get('list').innerHTML;
}, test.limit.quick);
test.run('the empty words default to "Nothing matches."', 0.2, function () {
  L3.redraw();
  return (/Nothing matches\./.test(c3.get('list').innerHTML)) ? true : 'list: ' + c3.get('list').innerHTML;
}, test.limit.quick);
test.run('the filters are drawn as buttons', 0.2, function () {
  // create: filter buttons
  c4 = container();
  A4 = source('s');
  L4 = PS.create(c4, { search: A4.search, server: 's', verb: 'v', columns: [{ field: 'name' }],
    rows: function () { return [{ key: 'a', name: 'a', mine: true, kind: 'x', n: 9 }, { key: 'b', name: 'b', mine: false, kind: 'y', n: 1 }]; },
    filters: [{ name: 'mine', toggle: true, word: 'Mine', test: function (row, v) { return v ? (row.mine ? 1 : 0) : 1; } },
      { name: 'kind', multi: true, choices: [{ value: 'x', word: 'X' }, { value: 'y', word: 'Y' }], test: function (row, v) { return v[row.kind] ? 0 : 1; } },
      { name: 'size', choices: [{ value: 'all', word: 'All' }, { value: 'big', word: 'Big' }], test: function (row, v) { return v === 'big' ? (row.n > 5 ? 1 : 0) : 1; } }] });
  fhtml = c4.get('filters').innerHTML;
  return (/data-filter="mine" data-value="toggle"/.test(fhtml) && /data-value="x"/.test(fhtml) && /data-value="big"/.test(fhtml)) ? true : 'filters: ' + fhtml;
}, test.limit.quick);
test.run('a toggle starts off, a multi with every choice on, a plain choice at its first', 0.2, function () {
  return (c4.shown().join() === 'a,b') ? true : 'shown: ' + c4.shown();
}, test.limit.quick);
test.run('a toggle press flips it on, re-ranks and asks', 0.2, function () {
  c4.fire('click', { target: filterTarget('mine', 'toggle') });
  return (c4.shown().join() === 'a' && A4.calls.length === 1) ? true : 'shown: ' + c4.shown() + ' calls ' + A4.calls.length;
}, test.limit.quick);
test.run('pressed again it flips off', 0.2, function () {
  c4.fire('click', { target: filterTarget('mine', 'toggle') });
  return (c4.shown().join() === 'a,b') ? true : 'shown: ' + c4.shown();
}, test.limit.quick);
test.run('a multi choice pressed goes off', 0.2, function () {
  c4.fire('click', { target: filterTarget('kind', 'x') });
  return (c4.shown().join() === 'b') ? true : 'shown: ' + c4.shown();
}, test.limit.quick);
test.run('pressed again it is back on', 0.2, function () {
  c4.fire('click', { target: filterTarget('kind', 'x') });
  return (c4.shown().join() === 'a,b') ? true : 'shown: ' + c4.shown();
}, test.limit.quick);
test.run('a plain choice takes its value', 0.2, function () {
  c4.fire('click', { target: filterTarget('size', 'big') });
  return (c4.shown().join() === 'a') ? true : 'shown: ' + c4.shown();
}, test.limit.quick);
// keepOne (goal/G47.1, the testicle search, the box: "at least one of the two is selected at all times: the only combination
// forbidden is both off"): a multi filter that keeps its last choice on.
let c4k = null;
test.run('a keepOne multi choice pressed goes off while another is still on', 0.2, function () {
  c4k = container();
  PS.create(c4k, { search: source('s').search, server: 's', verb: 'v', columns: [{ field: 'name' }],
    rows: function () { return [{ key: 'a', name: 'a', kind: 'x' }, { key: 'b', name: 'b', kind: 'y' }]; },
    filters: [{ name: 'kind', multi: true, keepOne: true, choices: [{ value: 'x', word: 'X' }, { value: 'y', word: 'Y' }], test: function (row, v) { return v[row.kind] ? 0 : 1; } }] });
  c4k.fire('click', { target: filterTarget('kind', 'x') });
  return (c4k.shown().join() === 'b') ? true : 'shown: ' + c4k.shown();
}, test.limit.quick);
test.run('the last keepOne choice still on, pressed, stays on', 0.2, function () {
  if (!c4k) return 'no list: the test before failed';
  c4k.fire('click', { target: filterTarget('kind', 'y') });
  return (c4k.shown().join() === 'b') ? true : 'shown: ' + c4k.shown();
}, test.limit.quick);
const seen = function (h) { return String(h).replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, '').replace(/\s+/g, ''); };
const upToInput = function (c) { const h = c.innerHTML; const at = h.indexOf('id="' + c.pre() + 'text"'); return at === -1 ? null : seen(h.slice(0, h.lastIndexOf('<', at))); };
test.run('with filters: 🗜 starts the filter row, its words follow, and 🔎 starts the search row', 0.2, async function () {
  await tick();
  await tick();
  // create: the filter row starts with 🗜, the search row with 🔎 (goal/G41.26)
  // Andy, on G41.26: "in probablitySearch, if there is a filter row, it must start wit a '🗜' icon, and the search input
  // row must start with a '🔎' icon". What is seen up to the search input, its markup taken away: 🗜, the filters' own
  // words, then 🔎 at once before the input.
  fWords = seen(fhtml).replace(/🗜/g, '');
  u4 = upToInput(c4);
  return (u4 === '🗜' + fWords + '🔎') ? true : 'seen up to the input: ' + JSON.stringify(u4) + ', the filters\' words ' + JSON.stringify(fWords);
}, test.limit.quick);
test.run('and a press that redraws the filters keeps their 🗜', 0.2, function () {
  before4 = c4.innerHTML.slice(0, c4.innerHTML.indexOf('id="' + c4.pre() + 'filters"'));
  return (/^🗜/.test(seen(c4.get('filters').innerHTML)) || /🗜/.test(seen(before4))) ? true : 'filters now: ' + c4.get('filters').innerHTML.slice(0, 200);
}, test.limit.quick);
test.run('with no filters there is no filter row and no 🗜: 🔎 starts the search row', 0.2, function () {
  c4b = container();
  PS.create(c4b, { rows: function () { return [{ key: 'a', name: 'a' }]; }, columns: [{ field: 'name' }] });
  u4b = upToInput(c4b);
  return (u4b === '🔎') ? true : 'seen up to the input: ' + JSON.stringify(u4b);
}, test.limit.quick);
test.run('and in a dropdown\'s pane alike', 0.2, function () {
  c4c = container();
  PS.create(c4c, { face: 'dropdown', placeholder: 'pick one', rows: function () { return [{ key: 'a', name: 'a' }]; }, columns: [{ field: 'name' }],
    filters: [{ name: 'mine', toggle: true, word: 'Mine', test: function () { return 1; } }] });
  u4c = upToInput(c4c);
  return (u4c !== null && /^[^🗜🔎]*🗜Mine🔎$/u.test(u4c)) ? true : 'seen up to the input: ' + JSON.stringify(u4c);
}, test.limit.quick);
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
test.run('with filters: the filters and the search row stand in one bubble, transparent, its border the type-face\'s colour', 0.2, function () {
  // create: the filter row and the search row in one bubble (goal/G41.26)
  // Andy, on G41.26: "the filer row and search-input row must be set in a transparent bubble, with a border that has the
  // same color as the type-face", "NO! the filtel row and the search-input row int eh SAME bubble", and
  //   | 🗜 [filter1] [filter2] ...
  //   | 🔎[search-input][search-button]
  // "if there's no filters, there's no filer row." The bubble: the innermost element holding the filters and the search
  // row, its border the type-face's colour, its background transparent; the list stays outside it.
  // Its look: its own style, or since goal/G41.27 the shared bubble class shell.css draws ("The bubble is one shared
  // style, the same probabilitySearch's search bubble uses.").
  // with filters
  bF = bubbleOf(c4);
  preF = c4.pre();
  clsF = bF ? ((/class="([^"]*)"/.exec(bF.open) || [])[1] || '').split(/\s+/).filter(Boolean) : [];
  stF = bF ? ((/style="([^"]*)"/.exec(bF.open) || [])[1] || '') + ';' + clsF.map(function (k) { const h = new RegExp('\\.' + k.replace(/-/g, '\\-') + '\\s*\\{([^}]*)\\}').exec(SHELL_CSS); return h ? h[1] : ''; }).join(';') : '';
  return (!!bF && /border(-color)?\s*:[^;]*currentColor/.test(stF) && /background(-color)?\s*:\s*transparent/.test(stF) && /border-radius\s*:/.test(stF)) ? true : 'the innermost box holding both: ' + short(bF && bF.open);
}, test.limit.quick);
test.run('with filters: the list stands outside the bubble', 0.2, function () {
  return (!!bF && bF.part.indexOf('id="' + preF + 'list"') === -1) ? true : 'the bubble holds the list';
}, test.limit.quick);
test.run('with filters: its search row is 🔎, the input, then the search button', 0.2, function () {
  return (!!bF && bF.part.indexOf('id="' + preF + 'text"') < bF.part.indexOf('id="' + preF + 'search"')) ? true : 'bubble: ' + short(bF && bF.part);
}, test.limit.quick);
test.run('with none: the filters and the search row stand in one bubble, transparent, its border the type-face\'s colour', 0.2, function () {
  // with none
  bN = bubbleOf(c4b);
  preN = c4b.pre();
  clsN = bN ? ((/class="([^"]*)"/.exec(bN.open) || [])[1] || '').split(/\s+/).filter(Boolean) : [];
  stN = bN ? ((/style="([^"]*)"/.exec(bN.open) || [])[1] || '') + ';' + clsN.map(function (k) { const h = new RegExp('\\.' + k.replace(/-/g, '\\-') + '\\s*\\{([^}]*)\\}').exec(SHELL_CSS); return h ? h[1] : ''; }).join(';') : '';
  return (!!bN && /border(-color)?\s*:[^;]*currentColor/.test(stN) && /background(-color)?\s*:\s*transparent/.test(stN) && /border-radius\s*:/.test(stN)) ? true : 'the innermost box holding both: ' + short(bN && bN.open);
}, test.limit.quick);
test.run('with none: the list stands outside the bubble', 0.2, function () {
  return (!!bN && bN.part.indexOf('id="' + preN + 'list"') === -1) ? true : 'the bubble holds the list';
}, test.limit.quick);
test.run('with none: its search row is 🔎, the input, then the search button', 0.2, function () {
  return (!!bN && bN.part.indexOf('id="' + preN + 'text"') < bN.part.indexOf('id="' + preN + 'search"')) ? true : 'bubble: ' + short(bN && bN.part);
}, test.limit.quick);
test.run('in a dropdown\'s pane: the filters and the search row stand in one bubble, transparent, its border the type-face\'s colour', 0.2, function () {
  // in a dropdown's pane
  bD = bubbleOf(c4c);
  preD = c4c.pre();
  clsD = bD ? ((/class="([^"]*)"/.exec(bD.open) || [])[1] || '').split(/\s+/).filter(Boolean) : [];
  stD = bD ? ((/style="([^"]*)"/.exec(bD.open) || [])[1] || '') + ';' + clsD.map(function (k) { const h = new RegExp('\\.' + k.replace(/-/g, '\\-') + '\\s*\\{([^}]*)\\}').exec(SHELL_CSS); return h ? h[1] : ''; }).join(';') : '';
  return (!!bD && /border(-color)?\s*:[^;]*currentColor/.test(stD) && /background(-color)?\s*:\s*transparent/.test(stD) && /border-radius\s*:/.test(stD)) ? true : 'the innermost box holding both: ' + short(bD && bD.open);
}, test.limit.quick);
test.run('in a dropdown\'s pane: the list stands outside the bubble', 0.2, function () {
  return (!!bD && bD.part.indexOf('id="' + preD + 'list"') === -1) ? true : 'the bubble holds the list';
}, test.limit.quick);
test.run('in a dropdown\'s pane: its search row is 🔎, the input, then the search button', 0.2, function () {
  return (!!bD && bD.part.indexOf('id="' + preD + 'text"') < bD.part.indexOf('id="' + preD + 'search"')) ? true : 'bubble: ' + short(bD && bD.part);
}, test.limit.quick);
test.run('with no filters there is no filter row in the bubble', 0.2, function () {
  return (seen(c4b.get('filters').innerHTML) === '' && !/🗜/.test(seen(c4b.innerHTML))) ? true : 'filters: ' + short(c4b.get('filters').innerHTML);
}, test.limit.quick);
const selEl = function () { const heard = {}; return { tagName: 'SPAN', value: '', heard: heard,
  addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); }, removeEventListener: function () {},
  fire: function (t) { (heard[t] || []).forEach(function (fn) { fn({ type: t, target: this }); }, this); } }; };
const hostOf = function (e) { return e && e.parentNode && typeof e.parentNode.id === 'string' ? e.parentNode.id : ''; };
const at = function (id) { return id ? h11.indexOf('id="' + id + '"') : -1; };
test.run('each selector it is handed is mounted in the search', 0.2, async function () {
  L4.destroy();
  // create: the 🪣 row of selectors, on top of the bubble (goal/G41.26)
  // Andy, on G41.26: "so the client probabilitySearch needs to provide a selectorRow, on top of the filter row. the
  // selectorRow must start with a\n🪣icon, and be hidden, if no selectors are present.", "any searchSelector in our
  // system must go into the probabilitySearch's selectorRow, so that the user-can see, which elements belong to the
  // search.", and "do it for all probabilitySearch object in the new face-shell. go." The shape (cw, on G41.26, under
  // that go): selectors [{ name, element, test(row) }], each element a selector its mounter made, mounted in the 🪣 row;
  // its change redraws the list and its test narrows it; a pick narrows the rows already fetched.
  s1 = selEl();
  s2 = selEl();
  c11 = container();
  A11 = source('s');
  PS.create(c11, { search: A11.search, server: 's', verb: 'v', columns: [{ field: 'name' }],
    rows: function () { return [{ key: 'a', name: 'a', who: 'ann', kind: 'x' }, { key: 'b', name: 'b', who: 'bob', kind: 'y' }]; },
    selectors: [{ name: 'who', element: s1, test: function (row) { return !s1.value || row.who === s1.value ? 1 : 0; } },
      { name: 'kind', element: s2, test: function (row) { return !s2.value || row.kind === s2.value ? 1 : 0; } }],
    filters: [{ name: 'mine', toggle: true, word: 'Mine', test: function () { return 1; } }] });
  await tick();
  p11 = c11.pre();
  h11 = c11.innerHTML;
  // Each mounted in a box of the search's own markup (a slot each, or one row: the search's choice).
  return (!!hostOf(s1) && !!hostOf(s2) && at(hostOf(s1)) !== -1 && at(hostOf(s2)) !== -1) ? true : 'mounted in: ' + short([hostOf(s1), hostOf(s2)]);
}, test.limit.quick);
test.run('in the order they are handed', 0.2, function () {
  return (at(hostOf(s1)) !== -1 && (hostOf(s1) === hostOf(s2) ? (c11.nodes[hostOf(s1)].kids || []).indexOf(s1) < (c11.nodes[hostOf(s1)].kids || []).indexOf(s2) : at(hostOf(s1)) < at(hostOf(s2)))) ? true : 'at ' + short([at(hostOf(s1)), at(hostOf(s2))]);
}, test.limit.quick);
test.run('the 🪣 row stands in the bubble', 0.2, function () {
  b11 = bubbleOf(c11);
  return (!!b11 && b11.part.indexOf('id="' + hostOf(s1) + '"') !== -1 && b11.part.indexOf('id="' + hostOf(s2) + '"') !== -1) ? true : 'bubble: ' + short(b11 && b11.open);
}, test.limit.quick);
test.run('on top of the bubble: the 🪣 row, then the 🗜 row, then the 🔎 row', 0.2, function () {
  return (at(hostOf(s1)) !== -1 && at(hostOf(s2)) < at(p11 + 'filters') && at(hostOf(s1)) < at(p11 + 'filters') && at(p11 + 'filters') < at(p11 + 'text')) ? true : 'at ' + short([at(hostOf(s1)), at(p11 + 'filters'), at(p11 + 'text')]);
}, test.limit.quick);
test.run('its row starts with 🪣, before its selectors', 0.2, function () {
  u11 = upToInput(c11);
  return (u11 === '🪣🗜Mine🔎') ? true : 'seen up to the input: ' + JSON.stringify(u11);
}, test.limit.quick);
test.run('no selector picked: every row', 0.2, function () {
  return (c11.shown().join() === 'a,b') ? true : 'shown: ' + c11.shown();
}, test.limit.quick);
test.run('a selector\'s change redraws the list, its test narrowing it', 0.2, function () {
  asked11 = A11.calls.length;
  s1.value = 'bob';
  s1.fire('change');
  return (c11.shown().join() === 'b') ? true : 'shown: ' + c11.shown();
}, test.limit.quick);
test.run('and narrows the rows already fetched, asking nothing', 0.2, function () {
  return (A11.calls.length === asked11) ? true : 'calls: ' + (A11.calls.length - asked11);
}, test.limit.quick);
test.run('every selector\'s test counts', 0.2, function () {
  s2.value = 'x';
  s2.fire('change');
  return (c11.shown().join() === '') ? true : 'shown: ' + c11.shown();
}, test.limit.quick);
test.run('and a selector cleared lets its rows back', 0.2, function () {
  s1.value = '';
  s1.fire('change');
  return (c11.shown().join() === 'a') ? true : 'shown: ' + c11.shown();
}, test.limit.quick);
test.run('with no selectors there is no 🪣 row', 0.2, function () {
  return (!/🪣/.test(seen(c4.innerHTML)) && !/🪣/.test(seen(c4b.innerHTML))) ? true : 'seen: ' + short(seen(c4.innerHTML));
}, test.limit.quick);
test.run('a dropdown\'s pane alike: 🪣 and its selector, no filter row, then 🔎', 0.2, async function () {
  c12 = container();
  s3 = selEl();
  PS.create(c12, { face: 'dropdown', placeholder: 'pick', columns: [{ field: 'name' }], rows: function () { return [{ key: 'a', name: 'a' }]; },
    selectors: [{ name: 'who', element: s3, test: function () { return 1; } }] });
  await tick();
  u12 = upToInput(c12);
  return (!!hostOf(s3) && u12 !== null && /^[^🪣🔎]*🪣🔎$/u.test(u12)) ? true : 'seen up to the input: ' + JSON.stringify(u12) + ', mounted in ' + short(hostOf(s3));
}, test.limit.quick);
test.run('a press fold claims opens nothing and picks nothing, the row current', 0.2, function () {
  // create: details in a pane, and fold
  c5 = container();
  det = [];
  pk5 = [];
  folding = true;
  PS.create(c5, { rows: function () { return [{ key: 'a', name: 'a' }]; }, columns: [{ field: 'name' }],
    fold: function () { return folding; }, details: function (row, key, el) { det.push([row, key, el]); }, pick: function (row, key) { pk5.push(key); } });
  c5.fire('click', { target: rowTarget('a') });
  return (det.length === 0 && pk5.length === 0 && c5.current() === 'a') ? true : 'det ' + det.length + ' pk ' + pk5.length;
}, test.limit.quick);
test.run('with details a press opens details(row, key, el) and picks nothing', 0.2, function () {
  folding = false;
  c5.fire('click', { target: rowTarget('a') });
  return (det.length === 1 && det[0][1] === 'a' && det[0][0].name === 'a' && det[0][2] === null && pk5.length === 0) ? true : 'det: ' + JSON.stringify(det);
}, test.limit.quick);
test.run('a row\'s element is made once per key', 0.2, function () {
  // create: rows drawn by elements
  c6 = container();
  made = 0;
  destroyed = 0;
  page6 = [{ key: 'a', name: 'ann' }];
  L6 = PS.create(c6, { rows: function () { return page6; }, columns: [{ field: 'name' }],
    element: function (row, key) { made += 1; return { key: key, row: Object.assign({}, row), apply: function (r) { Object.assign(this.row, r); }, mount: function () {}, destroy: function () { destroyed += 1; } }; } });
  L6.redraw();
  L6.redraw();
  return (made === 1) ? true : 'made ' + made;
}, test.limit.quick);
test.run('a row with an element leaves its cells to the element', 0.2, function () {
  return (!/ann/.test(c6.get('list').innerHTML) && c6.shown().join() === 'a') ? true : 'list: ' + c6.get('list').innerHTML;
}, test.limit.quick);
test.run('a page row\'s new values reach the element it already has', 0.2, function () {
  page6 = [{ key: 'a', name: 'anne' }];
  L6.redraw();
  return (made === 1) ? true : 'made ' + made;
}, test.limit.quick);
test.run('destroy destroys every element', 0.2, function () {
  L6.destroy();
  return (destroyed === 1) ? true : 'destroyed ' + destroyed;
}, test.limit.quick);
test.run('with data its rows are the branch\'s, drawn at once', 0.2, function () {
  // create: a view of the data layer
  watched = [];
  seatedIn = [];
  unwatched = 0;
  window.spirit.data = { rowsOf: function (type) { return type === 'people' ? [{ key: 'p1', name: 'pia' }] : []; },
    seatRows: function (type, items) { seatedIn.push([type, items]); },
    watchPath: function (type, fn) { watched.push([type, fn]); return function () { unwatched += 1; }; } };
  c7 = container();
  A7 = source('s');
  A7.answer = { status: 200, body: { ok: true, items: [{ key: 'p2', label: '{"name":"per"}' }] } };
  L7 = PS.create(c7, { search: A7.search, server: 's', verb: 'v', data: 'people', columns: [{ field: 'name' }] });
  return (c7.shown().join() === 'p1') ? true : 'shown: ' + c7.shown();
}, test.limit.quick);
test.run('it watches its branch', 0.2, function () {
  return (watched.length === 1 && watched[0][0] === 'people') ? true : 'watched: ' + watched.length;
}, test.limit.quick);
test.run('an answer is seated into the branch, not into the list\'s own cache', 0.2, async function () {
  c7.type('pe');
  await tick();
  await tick();
  return (seatedIn.length === 1 && seatedIn[0][0] === 'people' && seatedIn[0][1][0].key === 'p2' && c7.shown().indexOf('p2') === -1) ? true : 'seated: ' + JSON.stringify(seatedIn);
}, test.limit.quick);
test.run('a write to the branch redraws the list', 0.2, function () {
  window.spirit.data.rowsOf = function () { return [{ key: 'p1', name: 'pia' }, { key: 'p2', name: 'per' }]; };
  watched[0][1]('people/p2', {});
  return (c7.shown().length === 2) ? true : 'shown: ' + c7.shown();
}, test.limit.quick);
test.run('destroy drops the watch', 0.2, function () {
  L7.destroy();
  return (unwatched === 1) ? true : 'unwatched ' + unwatched;
}, test.limit.quick);
test.run('a dropdown starts shut, its list not drawn', 0.2, function () {
  delete window.spirit.data;
  // create: the dropdown
  c8 = container();
  pk8 = [];
  heard0 = docHeard.length;
  L8 = PS.create(c8, { face: 'dropdown', placeholder: 'pick one', all: 'everyone', columns: [{ field: 'name' }],
    rows: function () { return [{ key: 'a', name: 'ann' }, { key: 'b', name: 'bo' }]; }, name: function (row) { return 'N:' + row.name; },
    details: function () { throw new Error('a dropdown opens no details'); }, pick: function (row, key) { pk8.push([row, key]); } });
  return (c8.get('popup').hidden === true && c8.get('list').innerHTML === '') ? true : 'popup hidden ' + c8.get('popup').hidden;
}, test.limit.quick);
test.run('the field shows the all words while nothing is chosen', 0.2, function () {
  return (/everyone/.test(c8.get('field').innerHTML)) ? true : 'field: ' + c8.get('field').innerHTML;
}, test.limit.quick);
test.run('it listens for a press elsewhere', 0.2, function () {
  return (docHeard.length === heard0 + 1) ? true : 'document listeners: ' + docHeard.length;
}, test.limit.quick);
test.run('a press on the field opens it, drawn, the search focused', 0.2, function () {
  c8.fire('click', { target: c8.get('field') });
  return (c8.get('popup').hidden === false && c8.shown().join() === 'a,b' && c8.get('text').focused === 1) ? true : 'open: ' + c8.get('popup').hidden + ' ' + c8.shown();
}, test.limit.quick);
test.run('all adds a None button', 0.2, function () {
  return (/id="[^"]*none"/.test(c8.get('list').innerHTML)) ? true : 'no None button';
}, test.limit.quick);
test.run('a press picks the row, details never asked', 0.2, function () {
  c8.fire('click', { target: rowTarget('b') });
  return (pk8.length === 1 && pk8[0][1] === 'b' && L8.value === 'b') ? true : 'picks: ' + JSON.stringify(pk8);
}, test.limit.quick);
test.run('a pick shuts it and the field shows the row\'s name', 0.2, function () {
  return (c8.get('popup').hidden === true && /N:bo/.test(c8.get('field').innerHTML)) ? true : 'field: ' + c8.get('field').innerHTML;
}, test.limit.quick);
test.run('Escape shuts it', 0.2, function () {
  c8.fire('click', { target: c8.get('field') });
  c8.key('Escape');
  return (c8.get('popup').hidden === true) ? true : 'still open after Escape';
}, test.limit.quick);
test.run('a press elsewhere shuts it', 0.2, function () {
  c8.fire('click', { target: c8.get('field') });
  docHeard[docHeard.length - 1]({ target: { inside: false } });
  return (c8.get('popup').hidden === true) ? true : 'still open after a press elsewhere';
}, test.limit.quick);
test.run('a press on something drawn away is not elsewhere', 0.2, function () {
  c8.fire('click', { target: c8.get('field') });
  docHeard[docHeard.length - 1]({ target: { inside: false, isConnected: false } });
  return (c8.get('popup').hidden === false) ? true : 'shut by a detached target';
}, test.limit.quick);
test.run('None picks nothing', 0.2, function () {
  c8.fire('click', { target: { id: c8.pre() + 'none', inside: true, closest: function () { return null; }, getAttribute: function () { return null; } } });
  return (pk8.length === 2 && pk8[1][0] === null && pk8[1][1] === '' && L8.value === '' && L8.row === null) ? true : 'picks: ' + JSON.stringify(pk8[1]);
}, test.limit.quick);
test.run('with nothing chosen the field says the all words again', 0.2, function () {
  return (/everyone/.test(c8.get('field').innerHTML)) ? true : 'field: ' + c8.get('field').innerHTML;
}, test.limit.quick);
test.run('the keys open it and the field says the current row', 0.2, function () {
  c8.key('ArrowDown');
  return (c8.get('popup').hidden === false && /N:ann/.test(c8.get('field').innerHTML)) ? true : 'field: ' + c8.get('field').innerHTML;
}, test.limit.quick);
test.run('destroy stops listening for a press elsewhere', 0.2, function () {
  L8.destroy();
  return (docHeard.length === heard0 && docRemoved === 1) ? true : 'document listeners: ' + docHeard.length;
}, test.limit.quick);
test.run('without all the field shows the placeholder', 0.2, function () {
  c9 = container();
  PS.create(c9, { face: 'dropdown', placeholder: 'pick one' });
  return (/pick one/.test(c9.get('field').innerHTML)) ? true : 'field: ' + c9.get('field').innerHTML;
}, test.limit.quick);
test.run('it requires probabilityStringMatch.js, probabilityStringObjectMatch.js and probabilityBucket.js', 0.2, async function () {
  // it loads the spirit's probability files itself (rule/26; goal/G41.18)
  // Found by the shell's general rules on a bare page (spirit/test/spirit-sibling-generalRules.js): the Apps and Grants
  // lists threw "createProbabilityBucket is not a function", since only boot loaded these files. rule/26: every element
  // loads its own parts via spirit.require; nothing is preloaded. This loader answers in the reverse of the order it was
  // asked, as a page's fetches may: whatever order the files land in, the list must work once they are in.
  asked10 = [];
  global.window = { spirit: { element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  wait = 60;
  global.window.spirit.require = function (p) {
    const rel = String(p).replace(/^\/+/, '');
    asked10.push(rel);
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
  NEED = ['spirit/probabilityStringMatch.js', 'spirit/probabilityStringObjectMatch.js', 'spirit/probabilityBucket.js'];
  return (NEED.every(function (n) { return asked10.indexOf(n) !== -1; })) ? true : 'asked10: ' + JSON.stringify(asked10);
}, test.limit.quick);
test.run('once loaded, with nothing preloaded, it draws and ranks: typing ze puts zed first', 0.2, function () {
  P2 = window.spirit.element.spirit.element.search;
  made10 = null;
  threw = null;
  c10 = container();
  try {
    made10 = P2.create(c10, { search: source('srv').search, server: 'srv', verb: 'search', rows: function () { return [{ key: 'b', name: 'bert' }, { key: 'z', name: 'zed' }]; },
      columns: [{ field: 'name', label: 'Name', sort: 'text' }], args: function (t) { return { q: t }; } });
    c10.type('ze');
  } catch (e) { threw = e && e.message; }
  return (!threw && made10 && c10.shown()[0] === 'z') ? true : 'threw ' + JSON.stringify(threw) + ', shown ' + (made10 ? c10.shown() : '');
}, test.limit.quick);

// The parts that were once files of their own (search-bubble.js, search-folder.js, search-popup.js, search-tiles.js): one
// test file per script (spirit/run/spirit/test/TEST_SYSTEM.md), each part a section of it, its tests run after these, in
// this order. Each registers its tests as it is called, before its first await.
bubblePart();
folderPart();
popupPart();
tilesPart();
keptPart();

// THE SEARCH KEEPS ITS ROWS (goal/G47.1, the cycle "the search keeps its rows", the box: "The search element
// (spirit/element/search.js) never redraws its list. Each row is made once and kept in the table: a new record adds its one
// row at its place; a changed record repaints its own row; a filter or a selector hides and shows rows; a sort or new words
// move them", "It is the shared search element, so every search in the face gets it"; Andy: "WHY THE FUCK WOULD WOULDN't
// you just sort the row elements? and make them invisible/visible? Do you redraw the fucking list every time a new record
// arrives????"). In a real Chrome on a scratch node: a list of five rows, each row's <tr> marked by the page as it is first
// drawn; then a new record, a changed record, a filter, a selector, a sort and typed words, each judged by the marks: the
// rows that were there are the same elements, none taken out of the page.
async function keptPart() {
  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..', '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { scratchNode, chromePage, findChrome, until, sleep } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

  let node, chrome, made = '';
  const NOWORLD = 'no list: the world failed';
  const ok = function () { return made === 'made'; };
  const ev = function (js) { return chrome.evaluate('(function () { var K = window.__k; ' + js + ' }())'); };
  // THE PAGE'S HANDS (window.__k): the list's rows are tr[data-key] outside the selector row; marks() names each one's mark,
  // marking a row first seen; shown() the keys of the rows that show, top down; same(keys) whether each of those keys' row
  // is the element first marked for it, still in the page; text(key) a row's text.
  const HANDS = '' +
    'var K = window.__k = { rows: [], marked: {}, n: 0, removed: [] }; ' +
    'K.box = document.getElementById("zzKept"); ' +
    'K.trs = function () { return Array.prototype.slice.call(K.box.querySelectorAll("tr[data-key]")).filter(function (r) { return !(r.closest && r.closest("[id$=\\"selectors\\"]")); }); }; ' +
    'K.seen = function (e) { return !!e && e.isConnected && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none" && !e.hidden; }; ' +
    'K.mark = function () { K.trs().forEach(function (r) { var k = r.getAttribute("data-key"); if (!K.marked[k]) { K.n += 1; r.__mark = K.n; K.marked[k] = r; } }); }; ' +
    'K.shown = function () { return K.trs().filter(K.seen).map(function (r) { return r.getAttribute("data-key"); }); }; ' +
    'K.same = function (keys) { return keys.filter(function (k) { var now = K.trs().filter(function (r) { return r.getAttribute("data-key") === k; })[0]; return !now || now !== K.marked[k] || !K.marked[k].isConnected; }); }; ' +
    'K.text = function (k) { var r = K.trs().filter(function (r) { return r.getAttribute("data-key") === k; })[0]; return r ? String(r.innerText || "").trim() : null; }; ' +
    'K.press = function (v) { var b = Array.prototype.slice.call(K.box.querySelectorAll("button[data-filter][data-value]")).filter(function (x) { return x.getAttribute("data-value") === v; })[0]; if (!b) return false; b.click(); return true; }; ' +
    'K.sort = function (field) { var h = K.box.querySelector("th[data-sort=\\"" + field + "\\"]"); if (!h) return false; h.click(); return true; }; ' +
    'K.type = function (w) { var t = Array.prototype.slice.call(K.box.querySelectorAll("input[id$=\\"text\\"]")).filter(function (x) { return !(x.closest && x.closest("[id$=\\"selectors\\"]")); })[0]; if (!t) return false; t.value = w; t.dispatchEvent(new Event("input", { bubbles: true })); return true; }; ' +
    'K.pickWho = function (v) { K.who.value = v; K.who.dispatchEvent(new Event("change", { bubbles: true })); }; ' +
    'K.table = function () { return K.box.querySelector("[id$=\\"list\\"] table") || K.box.querySelector("table"); }; ' +
    // What the list takes out of the page: a row element removed and never put back.
    'K.watch = function () { new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.removedNodes, function (x) { if (x.nodeType === 1) K.removed.push(x); }); }); }).observe(K.box, { childList: true, subtree: true }); }; ' +
    'K.gone = function () { return K.removed.filter(function (x) { return !x.isConnected && (x.matches && (x.matches("tr[data-key], table, tbody") || x.querySelector("tr[data-key]"))); }).length; }; ' +
    '"hands"';
  const FIVE = [{ key: 'a', name: 'ann', who: 'x', kind: 'red', n: 5 }, { key: 'b', name: 'bob', who: 'y', kind: 'green', n: 4 },
    { key: 'd', name: 'dan', who: 'x', kind: 'red', n: 3 }, { key: 'e', name: 'eve', who: 'y', kind: 'green', n: 2 }, { key: 'f', name: 'fay', who: 'x', kind: 'red', n: 1 }];
  const FIVE_KEYS = FIVE.map(function (r) { return r.key; });

  test.run('the world: a scratch node and a Chrome page for the kept rows', 0.2, async function () {
    node = await scratchNode();
    chrome = await chromePage(findChrome());
    return (node.up && !chrome.error) ? true : 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  }, test.limit.slow);
  test.run('the world: a list of five rows, with a filter, a selector, two sortable columns and a search field; each row marked', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search.js"); }).then(function () { ' +
      'var b = document.createElement("div"); b.id = "zzKept"; b.style.cssText = "position:absolute;left:0;top:0;width:900px;height:700px;display:flex;flex-direction:column"; document.body.appendChild(b); ' +
      HANDS + '; ' +
      'K.rows = ' + JSON.stringify(FIVE) + '; ' +
      'K.who = document.createElement("span"); K.who.value = ""; ' +
      'K.list = spirit.element.spirit.element.search.create(b, { rows: function () { return K.rows; }, columns: [{ field: "name", label: "Name", sort: "text" }, { field: "n", label: "N", sort: "number" }], ' +
      '  filters: [{ name: "kind", multi: true, keepOne: true, choices: [{ value: "red", word: "red" }, { value: "green", word: "green" }], test: function (row, off) { var o = off || {}; return row && !o[row.kind] ? 1 : 0; } }], ' +
      '  selectors: [{ name: "who", element: K.who, test: function (row) { return !K.who.value || row.who === K.who.value ? 1 : 0; } }] }); ' +
      'return new Promise(function (r) { setTimeout(r, 300); }).then(function () { K.mark(); K.watch(); K.firstTable = K.table(); return K.trs().length === 5 ? "made" : "rows drawn: " + K.trs().length; }); }, function (e) { return String(e); })');
    return ok() || 'nothing made: ' + short(made);
  }, test.limit.slow);

  // the box: "a sort or new words move them"
  test.run('a sort moves the rows: sorted by name, the same five row elements, in the order of their names', 0.2, async function () {
    if (!ok()) return NOWORLD;
    if (!(await ev('return K.sort("name");'))) return 'no header for name to press';
    await sleep(300);
    const shown = await ev('return K.shown();');
    const notSame = await ev('return K.same(' + JSON.stringify(FIVE_KEYS) + ');');
    const order = shown.slice().sort(function (x, y) { return FIVE_KEYS.indexOf(x) - FIVE_KEYS.indexOf(y); });
    return (!notSame.length && shown.length === 5 && (JSON.stringify(shown) === JSON.stringify(order) || JSON.stringify(shown) === JSON.stringify(order.slice().reverse()))) || 'shown ' + short(shown) + '; rows that are not the elements first drawn: ' + short(notSame);
  }, test.limit.slow);
  test.run('a sort the other way moves them back: the same five row elements, reversed', 0.2, async function () {
    if (!ok()) return NOWORLD;
    const before = await ev('return K.shown();');
    await ev('return K.sort("name");');
    await sleep(300);
    const shown = await ev('return K.shown();');
    const notSame = await ev('return K.same(' + JSON.stringify(FIVE_KEYS) + ');');
    return (!notSame.length && JSON.stringify(shown) === JSON.stringify(before.slice().reverse())) || 'before ' + short(before) + ', after ' + short(shown) + '; not the elements first drawn: ' + short(notSame);
  }, test.limit.slow);
  test.run('the world: sorted by name, a to f', 0.2, async function () {
    if (!ok()) return NOWORLD;
    for (let i = 0; i < 2; i++) { const s = await ev('return K.shown();'); if (s[0] === 'a') return true; await ev('return K.sort("name");'); await sleep(300); }
    return 'shown ' + short(await ev('return K.shown();'));
  }, test.limit.slow);

  // the box: "a new record adds its one row at its place"
  test.run('a new record adds its one row: the five row elements already drawn stay the same', 0.2, async function () {
    if (!ok()) return NOWORLD;
    await ev('K.rows = K.rows.concat([{ key: "c", name: "cat", who: "y", kind: "green", n: 9 }]); K.list.redraw(); return true;');
    await sleep(300);
    const notSame = await ev('return K.same(' + JSON.stringify(FIVE_KEYS) + ');');
    return !notSame.length || 'after a new record, rows that are not the elements first drawn: ' + short(notSame);
  }, test.limit.slow);
  test.run('the new record\'s row shows at its place: cat between bob and dan', 0.2, async function () {
    if (!ok()) return NOWORLD;
    const shown = await ev('return K.shown();');
    return JSON.stringify(shown) === JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']) || 'shown ' + short(shown);
  }, test.limit.quick);
  test.run('the world: the new row marked', 0.2, async function () {
    if (!ok()) return NOWORLD;
    await ev('K.mark(); return true;');
    return true;
  }, test.limit.quick);

  // the box: "a changed record repaints its own row"
  test.run('a changed record repaints its own row: its new text, the same element', 0.2, async function () {
    if (!ok()) return NOWORLD;
    await ev('K.rows = K.rows.map(function (r) { return r.key === "d" ? Object.assign({}, r, { n: 33 }) : r; }); K.list.redraw(); return true;');
    await sleep(300);
    const t = await ev('return K.text("d");');
    const notSame = await ev('return K.same(["d"]);');
    return (/33/.test(String(t)) && !notSame.length) || 'its text ' + short(t) + ', the same element: ' + !notSame.length;
  }, test.limit.slow);
  test.run('a changed record leaves every other row element the same', 0.2, async function () {
    if (!ok()) return NOWORLD;
    const notSame = await ev('return K.same(["a", "b", "c", "e", "f"]);');
    return !notSame.length || 'not the elements first drawn: ' + short(notSame);
  }, test.limit.quick);

  // the box: "a filter or a selector hides and shows rows"
  test.run('a filter hides rows: green off, the green rows hidden, the red ones show', 0.2, async function () {
    if (!ok()) return NOWORLD;
    if (!(await ev('return K.press("green");'))) return 'no green filter to press';
    await sleep(300);
    const shown = await ev('return K.shown();');
    return JSON.stringify(shown) === JSON.stringify(['a', 'd', 'f']) || 'shown ' + short(shown);
  }, test.limit.slow);
  test.run('a filter hides rows, it does not take them out: the six row elements are the same, the hidden ones still in the page', 0.2, async function () {
    if (!ok()) return NOWORLD;
    const notSame = await ev('return K.same(["a", "b", "c", "d", "e", "f"]);');
    return !notSame.length || 'not the elements first drawn, or out of the page: ' + short(notSame);
  }, test.limit.quick);
  test.run('the filter turned back, the same row elements show again, in their place', 0.2, async function () {
    if (!ok()) return NOWORLD;
    await ev('return K.press("green");');
    await sleep(300);
    const shown = await ev('return K.shown();');
    const notSame = await ev('return K.same(["a", "b", "c", "d", "e", "f"]);');
    return (JSON.stringify(shown) === JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']) && !notSame.length) || 'shown ' + short(shown) + '; not the same: ' + short(notSame);
  }, test.limit.slow);
  test.run('a selector hides rows: y chosen, only y\'s rows show, every row element the same', 0.2, async function () {
    if (!ok()) return NOWORLD;
    await ev('K.pickWho("y"); return true;');
    await sleep(300);
    const shown = await ev('return K.shown();');
    const notSame = await ev('return K.same(["a", "b", "c", "d", "e", "f"]);');
    return (JSON.stringify(shown) === JSON.stringify(['b', 'c', 'e']) && !notSame.length) || 'shown ' + short(shown) + '; not the same: ' + short(notSame);
  }, test.limit.slow);
  test.run('the selector unselected, every row shows again, the same row elements', 0.2, async function () {
    if (!ok()) return NOWORLD;
    await ev('K.pickWho(""); return true;');
    await sleep(300);
    const shown = await ev('return K.shown();');
    const notSame = await ev('return K.same(["a", "b", "c", "d", "e", "f"]);');
    return (JSON.stringify(shown) === JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']) && !notSame.length) || 'shown ' + short(shown) + '; not the same: ' + short(notSame);
  }, test.limit.slow);

  // the box: "a sort or new words move them"
  test.run('new words move the rows: "eve" typed, eve\'s row shows first, the same element', 0.2, async function () {
    if (!ok()) return NOWORLD;
    if (!(await ev('return K.type("eve");'))) return 'no search field to type in';
    await sleep(600);
    const shown = await ev('return K.shown();');
    const notSame = await ev('return K.same(["e"]);');
    return (shown[0] === 'e' && !notSame.length) || 'shown ' + short(shown) + '; eve\'s row the same element: ' + !notSame.length;
  }, test.limit.slow);
  test.run('with words typed, every row element kept is the same', 0.2, async function () {
    if (!ok()) return NOWORLD;
    const notSame = await ev('return K.same(K.shown());');
    return !notSame.length || 'not the elements first drawn: ' + short(notSame);
  }, test.limit.quick);
  test.run('the words cleared, the rows move back to their order, the same elements', 0.2, async function () {
    if (!ok()) return NOWORLD;
    await ev('return K.type("");');
    await sleep(600);
    const shown = await ev('return K.shown();');
    const notSame = await ev('return K.same(["a", "b", "c", "d", "e", "f"]);');
    return (JSON.stringify(shown) === JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f']) && !notSame.length) || 'shown ' + short(shown) + '; not the same: ' + short(notSame);
  }, test.limit.slow);

  // the box: "never redraws its list"
  test.run('in all of this the list never redrew: its table is the one first drawn', 0.2, async function () {
    if (!ok()) return NOWORLD;
    return (await ev('return K.table() === K.firstTable && !!K.firstTable && K.firstTable.isConnected;')) || 'the table is not the one first drawn';
  }, test.limit.quick);
  test.run('in all of this no row element, no table was taken out of the page', 0.2, async function () {
    if (!ok()) return NOWORLD;
    const n = await ev('return K.gone();');
    return n === 0 || n + ' row elements or tables taken out and not put back';
  }, test.limit.quick);

  test.after(function () {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node && node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  });
}

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

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  const same = function (a, b) { return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 0.5; };

  const ADDRESS = '/DEBUG/spirit/element/test/search-bubble-laid.html';
  // What the tests make, shared by the tests after them.
  let chrome, node, page, s, m, rPane, rDrop;
  test.run('the world: Chrome is on this machine', 0.2, function () {
    // search-bubble: probabilitySearch.js in a browser: the bubble's rows aligned
    chrome = H.findChrome();
    return (!!chrome) ? true : 'no Chrome on this machine: SPIRIT_CHROME names none, and none is found by its name';
  }, test.limit.quick);
  test.run('the world: a scratch node comes up with its DEBUG on', 0.2, async function () {
    if (!chrome) return 'no Chrome: the world failed';
    node = await H.scratchNode();
    page = null;
    return (node.up && node.debug) ? true : 'the scratch node did not come up with its DEBUG on';
  }, test.limit.slow);
  test.run('the world: a Chrome page opens on it', 0.2, async function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    page = await H.chromePage(chrome);
    return (!page.error) ? true : page.error;
  }, test.limit.quick);
  test.run('the world: the page lays out a pane and a dropdown', 0.2, async function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    await page.send('Page.navigate', { url: node.base + ADDRESS });
    await H.until(function () { return page.evaluate('typeof window.laid === "function" && !!window.spirit').then(Boolean); }, H.WAIT);
    s = await page.evaluate('window.laid()').catch(function () { return ''; });
    m = null;
    try { m = JSON.parse(s); } catch (e) { m = null; }
    return (!!m && !!m.made) ? true : 'the page measured nothing: ' + JSON.stringify(s).slice(0, 300);
  }, test.limit.slow);
  test.run('its 🗜 and 🔎 are the icon element (spirit/element/icon.js)', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    // Andy, on G41.26: "why do the icons in the probabilitySearch row have different width's? do they not use the icon
    // element? I'd like it, if the controls in the search bubble look better aligned."
    // a pane
    rPane = m.pane || {};
    return (/\bshell-icon\b/.test(rPane.filterIconClass) && /\bshell-icon\b/.test(rPane.searchIconClass)) ? true : 'classes: ' + short([rPane.filterIconClass, rPane.searchIconClass]);
  }, test.limit.quick);
  test.run('each icon is a square of its font size, whatever its glyph', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    // The icon element is a square of 1em whatever its glyph, so no glyph's own width moves what follows it: here a
    // bare glyph is 20px wide at 16px, where a browser on another machine draws each glyph its own width.
    return (!!rPane.filterIcon && !!rPane.searchIcon && same(rPane.filterIcon.w, rPane.filterIconSize) && same(rPane.searchIcon.w, rPane.searchIconSize)) ? true : 'icons: ' + short([rPane.filterIcon, rPane.filterIconSize, rPane.searchIcon, rPane.searchIconSize]);
  }, test.limit.quick);
  test.run('the two icons are as wide and stand one under the other', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    return (!!rPane.filterIcon && !!rPane.searchIcon && same(rPane.filterIcon.w, rPane.searchIcon.w) && same(rPane.filterIcon.left, rPane.searchIcon.left)) ? true : 'icons: ' + short([rPane.filterIcon, rPane.searchIcon]);
  }, test.limit.quick);
  test.run('its 🪣 is the icon element too, a square of its font size, over the 🗜', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    // And the 🪣 row of selectors on top (goal/G41.26: "the selectorRow must start with a\n🪣icon").
    return (/\bshell-icon\b/.test(rPane.bucketIconClass) && !!rPane.bucketIcon && same(rPane.bucketIcon.w, rPane.bucketIconSize) && !!rPane.filterIcon && same(rPane.bucketIcon.left, rPane.filterIcon.left)) ? true : 'bucket: ' + short([rPane.bucketIconClass, rPane.bucketIcon, rPane.bucketIconSize]);
  }, test.limit.quick);
  test.run('the first selector starts where the search input does', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    return (!!rPane.firstSelector && !!rPane.input && same(rPane.firstSelector.left, rPane.input.left)) ? true : 'first selector ' + short(rPane.firstSelector) + ', input ' + short(rPane.input);
  }, test.limit.quick);
  test.run('each row\'s first control starts at the same place: the first filter over the search input', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    return (!!rPane.firstFilter && !!rPane.input && same(rPane.firstFilter.left, rPane.input.left)) ? true : 'first filter ' + short(rPane.firstFilter) + ', input ' + short(rPane.input);
  }, test.limit.quick);
  test.run('a dropdown: its 🗜 and 🔎 are the icon element (spirit/element/icon.js)', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    // a dropdown
    rDrop = m.dropdown || {};
    return (/\bshell-icon\b/.test(rDrop.filterIconClass) && /\bshell-icon\b/.test(rDrop.searchIconClass)) ? true : 'classes: ' + short([rDrop.filterIconClass, rDrop.searchIconClass]);
  }, test.limit.quick);
  test.run('a dropdown: each icon is a square of its font size, whatever its glyph', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    // The icon element is a square of 1em whatever its glyph, so no glyph's own width moves what follows it: here a
    // bare glyph is 20px wide at 16px, where a browser on another machine draws each glyph its own width.
    return (!!rDrop.filterIcon && !!rDrop.searchIcon && same(rDrop.filterIcon.w, rDrop.filterIconSize) && same(rDrop.searchIcon.w, rDrop.searchIconSize)) ? true : 'icons: ' + short([rDrop.filterIcon, rDrop.filterIconSize, rDrop.searchIcon, rDrop.searchIconSize]);
  }, test.limit.quick);
  test.run('a dropdown: the two icons are as wide and stand one under the other', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    return (!!rDrop.filterIcon && !!rDrop.searchIcon && same(rDrop.filterIcon.w, rDrop.searchIcon.w) && same(rDrop.filterIcon.left, rDrop.searchIcon.left)) ? true : 'icons: ' + short([rDrop.filterIcon, rDrop.searchIcon]);
  }, test.limit.quick);
  test.run('a dropdown: its 🪣 is the icon element too, a square of its font size, over the 🗜', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    // And the 🪣 row of selectors on top (goal/G41.26: "the selectorRow must start with a\n🪣icon").
    return (/\bshell-icon\b/.test(rDrop.bucketIconClass) && !!rDrop.bucketIcon && same(rDrop.bucketIcon.w, rDrop.bucketIconSize) && !!rDrop.filterIcon && same(rDrop.bucketIcon.left, rDrop.filterIcon.left)) ? true : 'bucket: ' + short([rDrop.bucketIconClass, rDrop.bucketIcon, rDrop.bucketIconSize]);
  }, test.limit.quick);
  test.run('a dropdown: the first selector starts where the search input does', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    return (!!rDrop.firstSelector && !!rDrop.input && same(rDrop.firstSelector.left, rDrop.input.left)) ? true : 'first selector ' + short(rDrop.firstSelector) + ', input ' + short(rDrop.input);
  }, test.limit.quick);
  test.run('a dropdown: each row\'s first control starts at the same place: the first filter over the search input', 0.2, function () {
    if (!chrome) return 'no Chrome: the world failed';
    if (!node || !node.up || !node.debug) return 'no scratch node: the world failed';
    if (!page || page.error) return 'no Chrome page: the world failed';
    if (!m || !m.made) return 'nothing measured: the world failed';
    return (!!rDrop.firstFilter && !!rDrop.input && same(rDrop.firstFilter.left, rDrop.input.left)) ? true : 'first filter ' + short(rDrop.firstFilter) + ', input ' + short(rDrop.input);
  }, test.limit.quick);
  test.after(function () {
    if (page && page.kid) page.kid.kill();
    if (node && node.child) node.child.kill();
    try { if (page && page.profile) fs.rmSync(page.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  });
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

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

  // What the tests make, shared by the tests after them.
  let node, chrome, made, a0, a1, b1, a2, l1;
  test.run('the world: a scratch node and a Chrome page for the dropdowns', 0.2, async function () {
    // search-popup: a search dropdown's list floats above everything, one at a time (goal/G43.18)
    node = await scratchNode();
    chrome = await chromePage(findChrome());
    return (node.up && !chrome.error) ? true : 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  }, test.limit.slow);
  test.run('the world: three search dropdowns of 40 rows, each in a 48 px box that cuts off its overflow, and a block drawn over the space below the first two', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    // Each box cuts off what overflows it (overflow hidden), and stands under a sibling drawn later on the same spot's level.
    made = await chrome.evaluate('window.spirit.ready.then(function () { return spirit.require("spirit/element/search.js"); }).then(function () { ' +
      'var rows = []; for (var i = 0; i < 40; i++) rows.push({ key: "r" + i, name: "row " + i }); window.__z = {}; ' +
      '[["a", 40, 100], ["b", 500, 100], ["low", 40, window.innerHeight - 70]].forEach(function (x) { var b = document.createElement("div"); b.id = "zz-" + x[0]; ' +
      'b.style.cssText = "position:absolute;left:" + x[1] + "px;top:" + x[2] + "px;width:320px;height:48px;overflow:hidden;border:1px solid"; document.body.appendChild(b); ' +
      'spirit.element.spirit.element.search.create(b, { face: "dropdown", rows: function () { return rows; }, columns: [{ field: "name", label: "Name" }], name: function (r) { return r.name; }, pick: function () {} }); ' +
      'window.__z[x[0]] = { box: b, list: b.querySelector("[id$=list]"), field: b.querySelector("[id$=field]") }; }); ' +
      'var cover = document.createElement("div"); cover.id = "zz-cover"; cover.style.cssText = "position:absolute;left:0;top:160px;width:900px;height:200px;background:#333;z-index:20"; document.body.appendChild(cover); ' +
      'return Object.keys(window.__z).every(function (k) { return !!window.__z[k].list && !!window.__z[k].field; }) ? "made" : "no list or field"; }, function (e) { return String(e); })');
    return (made === 'made') ? true : 'nothing made: ' + short(made);
  }, test.limit.quick);
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
  test.run('the world: pressed, the first dropdown\'s list opens', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    await sleep(800);
    // What one dropdown shows: where its field is, whether its list is open, where it lies, and whether it is what is seen there.
    // Andy: "the actual dropdown control stays where it is", "just the popped list would float"
    a0 = await look('a');
    await press('a');
    a1 = await look('a');
    return (a1.open) ? true : 'the list did not open: ' + short(a1);
  }, test.limit.slow);
  test.run('its field stays where it was, in its box', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    return (a1.fieldInBox && a1.field[0] === a0.field[0] && a1.field[1] === a0.field[1]) ? true : 'the field moved: ' + short(a0.field) + ' to ' + short(a1.field);
  }, test.limit.quick);
  test.run('"floats it\'s contents above all windows": the list reaches past its box, over the block drawn on top, and is what is seen there', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    return (a1.open && a1.below && a1.seen) ? true : 'the list: ' + short(a1);
  }, test.limit.quick);
  test.run('"only bound by the window size but not neccessarily filling it"', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    return (a1.open && a1.inWindow && !a1.fills) ? true : 'the list: ' + short(a1);
  }, test.limit.quick);
  test.run('the second dropdown pressed: its list opens, seen', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    // Andy: "only one in the whole browser window can be active"
    await press('b');
    b1 = await look('b');
    a2 = await look('a');
    return (b1.open && b1.seen) ? true : 'the second list: ' + short(b1);
  }, test.limit.quick);
  test.run('and the first one\'s list is closed', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    return (b1.open && !a2.open) ? true : 'the first list is still open: ' + short(a2);
  }, test.limit.quick);
  test.run('Escape closes it', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    await key('Escape', 27);
    return (!(await look('b')).open) ? true : 'after Escape: ' + short(await look('b'));
  }, test.limit.quick);
  test.run('a press outside closes it', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    await press('a');
    await chrome.evaluate('(function () { var e = document.elementFromPoint(window.innerWidth - 5, 5) || document.body; e.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); e.click(); }()); true');
    await sleep(500);
    return (!(await look('a')).open) ? true : 'after a press outside: ' + short(await look('a'));
  }, test.limit.slow);
  test.run('a dropdown low in the window opens its list inside the window, seen', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    if (made !== 'made') return 'the dropdowns were not made: the world failed';
    // low in the window, its list still inside the window
    await press('low');
    l1 = await look('low');
    return (l1.open && l1.inWindow && l1.seen) ? true : 'the low list: ' + short(l1);
  }, test.limit.quick);
  test.after(function () {
    try { if (chrome && chrome.sock) chrome.sock.close(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (node && node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  });
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

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500); }

  // What the tests make, shared by the tests after them.
  let table, node, chrome, loaded, plain, nest, searching, nest2, best, expected, probe, missed, none, order, picked1,
    picked2, tipNest, lines, pane, pn, placed, asPane, asTiles, back;
  test.run('probabilityStringObjectMatch hands out its scan, measureObject', 0.2, function () {
    // search-tiles: probabilitySearch: the face tiles (goal/G43.6)
    // Andy, box: "assembled by scanning the row without knowing its meaning, with the one scan probabilityStringObjectMatch uses:
    // the scan also hands each string's js object path."
    // the one scan: each string with its js object path
    return (typeof match.measureObject === 'function') ? true : 'it exports ' + short(Object.keys(match));
  }, test.limit.quick);
  const at = function (s) { return table.filter(function (r) { return r.objectString === s; })[0] || {}; };
  test.run('a value carries its path: label', 0.2, function () {
    table = match.measureObject({ label: 'Nest', stats: { cpu: 12 }, files: [{ name: 'a.txt' }] });
    return (at('Nest').path === 'label') ? true : 'Nest: ' + short(at('Nest'));
  }, test.limit.quick);
  test.run('a nested one: stats.cpu', 0.2, function () {
    return (at('12').path === 'stats.cpu') ? true : '12: ' + short(at('12'));
  }, test.limit.quick);
  test.run('one in an array: files[0].name', 0.2, function () {
    return (at('a.txt').path === 'files[0].name') ? true : 'a.txt: ' + short(at('a.txt'));
  }, test.limit.quick);
  test.run('the match still scores with it', 0.2, function () {
    return (match.probabilityStringObjectMatch('Nest', { label: 'Nest' }) > 0) ? true : 'the match answered 0';
  }, test.limit.quick);
  test.run('the world: a scratch node and a Chrome page for the tiles', 0.2, async function () {
    node = await scratchNode();
    chrome = await chromePage(findChrome());
    return (node.up && !chrome.error) ? true : 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  }, test.limit.slow);
  const js = function (s) { return chrome.evaluate(s); };
  test.run('the world: it loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    loaded = await js('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search.js"); }).then(function () { return "loaded"; }, function (e) { return "ERR " + e; })');
    return (loaded === 'loaded') ? true : short(loaded);
  }, test.limit.quick);
  const read = async function () {
    return JSON.parse(await js('(function () { var c = window.__box; var tiles = [].map.call(c.querySelectorAll(".app-icon"), function (t) { var r = t.getBoundingClientRect(); var bar = t.querySelector(".list-rank"); var fill = bar ? (bar.querySelector("div div") || bar.firstElementChild) : null; var img = [].filter.call(t.querySelectorAll("*"), function (e) { return !e.children.length && /[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(e.textContent); })[0]; var lab = [].filter.call(t.querySelectorAll("*"), function (e) { return !e.children.length && /^(Alpha|Nest|Gamma)$/.test(e.textContent.trim()); })[0]; var rect = function (e) { if (!e) return null; var b = e.getBoundingClientRect(); return { t: Math.round(b.top - r.top), b: Math.round(b.bottom - r.top), l: Math.round(b.left - r.left), r: Math.round(b.right - r.left), w: Math.round(b.width), h: Math.round(b.height) }; }; return { text: t.innerText.replace(/\\s+/g, " ").trim(), w: Math.round(r.width), h: Math.round(r.height), img: rect(img), lab: rect(lab), hasBar: !!bar, bar: rect(bar), fill: rect(fill), colour: fill ? getComputedStyle(fill).borderTopColor : "", number: bar ? bar.getAttribute("title") : "", title: t.getAttribute("title") }; }); var inputs = [].filter.call(c.querySelectorAll("input"), function (i) { return i.getClientRects().length && i.type !== "checkbox"; }); return JSON.stringify({ tiles: tiles, inputs: inputs.length, headers: c.querySelectorAll("th").length, sorts: c.querySelectorAll("[data-sort]").length, tables: c.querySelectorAll("table").length }); })()'));
  };
  const type = async function (w) { await js('(function () { var i = [].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; i.value = ' + JSON.stringify(w) + '; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()'); await sleep(500); };
  test.run('one tile per row', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:500px;display:flex;flex-direction:column;background:#111"; window.__box = d; window.__picked = []; window.__rows = [{ key: "alpha", label: "Alpha", icon: "🅰️" }, { key: "nest", label: "Nest", icon: "🧩", stats: { cpu: 12 }, files: [{ name: "a.txt" }] }, { key: "gamma", label: "Gamma", icon: "🍀" }]; window.__made = window.spirit.element.spirit.element.search.create(d, { face: "tiles", rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }], pick: function (row, key) { window.__picked.push(key); } }); if (window.__made.refresh) window.__made.refresh(); return true; })()');
    await until(function () { return js('window.__box.querySelectorAll(".app-icon").length > 0'); }, 3000);
    plain = await read();
    // "the same ranked rows, drawn as tiles", "No column headers or sorting"
    return (plain.tiles.length === 3) ? true : short(plain.tiles.length) + ' tiles';
  }, test.limit.quick);
  test.run('no table, no column headers, no sort trigger', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (plain.headers === 0 && plain.sorts === 0 && plain.tables === 0) ? true : short({ h: plain.headers, s: plain.sorts, t: plain.tables });
  }, test.limit.quick);
  // THE TILES ARE A GRID (goal/G47.1; Andy, after the kept rows: "the FUCKING TILE MODE IN APP-SEARCH (OR SEARCH ITSELF)
  // FUCKING IS NO GRID ANYMORE, EVERY FUCKING TILE IS CENTERED ON IT'S OWN FUCKING ROW!"): in 800px, the three tiles of
  // at least 96px each stand side by side, one row, and so after a filter or new words are drawn.
  const sideBySide = function () {
    return js('(function () { var ts = [].filter.call(window.__box.querySelectorAll(".app-icon"), function (t) { return t.getClientRects().length; }).map(function (t) { var r = t.getBoundingClientRect(); return { top: Math.round(r.top), left: Math.round(r.left) }; }); return JSON.stringify(ts); })()').then(JSON.parse);
  };
  test.run('the tiles stand side by side in a grid, not one per line', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    const ts = await sideBySide();
    const oneRow = ts.length === 3 && ts.every(function (t) { return t.top === ts[0].top; }) && ts[1].left > ts[0].left && ts[2].left > ts[1].left;
    return oneRow || 'the tiles stand at ' + short(ts);
  }, test.limit.quick);
  test.run('and still side by side once words were typed and cleared', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await type('ga');
    await type('');
    const ts = await sideBySide();
    return (ts.length === 3 && ts.every(function (t) { return t.top === ts[0].top; })) || 'after words, the tiles stand at ' + short(ts);
  }, test.limit.slow);
  test.run('one search field', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (plain.inputs === 1) ? true : plain.inputs + ' search fields';
  }, test.limit.quick);
  test.run('"A tile: its image, the relevance, its label": image above label', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    nest = plain.tiles.filter(function (t) { return /Nest/.test(t.text); })[0] || {};
    return (!!nest.img && !!nest.lab && nest.img.b <= nest.lab.t + 1) ? true : 'the tile: ' + short(nest);
  }, test.limit.quick);
  test.run('no words: no bar shows', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // "With no search words there is no bar. Its space stays, so the tiles do not jump."
    return (plain.tiles.every(function (t) { return !t.hasBar || !t.fill || t.fill.w === 0; })) ? true : short(plain.tiles.map(function (t) { return t.fill; }));
  }, test.limit.quick);
  test.run('with words the label stands where it stood', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await type('Nest');
    searching = await read();
    nest2 = searching.tiles.filter(function (t) { return /Nest/.test(t.text); })[0] || {};
    return (!!nest2.lab && !!nest.lab && nest2.lab.t === nest.lab.t && nest2.h === nest.h) ? true : 'label ' + short(nest.lab) + ' then ' + short(nest2.lab);
  }, test.limit.quick);
  test.run('the row that fits comes first', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // "The relevance is a centered, horizontal bar, between the tile image and the tile label: the bar the lists draw, the same colour and number."
    return (/Nest/.test(searching.tiles[0].text)) ? true : 'first: ' + short(searching.tiles[0].text);
  }, test.limit.quick);
  test.run('its bar stands between image and label', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    best = searching.tiles[0];
    return (best.hasBar && !!best.bar && !!best.img && !!best.lab && best.bar.t >= best.img.b - 1 && best.bar.b <= best.lab.t + 1) ? true : short({ bar: best.bar, img: best.img, lab: best.lab });
  }, test.limit.quick);
  test.run('horizontal', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (best.hasBar && !!best.fill && best.fill.w > best.fill.h) ? true : short(best.fill);
  }, test.limit.quick);
  test.run('centered in the tile', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (best.hasBar && !!best.bar && Math.abs((best.bar.l + best.bar.r) / 2 - best.w / 2) <= 2) ? true : short({ bar: best.bar, w: best.w });
  }, test.limit.quick);
  test.run('the same number as a list: its rank against the best row\'s', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (best.number === '1.00') ? true : 'number: ' + short(best.number);
  }, test.limit.quick);
  test.run('the same colour as a list\'s bar', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    expected = await js('getComputedStyle(document.documentElement).getPropertyValue("--spirit-match")');
    probe = await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.style.borderTop = "1px solid var(--spirit-match, rgba(130,180,240,0.55))"; var c = getComputedStyle(d).borderTopColor; d.remove(); return c; })()');
    return (best.colour === probe) ? true : 'colour ' + short(best.colour) + ', a list\'s ' + short(probe) + ' (' + short(expected) + ')';
  }, test.limit.quick);
  test.run('all three tiles stay', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // "A tile the words miss stays, last, with an empty bar. Nothing is cut."
    await type('Nest');
    missed = searching.tiles.slice(1);
    return (searching.tiles.length === 3) ? true : short(searching.tiles.length) + ' tiles';
  }, test.limit.quick);
  test.run('words nothing fits: the tiles stay, every bar empty', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await type('qqqqzzzzxxxx');
    none = await read();
    return (none.tiles.length === 3 && none.tiles.every(function (t) { return t.hasBar && (!t.fill || t.fill.w === 0); })) ? true : short(none.tiles.map(function (t) { return { text: t.text, fill: t.fill }; }));
  }, test.limit.quick);
  test.run('the world: two others behind the best', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (missed.length === 2) ? true : short(missed.length);
  }, test.limit.quick);
  const press = async function (key) { await js('(function () { var at = document.activeElement || document.body; at.dispatchEvent(new KeyboardEvent("keydown", { key: ' + JSON.stringify(key) + ', bubbles: true, cancelable: true })); return true; })()'); await sleep(120); };
  test.run('Right, Right, Left, Enter picks one tile', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await type('');
    // "arrow keys also go left and right": Enter picks where they went
    // Each key goes where the focus really is, as a real key does: from the empty search field an arrow moves into the tiles.
    await js('[].filter.call(window.__box.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0].focus(); true');
    order = (await read()).tiles.map(function (t) { return t.text; });
    await press('ArrowRight');
    await press('ArrowRight');
    await press('ArrowLeft');
    await press('Enter');
    picked1 = JSON.parse(await js('JSON.stringify(window.__picked)'));
    return (picked1.length === 1) ? true : 'picked: ' + short(picked1) + ', order ' + short(order);
  }, test.limit.slow);
  test.run('a further Right, Enter picks the next one', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await press('ArrowRight');
    await press('Enter');
    picked2 = JSON.parse(await js('JSON.stringify(window.__picked)'));
    return (picked2.length === 2 && picked2[0] !== picked2[1]) ? true : 'picked: ' + short(picked2);
  }, test.limit.quick);
  test.run('pressing Gamma picks gamma', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // "A press opens": a pressed tile is the list's pick
    await js('window.__picked.length = 0; [].filter.call(window.__box.querySelectorAll(".app-icon"), function (t) { return /Gamma/.test(t.innerText); })[0].click(); true');
    await sleep(150);
    return (await js('window.__picked[0] === "gamma"')) ? true : 'picked: ' + short(await js('JSON.stringify(window.__picked)'));
  }, test.limit.quick);
  const tip = async function (label) {
    return js('(function () { var t = [].filter.call(window.__box.querySelectorAll(".app-icon"), function (x) { return x.innerText.indexOf(' + JSON.stringify(label) + ') !== -1; })[0]; t.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); t.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true })); var own = t.getAttribute("title") || ""; var pop = [].map.call(document.querySelectorAll("[role=tooltip]"), function (e) { return e.innerText; }).join("\\n"); return own || pop; })()');
  };
  test.run('its row, one above the other', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // "The tooltip shows the contents of the row, one above the other", "If the object is nested, it shows the js object path", "It drops the icon row"
    tipNest = String(await tip('Nest'));
    lines = tipNest.split('\n').map(function (l) { return l.trim(); });
    return (lines.indexOf('key: nest') !== -1 && lines.indexOf('label: Nest') !== -1) ? true : 'the tooltip: ' + short(tipNest);
  }, test.limit.quick);
  test.run('nested: stats.cpu: 12, files[0].name: a.txt', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (lines.indexOf('stats.cpu: 12') !== -1 && lines.indexOf('files[0].name: a.txt') !== -1) ? true : 'the tooltip: ' + short(tipNest);
  }, test.limit.quick);
  test.run('no icon row', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (!/icon/.test(tipNest)) ? true : 'the tooltip: ' + short(tipNest);
  }, test.limit.quick);
  test.run('a pane stays a table with headers', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // "Any list can use it": the other two faces stay
    pane = await js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:500px;height:200px"; window.spirit.element.spirit.element.search.create(d, { rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }] }); return new Promise(function (r) { setTimeout(function () { var n = JSON.stringify({ tiles: d.querySelectorAll(".app-icon").length, headers: d.querySelectorAll("th").length }); d.remove(); r(n); }, 300); }); })()');
    pn = JSON.parse(pane);
    return (pn.tiles === 0 && pn.headers > 0) ? true : short(pn);
  }, test.limit.quick);
  const make = function (opts) { return js('(function () { var d = document.body.appendChild(document.createElement("div")); d.className = "fill"; d.style.cssText = "position:fixed;left:0;top:0;width:800px;height:500px;display:flex;flex-direction:column;background:#111"; window.__t = d; window.__faces = []; window.__tl = window.spirit.element.spirit.element.search.create(d, Object.assign({ rows: function () { return window.__rows; }, columns: [{ field: "label", label: "Label" }], onFace: function (f) { window.__faces.push(f); } }, ' + JSON.stringify(opts) + ')); if (window.__tl.refresh) window.__tl.refresh(); return new Promise(function (r) { setTimeout(function () { r(true); }, 300); }); })()'); };
  const drop = function () { return js('(function () { window.__t.remove(); return true; })()'); };
  const toggles = function () { return js('window.__t.querySelectorAll(".list-toggle").length'); };
  test.run('a pane without the option has no toggle', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // Named here for the builder: the toggle is .list-toggle, and the owner hears through the option onFace(face).
    // the box: "A new option, toggle: true. Without it nothing changes for any other list."
    await make({ face: 'pane' });
    return (await toggles() === 0) ? true : 'a pane without the option has a toggle';
  }, test.limit.quick);
  test.run('tiles without the option have no toggle', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await drop();
    await make({ face: 'tiles' });
    return (await toggles() === 0) ? true : 'tiles without the option have a toggle';
  }, test.limit.quick);
  test.run('a dropdown with the option has no toggle', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await drop();
    // the box: "It flips pane and tiles only. Dropdown closes to a field, so it never shows the toggle."
    await make({ face: 'dropdown', toggle: true });
    return (await toggles() === 0) ? true : 'a dropdown shows a toggle';
  }, test.limit.quick);
  test.run('a pane with the option has one toggle', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await drop();
    await make({ face: 'pane', toggle: true });
    return (await toggles() === 1) ? true : 'toggles on a pane with the option: ' + short(await toggles());
  }, test.limit.quick);
  test.run('it follows the Search button', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // the box: "The toggle sits on the search row, right after the Search button."
    placed = await js('(function () { var t = window.__t.querySelector(".list-toggle"); if (!t) return "none"; var b = [].filter.call(window.__t.querySelectorAll("button"), function (x) { return x.textContent === "Search"; })[0]; if (!b) return "no Search button"; return t.previousElementSibling === b ? "after" : "elsewhere"; })()');
    return (placed === 'after') ? true : 'the toggle stands: ' + short(placed);
  }, test.limit.quick);
  const seen = function () { return js('JSON.stringify({ tiles: window.__t.querySelectorAll(".app-icon").length, headers: window.__t.querySelectorAll("th").length, words: ([].filter.call(window.__t.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0] || {}).value, faces: window.__faces })'); };
  const click = function () { return js('(function () { var t = window.__t.querySelector(".list-toggle"); if (t) t.click(); return !!t; })()'); };
  test.run('it starts as a pane', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // the box: "The face can change while the list lives, keeping the search words."
    await js('(function () { var i = [].filter.call(window.__t.querySelectorAll("input"), function (x) { return x.getClientRects().length && x.type !== "checkbox"; })[0]; if (!i) return false; i.value = "Nest"; i.dispatchEvent(new Event("input", { bubbles: true })); return true; })()');
    asPane = JSON.parse(await seen());
    return (asPane.tiles === 0 && asPane.headers > 0) ? true : short(asPane);
  }, test.limit.quick);
  test.run('a press draws tiles, one per row', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await click();
    await until(function () { return js('window.__t.querySelectorAll(".app-icon").length > 0'); }, 3000);
    asTiles = JSON.parse(await seen());
    return (asTiles.tiles === 3 && asTiles.headers === 0) ? true : short(asTiles);
  }, test.limit.quick);
  test.run('the search words stay', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (asTiles.words === 'Nest') ? true : 'the words after a press: ' + short(asTiles.words);
  }, test.limit.quick);
  test.run('the toggle stays, to go back', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    return (await toggles() === 1) ? true : 'no toggle on the tiles';
  }, test.limit.quick);
  test.run('the owner hears tiles', 0.2, function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    // the box: "It tells its owner the new face."
    return (JSON.stringify(asTiles.faces) === '["tiles"]') ? true : 'the owner heard: ' + short(asTiles.faces);
  }, test.limit.quick);
  test.run('a second press goes back, words kept, the owner told', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await click();
    await until(function () { return js('window.__t.querySelectorAll("th").length > 0'); }, 3000);
    back = JSON.parse(await seen());
    return (back.tiles === 0 && back.headers > 0 && back.words === 'Nest' && JSON.stringify(back.faces) === '["tiles","pane"]') ? true : short(back);
  }, test.limit.quick);
  await drop();
  test.after(function () {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node && node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  });
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

  // What the tests make, shared by the tests after them.
  let missing, top, odd, own, scripts, naming, verbUsers, scratchNode, chromePage, findChrome, until, node, chrome, ld;
  test.run('all are there: search.js, and api, app, contact, file, icon, bundle, branch, grant and valued under search/', 0.2, function () {
    // search-folder: the search elements in spirit/element/search/ (goal/G43.18)
    // the box: "spirit/element/probabilitySearch.js becomes spirit/element/search.js", and every one of the list after it
    missing = THERE.filter(function (p) { return !there(p); });
    return (!missing.length) ? true : 'missing ' + missing.length + ' of ' + THERE.length + ': ' + short(missing);
  }, test.limit.quick);
  test.run('spirit/element/search.js is there', 0.2, function () {
    return (there('spirit/element/search.js')) ? true : 'no spirit/element/search.js';
  }, test.limit.quick);
  test.run('spirit/element/search/api.js is there', 0.2, function () {
    return (there('spirit/element/search/api.js')) ? true : 'no spirit/element/search/api.js';
  }, test.limit.quick);
  test.run('spirit/element/search/api/verb.js is there', 0.2, function () {
    return (there('spirit/element/search/api/verb.js')) ? true : 'no spirit/element/search/api/verb.js';
  }, test.limit.quick);
  test.run('spirit/element/search/app.js is there', 0.2, function () {
    return (there('spirit/element/search/app.js')) ? true : 'no spirit/element/search/app.js';
  }, test.limit.quick);
  test.run('spirit/element/search/app/rowElement.js is there', 0.2, function () {
    return (there('spirit/element/search/app/rowElement.js')) ? true : 'no spirit/element/search/app/rowElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/contact.js is there', 0.2, function () {
    return (there('spirit/element/search/contact.js')) ? true : 'no spirit/element/search/contact.js';
  }, test.limit.quick);
  test.run('spirit/element/search/contact/listElement.js is there', 0.2, function () {
    return (there('spirit/element/search/contact/listElement.js')) ? true : 'no spirit/element/search/contact/listElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/contact/rowElement.js is there', 0.2, function () {
    return (there('spirit/element/search/contact/rowElement.js')) ? true : 'no spirit/element/search/contact/rowElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/contact/detailElement.js is there', 0.2, function () {
    return (there('spirit/element/search/contact/detailElement.js')) ? true : 'no spirit/element/search/contact/detailElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/file.js is there', 0.2, function () {
    return (there('spirit/element/search/file.js')) ? true : 'no spirit/element/search/file.js';
  }, test.limit.quick);
  test.run('spirit/element/search/file/rowElement.js is there', 0.2, function () {
    return (there('spirit/element/search/file/rowElement.js')) ? true : 'no spirit/element/search/file/rowElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/icon.js is there', 0.2, function () {
    return (there('spirit/element/search/icon.js')) ? true : 'no spirit/element/search/icon.js';
  }, test.limit.quick);
  test.run('spirit/element/search/icon/listElement.js is there', 0.2, function () {
    return (there('spirit/element/search/icon/listElement.js')) ? true : 'no spirit/element/search/icon/listElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/icon/rowElement.js is there', 0.2, function () {
    return (there('spirit/element/search/icon/rowElement.js')) ? true : 'no spirit/element/search/icon/rowElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/bundle.js is there', 0.2, function () {
    return (there('spirit/element/search/bundle.js')) ? true : 'no spirit/element/search/bundle.js';
  }, test.limit.quick);
  test.run('spirit/element/search/bundle/listElement.js is there', 0.2, function () {
    return (there('spirit/element/search/bundle/listElement.js')) ? true : 'no spirit/element/search/bundle/listElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/bundle/rowElement.js is there', 0.2, function () {
    return (there('spirit/element/search/bundle/rowElement.js')) ? true : 'no spirit/element/search/bundle/rowElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/branch.js is there', 0.2, function () {
    return (there('spirit/element/search/branch.js')) ? true : 'no spirit/element/search/branch.js';
  }, test.limit.quick);
  test.run('spirit/element/search/branch/listElement.js is there', 0.2, function () {
    return (there('spirit/element/search/branch/listElement.js')) ? true : 'no spirit/element/search/branch/listElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/branch/rowElement.js is there', 0.2, function () {
    return (there('spirit/element/search/branch/rowElement.js')) ? true : 'no spirit/element/search/branch/rowElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/grant.js is there', 0.2, function () {
    return (there('spirit/element/search/grant.js')) ? true : 'no spirit/element/search/grant.js';
  }, test.limit.quick);
  test.run('spirit/element/search/grant/rowElement.js is there', 0.2, function () {
    return (there('spirit/element/search/grant/rowElement.js')) ? true : 'no spirit/element/search/grant/rowElement.js';
  }, test.limit.quick);
  test.run('spirit/element/search/valued.js is there', 0.2, function () {
    return (there('spirit/element/search/valued.js')) ? true : 'no spirit/element/search/valued.js';
  }, test.limit.quick);
  test.run('spirit/element/probabilitySearch.js is gone', 0.2, function () {
    // the old names go
    return (!there('spirit/element/probabilitySearch.js')) ? true : 'spirit/element/probabilitySearch.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/appServerSelector.js is gone', 0.2, function () {
    return (!there('spirit/element/appServerSelector.js')) ? true : 'spirit/element/appServerSelector.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/apiFamilySelector.js is gone', 0.2, function () {
    return (!there('spirit/element/apiFamilySelector.js')) ? true : 'spirit/element/apiFamilySelector.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/apiVerbSelector.js is gone', 0.2, function () {
    return (!there('spirit/element/apiVerbSelector.js')) ? true : 'spirit/element/apiVerbSelector.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/contactSelector.js is gone', 0.2, function () {
    return (!there('spirit/element/contactSelector.js')) ? true : 'spirit/element/contactSelector.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/contact is gone', 0.2, function () {
    return (!there('spirit/element/contact')) ? true : 'spirit/element/contact is still there';
  }, test.limit.quick);
  test.run('spirit/element/files is gone', 0.2, function () {
    return (!there('spirit/element/files')) ? true : 'spirit/element/files is still there';
  }, test.limit.quick);
  test.run('spirit/element/iconSelector.js is gone', 0.2, function () {
    return (!there('spirit/element/iconSelector.js')) ? true : 'spirit/element/iconSelector.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/icons is gone', 0.2, function () {
    return (!there('spirit/element/icons')) ? true : 'spirit/element/icons is still there';
  }, test.limit.quick);
  test.run('spirit/element/bundleSelector.js is gone', 0.2, function () {
    return (!there('spirit/element/bundleSelector.js')) ? true : 'spirit/element/bundleSelector.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/bundleSelector is gone', 0.2, function () {
    return (!there('spirit/element/bundleSelector')) ? true : 'spirit/element/bundleSelector is still there';
  }, test.limit.quick);
  test.run('spirit/element/branchSelector.js is gone', 0.2, function () {
    return (!there('spirit/element/branchSelector.js')) ? true : 'spirit/element/branchSelector.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/branchSelector is gone', 0.2, function () {
    return (!there('spirit/element/branchSelector')) ? true : 'spirit/element/branchSelector is still there';
  }, test.limit.quick);
  test.run('spirit/element/grantSelector is gone', 0.2, function () {
    return (!there('spirit/element/grantSelector')) ? true : 'spirit/element/grantSelector is still there';
  }, test.limit.quick);
  test.run('spirit/element/valued.js is gone', 0.2, function () {
    return (!there('spirit/element/valued.js')) ? true : 'spirit/element/valued.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/contactDetails is gone', 0.2, function () {
    return (!there('spirit/element/contactDetails')) ? true : 'spirit/element/contactDetails is still there';
  }, test.limit.quick);
  test.run('spirit/element/relayPanel.js is gone', 0.2, function () {
    return (!there('spirit/element/relayPanel.js')) ? true : 'spirit/element/relayPanel.js is still there';
  }, test.limit.quick);
  test.run('spirit/element/search/contact/relayPanel.js is gone', 0.2, function () {
    return (!there('spirit/element/search/contact/relayPanel.js')) ? true : 'spirit/element/search/contact/relayPanel.js is still there';
  }, test.limit.quick);
  test.run('spirit/app/appSelector/listElement.js is gone', 0.2, function () {
    return (!there('spirit/app/appSelector/listElement.js')) ? true : 'spirit/app/appSelector/listElement.js is still there';
  }, test.limit.quick);
  test.run('spirit/app/appSelector/rowElement.js is gone', 0.2, function () {
    return (!there('spirit/app/appSelector/rowElement.js')) ? true : 'spirit/app/appSelector/rowElement.js is still there';
  }, test.limit.quick);
  test.run('every name under search/ is a word, and every folder sits beside its <name>.js', 0.2, function () {
    // the box: "the same pattern for all": under search/ a <name>.js and its <name>/ folder, each name a word
    top = fs.existsSync(SEARCH) ? fs.readdirSync(SEARCH, { withFileTypes: true }).filter(function (d) { return d.name !== 'test'; }) : [];
    odd = top.filter(function (d) { return d.isDirectory() ? !/^[a-z]+$/.test(d.name) || !fs.existsSync(path.join(SEARCH, d.name + '.js')) : !/^[a-z]+\.js$/.test(d.name); }).map(function (d) { return d.name; });
    return (top.length > 0 && !odd.length) ? true : top.length ? 'off the pattern: ' + short(odd) : 'no spirit/element/search/';
  }, test.limit.quick);
  const ownCut = function (c) { const at = c.indexOf('async function folderPart()'); return at === -1 ? c : c.slice(0, at); };
  test.run('no code names an old path, in more than a hundred scripts and their tests', 0.2, function () {
    // the box: "The apps and elements that require them name the new paths"
    // Once its own file, search-folder.js skipped itself; folded into search.js, it reads search.js up to this part, which
    // holds the old paths in its own lists.
    own = path.resolve(__filename);
    scripts = filesUnder(RUN).concat(filesUnder(path.join(REPO, 'spirit', 'test')))
      .filter(function (f) { return /\.(js|html|css)$/.test(f); });
    naming = [];
    scripts.forEach(function (f) {
      const c = path.resolve(f) === own ? ownCut(code(f)) : code(f);
      OLD.forEach(function (o) { if (new RegExp(o.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?![A-Za-z])').test(c)) naming.push(path.relative(REPO, f) + ': ' + o); });
    });
    return (scripts.length > 100 && !naming.length) ? true : naming.length + ' of ' + scripts.length + ' still name one, the first: ' + short(naming.slice(0, 8));
  }, test.limit.quick);
  test.run('api and branch both load the one verb filter, search/api/verb.js', 0.2, function () {
    // "apiVerbSelector.js is the verb dropdown filter: search/api/verb.js, which branch names too."
    verbUsers = ['spirit/element/search/api.js', 'spirit/element/search/branch.js', 'spirit/element/search/branch/listElement.js']
      .filter(function (p) { return /spirit\/element\/search\/api\/verb\.js/.test(code(path.join(RUN, p))); });
    return (verbUsers.indexOf('spirit/element/search/api.js') !== -1 && verbUsers.some(function (p) { return /branch/.test(p); })) ? true : 'loading it: ' + short(verbUsers);
  }, test.limit.quick);
  test.run('the world: a scratch node and a Chrome page for the loads', 0.2, async function () {
    // "renaming only": what loaded before still loads. A real Chrome on a scratch node's face.html, each file required through
    // spirit.require and answered within its time. Folding apiFamilySelector into search/api.js made it and search/api/verb.js
    // require each other, and neither ever loaded: the agent's bundle opened no tab (Andy: "the bundles fail to pop into a tab,
    // when i click on a bundle, no network activity, no console activity.").
    // the box: "renaming only": every one of them loads on a page
    ({ scratchNode, chromePage, findChrome, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')));
    node = await scratchNode();
    chrome = await chromePage(findChrome());
    return (node.up && !chrome.error) ? true : 'no scratch node or no Chrome: nothing judged. ' + short(chrome.error || '');
  }, test.limit.slow);
  const loads = async function (p) {
    const got = await chrome.evaluate('window.spirit.ready.then(function () { return Promise.race([window.spirit.require(' + JSON.stringify(p) + ').then(function () { return "loaded"; }, function (e) { return "refused: " + e; }), new Promise(function (r) { setTimeout(function () { r("never answered"); }, 8000); })]); })');
    return { fine: got === 'loaded', why: p + ': ' + short(got) };
  };
  test.run('spirit/element/search.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    await chrome.send('Page.navigate', { url: node.base + '/face.html' });
    await until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    // Each one written out, so that each check has a plain title of its own.
    ld = await loads('spirit/element/search.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/api.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/api.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/api/verb.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/api/verb.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/app.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/app.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/app/rowElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/app/rowElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/contact.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/contact.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/contact/listElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/contact/listElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/contact/rowElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/contact/rowElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/contact/detailElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/contact/detailElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/file.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/file.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/file/rowElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/file/rowElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/icon.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/icon.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/icon/listElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/icon/listElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/icon/rowElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/icon/rowElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/bundle.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/bundle.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/bundle/listElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/bundle/listElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/bundle/rowElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/bundle/rowElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/branch.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/branch.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/branch/listElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/branch/listElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/branch/rowElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/branch/rowElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/grant.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/grant.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/grant/rowElement.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/grant/rowElement.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.run('spirit/element/search/valued.js loads', 0.2, async function () {
    if (!node || !node.up || !chrome || chrome.error) return 'no scratch node or no Chrome: the world failed';
    ld = await loads('spirit/element/search/valued.js');
    return (ld.fine) ? true : ld.why;
  }, test.limit.quick);
  test.after(function () {
    if (chrome && chrome.kid) chrome.kid.kill();
    if (node && node.child) node.child.kill();
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* left */ }
    try { if (node && node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* left */ }
  });
}
