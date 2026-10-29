'use strict';

// spirit/run/shell/js/branchSelector/test/listElement.js
// The tests of shell/js/branchSelector/listElement.js, and of no other module (spec: ./listElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it; the row element and
// the family selector are stand-ins that keep what they were handed. The node's auth family is the spirit
// object's, each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'shell', 'js', 'branchSelector', 'listElement.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

function node(tag) {
  const heard = {};
  const n = { tag: tag, kids: [], style: {}, hidden: false, className: '', value: '',
    appendChild: function (c) { n.kids.push(c); return c; },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    removeEventListener: function () {},
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; } };
  return n;
}
function within(root, x) { if (root === x) return true; return (root.kids || []).some(function (k) { return within(k, x); }); }

test.startTest('branchSelector/listElement.js: the branch list');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('shell/js/branchSelector/listElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const lists = [];
  const families = [];
    const auth = { branch: function (a) { asked.push(a); return Promise.resolve({ items: [{ key: '3', label: JSON.stringify({ id: 3, bundle: 7, family: 'desk', verb: '' }) }], more: false }); } };
  const STANDS = {
    'shell/js/probabilitySearch.js': function (E) { E.probabilitySearch = { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }; },
    'shell/js/branchSelector/rowElement.js': function (E) { E.branchElement = { create: function (row) { return { kind: 'branch', row: row }; } }; },
    'shell/js/apiFamilySelector.js': function (E) { E.createApiFamilySelector = function (o) { const f = node('family'); f.o = o || {}; f.family = ''; f.verb = ''; families.push(f); return f; }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({ auth: auth }), auth: auth, elements: {} } };
  global.spirit = global.window.spirit;
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.elements); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.elements;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['shell/js/probabilitySearch.js', 'shell/js/branchSelector/rowElement.js', 'shell/js/apiFamilySelector.js'].every(function (p) { return required.indexOf(p) !== -1; }),
    'it requires the search element, its row element and the family selector through spirit.require', 'required: ' + short(required));
  ok(E.branchList && typeof E.branchList.create === 'function', 'it registers spirit.elements.branchList.create', 'elements: ' + short(Object.keys(E)));
  if (!E.branchList || typeof E.branchList.create !== 'function') return;

  test.subHeading('one bundle\'s branches, searched at auth.branch');
  const host = node('host');
  const made = E.branchList.create(host, { bundle: 7, face: 'pane', columns: ['family', 'verb', 'delete'] });
  await settle();
  const l = lists[0];
  ok(!!l && within(host, l.host), 'it draws one probabilitySearch inside the host it is given', 'lists: ' + lists.length);
  if (!l) return;
  const o = l.o;
  ok(l.refreshes >= 1, 'it fills as soon as it is drawn', 'refreshes: ' + l.refreshes);
  const got = await o.api.verb(o.server + '.' + o.verb, o.args(' cha ', {}));
  ok(o.server === 'auth' && o.verb === 'branch' && asked.length === 1 && asked[0].op === 'search' && asked[0].text === 'cha' && asked[0].bundle === 7,
    'its search asks auth.branch { op: search, text, bundle } through the spirit object, the text trimmed', 'asked: ' + short(asked));
  ok(got && got.status === 200 && got.body && got.body.items.length === 1 && got.body.more === false, 'and answers as a reply: { items, more }', 'got: ' + short(got));
  ok(JSON.stringify((o.columns || []).map(function (c) { return c.field; })) === '["family","verb","delete"]', 'opts.columns names the row\'s fields it shows, in order', 'columns: ' + short(o.columns));
  const el = o.element({ id: 3, bundle: 7, family: 'desk', verb: '' }, '3');
  ok(el && el.kind === 'branch' && el.row.id === 3 && el.row.family === 'desk', 'each row is a branchElement of that branch', 'element: ' + short(el));
  const m = typeof o.matched === 'function' ? o.matched({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }) : null;
  ok(m && m.family === 'desk' && m.verb === 'chat.add' && !('id' in m) && !('bundle' in m), 'a row is matched on its family and verb, never its hidden numbers', 'matched: ' + short(m));

  test.subHeading('its filter: the family selector, its verb half with it');
  // Andy, box: "the branchSelector element will use the standard apiFamilySelector and apiVerbSelector elements as
  // pickers for family and verb search filters, if no valid family is selected, the verb selector is invisible, set to
  // \"(ALL)\"", and since: "apiFamiliySelector.js will use apiVerbSelector as part of itself". The verb half's hiding
  // is the family selector's own (its test).
  const fam = families[0];
  ok(!!fam && within(host, fam) && families.length === 1, 'it draws one family selector in its host', 'families ' + families.length);
  if (!fam) return;
  asked.length = 0;
  await o.api.verb('auth.branch', o.args('', {}));
  ok(asked[0] && !asked[0].family && !asked[0].verb, 'nothing chosen: the search narrows by neither family nor verb', 'asked: ' + short(asked));
  const r0 = l.refreshes;
  fam.family = 'desk'; fam.verb = ''; fam.value = 'desk'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  asked.length = 0;
  await o.api.verb('auth.branch', o.args('', {}));
  ok(l.refreshes > r0 && asked[0] && asked[0].family === 'desk' && !asked[0].verb, 'a family chosen searches again, narrowed by the family', 'asked: ' + short(asked));
  const r1 = l.refreshes;
  fam.verb = 'chat.add'; fam.value = 'desk.chat.add'; fam.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  asked.length = 0;
  await o.api.verb('auth.branch', o.args('', {}));
  ok(l.refreshes > r1 && asked[0] && asked[0].family === 'desk' && asked[0].verb === 'chat.add', 'a verb chosen searches again, narrowed by the family and the verb', 'asked: ' + short(asked));

  test.subHeading('refresh and destroy are the search element\'s');
  const r2 = l.refreshes;
  made.refresh(); made.destroy();
  ok(l.refreshes === r2 + 1 && l.destroyed === true && made.list === l, 'refresh and destroy reach the search element; .list is it', 'refreshes ' + (l.refreshes - r2) + ', destroyed ' + l.destroyed);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
