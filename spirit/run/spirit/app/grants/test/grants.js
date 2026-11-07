'use strict';

// spirit/run/shell/grants/test/grants.js
// The tests of shell/grants/grants.js, and of no other module (spec: ./grants.md; goal/G41.5, goal/G41.13, goal/G41.14,
// goal/G41.16). Since G41.16 the app is a wrapper: its Grants tab is the grants panel (spirit/element/grantsPanel.js, tested in
// its own file), configured by this app for contacts and the node's grants. The browser file runs in node on a BARE
// window (rule/26): each element is put on the page only once the app requires it, a stand-in that keeps what the app
// handed it. The node is a stub that answers and keeps every ask.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'grants.js');
const SRC = fs.readFileSync(FILE, 'utf8');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
const tick = function () { return new Promise(function (r) { setImmediate(r); }); };
const settle = async function () { for (let i = 0; i < 20; i++) await tick(); };

// A node whose markup makes a child per tag; found by #id or [attr="value"], anywhere below it.
const byId = {};
function node(tag) {
  const heard = {}; let html = '';
  const n = { tag: tag || '', nodes: [], value: '', className: '', textContent: '', hidden: false, style: {}, kids: [],
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = String(v); n.nodes = [];
      const re = /<([a-z]+)\b([^>]*)>/gi; let m;
      while ((m = re.exec(html))) {
        const c = node(m[0]);
        c.className = (/class="([^"]*)"/.exec(m[2]) || [])[1] || '';
        const id = /\sid="([^"]*)"/.exec(m[2]); if (id) byId[id[1]] = c;
        n.nodes.push(c);
      }
    },
    getAttribute: function (k) { const m = new RegExp('\\s' + k + '="([^"]*)"').exec(n.tag); return m ? m[1] : null; },
    querySelector: function (sel) { return n.querySelectorAll(sel)[0] || null; },
    querySelectorAll: function (sel) {
      const all = n.nodes.concat(n.kids);
      const id = /^#([\w-]+)$/.exec(sel);
      if (id) return all.filter(function (c) { return c.getAttribute('id') === id[1]; });
      const a = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
      if (a) return all.filter(function (c) { return c.getAttribute(a[1]) === a[2]; });
      return [];
    },
    addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
    dispatchEvent: function (e) { (heard[e.type] || []).slice().forEach(function (fn) { fn(e); }); return true; },
    fire: function (t, e) { (heard[t] || []).slice().forEach(function (fn) { fn(e); }); },
    appendChild: function (c) { n.kids.push(c); return c; },
    contains: function () { return true; },
    isConnected: true,
  };
  return n;
}

