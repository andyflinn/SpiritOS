'use strict';

// spirit/run/shell/js/test/contactSelector.js
// The tests of shell/js/contactSelector.js, and of no other module (spec: ./contactSelector.md; goal/G41.13, Q2). The
// browser file runs in node on a BARE window (rule/26: "every shell element loads its own elements dynamically through
// the ... spirit.require functionality", "there will be NOTHING pre-loaded after the relays-supplied boot scripts"): no
// element is on the page until the selector requires it. The stand-in for probabilitySearch keeps what it was handed;
// the node's families are the spirit object's, each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'contactSelector.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function element(tag) {
  const n = { tag: tag, className: '', children: [], value: '', innerHTML: '', events: [], style: {},
    appendChild: function (c) { n.children.push(c); return c; },
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function (e) { n.events.push(e); return true; } };
  return n;
}

test.startTest('contactSelector.js: the configurable ID selector');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/contactSelector.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8');
  const code = SRC.replace(/\/\/.*$/gm, '');
  ok(!/shellCreateListSearch|listSearch\.js/.test(code), 'it names nothing of the old shell\'s list search (goal/G40.8)', 'contactSelector.js names shellCreateListSearch or listSearch.js');
  const lists = [];
  const asked = [];
  const required = [];
  const answer = function (family, verb) {
    return function (a) {
      asked.push({ family: family, verb: verb, args: a });
      if (family === 'contact') return Promise.resolve({ items: [{ key: 'KC', label: JSON.stringify({ name: 'Cat' }) }], more: false });
      // An ID table of the shadow roll's shape, its key and label under names of its own.
      return Promise.resolve({ items: [{ key: 'row-1', label: JSON.stringify({ contactID: 'KJ', relayLabel: 'Night job' }) }], more: false });
    };
  };
  const families = { contact: { search: answer('contact', 'search') }, agent: { job: answer('agent', 'job') } };
  const STANDS = {
    'shell/js/probabilitySearch.js': function (E) { E.probabilitySearch = { create: function (host, o) {
      const l = { host: host, o: o, refreshed: 0, redrawn: 0, value: '', row: null, refresh: function () { l.refreshed += 1; }, redraw: function () { l.redrawn += 1; }, destroy: function () {} };
      lists.push(l); return l;
    } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: element, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve(families), contact: families.contact, agent: families.agent, elements: {} } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p]) STANDS[p](global.window.spirit.elements); return Promise.resolve(true); };
  vm.runInThisContext(SRC, { filename: FILE });
  const make = global.window.spirit.elements.createContactSelector;
  ok(typeof make === 'function', 'it registers spirit.elements.createContactSelector', 'elements: ' + short(Object.keys(global.window.spirit.elements)));
  if (typeof make !== 'function') return;
  const rowsOf = async function (l, text) { const a = await l.o.api.verb(l.o.server + '.' + l.o.verb, l.o.args(text, {})); return (a && a.body && a.body.items) || []; };
  const parsed = function (item) { try { return JSON.parse(item.label); } catch (e) { return null; } };

  test.subHeading('it loads what it uses itself (rule/26)');
  const plain = make({});
  await settle();
  ok(required.indexOf('shell/js/probabilitySearch.js') !== -1 && lists.length === 1, 'on a bare page it requires shell/js/probabilitySearch.js, then builds on it', 'required ' + short(required) + ', lists ' + lists.length);
  ok(plain && plain.value === '' && typeof plain.refresh === 'function' && typeof plain.present === 'function' && typeof plain.mark === 'function',
    'it answers its root at once, nothing chosen, with refresh, present and mark, as Chatter and the shell use it', 'root: ' + short(plain && Object.keys(plain)));
  if (!lists.length) return;

  test.subHeading('by default, the contacts');
  const first = await rowsOf(lists[0], 'ca');
  ok(asked.length === 1 && asked[0].family === 'contact' && asked[0].verb === 'search' && JSON.stringify(asked[0].args).indexOf('ca') !== -1,
    'with no table named it searches the contacts, contact.search, with the words typed', 'asked: ' + short(asked));
  ok(first.length === 1 && first[0].key === 'KC' && parsed(first[0]).name === 'Cat', 'and a row is the contact\'s key and name', 'rows: ' + short(first));

  test.subHeading('configured: any ID table of the shadow roll\'s shape (Andy, Q2)');
  // Andy, Q2: "the loopback-api-location of the ID table, which must be formed like the shadow roll", "table:
  // \"loopback://api/contact/search\"", "if neccessary: key field name ... label field name"; and after it: "the config
  // info is auth.bundle (an api that conforms to the same interface norm as \"process/js/agent/table/<tableName>\")".
  asked.length = 0;
  const job = make({ table: 'loopback://api/agent/job', key: 'contactID', label: 'relayLabel' });
  await settle();
  const rows = await rowsOf(lists[1], 'night');
  ok(asked.length === 1 && asked[0].family === 'agent' && asked[0].verb === 'job', 'options.table loopback://api/<family>/<verb> is searched through the spirit object, at that family and verb', 'asked: ' + short(asked));
  ok(asked[0] && asked[0].args && asked[0].args.op === 'search' && asked[0].args.text === 'night', 'a table of the agent tables\' norm is asked { op: search, text }', 'args: ' + short(asked[0] && asked[0].args));
  const r = rows[0] && parsed(rows[0]);
  ok(rows.length === 1 && rows[0].key === 'KJ' && r && r.name === 'Night job', 'options.key names the field the row\'s ID is in, options.label the field its label is in', 'rows: ' + short(rows));
  lists[1].o.pick({ key: 'KJ', name: 'Night job' }, 'KJ');
  ok(job.value === 'KJ' && job.row && job.row.name === 'Night job', 'a pick sets .value to that ID', 'value: ' + short(job.value));
  asked.length = 0;
  make({ table: 'loopback://api/contact/search' }); await settle();
  await rowsOf(lists[2], 'x');
  ok(asked.length === 1 && asked[0].family === 'contact' && asked[0].verb === 'search', 'naming the contacts\' table is the same as naming none', 'asked: ' + short(asked));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
