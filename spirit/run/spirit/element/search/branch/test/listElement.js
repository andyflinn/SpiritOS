'use strict';

// spirit/run/spirit/element/search/branch/test/listElement.js
// The tests of spirit/element/search/branch/listElement.js, and of no other module (spec: ./listElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it; the row element and
// the family selector are stand-ins that keep what they were handed. The node's auth family is the spirit
// object's, each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'branch', 'listElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
let asked, required, lists, families, managers, E, host, made, l, o, fam, sel;
const NO_E = 'the list never ran: the world failed';
const NO_LIST = 'no list element registered';
const NO_SEARCH = 'the list drew no search';
const NO_FAM = 'the list made no family selector';
const listed = function () { return E && E.search && E.search.branch && E.search.branch.listElement && typeof E.search.branch.listElement.create === 'function'; };

test.run('the world: the list runs on a bare window, the page\'s data set real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/branch/listElement.js is not there';
  asked = [];
  required = [];
  lists = [];
  families = [];
  const auth = { branch: function (a) { asked.push(a); return Promise.resolve({ items: [{ key: '3', label: JSON.stringify({ id: 3, bundle: 7, family: 'desk', verb: '' }) }], more: false }); } };
  const STANDS = {
    'spirit/element/search.js': function (E) { E.search = Object.assign(E.search || {}, { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }); },
    // The real row element loads the auth family's cache manager as it runs (goal/G41.28); its stand-in does the same.
    'spirit/element/search/branch/rowElement.js': function (E) { global.window.spirit.cacheManager('auth'); require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'))(global.window.spirit, 'spirit/element/search/branch/rowElement.js', { create: function (row) { return { kind: 'branch', row: row }; } }); },
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'spirit/element/search/api.js': function (E) { (E.search = E.search || {}).api = { create: function (c, o) { const f = node('family'); f.o = o || {}; f.container = c; f.family = ''; f.verb = ''; families.push(f); c.appendChild(f); return f; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({ auth: auth }), auth: auth, element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // The page's one data set (spirit/data.js), which spirit.js brings with the client.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  const DATA = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
  managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  return true;
}, 1000);

// it loads what it uses itself (rule/26)
test.run('it requires the search element, its row element and the family selector through spirit.require, and no data script (Andy: "NO FUCKING DATA SCRIPT")', 0.2, function () {
  if (!required) return NO_E;
  return ['spirit/element/search.js', 'spirit/element/search/branch/rowElement.js', 'spirit/element/search/api.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }) ? true : 'required: ' + short(required);
}, 1000);
test.run('it registers spirit.element.spirit.element.search.branch.listElement.create', 0.2, function () {
  if (!E) return NO_E;
  return listed() ? true : 'elements: ' + short(Object.keys(E));
}, 1000);

// one bundle's branches, searched at auth.branch
test.run('it draws one probabilitySearch inside the host it is given', 0.2, async function () {
  if (!listed()) return NO_LIST;
  host = node('host');
  made = E.search.branch.listElement.create(host, { bundle: 7, face: 'pane', columns: ['family', 'verb', 'delete'] });
  await settle();
  l = lists[0];
  if (l) o = l.o;
  return !!l && within(host, l.host) ? true : 'lists: ' + lists.length;
}, 1000);
test.run('it fills as soon as it is drawn', 0.2, function () {
  if (!l) return NO_SEARCH;
  return l.refreshes >= 1 ? true : 'refreshes: ' + l.refreshes;
}, 1000);
// goal/G41.14: a view of the node's branches, kept current by the node's stream, so every branch list on a page agrees;
// goal/G41.28: the branch the auth family's cache manager keeps.
test.run('it is a view of the auth family\'s branches (spirit.data.auth.data.branches.branch), the spirit object\'s cache', 0.2, function () {
  if (!l) return NO_SEARCH;
  const B = ((global.window.spirit.data || {}).auth || {}).data && global.window.spirit.data.auth.data.branches;
  return !!B && typeof B.branch === 'string' && B.branch !== '' && o.data === B.branch ? true : 'data: ' + short(o.data) + ', authReads.branches.branch ' + short(B && B.branch);
}, 1000);
let got;
test.run('its search asks auth.branch { op: search, text, bundle } through the spirit object, the text trimmed', 0.2, async function () {
  if (!l) return NO_SEARCH;
  got = await o.search(o.args(' cha ', {}));
  return o.server === 'auth' && o.verb === 'branch' && asked.length === 1 && asked[0].op === 'search' && asked[0].text === 'cha' && asked[0].bundle === 7 ? true : 'asked: ' + short(asked);
}, 1000);
test.run('and answers as a reply: { items, more }', 0.2, function () {
  if (!l) return NO_SEARCH;
  return got && got.status === 200 && got.body && got.body.items.length === 1 && got.body.more === false ? true : 'got: ' + short(got);
}, 1000);
test.run('opts.columns names the row\'s fields it shows, in order', 0.2, function () {
  if (!l) return NO_SEARCH;
  return JSON.stringify((o.columns || []).map(function (c) { return c.field; })) === '["family","verb","delete"]' ? true : 'columns: ' + short(o.columns);
}, 1000);
test.run('each row is a branchElement of that branch', 0.2, function () {
  if (!l) return NO_SEARCH;
  const el = o.element({ id: 3, bundle: 7, family: 'desk', verb: '' }, '3');
  return el && el.kind === 'branch' && el.row.id === 3 && el.row.family === 'desk' ? true : 'element: ' + short(el);
}, 1000);
// THE WHOLE ROW (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole row, as
// cached in spirit.data."): the list hands its search no matched() of its own.
test.run('it hands its search no matched(): the whole row is matched (goal/G41.28)', 0.2, function () {
  if (!l) return NO_SEARCH;
  return typeof o.matched !== 'function' ? true : 'it still hands matched(): ' + short(o.matched);
}, 1000);
// goal/G41.14: a picked branch is shown by what it reaches, never its number (Andy: "the bundleSelector shows a
// fucking number is selected instead of the fucking label").
test.run('a picked branch is shown as family.verb, or family (ALL), never its number', 0.2, function () {
  if (!l) return NO_SEARCH;
  const nm = typeof o.name === 'function' ? [o.name({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }, '3'), o.name({ id: 4, bundle: 7, family: 'files', verb: '' }, '4')] : null;
  return nm && nm[0] === 'desk.chat.add' && nm[1] === 'files (ALL)' ? true : 'name: ' + short(nm);
}, 1000);

// its filter: the family selector, its verb half with it
// Andy, box: "the branchSelector element will use the standard apiFamilySelector and apiVerbSelector elements as
// pickers for family and verb search filters, if no valid family is selected, the verb selector is invisible, set to
// \"(ALL)\"", and since: "apiFamiliySelector.js will use apiVerbSelector as part of itself". The verb half's hiding
// is the family selector's own (its test).
// goal/G41.26, Andy: "any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the
// user-can see, which elements belong to the search." The shape (cw, under his go): the branch list's family selector
// moves into the 🪣 row, handed to the search; no filter row of its own above the list.
test.run('it makes one family selector and hands it to the search, for its 🪣 row', 0.2, function () {
  if (!l) return NO_SEARCH;
  fam = families[0];
  sel = Array.isArray(l.o.selectors) ? l.o.selectors : [];
  return !!fam && families.length === 1 && sel.length === 1 && sel[0].element === fam && !!sel[0].name && typeof sel[0].test === 'function' ? true : 'families ' + families.length + ', selectors ' + short(sel.map(function (x) { return { name: x.name, fam: x.element === fam }; }));
}, 1000);
test.run('no filter row of its own above the list', 0.2, function () {
  if (!fam) return NO_FAM;
  return !host.kids.some(function (k) { return k !== l.host && !within(k, l.host) && (k === fam.container || within(k, fam)); }) ? true : 'host holds: ' + short(host.kids.map(function (k) { return k.className || k.tag; }));
}, 1000);
test.run('its test narrows by the family and verb chosen, every row when none is', 0.2, function () {
  if (!fam) return NO_FAM;
  return sel[0] && (fam.family = 'desk', fam.verb = '', sel[0].test({ family: 'files', verb: '' }) === 0 && sel[0].test({ family: 'desk', verb: 'chat.add' }) === 1) && (fam.family = '', sel[0].test({ family: 'files' }) === 1) ? true : 'test: ' + short(sel[0] && 'given');
}, 1000);
test.run('nothing chosen: the search narrows by neither family nor verb', 0.2, async function () {
  if (!fam) return NO_FAM;
  asked.length = 0;
  await o.search(o.args('', {}), 'branch');
  return asked[0] && !asked[0].family && !asked[0].verb ? true : 'asked: ' + short(asked);
}, 1000);
test.run('a family chosen searches again, narrowed by the family', 0.2, async function () {
  if (!fam) return NO_FAM;
  const r0 = l.refreshes;
  fam.family = 'desk'; fam.verb = ''; fam.value = 'desk'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  asked.length = 0;
  await o.search(o.args('', {}), 'branch');
  return l.refreshes > r0 && asked[0] && asked[0].family === 'desk' && !asked[0].verb ? true : 'asked: ' + short(asked);
}, 1000);
test.run('a verb chosen searches again, narrowed by the family and the verb', 0.2, async function () {
  if (!fam) return NO_FAM;
  const r1 = l.refreshes;
  fam.verb = 'chat.add'; fam.value = 'desk.chat.add'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  asked.length = 0;
  await o.search(o.args('', {}), 'branch');
  return l.refreshes > r1 && asked[0] && asked[0].family === 'desk' && asked[0].verb === 'chat.add' ? true : 'asked: ' + short(asked);
}, 1000);

// refresh and destroy are the search element's
test.run('refresh and destroy reach the search element; .list is it', 0.2, function () {
  if (!l) return NO_SEARCH;
  const r2 = l.refreshes;
  made.refresh(); made.destroy();
  return l.refreshes === r2 + 1 && l.destroyed === true && made.list === l ? true : 'refreshes ' + (l.refreshes - r2) + ', destroyed ' + l.destroyed;
}, 1000);
// goal/G41.19, box v23: "destroy empties it".
test.run('and destroy leaves its host empty, the filters with it', 0.2, function () {
  if (!l) return NO_SEARCH;
  return host.kids.length === 0 ? true : 'kids left: ' + host.kids.length;
}, 1000);
