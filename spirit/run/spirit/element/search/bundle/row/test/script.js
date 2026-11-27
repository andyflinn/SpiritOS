'use strict';

// spirit/run/spirit/element/search/bundle/row/test/script.js
// The tests of spirit/element/search/bundle/row/script.js, and of no other module (spec: ./script.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. What it
// requires is put there then: the shared row element real. The field input real and the arming button and branch editor
// as recording stand-ins are offered too, though since goal/G41.26 and G41.32 it asks for none of them. The node's bundle branch is the spirit object's, each call recorded
// (goal/G49.21: the auth branch's bundle table is the spirit.bundle branch, spirit/bundle/script.js, its client spirit/bundle/client/script.js).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const JS = path.join(RUN, 'spirit', 'element');
const FILE = path.join(JS, 'search', 'bundle', 'row', 'script.js');

const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function node(tag) {
  const heard = {};
  const n = { tag: tag, kids: [], style: {}, className: '', innerHTML: '', value: '', attrs: {},
    appendChild: function (c) { n.kids.push(c); return c; },
    setAttribute: function (k, v) { n.attrs[k] = String(v); }, getAttribute: function (k) { return k in n.attrs ? n.attrs[k] : null; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    removeEventListener: function () {},
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; },
    heard: heard,
    querySelector: function (sel) {
      const all = []; (function walk(x) { x.kids.forEach(function (k) { all.push(k); walk(k); }); }(n));
      const m = /^\[data-action="([^"]+)"\]$/.exec(sel);
      if (m) return all.filter(function (k) { return k.attrs['data-action'] === m[1]; })[0] || null;
      if (sel === 'input') return all.filter(function (k) { return k.tag === 'input'; })[0] || null;
      return null;
    },
  };
  return n;
}
// A cell as the list hands one to mount: its html set by the paint, its controls made from it as a page parses it.
function cell() {
  const c = node('td');
  let html = '';
  Object.defineProperty(c, 'innerHTML', { get: function () { return html; }, set: function (v) {
    html = String(v); c.kids.length = 0;
    const b = /<button[^>]*data-action="([^"]+)"[^>]*>([^<]*)</.exec(html);
    if (b) { const k = node('button'); k.attrs['data-action'] = b[1]; k.textContent = b[2]; c.kids.push(k); }
  } });
  return c;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
// An element that counts on what it did not load throws inside a promise: the reporter fails the test it ran in.
let recording = true;
let asked, required, loaded, armed, opened, DATA, V, E, A, el, cells, ed, hosts;
let answer = function () { return Promise.resolve({ id: 7 }); };
const hasA = function () { return !!(A && typeof A.row === 'function'); };
const hasRow = function () { return hasA() && !!(E.search && E.search.bundle && E.search.bundle.row && typeof E.search.bundle.row.create === 'function'); };
const cellsOf = function (r) { const out = {}; (r.cells() || []).forEach(function (c) { out[c.name] = c.html; }); return out; };
// What the cell shows as text: its markup, and the text of what it holds that is no input.
const labelText = function () { return String(hosts.label.innerHTML || '') + hosts.label.kids.filter(function (k) { return !/input|textarea/i.test(k.tag || ''); }).map(function (k) { return String(k.textContent || ''); }).join(''); };

