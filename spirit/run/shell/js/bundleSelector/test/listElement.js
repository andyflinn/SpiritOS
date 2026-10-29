'use strict';

// spirit/run/shell/js/bundleSelector/test/listElement.js
// The tests of shell/js/bundleSelector/listElement.js, and of no other module (spec: ./listElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it, and the row element a
// stand-in that keeps what it was handed. The node's auth family is the spirit object's, each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'bundleSelector', 'listElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

test.startTest('bundleSelector/listElement.js: the bundle list');
// An element that counts on what it did not load throws inside a promise: that is a failure said, not a silent exit.
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/bundleSelector/listElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const lists = [];
  const rows = [];
  let answer = { items: [{ key: '7', label: JSON.stringify({ id: 7, label: 'Reader' }) }], more: true };
  const auth = { bundle: function (a) { asked.push(a); return answer ? Promise.resolve(answer) : Promise.resolve(null); } };
  const STANDS = {
    'shell/js/probabilitySearch.js': function (E) { E.probabilitySearch = { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }; },
    'shell/js/bundleSelector/rowElement.js': function (E) { E.bundleElement = { create: function (row, opts) { const r = { kind: 'bundle', row: row, opts: opts || {} }; rows.push(r); return r; } }; },
  };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  // The page's one data set (shell/js/spiritData.js), which spirit.js brings with the client.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'shell', 'js', 'spiritData.js'), 'utf8'), { filename: 'spiritData.js' });
  const DATA = global.window.spirit.data;
  global.document = { createElement: function () { return {}; } };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/probabilitySearch.js', 'shell/js/bundleSelector/rowElement.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }),
    'it requires the search element and its row element through spirit.require, and no data script (Andy: "NO FUCKING DATA SCRIPT")', 'required: ' + short(required));
  ok(E.bundleList && typeof E.bundleList.create === 'function', 'it registers spirit.elements.bundleList.create', 'elements: ' + short(Object.keys(E)));
  if (!E.bundleList || typeof E.bundleList.create !== 'function') return;

  test.subHeading('create hands the search element the node\'s bundles');
  const picked = [];
  const host = {};
  const made = E.bundleList.create(host, { face: 'dropdown', placeholder: 'choose a bundle…', all: 'no bundle', pick: function (row, key) { picked.push(key); } });
  await settle();
  const l = lists[0];
  ok(!!l && l.host === host, 'it draws one probabilitySearch into the host it is given', 'lists: ' + lists.length);
  if (!l) return;
  const o = l.o;
  ok(o.face === 'dropdown' && o.placeholder === 'choose a bundle…' && o.all === 'no bundle', 'face, placeholder and all are handed on, pane or dropdown as asked', 'opts: ' + short({ face: o.face, placeholder: o.placeholder, all: o.all }));
  o.pick({ id: 7 }, '7');
  ok(picked.length === 1 && picked[0] === '7', 'a pick reaches opts.pick', 'picked: ' + short(picked));
  ok(l.refreshes === 1, 'it fills as soon as it is drawn: one refresh at create', 'refreshes: ' + l.refreshes);
  // goal/G41.14, Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes their data set": the list is a
  // view of data.bundles, so a bundle added anywhere on the page shows in every bundle list (probabilitySearch's data).
  ok(o.data === 'bundles', 'it is a view of data.bundles, the spirit object\'s cache, which the node\'s stream keeps current', 'data: ' + short(o.data));

  test.subHeading('it takes the node\'s bundle rows from the stream itself (goal/G41.14)');
  // Andy: "DOESN'T THAT SHIT BELONG INSIDE THE MOTHERFUCKING element??????", "i ruled a LONG time AGO THAT FUCKING ELEMENTS
  // carry THEIR FUCKING DESCRIPTIONS". The node publishes each changed row of its two bundle tables on one permanent job
  // of type bundles, as the shadow job does each contact row: { table, row }, and { table, row: { id }, gone: true }.
  DATA.take({ type: 'bundles', data: { table: 'bundle', row: { id: 7, label: 'Reader' } } });
  ok(JSON.stringify(DATA.get('bundles/' + { id: 7, label: 'Reader' }.id)) === JSON.stringify({ id: 7, label: 'Reader' }), 'a bundle row published lands in data.bundles by its id, through the list element\'s own translation', 'data: ' + short(DATA.branch('bundles')));
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
  const got = await o.api.verb(o.server + '.' + o.verb, o.args('  rea ', {}));
  ok(o.server === 'auth' && o.verb === 'bundle' && asked.length === 1 && asked[0].op === 'search' && asked[0].text === 'rea',
    'its search asks auth.bundle { op: search, text } through the spirit object, the text trimmed', 'asked: ' + short(asked) + ', at ' + o.server + '.' + o.verb);
  ok(got && got.status === 200 && got.body && got.body.ok === true && got.body.items.length === 1 && got.body.more === true, 'and answers as a reply: { items, more }', 'got: ' + short(got));
  answer = null;
  const empty = await o.api.verb(o.server + '.' + o.verb, o.args('', {}));
  ok(empty && empty.body && Array.isArray(empty.body.items) && empty.body.items.length === 0 && empty.body.more === false, 'an empty answer is an empty list, like any other', 'empty: ' + short(empty));
  const cols = (o.columns || []).map(function (c) { return c.field; });
  ok(JSON.stringify(cols) === '["label"]', 'by default its one column is the label', 'columns: ' + short(cols));
  const m = typeof o.matched === 'function' ? o.matched({ id: 7, label: 'Reader' }) : null;
  ok(m && m.label === 'Reader' && !('id' in m), 'a row is matched on its label, never its hidden id', 'matched: ' + short(m));

  test.subHeading('each row a bundle row element');
  const el = o.element({ id: 7, label: 'Reader' }, '7');
  ok(el && el.kind === 'bundle' && el.row.id === 7 && el.row.label === 'Reader' && !el.opts.editable, 'each row is a bundleElement of that bundle, not editable by default', 'element: ' + short(el));

  test.subHeading('a pane of the editor: its columns and editable rows');
  // Andy, box: "the bundleSelector in pane-mode, with the following columns: 1. [fieldInput ... Label] 2. an edit button
  // ... 3. a delete armingButton.js".
  E.bundleList.create({}, { face: 'pane', columns: ['label', 'edit', 'delete'], editable: true });
  await settle();
  const p = lists[1] && lists[1].o;
  ok(p && JSON.stringify((p.columns || []).map(function (c) { return c.field; })) === '["label","edit","delete"]', 'opts.columns names the row\'s fields it shows, in order', 'columns: ' + short(p && p.columns));
  const pe = p && p.element({ id: 8, label: 'Writer' }, '8');
  ok(pe && pe.opts.editable === true, 'and opts.editable makes each row edit its label in place', 'element: ' + short(pe));

  test.subHeading('refresh and destroy are the search element\'s');
  const r0 = l.refreshes;
  made.refresh(); made.destroy();
  ok(l.refreshes === r0 + 1 && l.destroyed === true && made.list === l, 'refresh and destroy reach the search element; .list is it', 'refreshes ' + (l.refreshes - r0) + ', destroyed ' + l.destroyed);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
