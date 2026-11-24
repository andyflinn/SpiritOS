'use strict';

// spirit/run/spirit/app/agent/element/table/provider/test/elementRow.js
// The tests of spirit/app/agent/element/table/provider/elementRow.js, and of no other module (spec: ./elementRow.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72).
// One provider row in the page (goal/G41.4): the fields the provider table names, handed to the tables' row element
// (../row.js, tested in its own folder). The browser file runs in node on a window of its own; the row element is a
// stand-in placed by the real installSpiritElement as its own file places it, keeping what it was handed. The same world
// as the other tables' elementRow tests. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
const S = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = S.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'elementRow.js');
const ROW = 'spirit/app/agent/element/table/row.js';

function load(file) { PAGE_LOAD.runAsPage(file); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 10; i++) await tick(); };
const at = function (place) { return String(place).split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, global.window.spirit.required); };

// ── the world: a window of its own, the row element a stand-in ──
// W.made: each row element made, { container, o, destroyed }. W.held: while set, the row element's file has not loaded yet.
const W = { required: [], made: [], held: null };
function world() {
  global.window = { spirit: { elements: {}, get element() { return this.elements; }, set element(v) { this.elements = v; }, isBrowser: function () { return false; } } };
  global.spirit = global.window.spirit;
  const helper = S.requireScript('spirit/element/installSpiritElement.js');
  // The tables' row element, as its own file places itself: by the one helper, at spirit.required.<its path>.
  helper(global.window.spirit, ROW, { create: function (container, o) { const m = { container: container, o: o, destroyed: false, destroy: function () { m.destroyed = true; } }; W.made.push(m); return m; } });
  global.window.spirit.requireScript = function (p) {
    W.required.push(String(p));
    if (p === ROW && W.held) return W.held.promise;
    return Promise.resolve(true);
  };
  S.requireScript('spirit/test/headLessChrome.js').pageSpirit(global.window.spirit);
}
// The page's detail pane: look(table) gives the title row its icon and name; each ask kept.
const looks = [];
const detail = { look: function (t) { looks.push(t); return { icon: '•', name: 'the ' + t + ' look' }; } };
const E = {};
const plain = function (fields) { return (fields || []).map(function (f) { const o = { field: f.field, kind: f.kind }; if (f.pick) o.pick = f.pick; if (f.of) o.of = f.of; return o; }); };
const fieldOf = function (name) { const m = E.m; return m && m.o && Array.isArray(m.o.fields) ? m.o.fields.filter(function (f) { return f.field === name; })[0] || null : null; };

test.run('the file runs on a window of its own, with a stand-in row element placed as the page places it', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  world();
  W.up = true;
  return true;
}, test.limit.quick);
test.run('before it runs, the page has no provider row element', 0.2, function () {
  if (!W.up) return false;
  return at('spirit.app.agent.element.table.provider.elementRow') === undefined || false;
}, test.limit.quick);
test.run('it places spirit.required.spirit.app.agent.element.table.provider.elementRow, with create', 0.2, async function () {
  if (!W.up) return false;
  // What the element requires is what is asked from here on: the runner's own requires before it are not the element's.
  W.from = W.required.length;
  load(FILE);
  await settle();
  E.row = at('spirit.app.agent.element.table.provider.elementRow');
  return (!!E.row && typeof E.row.create === 'function') || false;
}, test.limit.quick);
// "Its table's rows are the agent family's cache (goal/G41.28) ... it is loaded here, with this element."
test.run('as it loads, it requires the agent branch\'s interface, spirit/app/agent/api.js, and no data.js', 0.2, function () {
  if (!W.up) return false;
  const own = W.required.slice(W.from || 0);
  return (own.indexOf('spirit/app/agent/api.js') !== -1 && !own.some(function (p) { return /data\.js$/.test(p); })) || false;
}, test.limit.quick);

