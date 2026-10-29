'use strict';

// spirit/run/shell/js/grantSelector/test/listElement.js
// The tests of shell/js/grantSelector/listElement.js, and of no other module (spec: ./listElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it, and the row element a
// stand-in that keeps what it was handed. The node's auth family is the spirit object's, each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'grantSelector', 'listElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

test.startTest('grantSelector/listElement.js: the grant list');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/grantSelector/listElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const lists = [];
  let answer = { ok: true, items: [{ key: 'K1\nfs.search', label: JSON.stringify({ name: 'Bob', key: 'K1', path: 'fs.search' }) }], more: false };
  const auth = { search: function (a) { asked.push(a); return Promise.resolve(answer); } };
  const STANDS = {
    'shell/js/probabilitySearch.js': function (E) { E.probabilitySearch = { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }; },
    'shell/js/grantSelector/rowElement.js': function (E) { E.grantElement = { create: function (row) { return { kind: 'grant', row: row }; } }; },
  };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  global.document = { createElement: function () { return {}; } };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/probabilitySearch.js', 'shell/js/grantSelector/rowElement.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }),
    'it requires the search element and its row element through spirit.require, and no data script', 'required: ' + short(required));
  ok(E.grantList && typeof E.grantList.create === 'function', 'it registers spirit.elements.grantList.create', 'elements: ' + short(Object.keys(E)));
  if (!E.grantList || typeof E.grantList.create !== 'function') return;

  test.subHeading('a pane of the node\'s grants, a view of data.grants');
  const host = {};
  const filters = [{ name: 'id', test: function () { return 1; } }];
  const made = E.grantList.create(host, { filters: filters });
  await settle();
  const l = lists[0];
  ok(!!l && l.host === host, 'it draws one probabilitySearch into the host it is given', 'lists: ' + lists.length);
  if (!l) return;
  const o = l.o;
  ok(l.refreshes === 1, 'it fills as soon as it is drawn', 'refreshes: ' + l.refreshes);
  // Andy, goal/G41.14: "WHY DOES A GRANT NOT JUST SIMPLY UPDATE AN EXISTING FUCKING ROW?": the list is a view of
  // data.grants, which the grant row element keeps from the node's stream, so one grant appears or goes.
  ok(o.data === 'grants', 'it is a view of data.grants', 'data: ' + short(o.data));
  const got = await o.api.verb(o.server + '.' + o.verb, o.args(' bo ', {}));
  ok(o.server === 'auth' && o.verb === 'search' && asked.length === 1 && asked[0].text === 'bo', 'its search asks auth.search { text } through the spirit object, the text trimmed', 'asked: ' + short(asked) + ', at ' + o.server + '.' + o.verb);
  ok(got && got.status === 200 && got.body && got.body.items.length === 1, 'and answers as a reply: { items, more }', 'got: ' + short(got));
  const cols = (o.columns || []).map(function (c) { return c.field; });
  ok(JSON.stringify(cols) === '["name","path","revoke"]', 'its columns are whose, the path and Revoke, Revoke the rightmost', 'columns: ' + short(cols));
  const el = o.element({ key: 'K1', path: 'fs.search', label: 'Bob' }, 'K1\nfs.search');
  ok(el && el.kind === 'grant' && el.row.key === 'K1' && el.row.path === 'fs.search', 'each row is a grantElement of that grant', 'element: ' + short(el));
  const m = typeof o.matched === 'function' ? o.matched({ key: 'K1', path: 'fs.search', label: 'Bob' }) : null;
  ok(m && m.name === 'Bob' && /fs search/.test(m.path || '') && !('key' in m), 'a row is matched on whose grant it is and the words of its path, never the key', 'matched: ' + short(m));
  ok(o.filters === filters, 'the filters the page hands it are its own (the grants app\'s ID and family filters)', 'filters: ' + short(o.filters));

  test.subHeading('refresh and destroy are the search element\'s');
  const r0 = l.refreshes;
  made.refresh(); made.destroy();
  ok(l.refreshes === r0 + 1 && l.destroyed === true && made.list === l, 'refresh and destroy reach the search element; .list is it', 'refreshes ' + (l.refreshes - r0) + ', destroyed ' + l.destroyed);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
