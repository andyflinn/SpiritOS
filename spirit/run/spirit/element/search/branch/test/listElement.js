'use strict';

// spirit/run/spirit/element/search/branch/test/listElement.js
// The tests of spirit/element/search/branch/listElement.js, and of no other module (spec: ./listElement.md; goal/G41.14). The
// browser file runs in node on a BARE window (rule/26): nothing is on the page until the list requires it. Then the
// search element is a recorder in its place, so this tests the list and not the search under it; the row element and
// the family selector are stand-ins that keep what they were handed. The node's auth family is the spirit
// object's, each search recorded.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(RUN, 'spirit', 'element', 'search', 'branch', 'listElement.js');

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
  let html = '';
  Object.defineProperty(n, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); n.kids.length = 0; } });
  return n;
}
function within(root, x) { if (root === x) return true; return (root.kids || []).some(function (k) { return within(k, x); }); }

test.startTest('branchSelector/listElement.js: the branch list');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  if (!fs.existsSync(FILE)) { test.fail('spirit/element/search/branch/listElement.js is not there'); return; }
  const asked = [];
  const required = [];
  const lists = [];
  const families = [];
    const auth = { branch: function (a) { asked.push(a); return Promise.resolve({ items: [{ key: '3', label: JSON.stringify({ id: 3, bundle: 7, family: 'desk', verb: '' }) }], more: false }); } };
  const STANDS = {
    'spirit/element/search.js': function (E) { E.search = Object.assign(E.search || {}, { create: function (host, o) {
      const l = { host: host, o: o, refreshes: 0, destroyed: false, refresh: function () { l.refreshes += 1; }, redraw: function () {}, destroy: function () { l.destroyed = true; } };
      lists.push(l); return l;
    } }); },
    // The real row element loads the auth family's cache manager as it runs (goal/G41.28); its stand-in does the same.
    'spirit/element/search/branch/rowElement.js': function (E) { global.window.spirit.cacheManager('auth'); ((E.search = E.search || {}).branch = E.search.branch || {}).rowElement = { create: function (row) { return { kind: 'branch', row: row }; } }; },
    // The shell's element shape (goal/G41.19): create(container, options) appends the control and answers it.
    'spirit/element/search/api.js': function (E) { (E.search = E.search || {}).api = { create: function (c, o) { const f = node('family'); f.o = o || {}; f.container = c; f.family = ''; f.verb = ''; families.push(f); c.appendChild(f); return f; } }; },
  };
  global.Event = function (type, o) { this.type = type; this.bubbles = !!(o && o.bubbles); };
  global.document = { createElement: function (t) { return node(t); } };
  global.window = { spirit: { escapeHtml: function (s) { return String(s); }, ready: Promise.resolve({ auth: auth }), auth: auth, element: {} } };
  global.spirit = global.window.spirit;
  // The page's one data set (spirit/data.js), which spirit.js brings with the client.
  vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), { filename: 'data.js' });
  const DATA = global.window.spirit.data;
  // THE PAGE KNOWS ITS NODE (goal/G41.28): spirit.start asks node.card, keeps the key and hands it to the data set.
  const NODE_KEY = 'nOdE+key/one==';
  global.window.spirit.node = { key: NODE_KEY };
  DATA.homeNode(NODE_KEY);
  // spirit.cacheManager(name), as a page's: the family's manager loaded once, attaching itself to the data set.
  const managers = [];
  global.window.spirit.cacheManager = function (name) {
    managers.push(String(name));
    vm.runInThisContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), { filename: name + '/data.js' });
    return Promise.resolve(true);
  };
  global.window.spirit.require = function (p) { required.push(String(p)); if (STANDS[p] && !STANDS[p].done) { STANDS[p].done = true; STANDS[p](global.window.spirit.element); } return Promise.resolve(true); };
  vm.runInThisContext(fs.readFileSync(FILE, 'utf8'), { filename: FILE });
  await settle();
  const E = global.window.spirit.element;

  test.subHeading('it loads what it uses itself (rule/26)');
  ok(['spirit/element/search.js', 'spirit/element/search/branch/rowElement.js', 'spirit/element/search/api.js'].every(function (p) { return required.indexOf(p) !== -1; }) && !required.some(function (p) { return /data\.js$/.test(p); }),
    'it requires the search element, its row element and the family selector through spirit.require, and no data script (Andy: "NO FUCKING DATA SCRIPT")', 'required: ' + short(required));
  ok(E.search.branch.listElement && typeof E.search.branch.listElement.create === 'function', 'it registers spirit.element.search.branch.listElement.create', 'elements: ' + short(Object.keys(E)));
  if (!E.search.branch.listElement || typeof E.search.branch.listElement.create !== 'function') return;

  test.subHeading('one bundle\'s branches, searched at auth.branch');
  const host = node('host');
  const made = E.search.branch.listElement.create(host, { bundle: 7, face: 'pane', columns: ['family', 'verb', 'delete'] });
  await settle();
  const l = lists[0];
  ok(!!l && within(host, l.host), 'it draws one probabilitySearch inside the host it is given', 'lists: ' + lists.length);
  if (!l) return;
  const o = l.o;
  ok(l.refreshes >= 1, 'it fills as soon as it is drawn', 'refreshes: ' + l.refreshes);
  // goal/G41.14: a view of the node's branches, kept current by the node's stream, so every branch list on a page agrees;
  // goal/G41.28: the branch the auth family's cache manager keeps.
  const B = ((global.window.spirit.data || {}).auth || {}).data && global.window.spirit.data.auth.data.branches;
  ok(!!B && typeof B.branch === 'string' && B.branch !== '' && o.data === B.branch, 'it is a view of the auth family\'s branches (spirit.data.auth.data.branches.branch), the spirit object\'s cache', 'data: ' + short(o.data) + ', authReads.branches.branch ' + short(B && B.branch));

  const got = await o.api.verb(o.server + '.' + o.verb, o.args(' cha ', {}));
  ok(o.server === 'auth' && o.verb === 'branch' && asked.length === 1 && asked[0].op === 'search' && asked[0].text === 'cha' && asked[0].bundle === 7,
    'its search asks auth.branch { op: search, text, bundle } through the spirit object, the text trimmed', 'asked: ' + short(asked));
  ok(got && got.status === 200 && got.body && got.body.items.length === 1 && got.body.more === false, 'and answers as a reply: { items, more }', 'got: ' + short(got));
  ok(JSON.stringify((o.columns || []).map(function (c) { return c.field; })) === '["family","verb","delete"]', 'opts.columns names the row\'s fields it shows, in order', 'columns: ' + short(o.columns));
  const el = o.element({ id: 3, bundle: 7, family: 'desk', verb: '' }, '3');
  ok(el && el.kind === 'branch' && el.row.id === 3 && el.row.family === 'desk', 'each row is a branchElement of that branch', 'element: ' + short(el));
  // THE WHOLE ROW (goal/G41.28; Andy, box v15: "All client side searches will be fixed, too, and search the whole row, as
  // cached in spirit.data."): the list hands its search no matched() of its own.
  ok(typeof o.matched !== 'function', 'it hands its search no matched(): the whole row is matched (goal/G41.28)', 'it still hands matched(): ' + short(o.matched));
  // goal/G41.14: a picked branch is shown by what it reaches, never its number (Andy: "the bundleSelector shows a
  // fucking number is selected instead of the fucking label").
  const nm = typeof o.name === 'function' ? [o.name({ id: 3, bundle: 7, family: 'desk', verb: 'chat.add' }, '3'), o.name({ id: 4, bundle: 7, family: 'files', verb: '' }, '4')] : null;
  ok(nm && nm[0] === 'desk.chat.add' && nm[1] === 'files (ALL)', 'a picked branch is shown as family.verb, or family (ALL), never its number', 'name: ' + short(nm));

  test.subHeading('its filter: the family selector, its verb half with it');
  // Andy, box: "the branchSelector element will use the standard apiFamilySelector and apiVerbSelector elements as
  // pickers for family and verb search filters, if no valid family is selected, the verb selector is invisible, set to
  // \"(ALL)\"", and since: "apiFamiliySelector.js will use apiVerbSelector as part of itself". The verb half's hiding
  // is the family selector's own (its test).
  const fam = families[0];
  // goal/G41.26, Andy: "any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the
  // user-can see, which elements belong to the search." The shape (cw, under his go): the branch list's family selector
  // moves into the 🪣 row, handed to the search; no filter row of its own above the list.
  const sel = Array.isArray(l.o.selectors) ? l.o.selectors : [];
  ok(!!fam && families.length === 1 && sel.length === 1 && sel[0].element === fam && !!sel[0].name && typeof sel[0].test === 'function',
    'it makes one family selector and hands it to the search, for its 🪣 row', 'families ' + families.length + ', selectors ' + short(sel.map(function (x) { return { name: x.name, fam: x.element === fam }; })));
  ok(!host.kids.some(function (k) { return k !== l.host && !within(k, l.host) && (k === fam.container || within(k, fam)); }), 'no filter row of its own above the list', 'host holds: ' + short(host.kids.map(function (k) { return k.className || k.tag; })));
  ok(!!fam && sel[0] && (fam.family = 'desk', fam.verb = '', sel[0].test({ family: 'files', verb: '' }) === 0 && sel[0].test({ family: 'desk', verb: 'chat.add' }) === 1) && (fam.family = '', sel[0].test({ family: 'files' }) === 1),
    'its test narrows by the family and verb chosen, every row when none is', 'test: ' + short(sel[0] && 'given'));
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
  // goal/G41.19, box v23: "destroy empties it".
  ok(host.kids.length === 0, 'and destroy leaves its host empty, the filters with it', 'kids left: ' + host.kids.length);
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
