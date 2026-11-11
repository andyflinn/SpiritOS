'use strict';

// spirit/run/spirit/element/search/grant/test/rowElement.js
// The tests of spirit/element/search/grant/rowElement.js, and of no other module (spec: ./rowElement.md; goal/G41.14,
// goal/G41.16). The browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires
// it. The shared row element and the page's data set are real; the arming button is a stand-in that records what it was
// handed. The grants table is the caller's, handed in as a configuration (goal/G41.16), each call recorded; two are
// tried, so nothing of either is the row's own: the node's auth grants as the Grants app configures them since
// goal/G41.28 (spirit/element/search/grant/grantsPanel.js, which spirit/app/grants/element.js mounts: the branch the auth family's cache manager keeps, spirit.data.auth.data.grants.branch,
// and its watch), and a second table shaped as the agent's grants by job were, its branch a whole spirit.data path
// (node/family/branch) and its watch that branch's. The auth family's data.js is loaded as a
// page's spirit.cacheManager('auth') loads it, as the Grants app asks it, the page's node known as spirit.start makes it
// known (spirit.node.key, then data.homeNode).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'grant', 'rowElement.js');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

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

// A grants table as its caller describes it (goal/G41.16, Andy: "the callers (Grants and agent shell apps should boody
// well know how to configure the damn grantsPanel element"): its data branch, its rows' key and label fields, how a grant
// is revoked, and its watch, fn(id + newline + path, row), its cache manager's (goal/G41.28).
function grantsTable(o) {
  const t = { key: o.key, label: o.label, revoked: [], watch: o.watch,
    revoke: function (id, p) { t.revoked.push({ id: id, path: p }); return Promise.resolve({ ok: true }); } };
  Object.defineProperty(t, 'branch', Object.getOwnPropertyDescriptor(o, 'branch'));
  return t;
}
// As spirit/element/search/grant/grantsPanel.js, in the Grants app, configures the node's grants (goal/G41.28): the auth family's branch and its watch.
const NODE = grantsTable({ get branch() { return ((global.window.spirit.data || {}).auth || {}).data ? global.window.spirit.data.auth.data.grants.branch : ''; }, key: 'key', label: 'label',
  watch: function (fn) { return global.window.spirit.data.auth.data.grants.watch(fn); } });
// A second table, its branch a whole spirit.data path of the home node, its watch that branch's.
const AGENT = grantsTable({ get branch() { return global.window.spirit.data.viewAt(null, 'agent').path('grant'); }, key: 'job_id', label: 'job',
  watch: function (fn) { const v = global.window.spirit.data.viewAt(null, 'agent'); return v.watch('grant', function (whole, row) { fn(v.row(whole, 'grant'), row); }); } });

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let SRC, required, armed, DATA, managers, A, V, E;
const NO_A = 'no auth cache on the page: the world failed';
const NO_ROW = 'no row element registered';
function noRow() { if (!A || !A.grants) return NO_A; if (!E.search.grant.rowElement || typeof E.search.grant.rowElement.create !== 'function') return NO_ROW; return ''; }

test.run('the world: the row runs on a bare window, the page\'s data set real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return 'spirit/element/search/grant/rowElement.js is not there';
  SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  required = [];
  armed = [];
  const STANDS = {
    'spirit/element/rowElement.js': function () { vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'element', 'rowElement.js'), 'utf8'), { filename: 'rowElement.js' }); },
    'spirit/element/armingButton.js': function (E) { E.armingButton = { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
  };
  global.document = { createElement: function () { return {}; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, ready: Promise.resolve({}), element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  DATA = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set; the
  // Grants app asks the auth family's as it loads (spirit/element/search/grant/grantsPanel.js).
  managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  await global.window.spirit.cacheManager('auth');
  A = ((global.window.spirit.data || {}).auth || {}).data;
  // The direct writes below are the auth family's own view of the home node, as its manager files them.
  V = DATA.viewAt(null, 'auth');
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.element.spirit = global.window.spirit.element.spirit || {}).element = global.window.spirit.element.spirit.element || {})); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  E = ((global.window.spirit.element || {}).spirit || {}).element || {};
  return true;
}, 1000);

test.run('the auth family\'s cache manager is on the page, and each table names a branch of its own', 0.2, function () {
  if (!DATA) return 'the row never ran: the world failed';
  return !!A && !!A.grants && typeof A.grants.row === 'function' && typeof NODE.branch === 'string' && NODE.branch !== '' && typeof AGENT.branch === 'string' && AGENT.branch !== '' && NODE.branch !== AGENT.branch ? true
    : 'authReads: ' + short(A && Object.keys(A)) + ', branches ' + short([NODE.branch, AGENT.branch]);
}, 1000);

