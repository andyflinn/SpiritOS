'use strict';

// spirit/run/spirit/element/search/grant/row/test/script.js
// The tests of spirit/element/search/grant/row/script.js, and of no other module (spec: ./script.md; goal/G41.14,
// goal/G41.16). The browser file runs in node on a BARE window (rule/26): nothing is on the page until the row requires
// it. The shared row element and the page's data set are real; the arming button is a stand-in that records what it was
// handed. The grants table is the caller's, handed in as a configuration (goal/G41.16), each call recorded; two are
// tried, so nothing of either is the row's own: the node's grants as the Grants app configures them since
// goal/G41.28 (spirit/element/search/grant/grantsPanel/script.js, which spirit/app/grants/element.js mounts: the branch the grant branch's client keeps, spirit.client.grant.data.branch,
// and its watch), and a second table shaped as the agent's grants by job were, its branch a whole spirit.client path
// (node/family/branch) and its watch that branch's. The grant branch's client is loaded as a
// page's spirit.requireScript('spirit/grant/script.js') brings it (goal/G49.21; once the auth family's data.js), as the Grants app asks it, the page's node known as spirit.startPage makes it
// known (spirit.nodeFacts.key, then data.homeNode).

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'script.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'grant', 'row', 'script.js');

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
// As spirit/element/search/grant/grantsPanel/script.js, in the Grants app, configures the node's grants (goal/G41.28): the grant branch's client's branch and its watch (goal/G49.21).
// goal/G49.23: the grant branch's client stands at its path, spirit.grant.client, never on the store by a short name.
const NODE = grantsTable({ get branch() { return ((global.window.spirit.grant || {}).client || {}).branch || ''; }, key: 'key', label: 'label',
  watch: function (fn) { return global.window.spirit.grant.client.watch(fn); } });
// A second table, its branch a whole spirit.client path of the home node, its watch that branch's.
const AGENT = grantsTable({ get branch() { return global.window.spirit.client.viewAt(null, 'agent').path('grant'); }, key: 'job_id', label: 'job',
  watch: function (fn) { const v = global.window.spirit.client.viewAt(null, 'agent'); return v.watch('grant', function (whole, row) { fn(v.row(whole, 'grant'), row); }); } });

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let SRC, required, loaded, armed, DATA, A, V, E;
function noRow() { if (!A) return true; if (!E.search.grant.row || typeof E.search.grant.row.create !== 'function') return true; return false; }

test.run('the grant row runs on a bare window, with the page\'s data set real', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  required = [];
  armed = [];
  const STANDS = {
    // ITS PARTS ARE requireScript's ANSWERS (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never
    // by writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
    // fail/throw"): the real shared row element, run as the page's loader runs it, and the arming button's stand-in.
    'spirit/element/row/script.js': function () { return PAGE_LOAD.runAsPage(path.join(RUN, 'spirit', 'element', 'row', 'script.js')); },
    'spirit/element/armingButton/script.js': function () { return { attach: function (b, o) { armed.push({ button: b, o: o }); return b; } }; },
  };
  global.document = { createElement: function () { return {}; } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }, readyPromise: Promise.resolve({}), element: {} } };
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  // goal/G49.23: the store places nothing itself; run as the page's loader runs it, it stands at spirit.client, and is what it hands back.
  DATA = PAGE_LOAD.runAsPage('spirit/client/script.js');
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.nodeFacts = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // The grant branch's client, run from its path as its branch brings it (goal/G49.21): the Grants app requires
  // spirit/grant/script.js as it loads (spirit/element/search/grant/grantsPanel/script.js), and that script requires its client.
  // goal/G49.23: run as the page's loader runs it, what the client puts out is the grant branch's client, placed at spirit.grant.client;
  // its family is named by its branch's path, spirit.grant.
  // The client files into the data set requireScript('spirit/client/script.js') hands back, the store this window ran above.
  const pageAsk = global.window.spirit.requireScript;
  global.window.spirit.requireScript = function (p) { return p === 'spirit/client/script.js' ? Promise.resolve(DATA) : pageAsk(p); };
  try { A = PAGE_LOAD.runAsPage(path.join(RUN, 'spirit', 'grant', 'client', 'script.js')); } finally { global.window.spirit.requireScript = pageAsk; }
  // The direct writes below are the grant client's own view of the home node, as it files them.
  V = DATA.viewAt(null, 'spirit.grant');
  const made = {};
  global.window.spirit.requireScript = function (p) { required.push(String(p)); if (!STANDS[p]) return Promise.resolve({}); if (!(p in made)) made[p] = STANDS[p](); return Promise.resolve(made[p]); };
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  // What the row asked as it loaded; the runner's own asks after this test are not the row's.
  loaded = required.slice();
  E = global.window.spirit.element || {};
  return true;
}, test.limit.quick);

