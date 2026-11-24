'use strict';

// spirit/run/spirit/element/search/grant/test/list.js
// The tests of spirit/element/search/grant/list.js, and of no other module (spec: ./list.md; goal/G41.14,
// goal/G41.16). The browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires
// it. Then the search element is a recorder in its place, so this tests the list and not the search under it, and the
// row element a stand-in that keeps what it was handed. The grants table is the caller's, handed in as a configuration
// (goal/G41.16), each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'spirit.js')).requireScript('spirit/test/headLessChrome.js');
// spirit.js, the loader, alone by node's require; every other file of the tree through it, by its path (goal/G49.6).
const LOADER = require(path.join(RUN, 'spirit', 'spirit.js'));
const test = LOADER.requireScript('spirit/test/testReport.js');
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'grant', 'list.js');

const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let SRC, required, lists, rows, E, made, l, o, AGENT, filters, selectors, serves, searched;
function noList() { return !E || !E.search.grant || !E.search.grant.list || typeof E.search.grant.list.create !== 'function'; }

test.run('the grant list runs on a bare window', 0.2, async function () {
  if (!fs.existsSync(FILE)) return false;
  SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  required = [];
  lists = [];
  rows = [];
  const STANDS = {
    'spirit/element/search.js': function (E) { E.search = Object.assign(E.search || {}, { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }); },
    'spirit/element/search/grant/row.js': function (E) { LOADER.requireScript('spirit/element/installSpiritElement.js')(global.window.spirit, 'spirit/element/search/grant/row.js', { create: function (row, opts) { const r = { kind: 'grant', row: row, opts: opts || {} }; rows.push(r); return r; } }); },
  };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, readyPromise: Promise.resolve({}), element: {} } };
  // goal/G43.32: the element places itself by installSpiritElement, as it runs (spirit/test/headLessChrome.js pageSpirit).
  LOADER.requireScript('spirit/test/headLessChrome.js').pageSpirit(window.spirit);
  global.spirit = global.window.spirit;
  global.document = { createElement: function () { return {}; } };
  global.window.spirit.requireScript = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](((global.window.spirit.required.spirit = global.window.spirit.required.spirit || {}).element = global.window.spirit.required.spirit.element || {})); } return Promise.resolve(true); };
  PAGE_LOAD.runAsPage(FILE);
  await settle();
  E = ((global.window.spirit.required || {}).spirit || {}).element || {};
  return true;
}, test.limit.quick);