test.run('the row runs on a bare window, with the page\'s data set and the bundle branch\'s data real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  asked = [];
  required = [];
  armed = [];
  opened = [];
  // goal/G49.21: one verb per operation, spirit.bundle.add/get/search/delete, no op argument; each call recorded with its verb as call.
  const bundleBranch = {};
  ['add', 'get', 'search', 'delete'].forEach(function (v) { bundleBranch[v] = function (a) { asked.push(Object.assign({ call: v }, a)); return answer(a); }; });
  const load = function (p) { return PAGE_LOAD.runAsPage(path.join(RUN, p)); };
  // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ...
  // never by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a
  // function... or fail/throw"): each path answers what stands for it, made once; any other path is refused.
  const STANDS = {
    'spirit/element/row/script.js': function () { return load('spirit/element/row/script.js'); },
    'spirit/element/fieldInput/script.js': function () { return load('spirit/element/fieldInput/script.js'); },
    'spirit/element/armingButton/script.js': function () { return { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
    'spirit/element/search/bundle/detail/script.js': function () { return { open: function (o) { opened.push(o); return {}; } }; },
    // The bundle branch's interface (goal/G49.21): its client run once, as the real spirit/bundle/script.js requires it.
    // What the branch's own client asks as it runs is the branch's, not the row's (goal/G49.23): not recorded.
    'spirit/bundle/script.js': function () { const was = recording; recording = false; try { load('spirit/bundle/client/script.js'); } finally { recording = was; } return bundleBranch; },
    // THE DATA SET IS requireScript's ANSWER TOO (goal/G49.23): the element reads it from what spirit/client/script.js hands back, never at spirit.required.
    'spirit/client/script.js': function () { return global.window.spirit.required.spirit.data; },
  };
  const made = {};
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
    required: { spirit: {} }, normalizeString: LOADER.normalizeString, readyPromise: Promise.resolve({ bundle: bundleBranch }), bundle: bundleBranch, element: {} } };
  global.spirit = global.window.spirit;
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
  // The page's one data set (spirit/client/script.js), which spirit.js brings with the client: the stream's rows land there.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'client', 'script.js'), 'utf8'), { filename: 'data.js' });
  DATA = global.window.spirit.required.spirit.data;
  // THE DATA STORE IS spirit.dataStore (goal/G49.23; Andy: "spirit.dataStore is fine with me"), as spirit.js keeps it.
  global.window.spirit.dataStore = DATA;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.nodeFacts = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // The bundle branch's script requires its client, as the real one does: the real file run once, attaching
  // itself to the data set; the bundles are the bundle branch's (goal/G41.28; goal/G49.21, was the auth family's).
  // The direct writes below are the bundle branch's own view of the home node, its rows at rows/<id>, as its client files them.
  V = DATA.viewAt(null, 'bundle');
  global.window.spirit.requireScript = function (p) {
    if (recording) required.push(String(p));
    if (!Object.prototype.hasOwnProperty.call(STANDS, p)) return Promise.reject(new Error('no stand-in for ' + p));
    if (!Object.prototype.hasOwnProperty.call(made, p)) made[p] = STANDS[p]();
    return Promise.resolve(made[p]);
  };
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  E = ((global.window.spirit.required || {}).spirit || {}).element || {};
  A = ((global.window.spirit.required.spirit.data || {}).bundle || {}).data;
  // What was asked as it loaded, kept apart from what this process asks later (the runner's own reports go through the
  // same window.spirit.requireScript).
  loaded = required.slice();
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26)
// goal/G41.26: the label is shown only, so no field input is used, and none is asked of it.
test.run('it requires the shared row element through spirit.requireScript, and no arming button, because Delete is the branchEditor\'s', 0.2, function () {
  if (!required) return false;
  return required.indexOf('spirit/element/row/script.js') !== -1 && required.indexOf('spirit/element/armingButton/script.js') === -1 ? true : false;
}, test.limit.quick);
// goal/G49.21: the auth branch's interface is the bundle branch's, spirit/bundle/script.js.
test.run('it requires the bundle branch\'s interface, spirit/bundle/script.js, which puts the bundle branch\'s data on the page', 0.2, function () {
  if (!loaded) return false;
  return loaded.indexOf('spirit/bundle/script.js') !== -1 && hasA() ? true : false;
}, test.limit.quick);
// goal/G49.21: a branch's data script is its client/script.js, required by the branch's script.js alone.
test.run('as it loads, it requires no client script, as only a branch\'s script.js requires its client', 0.2, function () {
  if (!loaded) return false;
  return !loaded.some(function (p) { return /data\.js$|\/client\/script\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
test.run('it registers spirit.required.spirit.element.search.bundle.row.create', 0.2, function () {
  if (!hasA()) return false;
  return hasRow() ? true : false;
}, test.limit.quick);

// a bundle row: its label and owner
test.run('it is a row element of kind bundle, keyed by the bundle\'s id', 0.2, function () {
  if (!hasRow()) return false;
  el = E.search.bundle.row.create({ id: 7, label: 'Read <files>' });
  return el.kind === 'bundle' && el.key === '7' && el.row.label === 'Read <files>' ? true : false;
}, test.limit.quick);
// goal/G41.25, box: "the bundleSelector's list will gain a new column \"owner\", displayed right after the bundles label."
// goal/G41.32: "the bundleSelector:pane looses both the 'Edit' button and the 'Delete' Button."
test.run('its fields are label and owner, in that order', 0.2, function () {
  if (!el) return false;
  cells = cellsOf(el);
  return JSON.stringify(Object.keys(cells)) === '["label","owner"]' ? true : false;
}, test.limit.quick);
test.run('the owner is shown as the bundle names it and never as an input, since it never changes after the add', 0.2, function () {
  if (!hasRow()) return false;
  const owCells = cellsOf(E.search.bundle.row.create({ id: 9, label: 'Agent tools', owner: 'agent' }));
  return /\bagent\b/.test(owCells.owner || '') && !/<input/.test(owCells.owner || '') ? true : false;
}, test.limit.quick);
test.run('the owner is drawn escaped', 0.2, function () {
  if (!hasRow()) return false;
  const oddCells = cellsOf(E.search.bundle.row.create({ id: 10, label: 'x', owner: 'a<b' }));
  return /a&lt;b/.test(oddCells.owner || '') && !/a<b/.test(oddCells.owner || '') ? true : false;
}, test.limit.quick);
test.run('the label is drawn escaped', 0.2, function () {
  if (!cells) return false;
  return (/Read &lt;files>/).test(cells.label || '') && !/<files>/.test(cells.label || '') ? true : false;
}, test.limit.quick);

// the label is shown only (goal/G41.26)
// Andy, box: "bundleSelector:pane mode the Label should now just be an output, field: A bundles label is determined
// when it's added, and cannot be modified. This will protect family owned bundles from having their label mutilated."
// Mounted, with the old editable option or without it, the label cell shows the label and holds no input.
test.run('once mounted, its label cell holds no input, whether it was made editable or not', 0.2, async function () {
  if (!hasRow()) return false;
  ed = E.search.bundle.row.create({ id: 7, label: 'Read <files>' }, { editable: true });
  hosts = { label: cell(), owner: cell() };
  ed.mount(hosts);
  await settle();
  return !hosts.label.querySelector('input') && !hosts.label.kids.some(function (k) { return /input|textarea/i.test(k.tag || ''); }) ? true : false;
}, test.limit.quick);
test.run('the mounted row shows the label escaped', 0.2, function () {
  if (!ed) return false;
  return (/Read &lt;files>|Read <files>/).test(labelText()) && !/<files>/.test(String(hosts.label.innerHTML || '')) ? true : false;
}, test.limit.quick);
test.run('the mounted row never asks the node for a set', 0.2, function () {
  if (!ed) return false;
  // goal/G49.21: the bundle branch's verbs are add, get, search and delete; none sets a bundle.
  return asked.every(function (a) { return a.op !== 'set' && a.call !== 'set'; }) ? true : false;
}, test.limit.quick);
// rule/19: a ui only draws what the server's stream says; goal/G41.14, Andy: "EVERY FUCKING element MUST FUCKING
// LISTING to anything that changes their data set". The row repaints from the bundle branch's rows (goal/G49.21).
test.run('when the bundle\'s row in the bundles changes, the row repaints its label', 0.2, async function () {
  if (!ed) return false;
  V.set('rows/7', { id: 7, label: 'Mover' });
  await settle();
  return ed.row.label === 'Mover' && /Mover/.test(labelText()) ? true : false;
}, test.limit.quick);
test.run('another bundle\'s row changes nothing here', 0.2, async function () {
  if (!ed) return false;
  V.set('rows/8', { id: 8, label: 'Someone else' });
  await settle();
  return ed.row.label === 'Mover' ? true : false;
}, test.limit.quick);

// the type's own element takes the node's bundle rows from the stream (goal/G41.14)
// The row element is the data type's code (G30.18: "rowElements carry the listeners and painters a subject needs
// for real-time updates"); it is loaded with every list of its kind, and since goal/G41.28 the rows are taken by the
// auth family's data.js, which comes with the auth api.js it requires. Andy: "DOESN'T THAT SHIT BELONG INSIDE THE MOTHERFUCKING element??????", "i ruled a LONG time AGO THAT FUCKING ELEMENTS
// carry THEIR FUCKING DESCRIPTIONS". The node publishes each changed row of its two bundle tables on one permanent job
// of type bundles, as the shadow job does each contact row: { table, row }, and { table, row: { id }, gone: true }.
// goal/G49.21: the rows come on the bundle branch's own job, spirit.bundle, { row }, gone when deleted.
test.run('a bundle row published lands in the bundle branch\'s rows by its id, through the client that comes with the script.js the row requires', 0.2, function () {
  if (!hasA()) return false;
  DATA.takeJob({ id: 'spirit.bundle', data: { row: { id: 7, label: 'Reader' } } });
  return JSON.stringify(A.row({ id: 7, label: 'Reader' }.id)) === JSON.stringify({ id: 7, label: 'Reader' }) ? true : false;
}, test.limit.quick);
test.run('a row published again replaces the one kept', 0.2, function () {
  if (!hasA()) return false;
  DATA.takeJob({ id: 'spirit.bundle', data: { row: { id: 7, label: 'Lister' } } });
  const again = A.row({ id: 7, label: 'Reader' }.id);
  return again && again.label === 'Lister' ? true : false;
}, test.limit.quick);
test.run('a row published as gone is taken out', 0.2, function () {
  if (!hasA()) return false;
  DATA.takeJob({ id: 'spirit.bundle', data: { row: { id: { id: 7, label: 'Reader' }.id }, gone: true } });
  return A.row({ id: 7, label: 'Reader' }.id) === null ? true : false;
}, test.limit.quick);
// goal/G49.21: the other table is the spirit.branch branch, its rows on its own job.
test.run('rows of the branch table, rows of another job and a row with no id write nothing in the bundles', 0.2, function () {
  if (!hasA()) return false;
  const before = JSON.stringify(A.rows());
  DATA.takeJob({ id: 'spirit.branch', data: { row: { id: 99, label: 'x', bundle: 1, family: 'f', verb: '' } } });
  DATA.takeJob({ id: 'spirit.contact', data: { row: { id: 98 } } });
  DATA.takeJob({ id: 'spirit.bundle', data: { row: { label: 'no id' } } });
  return JSON.stringify(A.rows()) === before ? true : false;
}, test.limit.quick);
