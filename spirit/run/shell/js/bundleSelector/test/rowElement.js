'use strict';

// spirit/run/shell/js/bundleSelector/test/rowElement.js
// The tests of shell/js/bundleSelector/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. What it
// requires is put there then: the shared row element and the field input real, the arming button and the branch editor
// stand-ins that record what they were handed. The node's auth family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const JS = path.join(RUN, 'shell', 'js');
const FILE = path.join(JS, 'bundleSelector', 'rowElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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

test.startTest('bundleSelector/rowElement.js: one bundle, as a row');
// An element that counts on what it did not load throws inside a promise: that is a failure said, not a silent exit.
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/bundleSelector/rowElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const armed = [];
  const opened = [];
  let answer = function () { return Promise.resolve({ id: 7 }); };
  const auth = { bundle: function (a) { asked.push(a); return answer(a); } };
  const load = function (p) { vm.runInThisContext(fs.readFileSync(path.join(RUN, p), 'utf8'), { filename: p }); };
  const STANDS = {
    'shell/js/rowElement.js': function () { load('shell/js/rowElement.js'); },
    'shell/js/fieldInput.js': function () { load('shell/js/fieldInput.js'); },
    'shell/js/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
    'shell/js/branchEditor.js': function (E) { E.branchEditor = { open: function (o) { opened.push(o); return {}; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); }, addEventListener: function () {}, removeEventListener: function () {} };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
    fieldRules: require(path.join(RUN, 'spirit', 'fieldRules.js')), ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  // The page's one data set (shell/shared/js/spiritData.js), which spirit.js brings with the client: the stream's rows land there.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'shared', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
  const DATA = global.window.spirit.data;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/rowElement.js', 'shell/js/fieldInput.js', 'shell/js/armingButton.js'].every(function (p) { return required.indexOf(p) !== -1; }),
    'it requires the shared row element, the field input and the arming button through spirit.require', 'required: ' + short(required));
  ok(E.bundleElement && typeof E.bundleElement.create === 'function', 'it registers spirit.elements.bundleElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.bundleElement || typeof E.bundleElement.create !== 'function') return;

  test.subHeading('a bundle row: its label, Edit and Delete');
  const el = E.bundleElement.create({ id: 7, label: 'Read <files>' });
  ok(el.kind === 'bundle' && el.key === '7' && el.row.label === 'Read <files>', 'it is a row element of kind bundle, keyed by the bundle\'s id', 'el: ' + short({ kind: el.kind, key: el.key, row: el.row }));
  const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; });
  // goal/G41.25, box: "the bundleSelector's list will gain a new column \"owner\", displayed right after the bundles label."
  ok(JSON.stringify(Object.keys(cells)) === '["label","owner","edit","delete"]', 'its fields are label, owner, edit and delete, in that order', 'fields: ' + short(Object.keys(cells)));
  const ow = E.bundleElement.create({ id: 9, label: 'Agent tools', owner: 'agent' });
  const owCells = {}; (ow.cells() || []).forEach(function (c) { owCells[c.name] = c.html; });
  ok(/\bagent\b/.test(owCells.owner || '') && !/<input/.test(owCells.owner || ''), 'the owner is shown as the bundle names it, never an input: it never changes after the add', 'owner: ' + short(owCells.owner));
  const odd = E.bundleElement.create({ id: 10, label: 'x', owner: 'a<b' });
  const oddCells = {}; (odd.cells() || []).forEach(function (c) { oddCells[c.name] = c.html; });
  ok(/a&lt;b/.test(oddCells.owner || '') && !/a<b/.test(oddCells.owner || ''), 'and drawn escaped', 'owner: ' + short(oddCells.owner));
  ok(/Read &lt;files>/.test(cells.label || '') && !/<files>/.test(cells.label || ''), 'the label is drawn escaped', 'label: ' + short(cells.label));
  ok(/data-action="edit"/.test(cells.edit || '') && /data-action="delete"/.test(cells.delete || ''), 'edit and delete are buttons naming their action', 'cells: ' + short(cells));

  test.subHeading('the label is shown only (goal/G41.26)');
  // Andy, box: "bundleSelector:pane mode the Label should now just be an output, field: A bundles label is determined
  // when it's added, and cannot be modified. This will protect family owned bundles from having their label mutilated."
  // Mounted, with the old editable option or without it, the label cell shows the label and holds no input.
  const ed = E.bundleElement.create({ id: 7, label: 'Read <files>' }, { editable: true });
  const hosts = { label: cell(), owner: cell(), edit: cell(), delete: cell() };
  ed.mount(hosts);
  await settle();
  // What the cell shows as text: its markup, and the text of what it holds that is no input.
  const labelText = function () { return String(hosts.label.innerHTML || '') + hosts.label.kids.filter(function (k) { return !/input|textarea/i.test(k.tag || ''); }).map(function (k) { return String(k.textContent || ''); }).join(''); };
  ok(!hosts.label.querySelector('input') && !hosts.label.kids.some(function (k) { return /input|textarea/i.test(k.tag || ''); }), 'mounted, its label cell holds no input, editable or not', 'label cell: ' + short(hosts.label.kids.map(function (k) { return k.tag; })));
  ok(/Read &lt;files>|Read <files>/.test(labelText()) && !/<files>/.test(String(hosts.label.innerHTML || '')), 'it shows the label, escaped', 'label cell: ' + short(labelText()));
  ok(asked.every(function (a) { return a.op !== 'set'; }), 'and asks the node no set, ever', 'asked: ' + short(asked));
  // rule/19: a ui only draws what the server's stream says; goal/G41.14, Andy: "EVERY FUCKING element MUST FUCKING
  // LISTING to anything that changes their data set". The row repaints from data.bundles.
  DATA.set('bundles/7', { id: 7, label: 'Mover' });
  await settle();
  ok(ed.row.label === 'Mover' && /Mover/.test(labelText()), 'the bundle\'s row in data.bundles changed, the row repaints its label', 'row: ' + short(ed.row) + ', label cell ' + short(labelText()));
  DATA.set('bundles/8', { id: 8, label: 'Someone else' });
  await settle();
  ok(ed.row.label === 'Mover', 'another bundle\'s row changes nothing here', 'row: ' + short(ed.row));

  test.subHeading('Delete asks are-you-sure; Edit opens the branch editor');
  const del = armed.filter(function (a) { return a.button && a.button.attrs['data-action'] === 'delete'; })[0];
  ok(!!del && typeof del.o.run === 'function', 'mounted, its Delete is an armingButton', 'armed: ' + short(armed.map(function (a) { return a.button && a.button.attrs; })));
  if (del) { await del.o.run(); await settle(); }
  const dels = asked.filter(function (a) { return a.op === 'delete'; });
  ok(dels.length === 1 && dels[0].id === 7, 'its second press asks auth.bundle { op: delete, id }', 'asked: ' + short(asked));
  await ed.act('edit', {});
  await settle();
  ok(required.indexOf('shell/js/branchEditor.js') !== -1 && opened.length === 1 && opened[0].bundle === 7 && opened[0].label === 'Mover',
    'Edit requires the branch editor, then opens it on this bundle: { bundle: id, label }', 'opened: ' + short(opened) + ', required ' + short(required));

  test.subHeading('the type\'s own element takes the node\'s bundle rows from the stream (goal/G41.14)');
  // The row element is the data type's code (G30.18: "rowElements carry the listeners and painters a subject needs
  // for real-time updates"); it is loaded with every list of its kind. Andy: "DOESN'T THAT SHIT BELONG INSIDE THE MOTHERFUCKING element??????", "i ruled a LONG time AGO THAT FUCKING ELEMENTS
  // carry THEIR FUCKING DESCRIPTIONS". The node publishes each changed row of its two bundle tables on one permanent job
  // of type bundles, as the shadow job does each contact row: { table, row }, and { table, row: { id }, gone: true }.
  DATA.take({ type: 'bundles', data: { table: 'bundle', row: { id: 7, label: 'Reader' } } });
  ok(JSON.stringify(DATA.get('bundles/' + { id: 7, label: 'Reader' }.id)) === JSON.stringify({ id: 7, label: 'Reader' }), 'a bundle row published lands in data.bundles by its id, through the row element\'s own translation (its kind\'s index, shell/js/rowElement.js, G30.18)', 'data: ' + short(DATA.branch('bundles')));
  DATA.take({ type: 'bundles', data: { table: 'bundle', row: { id: 7, label: 'Lister' } } });
  const again = DATA.get('bundles/' + { id: 7, label: 'Reader' }.id);
  ok(again && again.label === 'Lister', 'a row published again replaces the one kept', 'data: ' + short(again));
  DATA.take({ type: 'bundles', data: { table: 'bundle', row: { id: { id: 7, label: 'Reader' }.id }, gone: true } });
  ok(DATA.get('bundles/' + { id: 7, label: 'Reader' }.id) === undefined, 'a row published gone is taken out', 'data: ' + short(DATA.branch('bundles')));
  const before = JSON.stringify(DATA.branch('bundles'));
  DATA.take({ type: 'bundles', data: { table: 'branch', row: { id: 99, label: 'x', bundle: 1, family: 'f', verb: '' } } });
  DATA.take({ type: 'shadow', data: { row: { id: 98 } } });
  DATA.take({ type: 'bundles', data: { table: 'bundle', row: { label: 'no id' } } });
  ok(JSON.stringify(DATA.branch('bundles')) === before, 'the other table\'s rows, another job\'s, and a row with no id write nothing in data.bundles', 'data: ' + short(DATA.branch('bundles')));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