// it loads what it uses itself (rule/26), and knows no grants table
test.run('it requires the shared row element and the arming button, and no data script', 0.2, function () {
  if (!A || !A.grants) return NO_A;
  return ['spirit/element/rowElement.js', 'spirit/element/armingButton.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }) ? true : 'required: ' + short(required);
}, 1000);
test.run('it names no table: no auth verb, no agent grant, no stream job of its own (goal/G41.16)', 0.2, function () {
  if (!A || !A.grants) return NO_A;
  const names = /auth\.|agent\.grant|'bundles'|"bundles"|job_id/.test(SRC);
  return !names ? true : 'rowElement.js names a table of its own';
}, 1000);
test.run('it registers spirit.element.spirit.element.search.grant.rowElement.create', 0.2, function () {
  if (!A || !A.grants) return NO_A;
  return E.search.grant.rowElement && typeof E.search.grant.rowElement.create === 'function' ? true : 'elements: ' + short(Object.keys(E));
}, 1000);
// UNCONFIGURED, IT THROWS NOTHING (goal/G41.19, box v23: "throws nothing even when unconfigured"): made with no grants
// table it is a row of nothing, and never falls back to one.
test.run('made with no grants table, it throws nothing and is a row all the same', 0.2, function () {
  if (noRow()) return noRow();
  let thrown = null; let bare = null;
  try { bare = E.search.grant.rowElement.create({ key: 'K1', path: 'fs.search' }); } catch (e) { thrown = e && e.message; }
  return thrown === null && !!bare ? true : 'made with none: ' + (thrown ? 'it threw ' + thrown : 'nothing made');
}, 1000);

// A grant of each table: whose, the path, Revoke. Written out per table (goal/G46.1); the two tables' checks that once
// shared a title carry the table's name (goal/G47.2: a title is unique in its suite).
const TABLES = {
  node: { name: 'the node\'s grants', g: NODE, id: 'K1', label: 'Bob <b>', row: function (x) { return { key: x.id, path: x.path, label: x.label }; } },
  agent: { name: 'the agent\'s grants by job', g: AGENT, id: 'J1', label: 'Night <b>', row: function (x) { return { job_id: x.id, path: x.path, job: x.label }; } },
};
const made = {};
function makeRow(t) { const el = E.search.grant.rowElement.create(t.row({ id: t.id, path: 'desk.chat<add>', label: t.label }), { grants: t.g }); made[t.name] = { el: el }; return el; }
function cellsOf(el) { const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; }); return cells; }
function drawnOf(t) { const cells = cellsOf(made[t.name].el); return cells.name.indexOf(t.label.replace('<', '&lt;')) !== -1 && /desk\.chat&lt;add>/.test(cells.path || '') && !/<b>|<add>/.test(cells.name + cells.path) ? true : 'cells: ' + short(cells); }
function mountOf(t) {
  const el = made[t.name].el;
  armed.length = 0;
  el.mount({ name: cell(), path: cell(), revoke: cell() });
  const rv = armed.filter(function (a) { return a.button && a.button.action === 'revoke'; })[0];
  made[t.name].rv = rv;
  return !!rv && t.g.revoked.length === 0 ? true : 'armed ' + armed.length + ', revoked ' + short(t.g.revoked);
}
async function revokeOf(t) {
  const rv = made[t.name] && made[t.name].rv;
  if (rv) { await rv.o.run(); await settle(); }
  return t.g.revoked.length === 1 && t.g.revoked[0].id === t.id && t.g.revoked[0].path === 'desk.chat<add>' ? true : 'revoked: ' + short(t.g.revoked);
}
function keyedOf(t) { const el = makeRow(t); return el.kind === 'grant' && el.key === t.id + '\ndesk.chat<add>' ? true : 'el: ' + short({ kind: el.kind, key: el.key }); }
function fieldsOf(t) { const k = Object.keys(cellsOf(made[t.name].el)); return JSON.stringify(k) === '["name","path","revoke"]' ? true : 'fields: ' + short(k); }
const NO_MADE = 'no row of this table was made';

