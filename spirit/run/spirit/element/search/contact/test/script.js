'use strict';

// spirit/run/spirit/element/search/contact/test/script.js
// The tests of spirit/element/search/contact/script.js, and of no other module (spec: ./script.md; goal/G41.13, G43.32). The browser
// file runs in node on a BARE window (rule/26): nothing is on the page until the picker requires it. Its list, the one
// contact list (search/contact/list.js), is a stand-in that keeps what it was handed; what that list does (the
// contacts, any ID table, filters, marks) is tested in its own folder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');

const FILE = path.join(__dirname, '..', 'script.js');
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function element(tag) {
  const heard = {};
  const n = { tag: tag, className: '', children: [], parentNode: null, events: [],
    appendChild: function (c) { n.children.push(c); c.parentNode = n; return c; },
    removeChild: function (c) { n.children = n.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    dispatchEvent: function (e) { n.events.push(e); (heard[e.type] || []).forEach(function (fn) { fn(e); }); return true; } };
  return n;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let code, lists, required, atLoad, loaded, made, box, drop, d, changes, pane, p, statuses;
let hold = null;

test.run('the picker runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  const SRC = fs.readFileSync(FILE, 'utf8');
  code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  lists = [];
  required = [];
  // ITS STAND-INS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never
  // by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
  // fail/throw"): the one contact list, a stand-in; contact's api and the row an object each.
  const STANDS = {
    'spirit/element/search/contact/list/script.js': { create: function (host, o) {
      const l = { host: host, o: o, refreshed: 0, marks: [], destroyed: 0 };
      lists.push(l);
      return { list: {}, refresh: function () { l.refreshed += 1; }, mark: function (k, s) { l.marks.push([k, s]); }, destroy: function () { l.destroyed += 1; } };
    } },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: element };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, readyPromise: Promise.resolve({}), element: {} } };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.requireScript = function (p) {
    required.push(String(p));
    // A held answer comes once the test lets it go, the same stand-in then.
    const answer = Object.prototype.hasOwnProperty.call(STANDS, p) ? STANDS[p] : {};
    return hold ? hold.then(function () { return answer; }) : Promise.resolve(answer);
  };
  // Its own answer, what the loader places at its place.
  const own = PAGE_LOAD.runAsPage(FILE, null, SRC);
  await settle();
  const E = ((global.window.spirit.required || {}).spirit || {}).element || {};
  made = E.search && E.search.contact === own ? own : null;
  atLoad = required.slice();
  return true;
}, test.limit.quick);
// goal/G40.8: the old shell's list search is forbidden on the face; goal/G43.32: no list of its own either.
test.run('it makes no list of its own, neither a probabilitySearch nor anything of the old shell\'s list search', 0.2, function () {
  if (!code) return false;
  const own = /shellCreateListSearch|listSearch\.js/.test(code) || /\.element\.search\.create\(/.test(code);
  return !own ? true : false;
}, test.limit.quick);
test.run('it places itself at spirit.required.spirit.element.search.contact, with a create', 0.2, function () {
  if (!lists) return false;
  return made && typeof made.create === 'function' ? true : false;
}, test.limit.quick);

// one list, drawn in its dropdown and in its pane (Andy: "all, any search-unit has ONE list shared by popup and list modes.")
test.run('create appends its root to the container it is given and answers that root', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return false;
  box = element('div');
  const from = required.length;
  drop = made.create(box, { placeholder: 'choose an ID…', all: 'every ID', table: 'loopback://api/agent/job', key: 'id', label: 'title', data: 'b/branch' });
  await settle();
  d = lists[0];
  // What the picker required as it ran and as it drew, kept apart from what the runner asks of the page between tests.
  loaded = atLoad.concat(required.slice(from));
  return box.children.length === 1 && box.children[0] === drop ? true : false;
}, test.limit.quick);
test.run('on a bare page it requires the one contact list and spirit/contact/api.js, and no data.js, then draws it', 0.2, function () {
  if (!loaded) return false;
  return loaded.indexOf('spirit/element/search/contact/list/script.js') !== -1 && loaded.indexOf('spirit/contact/api.js') !== -1 && !loaded.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
test.run('the dropdown is the list in its dropdown face, drawn into its root with its words handed on', 0.2, function () {
  if (!box) return false;
  return !!d && d.host === drop && d.o.face === 'dropdown' && d.o.placeholder === 'choose an ID…' && d.o.all === 'every ID' ? true : false;
}, test.limit.quick);
test.run('an ID table is handed on whole, with its table, key, label and data', 0.2, function () {
  if (!box) return false;
  return !!d && d.o.table === 'loopback://api/agent/job' && d.o.key === 'id' && d.o.label === 'title' && d.o.data === 'b/branch' ? true : false;
}, test.limit.quick);
test.run('at first nothing is chosen, so the value is empty and the row is null', 0.2, function () {
  if (!box) return false;
  return drop.value === '' && drop.row === null && /\bcontact-selector-face-dropdown\b/.test(drop.className) ? true : false;
}, test.limit.quick);
test.run('a pick sets value to the key and row to the row, with one bubbling change', 0.2, function () {
  if (!d) return false;
  changes = [];
  drop.addEventListener('change', function (e) { changes.push(e); });
  d.o.pick({ name: 'Night job' }, 'KJ');
  return drop.value === 'KJ' && drop.row && drop.row.name === 'Night job' && changes.length === 1 && changes[0].bubbles === true ? true : false;
}, test.limit.quick);
test.run('picking None clears the value and the row', 0.2, function () {
  if (!d) return false;
  d.o.pick(null);
  return drop.value === '' && drop.row === null ? true : false;
}, test.limit.quick);

const hid = { name: 'offered' };
test.run('the pane is the same list in its pane face, and it fills its box', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return false;
  statuses = [{ status: 'none' }, { status: 'waiting', glyph: '⌛' }];
  pane = made.create(element('div'), { face: 'pane', filters: [hid], statuses: statuses });
  await settle();
  p = lists[1];
  return !!p && p.o.face === 'pane' && p.o.placeholder === '' && p.o.all === undefined && /\bfill\b/.test(pane.className) ? true : false;
}, test.limit.quick);
test.run('the caller\'s hidden filters and statuses are handed on (Chat\'s offered peers and ⌛)', 0.2, function () {
  if (!p) return false;
  return p.o.filters[0] === hid && p.o.statuses === statuses ? true : false;
}, test.limit.quick);
test.run('a press in a pane picks, because it hands the list no details and the list opens nothing itself', 0.2, function () {
  if (!p) return false;
  return p.o.details === null ? true : false;
}, test.limit.quick);
test.run('a caller that opens something itself has its details function handed on to the list', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return false;
  const opened = [];
  made.create(element('div'), { face: 'pane', details: function (row) { opened.push(row); } });
  await settle();
  return lists[2] && typeof lists[2].o.details === 'function' ? true : false;
}, test.limit.quick);