// ── create(container, id, added, detail): the row element, handed the provider table's fields ──
test.run('create, given a container, an id, added true and the detail pane, makes the tables\' row element in that container', 0.2, async function () {
  if (!E.row) return false;
  E.box = { id: 'box' };
  E.made = E.row.create(E.box, 'ID1', true, detail);
  await settle();
  E.m = W.made[W.made.length - 1];
  return (!!E.m && E.m.container === E.box) || false;
}, test.limit.quick);
test.run('it loads the row element itself, spirit/app/agent/element/table/row.js', 0.2, function () {
  if (!W.up) return false;
  return W.required.indexOf(ROW) !== -1 || false;
}, test.limit.quick);
test.run('the row element is told its table, provider, and the row\'s id', 0.2, function () {
  if (!E.m) return false;
  return (E.m.o.table === 'provider' && E.m.o.id === 'ID1') || false;
}, test.limit.quick);
test.run('the row element is told added as true for the row just made by Add', 0.2, function () {
  if (!E.m) return false;
  return E.m.o.added === true || false;
}, test.limit.quick);
test.run('the title row\'s look is the detail pane\'s look of the provider table', 0.2, function () {
  if (!E.m) return false;
  return (looks.indexOf('provider') !== -1 && !!E.m.o.look && E.m.o.look.name === 'the provider look') || false;
}, test.limit.quick);
test.run('its fields are the provider table\'s: label, url, apiKey, model', 0.2, function () {
  if (!E.m) return false;
  return JSON.stringify(plain(E.m.o.fields)) === JSON.stringify([{'field': 'label', 'kind': 'name'}, {'field': 'url', 'kind': 'url'}, {'field': 'apiKey', 'kind': 'secret'}, {'field': 'model', 'kind': 'pick', 'pick': 'model', 'of': 'providerId'}]) || false;
}, test.limit.quick);
test.run('its API key is a secret: the page never shows it', 0.2, function () {
  if (!E.m) return false;
  const f = fieldOf('apiKey');
  return (!!f && f.kind === 'secret') || false;
}, test.limit.quick);
// goal/G41.21, box v17: "a Model field at the bottom. It is a pick field ... showing only the models whose provider is this provider".
test.run('its last field is Model, a pick of the model table showing only the models whose providerId is this provider', 0.2, function () {
  if (!E.m) return false;
  const fs2 = E.m.o.fields || []; const f = fs2[fs2.length - 1];
  return (!!f && f.field === 'model' && f.kind === 'pick' && f.pick === 'model' && f.of === 'providerId') || false;
}, test.limit.quick);
// goal/G41.21: "# mandatory fields (server AND ui) - provider: icon, label, valid URL".
test.run('its mandatory fields are icon, label and url, as its server names them', 0.2, function () {
  if (!E.m) return false;
  return JSON.stringify(E.m.o.required) === JSON.stringify(["icon", "label", "url"]) || false;
}, test.limit.quick);
test.run('its destroy destroys the row element it made', 0.2, function () {
  if (!E.made || !E.m) return false;
  E.made.destroy();
  return E.m.destroyed === true || false;
}, test.limit.quick);
test.run('anything but added true is told as false, and with no detail pane there is no look', 0.2, async function () {
  if (!E.row) return false;
  E.row.create({ id: 'box2' }, 'ID2', 'yes');
  await settle();
  const m = W.made[W.made.length - 1];
  return (!!m && m.o.id === 'ID2' && m.o.added === false && m.o.look === null) || false;
}, test.limit.quick);
test.run('destroyed before the row element has loaded, it makes none', 0.2, async function () {
  if (!E.row) return false;
  let open = null;
  W.held = { promise: new Promise(function (r) { open = r; }) };
  const n = W.made.length;
  const early = E.row.create({ id: 'box3' }, 'ID3', false, detail);
  early.destroy();
  open(true); W.held = null;
  await settle();
  return W.made.length === n || false;
}, test.limit.quick);
