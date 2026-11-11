'use strict';

// spirit/run/spirit/element/search/bundle/test/listElement.js
// The tests of spirit/element/search/bundle/listElement.js, and of no other module (spec: ./listElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it, and the row element a
// stand-in that keeps what it was handed. The node's auth family is the spirit object's, each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'bundle', 'listElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
// An element that counts on what it did not load throws inside a promise: the reporter fails the test it ran in.
let asked, required, lists, rows, managers, DATA, V, E, made, l, o, got, p, fo, LIST;
let answer = { items: [{ key: '7', label: JSON.stringify({ id: 7, label: 'Reader' }) }], more: true };
const picked = [];
const NO_E = 'the list never ran: the world failed';
const NO_LIST = 'no list element registered';
const NO_SEARCH = 'the list drew no search';
const listed = function () { return !!(E && E.search && E.search.bundle && E.search.bundle.listElement && typeof E.search.bundle.listElement.create === 'function'); };

test.run('the world: the list runs on a bare window, the page\'s data set real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/bundle/listElement.js is not there';
  asked = [];
  required = [];
  lists = [];
  rows = [];
  const auth = { bundle: function (a) { asked.push(a); return answer ? Promise.resolve(answer) : Promise.resolve(null); } };
  const STANDS = {
    'spirit/element/search.js': function (E) { E.search = Object.assign(E.search || {}, { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }); },
    // The real row element loads the auth family's cache manager as it runs (goal/G41.28); its stand-in does the same.
    'spirit/element/search/bundle/rowElement.js': function (E) { global.window.spirit.cacheManager('auth'); require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'))(global.window.spirit, 'spirit/element/search/bundle/rowElement.js', { create: function (row, opts) { const r = { kind: 'bundle', row: row, opts: opts || {} }; rows.push(r); return r; } }); },
  };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({ auth: auth }), auth: auth, element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // The page's one data set (spirit/data.js), which spirit.js brings with the client.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  DATA = global.window.spirit.data;
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
  // The direct writes below are the auth family's own view of the home node, as its manager files them.
  V = DATA.viewAt(null, 'auth');
  global.document = { createElement: function () { return {}; } };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26)
test.run('it requires the search element and its row element through spirit.require, and no data script (Andy: "NO FUCKING DATA SCRIPT")', 0.2, function () {
  if (!required) return NO_E;
  return ['spirit/element/search.js', 'spirit/element/search/bundle/rowElement.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }) ? true : 'required: ' + short(required);
}, test.limit.quick);
test.run('it registers spirit.element.spirit.element.search.bundle.listElement.create', 0.2, function () {
  if (!E) return NO_E;
  return listed() ? true : 'elements: ' + short(Object.keys(E));
}, test.limit.quick);

// create hands the search element the node's bundles
test.run('it draws one probabilitySearch into the host it is given', 0.2, async function () {
  if (!listed()) return NO_LIST;
  const host = {};
  made = E.search.bundle.listElement.create(host, { face: 'dropdown', placeholder: 'choose a bundle…', all: 'no bundle', pick: function (row, key) { picked.push(key); } });
  await settle();
  l = lists[0];
  if (l) o = l.o;
  return !!l && l.host === host ? true : 'lists: ' + lists.length;
}, test.limit.quick);
test.run('face, placeholder and all are handed on, pane or dropdown as asked', 0.2, function () {
  if (!l) return NO_SEARCH;
  return o.face === 'dropdown' && o.placeholder === 'choose a bundle…' && o.all === 'no bundle' ? true : 'opts: ' + short({ face: o.face, placeholder: o.placeholder, all: o.all });
}, test.limit.quick);
test.run('a pick reaches opts.pick', 0.2, function () {
  if (!l) return NO_SEARCH;
  o.pick({ id: 7 }, '7');
  return picked.length === 1 && picked[0] === '7' ? true : 'picked: ' + short(picked);
}, test.limit.quick);
test.run('it fills as soon as it is drawn: one refresh at create', 0.2, function () {
  if (!l) return NO_SEARCH;
  return l.refreshes === 1 ? true : 'refreshes: ' + l.refreshes;
}, test.limit.quick);
// goal/G41.14, Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes their data set": the list is a
// view of the node's bundles (goal/G41.28: the branch the auth family's cache manager keeps), so a bundle added anywhere
// on the page shows in every bundle list (probabilitySearch's data).
test.run('it is a view of the auth family\'s bundles (spirit.data.auth.data.bundles.branch), the spirit object\'s cache, which the node\'s stream keeps current', 0.2, function () {
  if (!l) return NO_SEARCH;
  const B = ((global.window.spirit.data || {}).auth || {}).data && global.window.spirit.data.auth.data.bundles;
  return !!B && typeof B.branch === 'string' && B.branch !== '' && o.data === B.branch ? true : 'data: ' + short(o.data) + ', authReads.bundles.branch ' + short(B && B.branch);
}, test.limit.quick);
test.run('its search asks auth.bundle { op: search, text } through the spirit object, the text trimmed', 0.2, async function () {
  if (!l) return NO_SEARCH;
  got = await o.search(o.args('  rea ', {}));
  return o.server === 'auth' && o.verb === 'bundle' && asked.length === 1 && asked[0].op === 'search' && asked[0].text === 'rea' ? true : 'asked: ' + short(asked) + ', at ' + o.server + '.' + o.verb;
}, test.limit.quick);
test.run('and answers as a reply: { items, more }', 0.2, function () {
  if (!l) return NO_SEARCH;
  return got && got.status === 200 && got.body && got.body.ok === true && got.body.items.length === 1 && got.body.more === true ? true : 'got: ' + short(got);
}, test.limit.quick);
test.run('an empty answer is an empty list, like any other', 0.2, async function () {
  if (!l) return NO_SEARCH;
  answer = null;
  const empty = await o.search(o.args('', {}));
  return empty && empty.body && Array.isArray(empty.body.items) && empty.body.items.length === 0 && empty.body.more === false ? true : 'empty: ' + short(empty);
}, test.limit.quick);
// goal/G41.25, box: "the bundleSelector's list will gain a new column \"owner\", displayed right after the bundles label."
test.run('by default its columns are the label, then the owner', 0.2, function () {
  if (!l) return NO_SEARCH;
  const cols = (o.columns || []).map(function (c) { return c.field; });
  return JSON.stringify(cols) === '["label","owner"]' ? true : 'columns: ' + short(cols);
}, test.limit.quick);
test.run('made for no app server, its search names no owner: every bundle', 0.2, async function () {
  if (!l) return NO_SEARCH;
  answer = { items: [], more: false };
  await o.search(o.args('', {}));
  return asked.length > 0 && asked[asked.length - 1].op === 'search' && !('owner' in asked[asked.length - 1]) ? true : 'asked: ' + short(asked[asked.length - 1]);
}, test.limit.quick);
// THE WHOLE ROW (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole row, as
// cached in spirit.data."): the list hands its search no matched() of its own.
test.run('it hands its search no matched(): the whole row is matched (goal/G41.28)', 0.2, function () {
  if (!l) return NO_SEARCH;
  return typeof o.matched !== 'function' ? true : 'it still hands matched(): ' + short(o.matched);
}, test.limit.quick);
// Andy, goal/G41.14: "the bundleSelector shows a fucking number is selected instead of the fucking label or the
// bundle." A dropdown shows the row picked by the list's name(row) (probabilitySearch); without it, the key.
test.run('a picked bundle is shown by its label, never its number', 0.2, function () {
  if (!l) return NO_SEARCH;
  return typeof o.name === 'function' && o.name({ id: 7, label: 'Reader' }, '7') === 'Reader' ? true : 'name: ' + short(typeof o.name === 'function' ? o.name({ id: 7, label: 'Reader' }, '7') : o.name);
}, test.limit.quick);

// each row a bundle row element
test.run('each row is a bundleElement of that bundle, not editable by default', 0.2, function () {
  if (!l) return NO_SEARCH;
  const el = o.element({ id: 7, label: 'Reader' }, '7');
  return el && el.kind === 'bundle' && el.row.id === 7 && el.row.label === 'Reader' && !el.opts.editable ? true : 'element: ' + short(el);
}, test.limit.quick);

// a pane of the editor: its columns, its labels shown only (goal/G41.26)
// Andy, box: "the bundleSelector in pane-mode, with the following columns: 1. [fieldInput ... Label] 2. an edit button
// ... 3. a delete armingButton.js".
test.run('opts.columns names the row\'s fields it shows, in order', 0.2, async function () {
  if (!listed()) return NO_LIST;
  E.search.bundle.listElement.create({}, { face: 'pane', columns: ['owner', 'label'], editable: true });
  await settle();
  p = lists[1] && lists[1].o;
  return p && JSON.stringify((p.columns || []).map(function (c) { return c.field; })) === '["owner","label"]' ? true : 'columns: ' + short(p && p.columns);
}, test.limit.quick);
// Andy, box: "bundleSelector:pane mode the Label should now just be an output": editable is no option any more, so a
// list asked for it still hands its rows none.
test.run('no row edits its label: an editable asked for is handed to no row', 0.2, function () {
  if (!p) return 'no pane list was made';
  const pe = p.element({ id: 8, label: 'Writer' }, '8');
  return pe && !pe.opts.editable ? true : 'element: ' + short(pe && pe.opts);
}, test.limit.quick);

// goal/G41.25: made for an app server, it lists that server's bundles alone
// Andy, box: "if the bundleSelector is not configured for an appServer, the bundleSelector will show/search ALL/ANY
// bundles", and "if the bundleSelector IS configured for an appServer, then it will only list bundles \"owned\" by that
// Appserver".
test.run('its search asks auth.bundle { op: search, text, owner: family }, the text trimmed', 0.2, async function () {
  if (!listed()) return NO_LIST;
  E.search.bundle.listElement.create({}, { face: 'dropdown', family: 'agent' });
  await settle();
  fo = lists[2] && lists[2].o;
  const nA = asked.length;
  if (fo && typeof fo.search === 'function' && typeof fo.args === 'function') await fo.search(fo.args(' too ', {}), fo.verb);
  const fa = asked[nA];
  return !!fa && asked.length === nA + 1 && fa.op === 'search' && fa.text === 'too' && fa.owner === 'agent' ? true : 'asked: ' + short(asked.slice(nA));
}, test.limit.quick);
// WHAT IT OFFERS: the list is a view of the node's bundles, which holds every bundle the page has, so what it shows is that
// branch filtered and ranked by the real list's own heart, probabilitySearch.order, the state it is made with.
const offered = function (opts) {
  if (!opts || !LIST || typeof LIST.order !== 'function') return null;
  const rows = DATA.rowsOf(opts.data) || [];
  const entries = rows.map(function (r, i) { return { key: String(r.key != null ? r.key : r.id), row: r, at: i }; });
  return LIST.order(entries, { words: '', values: {}, filters: opts.filters || [], columns: opts.columns || [], matched: opts.matched, score: opts.score })
    .map(function (e) { return String(e.row && e.row.id); }).filter(function (k) { return ['21', '22', '23'].indexOf(k) !== -1; }).sort();
};
test.run('of the bundles the page holds, it offers that server\'s alone', 0.2, function () {
  if (!fo) return 'no list made for an app server';
  LIST = (function () {
    const win = { window: null, spirit: { element: {} }, console: console };
    // goal/G43.32: search.js places itself by installSpiritElement (spirit/test/headLessChrome.js pageSpirit).
    require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
    win.window = win;
    vm.createContext(win);
    ['spirit/probabilityStringMatch.js', 'spirit/probabilityStringObjectMatch.js', 'spirit/probabilityBucket.js', 'spirit/element/search.js'].forEach(function (rel) {
      vm.runInContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), win, { filename: rel });
    });
    return ((win.spirit.element.spirit || {}).element || {}).search;
  }());
  V.set('bundles/21', { id: 21, label: 'Agent tools', owner: 'agent' });
  V.set('bundles/22', { id: 22, label: 'Node files', owner: 'node' });
  V.set('bundles/23', { id: 23, label: 'Desk hand', owner: 'desk' });
  return JSON.stringify(offered(fo)) === '["21"]' ? true : 'offered: ' + short(offered(fo));
}, test.limit.quick);
test.run('made for no app server, it offers every bundle, whoever owns it', 0.2, function () {
  if (!l) return NO_SEARCH;
  return JSON.stringify(offered(o)) === '["21","22","23"]' ? true : 'offered: ' + short(offered(o));
}, test.limit.quick);

// refresh and destroy are the search element's
test.run('refresh and destroy reach the search element; .list is it', 0.2, function () {
  if (!l) return NO_SEARCH;
  const r0 = l.refreshes;
  made.refresh(); made.destroy();
  return l.refreshes === r0 + 1 && l.destroyed === true && made.list === l ? true : 'refreshes ' + (l.refreshes - r0) + ', destroyed ' + l.destroyed;
}, test.limit.quick);