test.run('the grant branch\'s data is on the page, and each table names a branch of its own', 0.2, function () {
  if (!DATA) return false;
  return !!A && typeof A.row === 'function' && typeof NODE.branch === 'string' && NODE.branch !== '' && typeof AGENT.branch === 'string' && AGENT.branch !== '' && NODE.branch !== AGENT.branch ? true
    : false;
}, test.limit.quick);

// it loads what it uses itself (rule/26), and knows no grants table
test.run('the grant row requires the shared row element and the arming button, and no data script', 0.2, function () {
  if (!A) return false;
  if (!loaded) return false;
  return ['spirit/element/row/script.js', 'spirit/element/armingButton/script.js'].every(function (p) { return loaded.indexOf(p) !== -1; }) && !loaded.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
test.run('the grant row names no table: no auth verb, no agent grant, and no stream job of its own', 0.2, function () {
  if (!A) return false;
  const names = /auth\.|spirit\.grant\.|agent\.grant|'bundles'|"bundles"|job_id/.test(SRC);
  return !names ? true : false;
}, test.limit.quick);
test.run('the grant row registers spirit.element.search.grant.row.create', 0.2, function () {
  if (!A) return false;
  return E.search.grant.row && typeof E.search.grant.row.create === 'function' ? true : false;
}, test.limit.quick);
// UNCONFIGURED, IT THROWS NOTHING (goal/G41.19, box v23: "throws nothing even when unconfigured"): made with no grants
// table it is a row of nothing, and never falls back to one.
test.run('made with no grants table, the grant row throws nothing and is a row all the same', 0.2, function () {
  if (noRow()) return false;
  let thrown = null; let bare = null;
  try { bare = E.search.grant.row.create({ key: 'K1', path: 'fs.search' }); } catch (e) { thrown = true; }
  return thrown === null && !!bare ? true : false;
}, test.limit.quick);

// A grant of each table: whose, the path, Revoke. Written out per table (goal/G46.1); the two tables' checks that once
// shared a title carry the table's name (goal/G47.2: a title is unique in its suite).
const TABLES = {
  node: { name: 'the node\'s grants', g: NODE, id: 'K1', label: 'Bob <b>', row: function (x) { return { key: x.id, path: x.path, label: x.label }; } },
  agent: { name: 'the agent\'s grants by job', g: AGENT, id: 'J1', label: 'Night <b>', row: function (x) { return { job_id: x.id, path: x.path, job: x.label }; } },
};
const made = {};
function makeRow(t) { const el = E.search.grant.row.create(t.row({ id: t.id, path: 'desk.chat<add>', label: t.label }), { grants: t.g }); made[t.name] = { el: el }; return el; }
function cellsOf(el) { const cells = {}; (el.cells() || []).forEach(function (c) { cells[c.name] = c.html; }); return cells; }
function drawnOf(t) { const cells = cellsOf(made[t.name].el); return cells.name.indexOf(t.label.replace('<', '&lt;')) !== -1 && /desk\.chat&lt;add>/.test(cells.path || '') && !/<b>|<add>/.test(cells.name + cells.path) ? true : false; }
function mountOf(t) {
  const el = made[t.name].el;
  armed.length = 0;
  el.mount({ name: cell(), path: cell(), revoke: cell() });
  const rv = armed.filter(function (a) { return a.button && a.button.action === 'revoke'; })[0];
  made[t.name].rv = rv;
  return !!rv && t.g.revoked.length === 0 ? true : false;
}
async function revokeOf(t) {
  const rv = made[t.name] && made[t.name].rv;
  if (rv) { await rv.o.run(); await settle(); }
  return t.g.revoked.length === 1 && t.g.revoked[0].id === t.id && t.g.revoked[0].path === 'desk.chat<add>' ? true : false;
}
function keyedOf(t) { const el = makeRow(t); return el.kind === 'grant' && el.key === t.id + '\ndesk.chat<add>' ? true : false; }
function fieldsOf(t) { const k = Object.keys(cellsOf(made[t.name].el)); return JSON.stringify(k) === '["name","path","revoke"]' ? true : false; }

// a grant of the node's grants: whose, the path, Revoke
test.run('a node grant is a row of kind grant, keyed by its id and its path, the id read from the key field', 0.2, function () {
  if (noRow()) return false;
  return keyedOf(TABLES.node);
}, test.limit.quick);
test.run('the fields of a node grant are name, path and revoke, with Revoke the rightmost', 0.2, function () {
  if (!made[TABLES.node.name]) return false;
  return fieldsOf(TABLES.node);
}, test.limit.quick);
test.run('a node grant shows whose grant it is, read from the label field, and its path, both drawn escaped', 0.2, function () {
  if (!made[TABLES.node.name]) return false;
  return drawnOf(TABLES.node);
}, test.limit.quick);
test.run('a node grant mounted has an armingButton as its Revoke, and nothing is revoked yet', 0.2, function () {
  if (!made[TABLES.node.name]) return false;
  return mountOf(TABLES.node);
}, test.limit.quick);
test.run('the second press of a node grant\'s Revoke revokes its id and path through the table it was handed', 0.2, async function () {
  if (!made[TABLES.node.name]) return false;
  return revokeOf(TABLES.node);
}, test.limit.quick);
// a grant of the agent's grants by job: whose, the path, Revoke
test.run('an agent grant is a row of kind grant, keyed by its id and its path, the id read from the job_id field', 0.2, function () {
  if (noRow()) return false;
  return keyedOf(TABLES.agent);
}, test.limit.quick);
test.run('the fields of an agent grant are name, path and revoke, with Revoke the rightmost', 0.2, function () {
  if (!made[TABLES.agent.name]) return false;
  return fieldsOf(TABLES.agent);
}, test.limit.quick);
test.run('an agent grant shows whose grant it is, read from the job field, and its path, both drawn escaped', 0.2, function () {
  if (!made[TABLES.agent.name]) return false;
  return drawnOf(TABLES.agent);
}, test.limit.quick);
test.run('an agent grant mounted has an armingButton as its Revoke, and nothing is revoked yet', 0.2, function () {
  if (!made[TABLES.agent.name]) return false;
  return mountOf(TABLES.agent);
}, test.limit.quick);
test.run('the second press of an agent grant\'s Revoke revokes its id and path through the table it was handed', 0.2, async function () {
  if (!made[TABLES.agent.name]) return false;
  return revokeOf(TABLES.agent);
}, test.limit.quick);

// it translates no stream: a table's rows are its cache manager's (goal/G41.28)
// Andy, the box: "anything not using the new spiritData.js and it's buddies clientCacheManager.js must do so in this
// item. no exceptions."
test.run('the grant row\'s code registers no translator and takes no stream', 0.2, function () {
  if (!SRC) return false;
  const takes = /\.translate\s*\(|onJob|\bstream\b|event\.subscribe/.test(SRC);
  return !takes ? true : false;
}, test.limit.quick);
test.run('a table with no watch is no table: the row has no Revoke', 0.2, function () {
  if (noRow()) return false;
  const unwatched = grantsTable({ branch: NODE.branch, key: 'key', label: 'label' });
  const nwCells = cellsOf(E.search.grant.row.create({ key: 'K5', path: 'fs.search', label: 'Eve' }, { grants: unwatched }));
  return !('revoke' in nwCells) || !/Revoke/.test(nwCells.revoke || '') ? true : false;
}, test.limit.quick);

// it repaints from its table's watch
let live;
test.run('when its row in its branch changes, the grant row repaints whose grant it is', 0.2, async function () {
  if (noRow()) return false;
  live = E.search.grant.row.create({ key: 'K2', path: 'fs.search', label: 'Ann' }, { grants: NODE });
  const lh = { name: cell(), path: cell(), revoke: cell() };
  live.mount(lh);
  V.set('rows/K2\nfs.search', { key: 'K2', path: 'fs.search', label: 'Ann, renamed' });
  await settle();
  return live.row.label === 'Ann, renamed' && /Ann, renamed/.test(lh.name.innerHTML) ? true : false;
}, test.limit.quick);
test.run('another grant, or the same key in another table\'s branch, changes nothing here', 0.2, async function () {
  if (!live) return false;
  DATA.setPath(AGENT.branch + '/K2\nfs.search', { job_id: 'K2', path: 'fs.search', job: 'Other table' });
  V.set('rows/K3\nfs.search', { key: 'K3', path: 'fs.search', label: 'Other' });
  await settle();
  return live.row.label === 'Ann, renamed' ? true : false;
}, test.limit.quick);

// NO DEPRECATED (goal/G47.4; Andy: "get rid of that deprecated filter and the field in the database if it's there as well,
// what the hell is it even for?"): nothing marks a grant deprecated, and nothing asks whether a server serves its path.
test.run('row.js names no deprecated and takes no serves, its comments left out', 0.2, function () {
  let src = '';
  try { src = fs.readFileSync(path.join(RUN, 'spirit/element/search/grant/row/script.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return false; }
  return (src.length > 0 && !/deprecated/i.test(src) && !/\bserves\b/.test(src)) ? true : false;
}, test.limit.quick);