// it loads what it uses itself (rule/26), and knows no grants table
test.run('it requires the search element and its row element, and no data script', 0.2, function () {
  if (!required) return false;
  return ['spirit/element/search.js', 'spirit/element/search/grant/row.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }) ? true : false;
}, test.limit.quick);
test.run('it names no table and no branch of its own: no auth verb, no agent grant and no data.grants', 0.2, function () {
  if (!SRC) return false;
  const names = /auth\.|agent\.grant|job_id|'grants'|"grants"/.test(SRC);
  return !names ? true : false;
}, test.limit.quick);
test.run('it registers spirit.required.spirit.element.search.grant.list.create', 0.2, function () {
  if (!E) return false;
  return !noList() ? true : false;
}, test.limit.quick);
test.run('made with no grants table, it is refused, and draws nothing', 0.2, function () {
  if (noList()) return false;
  let refused = false;
  try { E.search.grant.list.create({}, {}); } catch (e) { refused = (e && e.message) !== null; }
  return refused && lists.length === 0 ? true : false;
}, test.limit.quick);

// a pane of the table it is handed, a view of that table's branch
test.run('it draws one probabilitySearch into its host, and fills it as soon as it is drawn', 0.2, async function () {
  if (noList()) return false;
  searched = [];
  // Its branch a whole spirit.required.spirit.data path, node/family/branch (goal/G41.28), the node's key in base64url.
  AGENT = { branch: 'nOdE-key_one/agent/grant', key: 'job_id', label: 'job',
    search: function (text) { searched.push(text); return Promise.resolve({ items: [{ key: 'J1\nfs.search', label: JSON.stringify({ job_id: 'J1', path: 'fs.search', job: 'Night' }) }], more: false }); },
    revoke: function () { return Promise.resolve({}); }, watch: function () { return function () {}; } };
  const host = {};
  filters = [{ name: 'id', test: function () { return 1; } }];
  serves = function () { return true; };
  // goal/G41.26: the page's selectors, for the search's 🪣 row (Andy: "any searchSelector in our system must go into the
  // probabilitySearch's selectorRow").
  selectors = [{ name: 'id', element: { addEventListener: function () {} }, test: function () { return 1; } }];
  made = E.search.grant.list.create(host, { grants: AGENT, filters: filters, selectors: selectors, serves: serves });
  await settle();
  l = lists[0];
  if (l) o = l.o;
  return !!l && l.host === host && l.refreshes === 1 ? true : false;
}, test.limit.quick);
test.run('it is a view of the branch its table names, here nOdE-key_one/agent/grant', 0.2, function () {
  if (!l) return false;
  return o.data === 'nOdE-key_one/agent/grant' ? true : false;
}, test.limit.quick);
// WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24): its own data source is the search's options.search, never an api.
test.run('it hands its search a data source of its own as options.search, and no api', 0.2, function () {
  if (!l) return false;
  return o.api === undefined && typeof o.search === 'function' ? true : false;
}, test.limit.quick);
test.run('its search asks the table\'s search with the text trimmed, and answers as a reply', 0.2, async function () {
  if (!l) return false;
  if (typeof o.search !== 'function') return false;
  const got = await o.search(o.args(' ni ', {}), o.verb);
  return searched.length === 1 && searched[0] === 'ni' && got && got.status === 200 && got.body && got.body.items.length === 1 ? true : false;
}, test.limit.quick);
test.run('its columns are whose it is, the path and Revoke, with Revoke the rightmost', 0.2, function () {
  if (!l) return false;
  const cols = (o.columns || []).map(function (c) { return c.field; });
  return JSON.stringify(cols) === '["name","path","revoke"]' ? true : false;
}, test.limit.quick);
// No deprecated (goal/G47.4): a row is handed nothing that judges whether a server serves its path.
test.run('each row is a grantElement, handed the same table and nothing that judges whether a server serves its path', 0.2, function () {
  if (!l) return false;
  const el = o.element({ job_id: 'J1', path: 'fs.search', job: 'Night' }, 'J1\nfs.search');
  return el && el.kind === 'grant' && el.opts.grants === AGENT && !('serves' in el.opts) ? true : false;
}, test.limit.quick);
// THE WHOLE ROW (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole row, as
// cached in spirit.required.spirit.data."): the list hands its search no matched() of its own.
test.run('it hands its search no matched function, so the whole row is matched', 0.2, function () {
  if (!l) return false;
  return typeof o.matched !== 'function' ? true : false;
}, test.limit.quick);
test.run('the filters the page hands it are its own', 0.2, function () {
  if (!l) return false;
  return o.filters === filters ? true : false;
}, test.limit.quick);
test.run('the selectors the page hands it go to the search as they are, for its 🪣 row', 0.2, function () {
  if (!l) return false;
  return o.selectors === selectors ? true : false;
}, test.limit.quick);

// BOTH FACES (box v123: "every search supports both pane and dropdown; a selector with only one is red").
test.run("it is a pane unless told otherwise; given face dropdown, a dropdown, its placeholder and its pick handed on", 0.2, async function () {
  if (!l) return false;
  const n = lists.length;
  const picked = [];
  E.search.grant.list.create({}, { grants: AGENT, face: 'dropdown', placeholder: 'which grant?', pick: function (row, key) { picked.push(key); } });
  await settle();
  const d = lists[n] && lists[n].o;
  if (d && typeof d.pick === 'function') d.pick({ job_id: 'J1' }, 'J1 fs.search');
  return o.face === 'pane' && !!d && d.face === 'dropdown' && d.placeholder === 'which grant?' && picked.length === 1 && picked[0] === 'J1 fs.search' ? true : false;
}, test.limit.quick);

// an empty list holds its first grant (goal/G41.16), its cache manager's (goal/G41.28)
// Found by cw live: a list with no rows drawn never heard its first grant. Since goal/G41.28 a table's rows are its
// family's cache manager's from the page's start: here the real data set and the auth family's manager, a list made
// for the node's grants with no row drawn, and its first grant taken by spirit.required.spirit.data.
test.run('a list made with no row drawn is a view of the branch its first grant lands in', 0.2, async function () {
  if (noList()) return false;
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  const DATA = global.window.spirit.required.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.startPage asks node.card, keeps the key and hands it to the data set.
  global.window.spirit.nodeFacts = { key: 'nOdE+key/one==' };
  DATA.homeNode('nOdE+key/one==');
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'auth', 'data.js'), 'utf8'), { filename: 'auth/data.js' });
  const A = ((global.window.spirit.required.spirit.data || {}).auth || {}).data;
  const GRANTS = { get branch() { return A.grants.branch; }, key: 'key', label: 'label', search: function () { return Promise.resolve({ items: [], more: false }); },
    revoke: function () { return Promise.resolve({}); }, watch: function (fn) { return A.grants.watch(fn); } };
  const n = lists.length;
  E.search.grant.list.create({}, { grants: GRANTS });
  await settle();
  DATA.takeJob({ id: 'spirit.auth', data: { table: 'grant', row: { key: 'K7', path: 'job.list', label: 'First' } } });
  await settle();
  const fresh = lists[n];
  const kept = A.grants.row(A.grantKey('K7', 'job.list'));
  return !!fresh && fresh.o.data === A.grants.branch && kept && kept.label === 'First' ? true : false;
}, test.limit.quick);

// refresh and destroy are the search element's
test.run('refresh and destroy reach the search element, and its list property is that element', 0.2, function () {
  if (!l) return false;
  const r0 = l.refreshes;
  made.refresh(); made.destroy();
  return l.refreshes === r0 + 1 && l.destroyed === true && made.list === l ? true : false;
}, test.limit.quick);

// NO DEPRECATED (goal/G47.4; Andy: "get rid of that deprecated filter and the field in the database if it's there as well,
// what the hell is it even for?"): nothing marks a grant deprecated, and nothing asks whether a server serves its path.
test.run('list.js names no deprecated and takes no serves, its comments left out', 0.2, function () {
  let src = '';
  try { src = fs.readFileSync(path.join(RUN, 'spirit/element/search/grant/list.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return false; }
  return (src.length > 0 && !/deprecated/i.test(src) && !/\bserves\b/.test(src)) ? true : false;
}, test.limit.quick);

// THE REVOKE COLUMN STAYS AT THE RIGHT EDGE (goal/G47.4; Andy: "can you make the revoke-button column stick to the right edge
// so the button doesn't jump out my way when i try to revoke haiku's grants?"): it is the rightmost column, of a fixed
// width, its button aligned right, so a row going away moves no other row's Revoke.
test.run('the revoke column has a fixed width and aligns its button to the right edge', 0.2, function () {
  if (!l) return false;
  const rv = (o.columns || [])[(o.columns || []).length - 1] || {};
  return rv.field === 'revoke' && /^\d+(\.\d+)?(px|em|rem|ch)$/.test(String(rv.width || '')) && rv.align === 'right' ? true : false;
}, test.limit.quick);