function world() {
  const w = { required: [], calls: [], def: null, tabs: [], editors: [], panels: [] };
  const E = {
    tabContainer: { create: function (host, opts) { const t = { host: host, opts: opts || {} }; w.tabs.push(t); return t; } },
    bundleEditor: { create: function (host, opts) { const e = { host: host, opts: opts || {} }; w.editors.push(e); return e; } },
    grantsPanel: { create: function (host, cfg) { const p = { host: host, cfg: cfg || {} }; w.panels.push(p); return p; } },
  };
  const api = {
    escapeHtml: function (s) { return String(s); },
    verb: function (name, args) { w.calls.push({ name: name, args: args });
      // auth.search answers whose grant it is as name (apiAuth.js search), the stream as label.
      if (name === 'auth.search') return Promise.resolve({ status: 200, body: { ok: true, items: [{ key: 'K1\nfs.search', label: JSON.stringify({ name: 'Bob', key: 'K1', path: 'fs.search' }) }], more: false } });
      if (name === 'auth.grant' && args && args.path === 'fs.search') return Promise.resolve({ status: 409, body: { ok: false, code: 'already-granted', error: 'already granted' } });
      return Promise.resolve({ status: 200, body: { ok: true } }); },
    ui: { elements: {} },
  };
  const FILES = { 'spirit/element/tabContainer.js': ['tabContainer'], 'spirit/element/bundleEditor.js': ['bundleEditor'], 'spirit/element/grantsPanel.js': ['grantsPanel'] };
  const page = {};
  const win = {
    spirit: { get element() { return this.elements; }, elements: page,
      require: function (p) { w.required.push(String(p)); (FILES[p] || []).forEach(function (k) { page[k] = E[k]; }); return Promise.resolve(true); },
      // A family's cache (goal/G41.28): the family's own manager, run on this window over the real data set.
      cacheManager: function (name) {
        w.managers = (w.managers || []).concat(String(name));
        vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', String(name), 'data.js'), 'utf8'), win, { filename: name + '/data.js' });
        return Promise.resolve(true);
      },
      shell: { activateApp: function (d) { w.def = d; } }, escapeHtml: api.escapeHtml },
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  // The page's one data set, its node known (goal/G41.28, Q10), as spirit.start leaves it before any app runs.
  vm.runInContext(fs.readFileSync(path.join(RUN, 'spirit', 'data.js'), 'utf8'), win, { filename: 'data.js' });
  win.spirit.node = { key: 'KEY+GRANTS/APP==' };
  win.spirit.data.homeNode(win.spirit.node.key);
  vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.api = api;
  return w;
}

test.startTest('grants.js: the Grants app, a wrapper of the grants panel');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  const code = SRC.replace(/\/\/.*$/gm, '');
  test.subHeading('nothing of the old shell is left in it');
  ok(!/shellCreateListSearch|api\.ui\.elements|apiBranchSelector/.test(code), 'grants.js names no shellCreateListSearch, no api.ui.elements, no apiBranchSelector', 'grants.js still names one');

  const w = world();
  ok(w.def && typeof w.def.mount === 'function', 'it mounts through spirit.shell.activateApp', 'no activateApp with mount');
  if (!w.def) return;

  test.subHeading('a wrapper: it loads the panel, the tabs and the bundle editor, and nothing it draws itself');
  ['spirit/element/grantsPanel.js', 'spirit/element/tabContainer.js', 'spirit/element/bundleEditor.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });
  // goal/G41.16: "the shell app shell/grans/grants/ must be a wrapper for a new shell element: shell/js/grantsPanel.js".
  // The selectors by either shape: createContactSelector, or contactSelector.create (goal/G41.19).
  ok(!/innerHTML|createElement|probabilitySearch|grantList|[cC]ontactSelector|[bB]undleSelector|[aA]piFamilySelector/.test(code) && !w.required.some(function (p) { return /data\.js$/.test(p); }),
    'it draws nothing itself: no markup, no list, no selector of its own, no data script', 'grants.js still draws or builds something of its own');

  const app = node('container');
  await w.def.mount(app, w.api); await settle();

  test.subHeading('two tabs: Grants, the grants panel; Bundles, the bundle editor');
  const tabs = w.tabs[0];
  const names = tabs ? (tabs.opts.tabs || []).map(function (t) { return t && t.name; }) : [];
  ok(w.tabs.length === 1 && JSON.stringify(names) === '["grants","bundles"]', 'one tabContainer with the tabs grants and bundles', 'tabs: ' + short(names));
  if (!tabs || names.length !== 2) return;
  const gbox = node('grants-tab');
  await tabs.opts.tabs[0].mount(gbox); await settle();
  const bbox = node('bundles-tab');
  await tabs.opts.tabs[1].mount(bbox); await settle();
  ok(w.editors.length === 1 && w.editors[0].host === bbox && w.editors[0].opts.api === w.api, 'the Bundles tab is the bundle editor, with the app\'s api', 'editors: ' + w.editors.length);
  const p = w.panels[0];
  ok(w.panels.length === 1 && p.host === gbox && p.cfg.api === w.api, 'the Grants tab is the grants panel, in its own box, with the app\'s api', 'panels: ' + w.panels.length);
  if (!p) return;

  test.subHeading('the app configures it: contacts, and the node\'s grants');
  // Andy: "the callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel element".
  const ids = p.cfg.ids || {};
  ok(ids.table === 'loopback://api/contact/search', 'its ID table is the contacts\', loopback://api/contact/search', 'ids: ' + short(ids));
  const g = p.cfg.grants || {};
  const A = ((w.win.spirit.data || {}).auth || {}).data;
  ok((w.managers || []).indexOf('auth') !== -1 && !!A && g.branch === A.grants.branch && g.key === 'key' && g.label === 'label',
    'its grants table is the node\'s, the auth family\'s cache (spirit.data.auth.data.grants.branch), keyed key, labelled label', 'managers ' + short(w.managers) + ', grants: ' + short({ branch: g.branch, key: g.key, label: g.label }));
  ok(['search', 'grant', 'revoke', 'watch'].every(function (f) { return typeof g[f] === 'function'; }) && !('stream' in g), 'with search, grant, revoke and watch, and no stream of its own', 'grants: ' + short(Object.keys(g)));
  if (!A || !['search', 'grant', 'revoke', 'watch'].every(function (f) { return typeof g[f] === 'function'; })) return;
  let at = w.calls.length;
  const found = await g.search('bo');
  const s = w.calls.slice(at)[0];
  ok(s && s.name === 'auth.search' && s.args.text === 'bo' && found && Array.isArray(found.items), 'search(text) asks auth.search { text } and answers its { items, more }', 'asked ' + short(s) + ', found ' + short(found));
  // Found by cw live (goal/G41.16): the whose column of the node's grants was empty, auth.search saying it as name and the
  // panel reading its table's label field. A found grant carries whose it is in that field.
  let hit = null; try { hit = JSON.parse(found.items[0].label); } catch (e) { hit = null; }
  ok(hit && hit[g.label] === 'Bob' && hit.key === 'K1' && hit.path === 'fs.search', 'a found grant carries whose it is in the table\'s label field, label', 'found row: ' + short(hit));
  at = w.calls.length;
  const made = await g.grant('K3', 'jobs.list');
  const gr = w.calls.slice(at)[0];
  ok(gr && gr.name === 'auth.grant' && gr.args.key === 'K3' && gr.args.path === 'jobs.list' && made && made.ok !== false, 'grant(id, path) asks auth.grant { key, path } and answers ok', 'asked ' + short(gr) + ', answered ' + short(made));
  const already = await g.grant('K3', 'fs.search');
  ok(already && already.ok === false && already.code === 'already-granted', 'a refusal answers { ok: false, code, error }, in the node\'s words', 'answered ' + short(already));
  at = w.calls.length;
  await g.revoke('K3', 'jobs.list');
  const rv = w.calls.slice(at)[0];
  ok(rv && rv.name === 'auth.revoke' && rv.args.key === 'K3' && rv.args.path === 'jobs.list', 'revoke(id, path) asks auth.revoke { key, path }', 'asked ' + short(rv));
  // WHO ASKS FOR A CHANGE LISTENS FOR IT (goal/G41.27, G41.28): a grant the node's auth job hands comes back through watch.
  const heard = [];
  const off = g.watch(function (k, row) { heard.push({ k: k, row: row }); });
  const D = w.win.spirit.data;
  D.takeJob({ id: 'job-bundles', type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list', label: 'Zed' } } });
  D.takeJob({ id: 'job-bundles', type: 'bundles', data: { table: 'grant', row: { key: 'K9', path: 'jobs.list' }, gone: true } });
  ok(heard.length === 2 && heard[0].k === 'K9\njobs.list' && heard[0].row && heard[0].row.label === 'Zed' && heard[1].k === 'K9\njobs.list' && !heard[1].row,
    'watch(fn): a grant kept is heard as <key>\\n<path> with its row, and once revoked with none', 'heard: ' + short(heard));
  if (typeof off === 'function') off();
  D.takeJob({ id: 'job-bundles', type: 'bundles', data: { table: 'grant', row: { key: 'K8', path: 'jobs.list', label: 'Yan' } } });
  ok(heard.length === 2, 'its release ends the watch', 'heard after release: ' + short(heard.slice(2)));

  // GOAL/G41.32, IN A REAL BROWSER ON A SCRATCH NODE. THE BOX: "the bundleSelector:pane looses both the 'Edit' button and the
  // 'Delete' Button. when some clicks on a (selects) a bundle row, a new closable tab opens in the tabContainer configured in
  // the bundleSelector:pane"; "if a bundle already has an branchEditor-tab in the configured tabContainer, that tab will
  // become the active tab"; "in the Grants app, this will be the grant app's tabContainer."; "i need the branchEditor to have
  // a rowForm at the bottom: [❌] "Delete <bundle-name> bundle and branches " [Delete (armingButton)]."; "a bundle that hears
  // its deletion, closes its branchEditor tab."; "A user can only create, change and delete node-owned bundles and branches,
  // and sees the others read-only". What a person sees is judged: a press is a real click on what is drawn.
  await (async function () {
  const H = require(path.join(RUN, 'test', 'headLessChrome.js'));
  const node = await H.scratchNode();
  let chrome = null;
  try {
    if (!node.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const where = H.findChrome();
    if (!where) { test.fail('no Chrome here: nothing judged'); return; }
    chrome = await H.chromePage(where);
    if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
    const home = async function (verb, args) {
      const r = await fetch(node.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text(); let body = null; try { body = JSON.parse(text); } catch (e) { body = null; }
      return { status: r.status, text: text, body: body };
    };
    // A real click on the innermost visible thing whose words are these, inside an optional selector.
    const LEAF = 'function leaf(words, within) { var all = Array.prototype.slice.call((within ? document.querySelector(within) || document : document).querySelectorAll("*")); return all.filter(function (e) { return e.offsetParent !== null && e.textContent.trim() === words && !Array.prototype.some.call(e.children, function (c) { return c.textContent.trim() === words; }); })[0] || null; }';
    const click = function (words, within) { return chrome.evaluate('(function () { ' + LEAF + ' var e = leaf(' + JSON.stringify(words) + ', ' + JSON.stringify(within || '') + '); if (!e) return false; e.click(); return true; }())'); };
    const shown = function (words) { return chrome.evaluate('(function () { ' + LEAF + ' return !!leaf(' + JSON.stringify(words) + ', ""); }())'); };
    const pageText = function () { return chrome.evaluate('document.body.innerText').then(String); };
    const tabs = function () { return chrome.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll(".tab-button")).filter(function (b) { return b.offsetParent !== null; }).map(function (b) { return { text: b.textContent.trim(), on: b.getAttribute("aria-selected") === "true" }; }))').then(function (t) { return JSON.parse(t || '[]'); }); };
    const tabNamed = async function (label) { return (await tabs()).filter(function (t) { return t.text.indexOf(label) !== -1; }); };
    const waitFor = function (fn, ms) { return H.until(fn, ms || 5000); };

    const one = await home('auth.bundle', { op: 'add', label: 'zzOne' });
    const two = await home('auth.bundle', { op: 'add', label: 'zzTwo' });
    const three = await home('auth.bundle', { op: 'add', label: 'zzThree' });
    ok(one.status === 200 && two.status === 200 && three.status === 200, 'three bundles of the node\'s stand', 'nothing judged: ' + short(one.text));
    await home('auth.branch', { op: 'add', bundle: one.body.id, family: 'node', verb: 'card' });
    const all = await home('auth.bundle', { op: 'search', text: '' });
    const rows = ((all.body && all.body.items) || []).map(function (i) { try { return JSON.parse(i.label); } catch (e) { return {}; } });
    const serverBundle = rows.filter(function (r) { return r.owner && r.owner !== 'node'; })[0];
    ok(!!serverBundle, 'and a server\'s bundle: ' + (serverBundle && serverBundle.label), 'no bundle of a server on the scratch node: read-only judges nothing');

    await chrome.send('Page.navigate', { url: node.base + '/' });
    await waitFor(function () { return shown('Grants'); }, 20000);
    ok(await click('Grants'), 'the Grants app\'s tile is pressed', 'no Grants tile: nothing judged');
    await waitFor(function () { return tabNamed('Bundles').then(function (t) { return t.length > 0; }); }, 10000);
    ok(await click('Bundles', '.tab-button') || await click('Bundles'), 'its Bundles tab is pressed', 'no Bundles tab: nothing judged');
    await waitFor(function () { return shown('zzOne'); }, 8000);

    test.subHeading('goal/G41.32: the pane has no Edit and no Delete');
    ok(await shown('zzOne'), 'the pane lists the bundles', 'zzOne is not listed: ' + short(await pageText()));
    ok(!(await shown('Edit')), 'no Edit button', 'an Edit button is still there');
    ok(!(await shown('Delete')), 'no Delete button', 'a Delete button is still there');

    test.subHeading('goal/G41.32: a row pressed opens its tab, in the app\'s own tab row');
    const before = (await tabs()).length;
    ok(before === 2, 'the app has its two tabs', 'tabs: ' + short(await tabs()));
    ok(await click('zzOne'), 'zzOne is pressed', 'no row to press');
    await waitFor(function () { return tabNamed('zzOne').then(function (t) { return t.length > 0; }); });
    const tOne = await tabNamed('zzOne');
    ok(tOne.length === 1 && tOne[0].on, 'a tab for it opens, and is active', 'tabs: ' + short(await tabs()));
    // Andy, on what he saw: "the tabs should name owner-bundle".
    ok(tOne.length === 1 && tOne[0].text.indexOf('node-zzOne') !== -1, 'the tab names owner-bundle: node-zzOne', 'tabs: ' + short(await tabs()));
    const place = await chrome.evaluate('(function () { var c = document.querySelector("[data-tab-close]"); if (!c) return null; var b = c.closest(".tab-button") || c.parentElement; var r = c.getBoundingClientRect(), o = b.getBoundingClientRect(); return { right: r.right <= o.right + 1 && r.left > o.left + (o.width / 3), small: r.width <= o.width / 2 }; }())');
    ok(!!place && place.right && place.small, 'its close button is small, on the tab\'s right side', 'close button: ' + short(place));

    test.subHeading('goal/G41.32: the branchEditor\'s Delete row');
    const WORDS = 'Delete zzOne bundle and branches';
    await waitFor(function () { return pageText().then(function (t) { return t.indexOf(WORDS) !== -1; }); });
    const paneText = await pageText();
    ok(paneText.indexOf(WORDS) !== -1, 'it says "' + WORDS + '"', 'not said: ' + short(paneText.slice(-300)));
    const atBottom = await chrome.evaluate('(function () { var forms = Array.prototype.slice.call(document.querySelectorAll(".shell-row-form")).filter(function (f) { return f.offsetParent !== null; }); var last = forms[forms.length - 1]; if (!last) return null; return { icon: last.textContent.indexOf("❌") !== -1, words: last.textContent.indexOf(' + JSON.stringify(WORDS) + ') !== -1, button: !!last.querySelector("button"), below: forms.length > 1 && forms[0].getBoundingClientRect().top < last.getBoundingClientRect().top }; }())');
    ok(!!atBottom && atBottom.icon && atBottom.words && atBottom.button && atBottom.below, 'in a rowForm below the others, ❌, the words, a button', 'the row: ' + short(atBottom));

    test.subHeading('goal/G41.32: a bundle already open: its tab is made active');
    ok(await click('Bundles', '.tab-button') || await click('Bundles'), 'back to the Bundles tab', 'no way back to the Bundles tab');
    await waitFor(function () { return shown('zzTwo'); });
    await click('zzOne', '.bundle-selector-face-pane');
    await H.sleep(800);
    const again = await tabNamed('zzOne');
    ok(again.length === 1 && again[0].on, 'zzOne pressed again: no second tab, its tab is active', 'tabs: ' + short(await tabs()));

    test.subHeading('goal/G41.32: the close button takes the tab away, the bundle stays');
    const closed = await chrome.evaluate('(function () { var c = Array.prototype.slice.call(document.querySelectorAll("[data-tab-close]"))[0]; if (!c) return false; c.click(); return true; }())');
    await waitFor(function () { return tabNamed('zzOne').then(function (t) { return t.length === 0; }); });
    ok(closed === true && (await tabNamed('zzOne')).length === 0, 'the tab is gone', 'tabs: ' + short(await tabs()));
    ok((await home('auth.bundle', { op: 'get', id: one.body.id })).status === 200, 'the bundle is there', 'closing a tab deleted the bundle');

    test.subHeading('goal/G41.32: the Delete row deletes, by the arming button, and the tab closes');
    await click('Bundles', '.tab-button');
    await waitFor(function () { return shown('zzTwo'); });
    await click('zzTwo', '.bundle-selector-face-pane');
    await waitFor(function () { return pageText().then(function (t) { return t.indexOf('Delete zzTwo bundle and branches') !== -1; }); });
    const hadTwo = (await tabNamed('zzTwo')).length === 1;
    const DELBTN = 'Array.prototype.slice.call(document.querySelectorAll(".shell-row-form")).filter(function (f) { return f.offsetParent !== null && f.textContent.indexOf("Delete zzTwo") !== -1; })[0]';
    const pressedOnce = await chrome.evaluate('(function () { var f = ' + DELBTN + '; var b = f && f.querySelector("button"); if (!b) return false; b.click(); return true; }())');
    await H.sleep(500);
    ok(pressedOnce === true && (await home('auth.bundle', { op: 'get', id: two.body.id })).status === 200, 'one press only arms: the bundle stays', 'one press: pressed ' + pressedOnce + ', the bundle answered ' + (await home('auth.bundle', { op: 'get', id: two.body.id })).status);
    await chrome.evaluate('(function () { var f = ' + DELBTN + '; var b = f && f.querySelector("button"); if (b) b.click(); }())');
    await waitFor(function () { return home('auth.bundle', { op: 'get', id: two.body.id }).then(function (a) { return a.status !== 200; }); });
    ok((await home('auth.bundle', { op: 'get', id: two.body.id })).status !== 200, 'the second press deletes it', 'the bundle is still there after two presses');
    await waitFor(function () { return tabNamed('zzTwo').then(function (t) { return t.length === 0; }); });
    ok(hadTwo && (await tabNamed('zzTwo')).length === 0, 'and its tab closes', hadTwo ? 'tabs: ' + short(await tabs()) : 'zzTwo never had a tab: nothing judged');

    test.subHeading('goal/G41.32: a bundle deleted elsewhere closes its tab');
    await click('Bundles', '.tab-button');
    await waitFor(function () { return shown('zzThree'); });
    await click('zzThree', '.bundle-selector-face-pane');
    await waitFor(function () { return tabNamed('zzThree').then(function (t) { return t.length === 1; }); });
    const hadThree = (await tabNamed('zzThree')).length === 1;
    ok(hadThree, 'zzThree has its tab', 'tabs: ' + short(await tabs()));
    await home('auth.bundle', { op: 'delete', id: three.body.id });
    await waitFor(function () { return tabNamed('zzThree').then(function (t) { return t.length === 0; }); });
    ok(hadThree && (await tabNamed('zzThree')).length === 0, 'deleted at the door, its tab closes by itself', hadThree ? 'the tab stayed: ' + short(await tabs()) : 'zzThree never had a tab: nothing judged');

    test.subHeading('goal/G41.32: a server\'s bundle is read-only');
    if (serverBundle) {
      await click('Bundles', '.tab-button');
      await waitFor(function () { return shown(serverBundle.label); });
      ok(await click(serverBundle.label, '.bundle-selector-face-pane'), 'its row opens', 'no row for ' + serverBundle.label);
      await waitFor(function () { return tabNamed(serverBundle.label).then(function (t) { return t.length === 1; }); });
      ok((await tabNamed(serverBundle.owner + '-' + serverBundle.label)).length === 1, 'its tab names owner-bundle: ' + serverBundle.owner + '-' + serverBundle.label, 'tabs: ' + short(await tabs()));
      const editable = await chrome.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll(".shell-row-form")).filter(function (f) { return f.offsetParent !== null; }).map(function (f) { return f.textContent.trim().slice(0, 60); }))');
      ok(JSON.parse(editable || '[]').length === 0, 'no add form and no Delete row on it', 'forms on a read-only bundle: ' + editable);
      const delBtns = await chrome.evaluate('Array.prototype.slice.call(document.querySelectorAll("button")).filter(function (b) { return b.offsetParent !== null && /delete/i.test(b.textContent); }).length');
      ok(delBtns === 0, 'and no Delete on its branches', delBtns + ' Delete buttons on a read-only bundle');
      ok((await pageText()).indexOf(serverBundle.label) !== -1, 'its branches are there to read, under its label', 'the page does not name it');
      const refused = await home('auth.bundle', { op: 'delete', id: serverBundle.id });
      ok(refused.status >= 400 && refused.status < 500 && !!(refused.body && refused.body.code), 'and the node refuses its delete at the door, with a code', 'auth.bundle delete of a server\'s bundle: ' + refused.status + ' ' + short(refused.text));
    }

    test.subHeading('goal/G41.32: with no tabContainer configured, the pane lists and a press throws nothing');
    // "in the agent app, this will be the tabContainer in the center tab of the workBench, oos for this item. and Edit/Delete
    // in the bundleSelector:pane go anyway."
    const mark = chrome.heard.length;
    await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/bundleEditor.js")).then(function () { var h = document.createElement("div"); h.id = "zzAgentLike"; h.style.height = "300px"; document.body.appendChild(h); window.spirit.element.bundleEditor.create(h, { api: { escapeHtml: function (t) { return String(t); }, verb: function (v, a) { return window.spirit.call ? window.spirit.call(v, a) : Promise.resolve({}); } } }); return true; })');
    await H.sleep(1500);
    const noBtn = await chrome.evaluate('Array.prototype.slice.call(document.querySelectorAll("#zzAgentLike button")).filter(function (b) { return /^(Edit|Delete)$/.test(b.textContent.trim()); }).length');
    ok(noBtn === 0, 'no Edit or Delete there either', noBtn + ' Edit or Delete buttons with no tabContainer');
    await click('zzOne', '#zzAgentLike');
    await H.sleep(500);
    const threw = chrome.heard.slice(mark).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text + ' ' + short((m.params.exceptionDetails.exception || {}).description || ''); });
    ok(!threw.length, 'a press on a row throws nothing', 'it threw: ' + threw.slice(0, 2).join(' | '));
  } finally {
    try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { if (node.child) node.child.kill(); } catch (e) { /* gone */ }
    try { if (node.root) fs.rmSync(node.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
  }());
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