// refresh and mark go to the list
test.run('refresh asks the list again, and mark is the list\'s own mark', 0.2, function () {
  if (!p) return false;
  pane.refresh();
  pane.mark('K1', 'waiting');
  return p.refreshed === 1 && JSON.stringify(p.marks) === '[["K1","waiting"]]' ? true : false;
}, test.limit.quick);
test.run('a mark said before the list is here is said to it once it is', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return false;
  let release = null;
  hold = new Promise(function (r) { release = r; });
  const early = made.create(element('div'), { face: 'pane', statuses: statuses });
  early.mark('K2', 'waiting');
  release(true);
  hold = null;
  await settle();
  const e = lists[3];
  return !!e && JSON.stringify(e.marks) === '[["K2","waiting"]]' ? true : false;
}, test.limit.quick);

// destroy
test.run('destroy lets its list go and takes itself out of its container', 0.2, function () {
  if (!d) return false;
  drop.destroy();
  return d.destroyed === 1 && box.children.length === 0 ? true : false;
}, test.limit.quick);
test.run('a picker destroyed before its list is here draws none', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return false;
  let arrive = null;
  hold = new Promise(function (r) { arrive = r; });
  const late = made.create(element('div'), {});
  late.destroy();
  arrive(true);
  hold = null;
  await settle();
  return lists.length === 4 ? true : false;
}, test.limit.quick);
