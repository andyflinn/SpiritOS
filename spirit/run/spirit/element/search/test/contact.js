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
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('search/contact.js: the contact picker, thin over the one contact list (goal/G43.32)');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/contact.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8');
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // goal/G40.8: the old shell's list search is forbidden on the face; goal/G43.32: no list of its own either.
  ok(!/shellCreateListSearch|listSearch\.js/.test(code) && !/\.element\.search\.create\(/.test(code), 'it makes no list of its own: no probabilitySearch, nothing of the old shell\'s list search', 'contact.js still makes a list');
  const lists = [];
  const required = [];
  const managers = [];
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
  let hold = null;
  global.window.spirit.require = function (p) {
    required.push(String(p));
    if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](); }
    return hold || Promise.resolve(true);
  };
  vm.runInThisContext(SRC, { filename: FILE });
  await settle();
  const E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  const made = E.search && E.search.contact;
  ok(made && typeof made.create === 'function', 'it places itself at spirit.element.spirit.element.search.contact, with a create', 'elements: ' + short(Object.keys(E.search || {})));
  if (!made || typeof made.create !== 'function') return;

  test.subHeading('one list, drawn in its dropdown and in its pane (Andy: "all, any search-unit has ONE list shared by popup and list modes.")');
  const box = element('div');
  const drop = made.create(box, { placeholder: 'choose an ID…', all: 'every ID', table: 'loopback://api/agent/job', key: 'id', label: 'title', data: 'b/branch' });
  await settle();
  ok(box.children.length === 1 && box.children[0] === drop, 'create(container, options) appends its root to its container and answers it', 'container holds ' + box.children.length);
  ok(required.indexOf('spirit/element/search/contact/listElement.js') !== -1 && managers.indexOf('contact') !== -1, 'on a bare page it requires the one contact list and the contact family\'s cache, then draws it', 'required ' + short(required) + ', managers ' + short(managers));
  const d = lists[0];
  ok(!!d && d.host === drop && d.o.face === 'dropdown' && d.o.placeholder === 'choose an ID…' && d.o.all === 'every ID', 'the dropdown is the list in its dropdown face, drawn into its root, its words handed on', 'list: ' + short(d && d.o));
  ok(!!d && d.o.table === 'loopback://api/agent/job' && d.o.key === 'id' && d.o.label === 'title' && d.o.data === 'b/branch', 'an ID table (goal/G41.13) is handed on whole: table, key, label, data', 'list: ' + short(d && d.o));
  ok(drop.value === '' && drop.row === null && /\bcontact-selector-face-dropdown\b/.test(drop.className), 'nothing chosen at first: value \'\', row null', 'root: ' + short({ value: drop.value, row: drop.row, className: drop.className }));
  const changes = [];
  drop.addEventListener('change', function (e) { changes.push(e); });
  d.o.pick({ name: 'Night job' }, 'KJ');
  ok(drop.value === 'KJ' && drop.row && drop.row.name === 'Night job' && changes.length === 1 && changes[0].bubbles === true, 'a pick sets value to the key and row to the row, with one bubbling change', 'value ' + short(drop.value) + ', changes ' + changes.length);
  d.o.pick(null);
  ok(drop.value === '' && drop.row === null, 'None picked clears them', 'value ' + short(drop.value));

  const hid = { name: 'offered' };
  const statuses = [{ status: 'none' }, { status: 'waiting', glyph: '⌛' }];
  const pane = made.create(element('div'), { face: 'pane', filters: [hid], statuses: statuses });
  await settle();
  const p = lists[1];
  ok(!!p && p.o.face === 'pane' && p.o.placeholder === '' && p.o.all === undefined && /\bfill\b/.test(pane.className), 'the pane is the same list in its pane face, filling its box', 'list: ' + short(p && p.o));
  ok(!!p && p.o.filters[0] === hid && p.o.statuses === statuses, 'the caller\'s hidden filters and statuses are handed on (Chat\'s offered peers and ⌛)', 'list: ' + short(p && { filters: p.o.filters, statuses: p.o.statuses }));
  ok(!!p && p.o.details === null, 'a pane\'s press picks: it hands the list no details, so the list opens nothing itself', 'details: ' + short(p && p.o.details));
  const opened = [];
  made.create(element('div'), { face: 'pane', details: function (row) { opened.push(row); } });
  await settle();
  ok(typeof lists[2].o.details === 'function', 'unless its caller opens something itself: options.details is handed on', 'details: ' + typeof lists[2].o.details);

  test.subHeading('refresh and mark go to the list');
  pane.refresh();
  pane.mark('K1', 'waiting');
  ok(p.refreshed === 1 && JSON.stringify(p.marks) === '[["K1","waiting"]]', 'refresh() asks the list again; mark(key, status) is the list\'s mark', 'refreshed ' + p.refreshed + ', marks ' + short(p.marks));
  let release = null;
  hold = new Promise(function (r) { release = r; });
  const early = made.create(element('div'), { face: 'pane', statuses: statuses });
  early.mark('K2', 'waiting');
  release(true);
  hold = null;
  await settle();
  const e = lists[3];
  ok(!!e && JSON.stringify(e.marks) === '[["K2","waiting"]]', 'a mark said before the list is here is said to it once it is', 'marks ' + short(e && e.marks));

  test.subHeading('destroy');
  drop.destroy();
  ok(d.destroyed === 1 && box.children.length === 0, 'destroy lets its list go and takes itself out of its container', 'destroyed ' + d.destroyed + ', container holds ' + box.children.length);
  let arrive = null;
  hold = new Promise(function (r) { arrive = r; });
  const late = made.create(element('div'), {});
  late.destroy();
  arrive(true);
  hold = null;
  await settle();
  ok(lists.length === 4, 'a picker destroyed before its list is here draws none', lists.length + ' lists drawn');
}()).then(function () { test.reportSuccessFailureCount(); }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); });
