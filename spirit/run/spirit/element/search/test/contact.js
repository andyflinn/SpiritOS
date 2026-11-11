'use strict';

// spirit/run/spirit/element/search/test/contact.js
// The tests of spirit/element/search/contact.js, and of no other module (spec: ./contact.md; goal/G41.13, G43.32). The browser
// file runs in node on a BARE window (rule/26): nothing is on the page until the picker requires it. Its list, the one
// contact list (search/contact/listElement.js), is a stand-in that keeps what it was handed; what that list does (the
// contacts, any ID table, filters, marks) is tested in its own folder.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'contact.js');
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
let code, lists, required, managers, made, box, drop, d, changes, pane, p, statuses;
let hold = null;
const NO_MADE = 'no contact picker with a create: the world failed';
const NO_D = 'no dropdown list was drawn';
const NO_P = 'no pane list was drawn';

test.run('the world: the picker runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/contact.js is not there';
  const SRC = fs.readFileSync(FILE, 'utf8');
  code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  lists = [];
  required = [];
  managers = [];
  const STANDS = {
    'spirit/element/search/contact/listElement.js': function () { require(path.join(RUN, 'spirit', 'element', 'installSpiritElement.js'))(global.window.spirit, 'spirit/element/search/contact/listElement.js', { create: function (host, o) {
      const l = { host: host, o: o, refreshed: 0, marks: [], destroyed: 0 };
      lists.push(l);
      return { list: {}, refresh: function () { l.refreshed += 1; }, mark: function (k, s) { l.marks.push([k, s]); }, destroy: function () { l.destroyed += 1; } };
    } }); },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: element };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({}), element: {} } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.window.spirit.cacheManager = function (n) { managers.push(String(n)); return Promise.resolve(true); };
  global.window.spirit.require = function (p) {
    required.push(String(p));
    if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](); }
    return hold || Promise.resolve(true);
  };
  vm.runInThisContext(SRC, { filename: FILE });
  await settle();
  const E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  made = E.search && E.search.contact;
  return true;
}, 1000);
// goal/G40.8: the old shell's list search is forbidden on the face; goal/G43.32: no list of its own either.
test.run('it makes no list of its own: no probabilitySearch, nothing of the old shell\'s list search', 0.2, function () {
  if (!code) return 'no contact.js read: the world failed';
  const own = /shellCreateListSearch|listSearch\.js/.test(code) || /\.element\.search\.create\(/.test(code);
  return !own ? true : 'contact.js still makes a list';
}, 1000);
test.run('it places itself at spirit.element.spirit.element.search.contact, with a create', 0.2, function () {
  if (!lists) return 'the picker never ran: the world failed';
  const E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  return made && typeof made.create === 'function' ? true : 'elements: ' + short(Object.keys(E.search || {}));
}, 1000);

// one list, drawn in its dropdown and in its pane (Andy: "all, any search-unit has ONE list shared by popup and list modes.")
test.run('create(container, options) appends its root to its container and answers it', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  box = element('div');
  drop = made.create(box, { placeholder: 'choose an ID…', all: 'every ID', table: 'loopback://api/agent/job', key: 'id', label: 'title', data: 'b/branch' });
  await settle();
  d = lists[0];
  return box.children.length === 1 && box.children[0] === drop ? true : 'container holds ' + box.children.length;
}, 1000);
test.run('on a bare page it requires the one contact list and the contact family\'s cache, then draws it', 0.2, function () {
  if (!required) return 'the picker never ran: the world failed';
  return required.indexOf('spirit/element/search/contact/listElement.js') !== -1 && managers.indexOf('contact') !== -1 ? true : 'required ' + short(required) + ', managers ' + short(managers);
}, 1000);
test.run('the dropdown is the list in its dropdown face, drawn into its root, its words handed on', 0.2, function () {
  if (!box) return NO_MADE;
  return !!d && d.host === drop && d.o.face === 'dropdown' && d.o.placeholder === 'choose an ID…' && d.o.all === 'every ID' ? true : 'list: ' + short(d && d.o);
}, 1000);
test.run('an ID table (goal/G41.13) is handed on whole: table, key, label, data', 0.2, function () {
  if (!box) return NO_MADE;
  return !!d && d.o.table === 'loopback://api/agent/job' && d.o.key === 'id' && d.o.label === 'title' && d.o.data === 'b/branch' ? true : 'list: ' + short(d && d.o);
}, 1000);
test.run('nothing chosen at first: value \'\', row null', 0.2, function () {
  if (!box) return NO_MADE;
  return drop.value === '' && drop.row === null && /\bcontact-selector-face-dropdown\b/.test(drop.className) ? true : 'root: ' + short({ value: drop.value, row: drop.row, className: drop.className });
}, 1000);
test.run('a pick sets value to the key and row to the row, with one bubbling change', 0.2, function () {
  if (!d) return NO_D;
  changes = [];
  drop.addEventListener('change', function (e) { changes.push(e); });
  d.o.pick({ name: 'Night job' }, 'KJ');
  return drop.value === 'KJ' && drop.row && drop.row.name === 'Night job' && changes.length === 1 && changes[0].bubbles === true ? true : 'value ' + short(drop.value) + ', changes ' + changes.length;
}, 1000);
test.run('None picked clears them', 0.2, function () {
  if (!d) return NO_D;
  d.o.pick(null);
  return drop.value === '' && drop.row === null ? true : 'value ' + short(drop.value);
}, 1000);

