'use strict';

// spirit/run/shell/shared/js/test/deskDoorFields.js
// The tests of shell/shared/js/deskDoorFields.js, and of no other module (spec: ./deskDoorFields.md; goal/G41.11). The
// browser file runs in node on a small page of its own (the page shell/desk/test/desk.js drives): its four framed
// blocks are drawn into it, typed into, checked and read back.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskDoorFields.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

// ── THE PAGE (shell/desk/test/desk.js) ──────────────────────────────────────────────────────────────────────────────
const VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
function makeDom() {
  const doc = {};
  function el(tag) {
    const attrs = {}; const heard = {};
    const e = { tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null, style: {}, value: '', hidden: false, disabled: false, type: '', title: '', _text: '',
      get id() { return attrs.id || ''; }, set id(v) { attrs.id = String(v); },
      get className() { return attrs.class || ''; }, set className(v) { attrs.class = String(v); },
      get firstChild() { return e.children[0] || null; },
      get isConnected() { let p = e; while (p.parentNode) p = p.parentNode; return p === doc.root; },
      get textContent() { return e.children.length ? e.children.map(function (c) { return c.textContent; }).join('') : e._text; },
      set textContent(v) { e.children = []; e._text = String(v == null ? '' : v); },
      get innerHTML() { return e._html || ''; },
      set innerHTML(v) { e._html = String(v); e.children = []; e._text = ''; parseInto(e, String(v)); },
      getAttribute: function (k) { if (k === 'id') return attrs.id || null; return k in attrs ? attrs[k] : null; },
      setAttribute: function (k, v) { attrs[k] = String(v); },
      removeAttribute: function (k) { delete attrs[k]; },
      hasAttribute: function (k) { return k in attrs; },
      classList: { add: function (c) { const l = (attrs.class || '').split(/\s+/).filter(Boolean); if (l.indexOf(c) === -1) l.push(c); attrs.class = l.join(' '); },
        remove: function (c) { attrs.class = (attrs.class || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
        contains: function (c) { return (attrs.class || '').split(/\s+/).indexOf(c) !== -1; },
        toggle: function (c, on) { if (on === undefined ? !e.classList.contains(c) : on) e.classList.add(c); else e.classList.remove(c); } },
      appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; e.children.push(c); return c; },
      insertBefore: function (c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; const i = e.children.indexOf(ref); if (i === -1) e.children.push(c); else e.children.splice(i, 0, c); return c; },
      removeChild: function (c) { const i = e.children.indexOf(c); if (i !== -1) e.children.splice(i, 1); c.parentNode = null; return c; },
      replaceChild: function (n, o) { const i = e.children.indexOf(o); if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = e; if (i !== -1) e.children[i] = n; o.parentNode = null; return o; },
      remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
      addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
      removeEventListener: function (t, fn) { heard[t] = (heard[t] || []).filter(function (f) { return f !== fn; }); },
      dispatch: function (t, ev) { (heard[t] || []).slice().forEach(function (fn) { fn(ev); }); },
      closest: function (sel) { let p = e; while (p && p.tagName) { if (matches(p, sel)) return p; p = p.parentNode; } return null; },
      matches: function (sel) { return matches(e, sel); },
      querySelectorAll: function (sel) { const out = []; (function walk(n) { n.children.forEach(function (c) { if (matches(c, sel)) out.push(c); walk(c); }); }(e)); return out; },
      querySelector: function (sel) { return e.querySelectorAll(sel)[0] || null; },
      focus: function () {}, blur: function () {}, scrollIntoView: function () {}, getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; },
      attrs: attrs,
    };
    return e;
  }
  function one(n, sel) {
    sel = sel.trim();
    const m = /^([a-z]*)((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(sel);
    if (!m) return false;
    if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
    const parts = m[2].match(/#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]/g) || [];
    return parts.every(function (p) {
      if (p[0] === '#') return n.getAttribute('id') === p.slice(1);
      if (p[0] === '.') return n.classList.contains(p.slice(1));
      const a = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(p);
      return a[2] === undefined ? n.hasAttribute(a[1]) : n.getAttribute(a[1]) === a[2];
    });
  }
  function matches(n, sel) { return String(sel).split(',').some(function (s) { return one(n, s); }); }
  function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&'); }
  function parseInto(root, html) {
    const stack = [root];
    const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g; let m;
    let raw = null;
    while ((m = re.exec(html))) {
      const top = stack[stack.length - 1];
      if (raw) { if (m[1] === '/' && m[2] && m[2].toLowerCase() === raw) { stack.pop(); raw = null; } continue; }
      if (m[5] !== undefined) { if (m[5].trim() || top.children.length === 0) { const t = el('#text'); t._text = unesc(m[5]); t.tagName = '#TEXT'; top.children.push(t); t.parentNode = top; } continue; }
      if (!m[2]) continue;
      const tag = m[2].toLowerCase();
      if (m[1] === '/') { for (let i = stack.length - 1; i > 0; i--) { if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } } continue; }
      const n = el(tag);
      const ar = /([\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
      while ((a = ar.exec(m[3]))) n.attrs[a[1]] = unesc(a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : a[5] !== undefined ? a[5] : '');
      if ('hidden' in n.attrs) n.hidden = true;
      if ('disabled' in n.attrs) n.disabled = true;
      if (n.attrs.type) n.type = n.attrs.type;
      if (n.attrs.title) n.title = n.attrs.title;
      if (n.attrs.value) n.value = n.attrs.value;
      n.parentNode = top; top.children.push(n);
      if (!VOID[tag] && !m[4]) { stack.push(n); if (tag === 'style' || tag === 'script') raw = tag; }
    }
  }
  doc.root = el('html');
  doc.body = doc.root.appendChild(el('body'));
  doc.head = doc.root.appendChild(el('head'));
  doc.documentElement = doc.root;
  doc.readyState = 'complete';
  doc.createElement = function (t) { return el(t); };
  doc.createTextNode = function (t) { const n = el('#text'); n._text = String(t); return n; };
  doc.getElementById = function (id) { return doc.root.querySelector('#' + id); };
  doc.querySelector = function (s) { return doc.root.querySelector(s); };
  doc.querySelectorAll = function (s) { return doc.root.querySelectorAll(s); };
  doc.addEventListener = function () {};
  doc.removeEventListener = function () {};
  // A click on an element, bubbling to every listener above it.
  doc.click = function (t) {
    const ev = { type: 'click', target: t, preventDefault: function () {}, stopPropagation: function () {} };
    let p = t; while (p) { if (p.dispatch) p.dispatch('click', ev); p = p.parentNode; }
  };
  return doc;
}
// An event on an element, bubbling to every listener above it, as doc.click does.
function fire(doc, type, target, extra) {
  const ev = Object.assign({ type: type, target: target, preventDefault: function () {}, stopPropagation: function () {} }, extra || {});
  let p = target; while (p) { if (p.dispatch) p.dispatch(type, ev); p = p.parentNode; }
  return ev;
}

const document = makeDom();
const win = { document: document, JSON: JSON, Object: Object, Array: Array, String: String };
win.window = win;
vm.createContext(win);
vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
const F = win.spirit && win.spirit.elements && win.spirit.elements.deskDoorFields;
const PRE = 'p-';
const host = document.body.appendChild(document.createElement('div'));
const button = document.body.appendChild(document.createElement('button'));
button.id = 'p-go';
const field = function (f) { return document.getElementById(PRE + f); };
function type(values) { F.FIELDS.forEach(function (f) { field(f).value = values[f] != null ? values[f] : ''; }); }
const GOOD = { gate: 'spirit/run/spirit/peerPost.js::createPeerPost', endpoint: 'spirit/run/spirit/presenceNode.js', paths: '', suites: 'a.js, b.js' };

test.startTest('deskDoorFields.js: a stack-frame door\'s four fields');

test.subHeading('it adds deskDoorFields to window.spirit.elements');
ok(!!F && ['FIELDS', 'html', 'check', 'why', 'door', 'fill'].every(function (k) { return k in F; }), 'deskDoorFields carries FIELDS, html, check, why, door, fill',
  'deskDoorFields: ' + short(F && Object.keys(F)));
ok(JSON.stringify(F.FIELDS) === '["gate","endpoint","paths","suites"]', 'FIELDS are gate, endpoint, paths, suites, in that order', short(F.FIELDS));

test.subHeading('html: four framed blocks, ids pre + field');
const html = F.html(PRE);
host.innerHTML = html;
F.FIELDS.forEach(function (f) {
  const input = field(f);
  ok(!!input && input.tagName === 'INPUT' && input.getAttribute('data-field') === f && input.getAttribute('type') === 'text', f + ': an input #p-' + f + ' carrying data-field="' + f + '"',
    f + ': ' + short(input && input.attrs));
  ok(!!document.getElementById(PRE + f + '-says') && !!document.getElementById(PRE + f + '-left') && !!host.querySelector('[data-block="p-' + f + '"]'),
    f + ': its block holds its meaning line (-says) and its wrong line (-left)', f + ': a part of its block is missing');
});
ok((html.match(/class="sfc-field"/g) || []).length === 4 && /display:inline-block/.test(html), 'each block is an inline block of its own (class sfc-field)', 'blocks: ' + (html.match(/class="sfc-field"/g) || []).length);
ok(document.getElementById('p-gate-says').textContent.indexOf('spirit/run/<file>.js::<function>') !== -1, 'an empty field says what goes in it', document.getElementById('p-gate-says').textContent);
ok(F.html('q-').indexOf('id="q-gate"') !== -1 && F.html('q-').indexOf('id="p-gate"') === -1, 'another prefix gives other ids', 'html(q-) has no q-gate');

test.subHeading('why: the gate is one function, never a whole module');
type({ gate: '' });
ok(F.why(PRE, 'gate') === '', 'an empty gate is not wrong yet', F.why(PRE, 'gate'));
type({ gate: 'spirit/run/spirit/peerPost.js' });
ok(/a whole module as the gate is cheating: name one function, spirit\/run\/spirit\/peerPost\.js::<function>/.test(F.why(PRE, 'gate')), 'a whole module as the gate is cheating', F.why(PRE, 'gate'));
type({ gate: 'spirit/run/spirit/peerPost.js::createPeerPost' });
ok(F.why(PRE, 'gate') === '', 'spirit/run/<file>.js::<function> is a gate', F.why(PRE, 'gate'));
['peerPost.js::x', 'spirit/run/a.js::1x', 'spirit/run/../a.js::x', 'spirit/run/a.ts::x'].forEach(function (v) {
  type({ gate: v });
  ok(F.why(PRE, 'gate') === 'a gate is spirit/run/<file>.js::<function>', JSON.stringify(v) + ' is refused as no gate', JSON.stringify(v) + ': ' + F.why(PRE, 'gate'));
});
type({ gate: '  spirit/run/a.js::f  ' });
ok(F.why(PRE, 'gate') === '', 'a gate is read trimmed', F.why(PRE, 'gate'));

test.subHeading('why: the endpoint is a whole module, or Node\'s own');
type({ endpoint: 'spirit/run/a/b.js' });
ok(F.why(PRE, 'endpoint') === '', 'a whole module is an endpoint', F.why(PRE, 'endpoint'));
type({ endpoint: 'spirit/run/a.js::f' });
ok(/not one function/.test(F.why(PRE, 'endpoint')), 'one function is no endpoint', F.why(PRE, 'endpoint'));
type({ endpoint: 'node:http+https+fetch', paths: '/api/' });
ok(F.why(PRE, 'endpoint') === '', 'node:http+https+fetch is an endpoint', F.why(PRE, 'endpoint'));
type({ endpoint: 'node:http+ftp+tcp', paths: '/api/' });
ok(/Node's own are http, https, fetch, joined by \+; not ftp, tcp/.test(F.why(PRE, 'endpoint')), 'a kind Node\'s own does not hold is named', F.why(PRE, 'endpoint'));
type({ endpoint: 'lib/a.js' });
ok(/an endpoint is spirit\/run\/<file>\.js/.test(F.why(PRE, 'endpoint')), 'anything else is refused, saying what an endpoint is', F.why(PRE, 'endpoint'));
type({ endpoint: '' });
ok(F.why(PRE, 'endpoint') === '', 'an empty endpoint is not wrong yet', F.why(PRE, 'endpoint'));

test.subHeading('why: paths belong to a node: endpoint');
type({ endpoint: 'node:http', paths: '' });
ok(/a node: endpoint needs its request paths/.test(F.why(PRE, 'paths')), 'a node: endpoint without paths is wrong', F.why(PRE, 'paths'));
type({ endpoint: 'spirit/run/a.js', paths: '/a/' });
ok(/paths belong to a node: endpoint; a module takes none/.test(F.why(PRE, 'paths')), 'a module with paths is wrong', F.why(PRE, 'paths'));
type({ endpoint: 'node:http', paths: '/api/relay/, /x y' });
ok(/the path \/x y is no request path/.test(F.why(PRE, 'paths')), 'a path with a space is no request path, named', F.why(PRE, 'paths'));
type({ endpoint: 'node:http', paths: 'api/' });
ok(/the path api\/ is no request path/.test(F.why(PRE, 'paths')), 'a path not starting with / is no request path', F.why(PRE, 'paths'));
type({ endpoint: 'node:http', paths: ' /api/relay/ , /b%20c ' });
ok(F.why(PRE, 'paths') === '', 'comma-separated request paths, trimmed, are right', F.why(PRE, 'paths'));
type({ endpoint: 'spirit/run/a.js', paths: '' });
ok(F.why(PRE, 'paths') === '', 'a module with no paths is right', F.why(PRE, 'paths'));

test.subHeading('why: suites are file names, each once');
type({ suites: 'a.js, b-c.js' });
ok(F.why(PRE, 'suites') === '', 'comma-separated file names are suites', F.why(PRE, 'suites'));
type({ suites: 'a.js, test/b.js' });
ok(F.why(PRE, 'suites') === 'test/b.js is not a suite\'s file name, <name>.js, with no folder', 'a folder in a suite is refused, naming it', F.why(PRE, 'suites'));
type({ suites: 'a' });
ok(/a is not a suite's file name/.test(F.why(PRE, 'suites')), 'a name without .js is refused', F.why(PRE, 'suites'));
type({ suites: 'a.js, b.js, a.js' });
ok(F.why(PRE, 'suites') === 'a suite is named twice', 'a suite named twice is refused', F.why(PRE, 'suites'));
type({ suites: '' });
ok(F.why(PRE, 'suites') === '', 'no suites is not wrong', F.why(PRE, 'suites'));

test.subHeading('why: no field past 256 characters');
type({ suites: 'a'.repeat(254) + '.js' });
ok(F.why(PRE, 'suites') === '257 characters, the limit is 256', 'a field past 256 characters says its length and the limit', F.why(PRE, 'suites'));
type({ gate: 'spirit/run/' + 'a'.repeat(239) + '.js::f' });
ok(F.why(PRE, 'gate') === '', 'a field at 256 characters is still read', 'gate length ' + field('gate').value.length + ': ' + F.why(PRE, 'gate'));

test.subHeading('check: says each field, says what is wrong, the button off while wrong');
type(GOOD);
let right = F.check(PRE, 'p-go');
ok(right === true && button.disabled === false, 'all right: check answers true and the button is on', 'answered ' + right + ', disabled ' + button.disabled);
ok(document.getElementById('p-gate-says').textContent === 'one function, createPeerPost, in spirit/run/spirit/peerPost.js', 'a right gate says what it means', document.getElementById('p-gate-says').textContent);
ok(document.getElementById('p-endpoint-says').textContent === 'every function of spirit/run/spirit/presenceNode.js', 'a right module endpoint says every function of it', document.getElementById('p-endpoint-says').textContent);
ok(document.getElementById('p-suites-says').textContent === 'the test suites run while the probe watches: a.js, b.js', 'right suites say themselves', document.getElementById('p-suites-says').textContent);
ok(document.getElementById('p-paths-says').textContent.indexOf('comma-separated') !== -1, 'empty paths say what goes in them', document.getElementById('p-paths-says').textContent);
ok(F.FIELDS.every(function (f) { const l = document.getElementById(PRE + f + '-left'); return l.textContent === '' && l.className === 'job-start-error'; }), 'no wrong line says anything', 'a -left line is filled');
type(Object.assign({}, GOOD, { endpoint: 'node:http+fetch', paths: '/api/' }));
F.check(PRE, 'p-go');
ok(document.getElementById('p-endpoint-says').textContent === 'Node\'s own network calls: http, fetch' && document.getElementById('p-paths-says').textContent === 'only the requests to /api/',
  'a node: endpoint says Node\'s own calls; its paths say the requests watched', document.getElementById('p-endpoint-says').textContent + ' / ' + document.getElementById('p-paths-says').textContent);
type(Object.assign({}, GOOD, { gate: 'spirit/run/a.js' }));
right = F.check(PRE, 'p-go');
ok(right === false && button.disabled === true, 'one field wrong: check answers false and the button is off', 'answered ' + right + ', disabled ' + button.disabled);
ok(/cheating/.test(document.getElementById('p-gate-left').textContent) && document.getElementById('p-gate-says').textContent.indexOf('the one function') === 0,
  'the wrong field says why below it, and its head line says what goes in it', document.getElementById('p-gate-left').textContent);
let threw = null; try { right = F.check(PRE); } catch (e) { threw = e; }
ok(!threw && right === false, 'without a button id check still answers', 'threw ' + short(threw && threw.message));

test.subHeading('door: the values as typed; fill: a door put in the form');
type({ gate: ' g ', endpoint: ' e ', paths: ' /a , ,/b ', suites: 'x.js,y.js' });
const d = F.door(PRE);
ok(JSON.stringify(d) === JSON.stringify({ gate: 'g', endpoint: 'e', paths: ['/a', '/b'], suites: ['x.js', 'y.js'] }), 'door answers gate and endpoint trimmed, paths and suites as lists, the empty dropped', short(d));
F.fill(PRE, { gate: 'G', endpoint: 'E', paths: ['/p', '/q'], suites: ['s.js'] });
ok(field('gate').value === 'G' && field('endpoint').value === 'E' && field('paths').value === '/p, /q' && field('suites').value === 's.js', 'fill puts the values in, lists joined by ", "',
  short(F.FIELDS.map(function (f) { return field(f).value; })));
F.fill(PRE, null);
ok(F.FIELDS.every(function (f) { return field(f).value === ''; }), 'fill with no door empties the form', short(F.FIELDS.map(function (f) { return field(f).value; })));
F.fill(PRE, { gate: 'G', paths: 'not a list' });
ok(field('gate').value === 'G' && field('paths').value === '' && field('endpoint').value === '', 'a value that is not a list fills nothing; a missing one empties', short(F.FIELDS.map(function (f) { return field(f).value; })));
let threw2 = null; try { F.fill('none-', { gate: 'x' }); F.door('none-'); F.why('none-', 'gate'); } catch (e) { threw2 = e; }
ok(!threw2 && JSON.stringify(F.door('none-')) === JSON.stringify({ gate: '', endpoint: '', paths: [], suites: [] }), 'a prefix with no form reads empty and fills nothing, harmlessly', 'threw ' + short(threw2 && threw2.message));

test.reportSuccessFailureCount();
