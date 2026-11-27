'use strict';

// spirit/run/spirit/element/search/branch/list/test/script.js
// The tests of spirit/element/search/branch/list/script.js, and of no other module (spec: ./script.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it; the row element and
// the family selector are stand-ins that keep what they were handed. The node's branch branch is the spirit object's
// (goal/G49.21: the auth branch's branch table is spirit.branch, spirit/branch/script.js), each search recorded; its client,
// spirit/branch/client/script.js, is the real one, on the page's real data set.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'branch', 'list', 'script.js');

const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function node(tag) {
  const heard = {};
  const n = { tag: tag, kids: [], style: {}, hidden: false, className: '', value: '',
    appendChild: function (c) { n.kids.push(c); return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    removeEventListener: function () {},
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; } };
  let html = '';
  Object.defineProperty(n, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); n.kids.length = 0; } });
  return n;
}
function within(root, x) { if (root === x) return true; return (root.kids || []).some(function (k) { return within(k, x); }); }

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let asked, required, loaded, lists, families, E, host, made, l, o, fam, sel, branchClient;
const listed = function () { return E && E.search && E.search.branch && E.search.branch.list && typeof E.search.branch.list.create === 'function'; };

test.run('the list runs on a bare window, with the page\'s data set real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  asked = [];
  required = [];
  lists = [];
  families = [];
  // goal/G49.21: one verb per operation, spirit.branch.search, no op argument.
  const branchBranch = { search: function (a) { asked.push(a); return Promise.resolve({ items: [{ key: '3', label: JSON.stringify({ id: 3, bundle: 7, family: 'desk', verb: '' }) }], more: false }); } };
  const STANDS = {
    'spirit/element/search/script.js': function (E) { E.search = Object.assign(E.search || {}, { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }); },
    // The real row element requires the branch branch's script.js as it runs (goal/G41.28, G47.1, G49.21); its stand-in does the same.
    // goal/G49.23: written at its place as the stand-ins beside it.
    'spirit/element/search/branch/row/script.js': function (E) { global.window.spirit.requireScript('spirit/branch/script.js'); ((E.search = E.search || {}).branch = E.search.branch || {}).row = { create: function (row) { return { kind: 'branch', row: row }; } }; },
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'spirit/element/search/api/script.js': function (E) { (E.search = E.search || {}).api = { create: function (c, o) { const f = node('family'); f.o = o || {}; f.container = c; f.family = ''; f.verb = ''; families.push(f); c.appendChild(f); return f; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, readyPromise: Promise.resolve({}), element: {} } };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // The page's one data set (spirit/client/script.js), which spirit.js brings with the client.
  // goal/G49.23: the store places nothing itself; run as the page's loader runs it, it stands at spirit.client, and is what it hands back.
  const DATA = PAGE_LOAD.runAsPage('spirit/client/script.js');
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.nodeFacts = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // The branch branch's script.js brings its client, as the real one does (goal/G47.1; goal/G49.21: <branch>/script.js and
  // <branch>/client/script.js): the real client run once as the page runs it, filing into the data set, and put on the branch as
  // its client (goal/G49.23, box v22 Part 1). What that client asks as it runs is the branch's, not the list's, so it is not recorded.
  let ran = false;
  let recording = true;
  // EACH STAND-IN IS requireScript's ANSWER (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers"; Andy:
  // "spirit.requireScript must allways return either an object or a function... or fail/throw"): what the stand-in made for its
  // path, read where the loader would place it (a folder's script.js at its folder's name), or an object for a part it has none of.
  const standIn = function (p) {
    const keys = String(p).replace(/\.js$/, '').split('/'); if (keys[keys.length - 1] === 'script') keys.pop();
    const v = keys.slice(1).reduce(function (o, k) { return o == null ? undefined : o[k]; }, global.window.spirit); // goal/G49.23: on the spirit object itself
    return v && (typeof v === 'object' || typeof v === 'function') ? v : {};
  };
  branchClient = function () { return branchBranch.client; };
  global.window.spirit.requireScript = function (p) {
    if (recording) required.push(String(p));
    if (p === 'spirit/branch/script.js' && !ran) { ran = true; recording = false; try { branchBranch.client = PAGE_LOAD.runAsPage('spirit/branch/client/script.js'); } finally { recording = true; } }
    if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p]((global.window.spirit.element = global.window.spirit.element || {})); }
    return Promise.resolve(p === 'spirit/branch/script.js' ? branchBranch : p === 'spirit/client/script.js' ? DATA : standIn(p));
  };
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  E = global.window.spirit.element || {};
  // What was asked as it loaded, kept apart from what this process asks later (the runner's own reports go through the
  // same window.spirit.requireScript).
  loaded = required.slice();
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26)
test.run('it requires the search element, its row element and the branch selector through spirit.requireScript', 0.2, function () {
  if (!required) return false;
  return ['spirit/element/search/script.js', 'spirit/element/search/branch/row/script.js', 'spirit/element/search/api/script.js'].every(function (p) { return required.indexOf(p) !== -1; }) ? true : false;
}, test.limit.quick);
test.run('it requires the branch branch\'s interface, spirit/branch/script.js', 0.2, function () {
  if (!loaded) return false;
  return loaded.indexOf('spirit/branch/script.js') !== -1 || false;
}, test.limit.quick);
test.run('as it loads, it requires no data script and no branch client, as only a branch\'s script.js requires its client', 0.2, function () {
  if (!loaded) return false;
  // goal/G49.21, G49.23: a branch's client is <branch>/client/script.js (the old data.js); the store, spirit/client/script.js, is none.
  return !loaded.some(function (p) { return /data\.js$/.test(p) || /^spirit\/.+\/client\/script\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
test.run('it registers spirit.element.search.branch.list.create', 0.2, function () {
  if (!E) return false;
  return listed() ? true : false;
}, test.limit.quick);

// one bundle's branches, searched at spirit.branch.search
test.run('it draws one probabilitySearch inside the host it is given', 0.2, async function () {
  if (!listed()) return false;
  host = node('host');
  made = E.search.branch.list.create(host, { bundle: 7, face: 'pane', columns: ['family', 'verb', 'delete'] });
  await settle();
  l = lists[0];
  if (l) o = l.o;
  return !!l && within(host, l.host) ? true : false;
}, test.limit.quick);
test.run('it fills as soon as it is drawn', 0.2, function () {
  if (!l) return false;
  return l.refreshes >= 1 ? true : false;
}, test.limit.quick);
// goal/G41.14: a view of the node's branches, kept current by the node's stream, so every branch list on a page agrees;
// goal/G41.28: the branch the branch branch's client keeps; goal/G49.23: the search is handed a handle on it, not its path.
test.run('it is a view of the branch branch\'s rows as its client keeps them in the spirit object\'s cache', 0.2, function () {
  if (!l) return false;
  const C = branchClient ? branchClient() : null;
  return !!C && typeof C.branch === 'string' && C.branch !== '' && !!o.data && o.data.path === C.branch && typeof o.data.rows === 'function' ? true : false;
}, test.limit.quick);
let got;
test.run('its search asks spirit.branch.search for the bundle\'s branches with the trimmed text, through the spirit object', 0.2, async function () {
  if (!l) return false;
  got = await o.search(o.args(' cha ', {}));
  return o.api === 'spirit/branch/script.js' && o.verb === 'search' && asked.length === 1 && asked[0].text === 'cha' && asked[0].bundle === 7 ? true : false;
}, test.limit.quick);
test.run('the search answers as a reply carrying its items and whether there are more', 0.2, function () {
  if (!l) return false;
  return got && got.status === 200 && got.body && got.body.items.length === 1 && got.body.more === false ? true : false;
}, test.limit.quick);
test.run('the columns option names the row\'s fields the list shows, in order', 0.2, function () {
  if (!l) return false;
  return JSON.stringify((o.columns || []).map(function (c) { return c.field; })) === '["family","verb","delete"]' ? true : false;
}, test.limit.quick);
test.run('each row is a branchElement of that branch', 0.2, function () {
  if (!l) return false;
  const el = o.element({ id: 3, bundle: 7, family: 'desk', verb: '' }, '3');
  return el && el.kind === 'branch' && el.row.id === 3 && el.row.family === 'desk' ? true : false;
}, test.limit.quick);
// THE WHOLE ROW (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole row, as
// cached in spirit.required.spirit.data."): the list hands its search no matched() of its own.
test.run('it hands its search no matched function of its own, so the whole row is matched', 0.2, function () {
  if (!l) return false;
  return typeof o.matched !== 'function' ? true : false;
}, test.limit.quick);
// goal/G41.14: a picked branch is shown by what it reaches, never its number (Andy: "the bundleSelector shows a
// fucking number is selected instead of the fucking label").
test.run('a picked branch is shown as its branch and verb, or as its branch with (ALL), and never as its number', 0.2, function () {
  if (!l) return false;
  const nm = typeof o.name === 'function' ? [o.name({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }, '3'), o.name({ id: 4, bundle: 7, family: 'files', verb: '' }, '4')] : null;
  return nm && nm[0] === 'desk.chat.add' && nm[1] === 'files (ALL)' ? true : false;
}, test.limit.quick);

// its filter: the family selector, its verb half with it
// Andy, box: "the branchSelector element will use the standard apiFamilySelector and apiVerbSelector elements as
// pickers for family and verb search filters, if no valid family is selected, the verb selector is invisible, set to
// \"(ALL)\"", and since: "apiFamiliySelector.js will use apiVerbSelector as part of itself". The verb half's hiding
// is the family selector's own (its test).
// goal/G41.26, Andy: "any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the
// user-can see, which elements belong to the search." The shape (cw, under his go): the branch list's family selector
// moves into the 🪣 row, handed to the search; no filter row of its own above the list.
test.run('it makes one branch selector and hands it to the search, for its 🪣 row', 0.2, function () {
  if (!l) return false;
  fam = families[0];
  sel = Array.isArray(l.o.selectors) ? l.o.selectors : [];
  return !!fam && families.length === 1 && sel.length === 1 && sel[0].element === fam && !!sel[0].name && typeof sel[0].test === 'function' ? true : false;
}, test.limit.quick);
test.run('the list draws no filter row of its own above itself', 0.2, function () {
  if (!fam) return false;
  return !host.kids.some(function (k) { return k !== l.host && !within(k, l.host) && (k === fam.container || within(k, fam)); }) ? true : false;
}, test.limit.quick);
test.run('the branch selector\'s test narrows by the branch and verb chosen, and passes every row when none is chosen', 0.2, function () {
  if (!fam) return false;
  return sel[0] && (fam.family = 'desk', fam.verb = '', sel[0].test({ family: 'files', verb: '' }) === 0 && sel[0].test({ family: 'desk', verb: 'chat.add' }) === 1) && (fam.family = '', sel[0].test({ family: 'files' }) === 1) ? true : false;
}, test.limit.quick);
test.run('with nothing chosen, the search narrows by neither branch nor verb', 0.2, async function () {
  if (!fam) return false;
  asked.length = 0;
  await o.search(o.args('', {}), 'branch');
  return asked[0] && !asked[0].family && !asked[0].verb ? true : false;
}, test.limit.quick);
test.run('a branch chosen searches again, narrowed by the branch', 0.2, async function () {
  if (!fam) return false;
  const r0 = l.refreshes;
  fam.family = 'desk'; fam.verb = ''; fam.value = 'desk'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  asked.length = 0;
  await o.search(o.args('', {}), 'branch');
  return l.refreshes > r0 && asked[0] && asked[0].family === 'desk' && !asked[0].verb ? true : false;
}, test.limit.quick);
test.run('a verb chosen searches again, narrowed by the branch and the verb', 0.2, async function () {
  if (!fam) return false;
  const r1 = l.refreshes;
  fam.verb = 'chat.add'; fam.value = 'desk.chat.add'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  asked.length = 0;
  await o.search(o.args('', {}), 'branch');
  return l.refreshes > r1 && asked[0] && asked[0].family === 'desk' && asked[0].verb === 'chat.add' ? true : false;
}, test.limit.quick);

// refresh and destroy are the search element's
test.run('refresh and destroy reach the search element, and the handle\'s list is that element', 0.2, function () {
  if (!l) return false;
  const r2 = l.refreshes;
  made.refresh(); made.destroy();
  return l.refreshes === r2 + 1 && l.destroyed === true && made.list === l ? true : false;
}, test.limit.quick);
// goal/G41.19, box v23: "destroy empties it".
test.run('destroy leaves its host empty, the filters included', 0.2, function () {
  if (!l) return false;
  return host.kids.length === 0 ? true : false;
}, test.limit.quick);
