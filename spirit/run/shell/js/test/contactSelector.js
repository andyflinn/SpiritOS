'use strict';

// spirit/run/shell/js/test/contactSelector.js
// The tests of shell/js/contactSelector.js, and of no other module (spec: ./contactSelector.md; goal/G41.13, Q2). The
// browser file runs in node on a window of its own: the shared list (shellCreateListSearch) is a stub that keeps what
// it was handed, and the node's families are the spirit object's, each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

const FILE = path.join(__dirname, '..', 'contactSelector.js');
function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

function element(tag) {
  const n = { tag: tag, className: '', children: [], value: '', innerHTML: '', events: [],
    appendChild: function (c) { n.children.push(c); return c; },
    addEventListener: function () {}, removeEventListener: function () {},
    dispatchEvent: function (e) { n.events.push(e); return true; } };
  return n;
}

test.startTest('contactSelector.js: the configurable ID selector');

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/contactSelector.js is not there'); return; }
  const lists = [];
  const asked = [];
  const answer = function (family, verb) {
    return function (a) {
      asked.push({ family: family, verb: verb, args: a });
      if (family === 'contact') return Promise.resolve({ items: [{ key: 'KC', label: JSON.stringify({ name: 'Cat' }) }], more: false });
      // An ID table of the shadow roll's shape, its key and label under names of its own.
      return Promise.resolve({ items: [{ key: 'row-1', label: JSON.stringify({ contactID: 'KJ', relayLabel: 'Night job' }) }], more: false });
    };
  };
  const families = { contact: { search: answer('contact', 'search') }, agent: { job: answer('agent', 'job') } };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: element, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/</g, '&lt;'); }, ready: Promise.resolve(families), elements: {
    shellCreateListSearch: function (host, o) { const l = { host: host, o: o, refresh: function () {}, redraw: function () {} }; lists.push(l); return l; },
  } } };
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  const make = global.window.spirit.elements.createContactSelector;
  ok(typeof make === 'function', 'it registers spirit.elements.createContactSelector', 'elements: ' + short(Object.keys(global.window.spirit.elements)));
  if (typeof make !== 'function') return;
  const rowsOf = async function (l, text) { const a = await l.o.api.verb(l.o.verb, l.o.args(text, {})); return (a && a.body && a.body.items) || []; };
  const parsed = function (item) { try { return JSON.parse(item.label); } catch (e) { return null; } };

  test.subHeading('by default, the contacts');
  const plain = make({});
  const first = await rowsOf(lists[0], 'ca');
  ok(asked.length === 1 && asked[0].family === 'contact' && asked[0].verb === 'search', 'with no table named it searches the contacts, contact.search', 'asked: ' + short(asked));
  ok(first.length === 1 && first[0].key === 'KC' && parsed(first[0]).name === 'Cat', 'and a row is the contact\'s key and name, as before', 'rows: ' + short(first));
  ok(plain && plain.value === '', 'nothing chosen at first', 'value: ' + short(plain && plain.value));

  test.subHeading('configured: any ID table of the shadow roll\'s shape (Andy, Q2)');
  // Andy, Q2: "the loopback-api-location of the ID table, which must be formed like the shadow roll : key:ID (ID-field-
  // rules, label (label-field rules)", "table:\"loopback://api/contact/search\"", and "if neccessary: key field name
  // ... label field name".
  asked.length = 0;
  const job = make({ table: 'loopback://api/agent/job', key: 'contactID', label: 'relayLabel' });
  const rows = await rowsOf(lists[1], 'night');
  ok(asked.length === 1 && asked[0].family === 'agent' && asked[0].verb === 'job', 'options.table loopback://api/<family>/<verb> is searched through the spirit object, at that family and verb', 'asked: ' + short(asked));
  ok(JSON.stringify(asked[0] && asked[0].args).indexOf('night') !== -1, 'with the words typed', 'args: ' + short(asked[0] && asked[0].args));
  const r = rows[0] && parsed(rows[0]);
  ok(rows.length === 1 && rows[0].key === 'KJ' && r && r.name === 'Night job', 'options.key names the field the row\'s ID is in, options.label the field its label is in', 'rows: ' + short(rows));
  lists[1].o.pick({ key: 'KJ', name: 'Night job' });
  ok(job.value === 'KJ' && job.row && job.row.name === 'Night job', 'a pick sets .value to that ID', 'value: ' + short(job.value));
  asked.length = 0;
  make({ table: 'loopback://api/contact/search' });
  await rowsOf(lists[2], 'x');
  ok(asked.length === 1 && asked[0].family === 'contact' && asked[0].verb === 'search', 'naming the contacts\' table is the same as naming none', 'asked: ' + short(asked));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
