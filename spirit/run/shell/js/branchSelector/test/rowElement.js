'use strict';

// spirit/run/shell/js/branchSelector/test/rowElement.js
// The tests of shell/js/branchSelector/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires it. The shared
// row element is put there real; the arming button is a stand-in that records what it was handed. The node's auth
// family is the spirit object's, each call recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'branchSelector', 'rowElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// A cell as the list hands one to mount: its html set by the paint, a button in it found as a page would find it.
function cell() {
  const c = { kids: [], html: '' };
  Object.defineProperty(c, 'innerHTML', { get: function () { return c.html; }, set: function (v) {
    c.html = String(v); c.kids.length = 0;
    const b = /<button[^>]*data-action="([^"]+)"[^>]*>([^<]*)</.exec(c.html);
    if (b) c.kids.push({ tag: 'button', action: b[1], textContent: b[2], getAttribute: function (k) { return k === 'data-action' ? b[1] : null; } });
  } });
  c.querySelector = function (sel) { const m = /^\[data-action="([^"]+)"\]$/.exec(sel); return m ? c.kids.filter(function (k) { return k.action === m[1]; })[0] || null : null; };
  return c;
}

test.startTest('branchSelector/rowElement.js: one branch, as a row');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/branchSelector/rowElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const armed = [];
  const auth = { branch: function (a) { asked.push(a); return Promise.resolve({ id: a.id }); } };
  const STANDS = {
    'shell/js/rowElement.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'rowElement.js'), 'utf8'), { filename: 'rowElement.js' }); },
    'shell/js/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
  };
  global.document = { createElement: function () { return {}; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  // The page's one data set (shell/js/spiritData.js): the stream's branch rows land there.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
  const DATA = global.window.spirit.data;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/rowElement.js', 'shell/js/armingButton.js'].every(function (p) { return required.indexOf(p) !== -1; }),
    'it requires the shared row element and the arming button through spirit.require', 'required: ' + short(required));
  ok(E.branchElement && typeof E.branchElement.create === 'function', 'it registers spirit.elements.branchElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.branchElement || typeof E.branchElement.create !== 'function') return;

  test.subHeading('a branch row: Family, Verb, Delete');
  // Andy, box: "branchSelector:pane, with table columns as follows: 1. Family (duh?) 2. Verb 3. armingButton 'Delete'".
  const el = E.branchElement.create({ id: 3, bundle: 7, family: 'de<sk>', verb: 'chat<add>' });
  ok(el.kind === 'branch' && el.key === '3' && el.row.bundle === 7 && el.row.family === 'de<sk>', 'it is a row element of kind branch, keyed by the branch\'s id, its bundle with it', 'el: ' + short({ kind: el.kind, key: el.key, row: el.row }));
  const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; });
  ok(JSON.stringify(Object.keys(cells)) === '["family","verb","delete"]', 'its fields are family, verb and delete, in that order', 'fields: ' + short(Object.keys(cells)));
  ok(cells.family === 'de&lt;sk>' && /chat&lt;add>/.test(cells.verb || '') && !/<add>/.test(cells.verb || ''), 'family and verb are drawn escaped', 'cells: ' + short(cells));
  const all = E.branchElement.create({ id: 4, bundle: 7, family: 'files', verb: '' });
  const allCells = {}; all.cells().forEach(function (c) { allCells[c.name] = c.html; });
  // Andy, box: "A branch row with an empty verb shows as \"(ALL)\", as the filter does."
  ok(allCells.verb === '(ALL)', 'an empty verb shows as (ALL)', 'verb: ' + short(allCells.verb));
  ok(/data-action="delete"/.test(cells.delete || ''), 'delete is a button naming its action', 'delete: ' + short(cells.delete));

  test.subHeading('Delete asks are-you-sure');
  const hosts = { family: cell(), verb: cell(), delete: cell() };
  el.mount(hosts);
  const del = armed.filter(function (a) { return a.button && a.button.action === 'delete'; })[0];
  ok(!!del && typeof del.o.run === 'function' && asked.length === 0, 'mounted, its Delete is an armingButton, and nothing is asked yet', 'armed: ' + short(armed.length) + ', asked ' + short(asked));
  if (del) { await del.o.run(); await settle(); }
  ok(asked.length === 1 && asked[0].op === 'delete' && asked[0].id === 3, 'its second press asks auth.branch { op: delete, id }', 'asked: ' + short(asked));

  test.subHeading('it repaints from data.branches (goal/G41.14)');
  // Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes their data set".
  const live = E.branchElement.create({ id: 5, bundle: 7, family: 'files', verb: 'read' });
  const lh = { family: cell(), verb: cell(), delete: cell() };
  live.mount(lh);
  DATA.set('branches/5', { id: 5, bundle: 7, family: 'files', verb: '' });
  await settle();
  ok(live.row.verb === '' && lh.verb.innerHTML === '(ALL)', 'its row in data.branches changed, the row repaints: the verb now (ALL)', 'row: ' + short(live.row) + ', verb cell ' + short(lh.verb.innerHTML));
  DATA.set('branches/6', { id: 6, bundle: 7, family: 'desk', verb: 'x' });
  await settle();
  ok(live.row.family === 'files', 'another branch\'s row changes nothing here', 'row: ' + short(live.row));

  test.subHeading('the type\'s own element takes the node\'s branch rows from the stream (goal/G41.14)');
  // The row element is the data type's code (G30.18: "rowElements carry the listeners and painters a subject needs
  // for real-time updates"); it is loaded with every list of its kind. Andy: "DOESN'T THAT SHIT BELONG INSIDE THE MOTHERFUCKING element??????", "i ruled a LONG time AGO THAT FUCKING ELEMENTS
  // carry THEIR FUCKING DESCRIPTIONS". The node publishes each changed row of its two bundle tables on one permanent job
  // of type bundles, as the shadow job does each contact row: { table, row }, and { table, row: { id }, gone: true }.
  DATA.take({ type: 'bundles', data: { table: 'branch', row: { id: 3, bundle: 7, family: 'desk', verb: 'chat.add' } } });
  ok(JSON.stringify(DATA.get('branches/' + { id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }.id)) === JSON.stringify({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }), 'a branch row published lands in data.branches by its id, through the row element\'s own translation (its kind\'s index, shell/js/rowElement.js, G30.18)', 'data: ' + short(DATA.branch('branches')));
  DATA.take({ type: 'bundles', data: { table: 'branch', row: { id: 3, bundle: 7, family: 'desk', verb: '' } } });
  const again = DATA.get('branches/' + { id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }.id);
  ok(again && again.verb === '', 'a row published again replaces the one kept', 'data: ' + short(again));
  DATA.take({ type: 'bundles', data: { table: 'branch', row: { id: { id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }.id }, gone: true } });
  ok(DATA.get('branches/' + { id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }.id) === undefined, 'a row published gone is taken out', 'data: ' + short(DATA.branch('branches')));
  const before = JSON.stringify(DATA.branch('branches'));
  DATA.take({ type: 'bundles', data: { table: 'bundle', row: { id: 99, label: 'x', bundle: 1, family: 'f', verb: '' } } });
  DATA.take({ type: 'shadow', data: { row: { id: 98 } } });
  DATA.take({ type: 'bundles', data: { table: 'branch', row: { label: 'no id' } } });
  ok(JSON.stringify(DATA.branch('branches')) === before, 'the other table\'s rows, another job\'s, and a row with no id write nothing in data.branches', 'data: ' + short(DATA.branch('branches')));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
