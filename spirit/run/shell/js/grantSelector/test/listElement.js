'use strict';

// spirit/run/shell/js/grantSelector/test/listElement.js
// The tests of shell/js/grantSelector/listElement.js, and of no other module (spec: ./listElement.md; goal/G41.14,
// goal/G41.16). The browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires
// it. Then the search element is a recorder in its place, so this tests the list and not the search under it, and the
// row element a stand-in that keeps what it was handed. The grants table is the caller's, handed in as a configuration
// (goal/G41.16), each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'grantSelector', 'listElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

test.startTest('grantSelector/listElement.js: the grant list, of whichever grants table it is handed');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/grantSelector/listElement.js is not there'); return; }
  const SRC = fs.readFileSync(FILE, 'utf8').replace(/\/\/.*$/gm, '');
  const required = [];
  const lists = [];
  const rows = [];
  const STANDS = {
    'shell/js/probabilitySearch.js': function (E) { E.probabilitySearch = { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }; },
    'shell/js/grantSelector/rowElement.js': function (E) { E.grantElement = { create: function (row, opts) { const r = { kind: 'grant', row: row, opts: opts || {} }; rows.push(r); return r; } }; },
  };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({}), elements: {} } };
  global.spirit = global.window.spirit;
  global.document = { createElement: function () { return {}; } };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26), and knows no grants table');
  ok(['shell/js/probabilitySearch.js', 'shell/js/grantSelector/rowElement.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }),
    'it requires the search element and its row element, and no data script', 'required: ' + short(required));
  ok(!/auth\.|agent\.grant|job_id|'grants'|"grants"/.test(SRC), 'it names no table and no branch of its own: no auth verb, no agent grant, no data.grants (goal/G41.16)', 'listElement.js names a table or branch of its own');
  ok(E.grantList && typeof E.grantList.create === 'function', 'it registers spirit.elements.grantList.create', 'elements: ' + short(Object.keys(E)));
  if (!E.grantList || typeof E.grantList.create !== 'function') return;
  let refused = null;
  try { E.grantList.create({}, {}); } catch (e) { refused = e && e.message; }
  ok(refused !== null && lists.length === 0, 'made with no grants table, it is refused, and draws nothing', 'made with none: ' + short(refused) + ', lists ' + lists.length);

  test.subHeading('a pane of the table it is handed, a view of that table\'s branch');
  const searched = [];
  const AGENT = { branch: 'agent.grant', key: 'job_id', label: 'job',
    search: function (text) { searched.push(text); return Promise.resolve({ items: [{ key: 'J1\nfs.search', label: JSON.stringify({ job_id: 'J1', path: 'fs.search', job: 'Night' }) }], more: false }); },
    revoke: function () { return Promise.resolve({}); }, stream: function () { return null; } };
  const host = {};
  const filters = [{ name: 'id', test: function () { return 1; } }];
  const serves = function () { return true; };
  const made = E.grantList.create(host, { grants: AGENT, filters: filters, serves: serves });
  await settle();
  const l = lists[0];
  ok(!!l && l.host === host && l.refreshes === 1, 'it draws one probabilitySearch into its host, and fills it as soon as it is drawn', 'lists: ' + lists.length + ', refreshes ' + (l && l.refreshes));
  if (!l) return;
  const o = l.o;
  ok(o.data === 'agent.grant', 'it is a view of the branch its table names: here data.agent.grant', 'data: ' + short(o.data));
  const got = await o.api.verb(String(o.server || '') + '.' + String(o.verb || ''), o.args(' ni ', {}));
  ok(searched.length === 1 && searched[0] === 'ni' && got && got.status === 200 && got.body && got.body.items.length === 1, 'its search is the table\'s search(text), the text trimmed, answered as a reply', 'searched ' + short(searched) + ', got ' + short(got));
  const cols = (o.columns || []).map(function (c) { return c.field; });
  ok(JSON.stringify(cols) === '["name","path","revoke"]', 'its columns are whose, the path and Revoke, Revoke the rightmost', 'columns: ' + short(cols));
  const el = o.element({ job_id: 'J1', path: 'fs.search', job: 'Night' }, 'J1\nfs.search');
  ok(el && el.kind === 'grant' && el.opts.grants === AGENT && el.opts.serves === serves, 'each row is a grantElement, handed the same table and what the tree serves', 'element: ' + short(el && { kind: el.kind, same: el.opts.grants === AGENT }));
  const m = typeof o.matched === 'function' ? o.matched({ job_id: 'J1', path: 'fs.search', job: 'Night' }) : null;
  ok(m && m.name === 'Night' && /fs search/.test(m.path || '') && !('job_id' in m) && !('key' in m), 'a row is matched on its table\'s label field and the words of its path, never the id', 'matched: ' + short(m));
  ok(o.filters === filters, 'the filters the page hands it are its own', 'filters: ' + short(o.filters));

  test.subHeading('refresh and destroy are the search element\'s');
  const r0 = l.refreshes;
  made.refresh(); made.destroy();
  ok(l.refreshes === r0 + 1 && l.destroyed === true && made.list === l, 'refresh and destroy reach the search element; .list is it', 'refreshes ' + (l.refreshes - r0) + ', destroyed ' + l.destroyed);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