const hid = { name: 'offered' };
test.run('the pane is the same list in its pane face, filling its box', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  statuses = [{ status: 'none' }, { status: 'waiting', glyph: '⌛' }];
  pane = made.create(element('div'), { face: 'pane', filters: [hid], statuses: statuses });
  await settle();
  p = lists[1];
  return !!p && p.o.face === 'pane' && p.o.placeholder === '' && p.o.all === undefined && /\bfill\b/.test(pane.className) ? true : 'list: ' + short(p && p.o);
}, 1000);
test.run('the caller\'s hidden filters and statuses are handed on (Chat\'s offered peers and ⌛)', 0.2, function () {
  if (!p) return NO_P;
  return p.o.filters[0] === hid && p.o.statuses === statuses ? true : 'list: ' + short({ filters: p.o.filters, statuses: p.o.statuses });
}, 1000);
test.run('a pane\'s press picks: it hands the list no details, so the list opens nothing itself', 0.2, function () {
  if (!p) return NO_P;
  return p.o.details === null ? true : 'details: ' + short(p.o.details);
}, 1000);
test.run('unless its caller opens something itself: options.details is handed on', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  const opened = [];
  made.create(element('div'), { face: 'pane', details: function (row) { opened.push(row); } });
  await settle();
  return lists[2] && typeof lists[2].o.details === 'function' ? true : 'details: ' + typeof (lists[2] && lists[2].o.details);
}, 1000);

// refresh and mark go to the list
test.run('refresh() asks the list again; mark(key, status) is the list\'s mark', 0.2, function () {
  if (!p) return NO_P;
  pane.refresh();
  pane.mark('K1', 'waiting');
  return p.refreshed === 1 && JSON.stringify(p.marks) === '[["K1","waiting"]]' ? true : 'refreshed ' + p.refreshed + ', marks ' + short(p.marks);
}, 1000);
test.run('a mark said before the list is here is said to it once it is', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  let release = null;
  hold = new Promise(function (r) { release = r; });
  const early = made.create(element('div'), { face: 'pane', statuses: statuses });
  early.mark('K2', 'waiting');
  release(true);
  hold = null;
  await settle();
  const e = lists[3];
  return !!e && JSON.stringify(e.marks) === '[["K2","waiting"]]' ? true : 'marks ' + short(e && e.marks);
}, 1000);

// destroy
test.run('destroy lets its list go and takes itself out of its container', 0.2, function () {
  if (!d) return NO_D;
  drop.destroy();
  return d.destroyed === 1 && box.children.length === 0 ? true : 'destroyed ' + d.destroyed + ', container holds ' + box.children.length;
}, 1000);
test.run('a picker destroyed before its list is here draws none', 0.2, async function () {
  if (!made || typeof made.create !== 'function') return NO_MADE;
  let arrive = null;
  hold = new Promise(function (r) { arrive = r; });
  const late = made.create(element('div'), {});
  late.destroy();
  arrive(true);
  hold = null;
  await settle();
  return lists.length === 4 ? true : lists.length + ' lists drawn';
}, 1000);