// a grant of the node's grants: whose, the path, Revoke
test.run('a node grant is a row of kind grant, keyed by its id and its path, the id read from the key field', 0.2, function () {
  if (noRow()) return noRow();
  return keyedOf(TABLES.node);
}, 1000);
test.run('its fields are name, path and revoke: Revoke the rightmost', 0.2, function () {
  if (!made[TABLES.node.name]) return NO_MADE;
  return fieldsOf(TABLES.node);
}, 1000);
test.run('a node grant shows whose grant it is, read from the label field, and its path, both drawn escaped', 0.2, function () {
  if (!made[TABLES.node.name]) return NO_MADE;
  return drawnOf(TABLES.node);
}, 1000);
test.run('mounted, its Revoke is an armingButton, and nothing is revoked yet', 0.2, function () {
  if (!made[TABLES.node.name]) return NO_MADE;
  return mountOf(TABLES.node);
}, 1000);
test.run('its second press revokes through the table it was handed: revoke(id, path)', 0.2, async function () {
  if (!made[TABLES.node.name]) return NO_MADE;
  return revokeOf(TABLES.node);
}, 1000);
// a grant of the agent's grants by job: whose, the path, Revoke
test.run('an agent grant is a row of kind grant, keyed by its id and its path, the id read from the job_id field', 0.2, function () {
  if (noRow()) return noRow();
  return keyedOf(TABLES.agent);
}, 1000);
test.run('its fields are name, path and revoke: Revoke the rightmost, of the agent\'s grants by job', 0.2, function () {
  if (!made[TABLES.agent.name]) return NO_MADE;
  return fieldsOf(TABLES.agent);
}, 1000);
test.run('an agent grant shows whose grant it is, read from the job field, and its path, both drawn escaped', 0.2, function () {
  if (!made[TABLES.agent.name]) return NO_MADE;
  return drawnOf(TABLES.agent);
}, 1000);
test.run('mounted, its Revoke is an armingButton, and nothing is revoked yet, of the agent\'s grants by job', 0.2, function () {
  if (!made[TABLES.agent.name]) return NO_MADE;
  return mountOf(TABLES.agent);
}, 1000);
test.run('its second press revokes through the table it was handed: revoke(id, path), of the agent\'s grants by job', 0.2, async function () {
  if (!made[TABLES.agent.name]) return NO_MADE;
  return revokeOf(TABLES.agent);
}, 1000);

// it translates no stream: a table's rows are its cache manager's (goal/G41.28)
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions."
test.run('its code registers no translator and takes no stream', 0.2, function () {
  if (!SRC) return 'no rowElement.js read: the world failed';
  const takes = /\.translate\s*\(|onJob|\bstream\b|event\.subscribe/.test(SRC);
  return !takes ? true : 'rowElement.js still translates or takes a stream';
}, 1000);
test.run('a table with no watch is no table: the row has no Revoke', 0.2, function () {
  if (noRow()) return noRow();
  const unwatched = grantsTable({ branch: NODE.branch, key: 'key', label: 'label' });
  const nwCells = cellsOf(E.search.grant.rowElement.create({ key: 'K5', path: 'fs.search', label: 'Eve' }, { grants: unwatched }));
  return !('revoke' in nwCells) || !/Revoke/.test(nwCells.revoke || '') ? true : 'cells: ' + short(nwCells);
}, 1000);

// it repaints from its table's watch
let live;
test.run('its row in its branch changed: the row repaints whose grant it is', 0.2, async function () {
  if (noRow()) return noRow();
  live = E.search.grant.rowElement.create({ key: 'K2', path: 'fs.search', label: 'Ann' }, { grants: NODE });
  const lh = { name: cell(), path: cell(), revoke: cell() };
  live.mount(lh);
  V.set('grants/K2\nfs.search', { key: 'K2', path: 'fs.search', label: 'Ann, renamed' });
  await settle();
  return live.row.label === 'Ann, renamed' && /Ann, renamed/.test(lh.name.innerHTML) ? true : 'row: ' + short(live.row) + ', cell ' + short(lh.name.innerHTML);
}, 1000);
test.run('another grant, or the same key in another table\'s branch, changes nothing here', 0.2, async function () {
  if (!live) return 'no live row was made';
  DATA.setPath(AGENT.branch + '/K2\nfs.search', { job_id: 'K2', path: 'fs.search', job: 'Other table' });
  V.set('grants/K3\nfs.search', { key: 'K3', path: 'fs.search', label: 'Other' });
  await settle();
  return live.row.label === 'Ann, renamed' ? true : 'row: ' + short(live.row);
}, 1000);
