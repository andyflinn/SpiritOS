'use strict';

// spirit/run/spirit/app/grants/test/element.js
// The tests of spirit/app/grants/element.js, and of no other module (spec: ./grants.md; goal/G41.5, G41.13, G41.14, G41.16,
// G41.32, G43.24). Since G43.24 the app is a wrapper mounted the new shell's way: its Grants tab is the grants panel
// (spirit/element/search/grant/grantsPanel.js) configured with the contacts and the panel's own grantsPanel.nodeGrants, both tested in
// spirit/element/search/grant/test/grantsPanel.js; its Bundles tab is the bundle editor. The browser file runs in node on a BARE window
// (rule/26): each element is put on the page only once the app requires it, a stand-in that keeps what the app handed it.
// Then the bundle lines of goal/G41.32, judged by real clicks in the Grants app as the shell app opens it, on /face.html of
// a real node on a scratch copy of the tree's files. Neither Andy's node nor an agent's is touched.
// This is the one test file of its script (spirit/test/TEST_SYSTEM.md): the wrapper part, once a file of its own, is a
// section at its end, run after the checks above and counted with them. One test.run per test (goal/G47.2).

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn, execSync } = require('child_process');
// spirit/app/grants/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'element.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
const settle = async function () { for (let i = 0; i < 20; i++) await new Promise(function (r) { setImmediate(r); }); };

function node(tag) {
  let html = '';
  const n = { tag: tag || '', kids: [], textContent: '',
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); n.kids = []; },
    appendChild: function (c) { n.kids.push(c); return c; },
  };
  return n;
}

function world(o) {
  const opt = o || {};
  const w = { required: [], tabs: [], editors: [], panels: [] };
  const NODE_GRANTS = { branch: 'the node\'s grants', key: 'key', label: 'label' };
  const E = {
    tabContainer: { create: function (host, x) { const t = { host: host, opts: x || {}, destroyed: 0, destroy: function () { t.destroyed += 1; } }; w.tabs.push(t); return t; } },
    bundleEditor: { create: function (host, x) { const e = { host: host, opts: x, args: arguments.length }; w.editors.push(e); return e; } },
    grantsPanel: { nodeGrants: NODE_GRANTS, create: function (host, cfg) { const p = { host: host, cfg: cfg || {}, args: arguments.length }; w.panels.push(p); return p; } },
  };
  const FILES = { 'spirit/element/tabContainer.js': 'tabContainer', 'spirit/element/bundleEditor.js': 'bundleEditor', 'spirit/element/search/grant/grantsPanel.js': 'grantsPanel' };
  // Where each stands under spirit.element.spirit.element, by its path: the grants panel in the grant search (goal/G43.32).
  const AT = { grantsPanel: ['search', 'grant', 'grantsPanel'] };
  // goal/G43.32: the parts stand where grants.js reads them, at spirit.element.spirit.element.<name>; a page's spirit
  // (spirit/test/headLessChrome.js pageSpirit), so grants.js places itself at spirit.element.spirit.app.grants.element as it runs.
  const page = {};
  const win = {
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  win.spirit = { element: { spirit: { element: page, app: {} } },
    require: function (p) {
      w.required.push(String(p));
      if (opt.refuse && opt.refuse.indexOf(p) !== -1) return Promise.reject(new Error('not-found ' + p));
      const put = function () { const n = FILES[p]; if (n) { const at = AT[n] || [n]; at.slice(0, -1).reduce(function (o, k) { return (o[k] = o[k] || {}); }, page)[at[at.length - 1]] = E[n]; } return {}; };
      return opt.held ? opt.held.then(put) : Promise.resolve(put());
    } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.els = { grants: (win.spirit.element.spirit.app.grants || {}).element }; w.NODE_GRANTS = NODE_GRANTS;
  return w;
}

// THE REAL NODE: the tree's files, the tracked ones and the new ones not ignored, as they are on the disk.
function treeFiles() {
  return execSync('git ls-files --cached --others --exclude-standard -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
}
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grants-'));
  treeFiles().forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  return { root: root, run: path.join(root, 'spirit', 'run') };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }


// grants.js: the Grants app, a wrapper of the grants panel and the bundle editor.
// What each test made, for the tests after it: U on the bare window, B in the browser.
const U = {};
const NO_APP = 'no spirit.element.spirit.app.grants.element: the tests before failed';

test.run('spirit/app/grants/element.js is there', 0.2, function () {
  return !!SRC || 'there is no spirit/app/grants/element.js';
}, 1000);

// mounted the new shell's way (goal/G43.24, requirement 7)
test.run('it sets spirit.element.spirit.app.grants.element = { create }', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/grants/element.js';
  U.w = world();
  U.G = U.w.els.grants;
  return !!U.G && typeof U.G.create === 'function' ? true : 'elements: ' + short(Object.keys(U.w.els));
}, 1000);
test.run('no spirit.shell.activateApp, the old shell\'s way', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/grants/element.js';
  return !/\bactivateApp\b|\bspirit\.shell\b/.test(CODE) || 'grants.js still mounts through spirit.shell';
}, 1000);
test.run('nothing of the old shell: no shellCreateListSearch, no api.ui.elements, no apiBranchSelector', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/grants/element.js';
  return !/shellCreateListSearch|api\.ui\.elements|apiBranchSelector/.test(CODE) || 'grants.js still names one';
}, 1000);

// a wrapper: it loads the panel, the tabs and the bundle editor, and nothing of its own (requirement 6)
test.run('it requires spirit/element/search/grant/grantsPanel.js', 0.2, function () {
  if (!U.w) return NO_APP;
  return U.w.required.indexOf('spirit/element/search/grant/grantsPanel.js') !== -1 || 'required: ' + short(U.w.required);
}, 1000);
test.run('it requires spirit/element/tabContainer.js', 0.2, function () {
  if (!U.w) return NO_APP;
  return U.w.required.indexOf('spirit/element/tabContainer.js') !== -1 || 'required: ' + short(U.w.required);
}, 1000);
test.run('it requires spirit/element/bundleEditor.js', 0.2, function () {
  if (!U.w) return NO_APP;
  return U.w.required.indexOf('spirit/element/bundleEditor.js') !== -1 || 'required: ' + short(U.w.required);
}, 1000);
test.run('and nothing else', 0.2, function () {
  if (!U.w) return NO_APP;
  return U.w.required.length === 3 || 'required: ' + short(U.w.required);
}, 1000);
// goal/G43.24: "Still its own: the panel's data source, auth.search and auth.grant / auth.revoke over the auth cache
// (GR_GRANTS). It moves into grantsPanel."
test.run('it asks nothing itself: no verb, no api, no auth verb, no cache of its own', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/grants/element.js';
  return !/\.verb\s*\(|\bapi\b|\bauth\.|\bcacheManager\b|\bspirit\.data\b|\boutcome\b|\bfetch\s*\(/.test(CODE) || 'grants.js still asks or keeps something of its own';
}, 1000);
test.run('it draws nothing itself: no markup, no list, no selector of its own', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/grants/element.js';
  return !/['"][^'"\n]*<(div|span|button|input|table|b)\b/.test(CODE) && !/createElement|probabilitySearch|grantList|[cC]ontactSelector|[bB]undleSelector/.test(CODE)
    ? true : 'grants.js still draws or builds something of its own';
}, 1000);

test.run('create(container, opts) answers { destroy() }', 0.2, function () {
  if (!U.G || typeof U.G.create !== 'function') return NO_APP;
  U.box = node('<container>');
  U.box.innerHTML = '<p>left over</p>';
  U.m = U.G.create(U.box, {});
  return !!U.m && typeof U.m.destroy === 'function' ? true : 'create answered ' + short(U.m && Object.keys(U.m));
}, 1000);
test.run('it empties its container', 0.2, async function () {
  if (!U.box) return 'create was never called';
  const left = U.box.innerHTML;
  await settle();
  return left === '' || 'left: ' + short(left);
}, 1000);

// two tabs: Grants, the grants panel; Bundles, the bundle editor (goal/G41.13)
test.run('one tabContainer, in its container', 0.2, function () {
  if (!U.box) return 'create was never called';
  U.tabs = U.w.tabs[0];
  U.list = U.tabs ? (U.tabs.opts.tabs || []) : [];
  return U.w.tabs.length === 1 && U.tabs.host === U.box ? true : 'tabContainers: ' + U.w.tabs.length;
}, 1000);
test.run('its tabs: grants (Grants), then bundles (Bundles)', 0.2, function () {
  const list = U.list || [];
  return JSON.stringify(list.map(function (t) { return [t.name, t.label]; })) === '[["grants","Grants"],["bundles","Bundles"]]' ? true : 'tabs: ' + short(list.map(function (t) { return [t.name, t.label]; }));
}, 1000);
const NO_TABS = 'no two tabs to mount: the tests before failed';
function twoTabs() { return !!U.list && U.list.length === 2 && typeof U.list[0].mount === 'function' && typeof U.list[1].mount === 'function'; }
test.run('the Grants tab is the grants panel, made in the tab\'s box and answered to it', 0.2, function () {
  if (!twoTabs()) return NO_TABS;
  const gbox = node('<grants-tab>');
  const gp = U.list[0].mount(gbox);
  U.p = U.w.panels[0];
  return U.w.panels.length === 1 && U.p.host === gbox && gp === U.p ? true : 'panels: ' + U.w.panels.length;
}, 1000);

// the app configures the panel: the contacts, and the node's grants (goal/G41.16)
// Andy: "the callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel element".
const NO_PANEL = 'no grants panel made: the tests before failed';
test.run('its ID table is the contacts\', loopback://api/contact/search', 0.2, function () {
  if (!U.p) return NO_PANEL;
  return U.p.cfg.ids && U.p.cfg.ids.table === 'loopback://api/contact/search' ? true : 'ids: ' + short(U.p.cfg.ids);
}, 1000);
test.run('its grants table is the node\'s, the one the panel offers by name: grantsPanel.nodeGrants', 0.2, function () {
  if (!U.p) return NO_PANEL;
  return U.p.cfg.grants === U.w.NODE_GRANTS || 'grants: ' + short(U.p.cfg.grants);
}, 1000);
// Andy: "every fucking element gets the interfaces it needs".
test.run('and nothing else: no api handed', 0.2, function () {
  if (!U.p) return NO_PANEL;
  return Object.keys(U.p.cfg).sort().join() === 'grants,ids' || 'handed: ' + short(Object.keys(U.p.cfg));
}, 1000);

// the Bundles tab: the bundle editor, opening its tabs in this tab row (goal/G41.32)
const NO_EDITOR = 'no bundle editor made: the tests before failed';
test.run('the Bundles tab is the bundle editor, made in the tab\'s box', 0.2, function () {
  if (!twoTabs()) return NO_TABS;
  const bbox = node('<bundles-tab>');
  const be = U.list[1].mount(bbox);
  U.ed = U.w.editors[0];
  return U.w.editors.length === 1 && U.ed.host === bbox && be === U.ed ? true : 'editors: ' + U.w.editors.length;
}, 1000);
// Andy: "in the Grants app, this will be the grant app's tabContainer."
test.run('handed the app\'s own tabContainer to open each bundle\'s tab in', 0.2, function () {
  if (!U.ed) return NO_EDITOR;
  return U.ed.opts && U.ed.opts.tabs === U.tabs ? true : 'tabs handed: ' + (U.ed.opts && U.ed.opts.tabs === U.tabs);
}, 1000);
// Andy: "Grants: <owner>-<bundle>."
test.run('each tab named owner-bundle (node when no owner is said)', 0.2, function () {
  if (!U.ed) return NO_EDITOR;
  const tl = U.ed.opts && U.ed.opts.tabLabel;
  return typeof tl === 'function' && tl({ owner: 'node', label: 'Reader' }) === 'node-Reader' && tl({ owner: 'agent', label: 'Jobs' }) === 'agent-Jobs' && tl({ label: 'Lone' }) === 'node-Lone'
    ? true : 'tabLabel: ' + short(typeof tl === 'function' ? [tl({ owner: 'node', label: 'Reader' }), tl({ label: 'Lone' })] : tl);
}, 1000);
test.run('and the bundle editor is handed nothing else: no api', 0.2, function () {
  if (!U.ed) return NO_EDITOR;
  return Object.keys(U.ed.opts).sort().join() === 'tabLabel,tabs' || 'handed: ' + short(Object.keys(U.ed.opts));
}, 1000);

// destroy
test.run('destroy destroys its tabs and empties its container', 0.2, function () {
  if (!U.m || !U.tabs) return 'no app made with its tabs: the tests before failed';
  U.m.destroy();
  return U.tabs.destroyed === 1 && U.box.innerHTML === '' ? true : 'tabs destroyed ' + U.tabs.destroyed + ', left ' + short(U.box.innerHTML);
}, 1000);
test.run('destroyed before its elements load, nothing is made', 0.2, async function () {
  if (!SRC) return 'there is no spirit/app/grants/element.js';
  let letGo = null;
  const late = world({ held: new Promise(function (r) { letGo = r; }) });
  const box2 = node('<container>');
  const m2 = late.els.grants.create(box2, {});
  m2.destroy(); letGo(); await settle();
  return late.tabs.length === 0 || 'tabContainers made: ' + late.tabs.length;
}, 1000);
test.run('an element refused: Grants could not be loaded.', 0.2, async function () {
  if (!SRC) return 'there is no spirit/app/grants/element.js';
  const no = world({ refuse: ['spirit/element/bundleEditor.js'] });
  const box3 = node('<container>');
  no.els.grants.create(box3, {});
  await settle();
  return box3.textContent === 'Grants could not be loaded.' && no.tabs.length === 0 ? true : 'said: ' + short(box3.textContent);
}, 1000);

// GOAL/G41.32, IN A REAL BROWSER ON A SCRATCH NODE. THE BOX: "the bundleSelector:pane looses both the 'Edit' button and the
// 'Delete' Button. when some clicks on a (selects) a bundle row, a new closable tab opens in the tabContainer configured in
// the bundleSelector:pane"; "if a bundle already has an branchEditor-tab in the configured tabContainer, that tab will
// become the active tab"; "in the Grants app, this will be the grant app's tabContainer."; "i need the branchEditor to have
// a rowForm at the bottom: [❌] "Delete <bundle-name> bundle and branches " [Delete (armingButton)]."; "a bundle that hears
// its deletion, closes its branchEditor tab."; "A user can only create, change and delete node-owned bundles and branches,
// and sees the others read-only". What a person sees is judged: a press is a real click on what is drawn, in the Grants
// app the shell app opens from its tile (goal/G43.24: "both show in the shell as before").
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const B = {};
// Its node and Chrome go once the bundle lines are judged (the wrapper part's world starts by it), or at the end.
async function closeBundleWorld() {
  if (B.closed) return;
  B.closed = true;
  const chrome = B.chrome;
  try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
  try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  await stop(B.child);
  if (B.s) { try { fs.rmSync(B.s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
}
test.after(closeBundleWorld);
const home = async function (verb, args) {
  try {
    const r = await fetch(B.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
};
// A real click on the innermost visible thing whose words are these, inside the shell's box (or the selector given).
const LEAF = 'function leaf(words, within) { var root = document.querySelector(within || "#zzBox"); if (!root) return null; var all = Array.prototype.slice.call(root.querySelectorAll("*")); return all.filter(function (e) { return e.offsetParent !== null && e.textContent.trim() === words && !Array.prototype.some.call(e.children, function (c) { return c.textContent.trim() === words; }); })[0] || null; }';
const click = function (words, within) { return B.chrome.evaluate('(function () { ' + LEAF + ' var e = leaf(' + JSON.stringify(words) + ', ' + JSON.stringify(within || '') + '); if (!e) return false; e.click(); return true; }())'); };
const shown = function (words) { return B.chrome.evaluate('(function () { ' + LEAF + ' return !!leaf(' + JSON.stringify(words) + ', ""); }())'); };
const pageText = function () { return B.chrome.evaluate('(function () { var b = document.getElementById("zzBox"); return b ? b.innerText : ""; }())').then(String); };
const IN = 'document.getElementById("zzBox").querySelectorAll';
const tabs = function () { return B.chrome.evaluate('JSON.stringify(Array.prototype.slice.call(' + IN + '(".tab-button")).filter(function (b) { return b.offsetParent !== null; }).map(function (b) { return { text: b.textContent.trim(), on: b.getAttribute("aria-selected") === "true" }; }))').then(function (t) { return JSON.parse(t || '[]'); }); };
const tabNamed = async function (label) { return (await tabs()).filter(function (t) { return t.text.indexOf(label) !== -1; }); };
const waitFor = function (fn, ms) { return H.until(fn, ms || 5000); };
const NO_NODE = 'no scratch node: the world failed';
const NO_PAGE = 'no Grants app on the page: the world failed';

test.run('the world: a scratch node comes up for the bundle lines', 0.2, async function () {
  B.s = scratch();
  const port = await H.freePort();
  B.child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: B.s.run, stdio: 'ignore' });
  B.base = 'http://127.0.0.1:' + port;
  B.up = !!(await H.until(function () { return home('api').then(function (r) { return r.status === 200; }); }, 60000));
  return B.up || 'the scratch node did not come up: nothing judged';
}, 6000);
test.run('the world: a Chrome page for the bundle lines', 0.2, async function () {
  if (!B.up) return NO_NODE;
  const where = H.findChrome();
  if (!where) return 'no Chrome here: nothing judged';
  const c = await H.chromePage(where);
  if (c.error) return 'Chrome: ' + c.error;
  B.chrome = c;
  return true;
}, 2000);
test.run('the world: three bundles of the node\'s stand', 0.2, async function () {
  if (!B.up) return NO_NODE;
  B.one = await home('auth.bundle', { op: 'add', label: 'zzOne' });
  B.two = await home('auth.bundle', { op: 'add', label: 'zzTwo' });
  B.three = await home('auth.bundle', { op: 'add', label: 'zzThree' });
  return B.one.status === 200 && B.two.status === 200 && B.three.status === 200 ? true : 'nothing judged: ' + short(B.one.text);
}, 1000);
test.run('the world: and a server\'s bundle', 0.2, async function () {
  if (!B.up) return NO_NODE;
  await home('auth.branch', { op: 'add', bundle: B.one && B.one.body && B.one.body.id, family: 'node', verb: 'card' });
  const all = await home('auth.bundle', { op: 'search', text: '' });
  const rows = ((all.body && all.body.items) || []).map(function (i) { return parsed(i.label) || {}; });
  B.serverBundle = rows.filter(function (r) { return r.owner && r.owner !== 'node'; })[0];
  return !!B.serverBundle || 'no bundle of a server on the scratch node: read-only judges nothing';
}, 1000);
test.run('the world: the face page has its spirit', 0.2, async function () {
  if (!B.chrome) return 'no Chrome page: the world failed';
  await B.chrome.send('Page.navigate', { url: B.base + '/face.html' });
  B.page = !!(await H.until(function () { return B.chrome.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000));
  return B.page || 'the page has no spirit: nothing judged';
}, 1000);
// The shell app, as boot.js hands it the page's app area, here in a box of its own over the page.
test.run('the world: the shell app is drawn', 0.2, async function () {
  if (!B.page) return 'no page: the world failed';
  const made = await B.chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__shell = spirit.element.spirit.app.app.element.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
  B.shell = made === 'made';
  return B.shell || 'the shell: ' + short(made);
}, 1000);
test.run('the Grants app\'s tile is pressed', 0.2, async function () {
  if (!B.shell) return 'no shell app: the world failed';
  B.tile = !!(await waitFor(function () { return B.chrome.evaluate('(function () { var t = document.querySelector("#zzBox .app-icon[data-key=grants]"); if (!t || t.offsetParent === null) return false; t.click(); return true; }())'); }, 15000));
  return B.tile || 'no Grants tile: nothing judged';
}, 1000);
test.run('its Bundles tab is pressed', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  await waitFor(function () { return tabNamed('Bundles').then(function (t) { return t.length > 0; }); }, 10000);
  const pressed = await click('Bundles', '#zzBox .tab-button') || await click('Bundles');
  await waitFor(function () { return shown('zzOne'); }, 8000);
  return pressed || 'no Bundles tab: nothing judged';
}, 2000);

// goal/G41.32: the pane has no Edit and no Delete
test.run('the pane lists the bundles', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  return await shown('zzOne') || 'zzOne is not listed: ' + short(await pageText());
}, 1000);
test.run('no Edit button', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  return !(await shown('Edit')) || 'an Edit button is still there';
}, 1000);
test.run('no Delete button', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  return !(await shown('Delete')) || 'a Delete button is still there';
}, 1000);

// goal/G41.32: a row pressed opens its tab, in the app's own tab row
test.run('the app has its two tabs', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  return (await tabs()).length === 2 || 'tabs: ' + short(await tabs());
}, 1000);
test.run('zzOne is pressed', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  const pressed = await click('zzOne');
  await waitFor(function () { return tabNamed('zzOne').then(function (t) { return t.length > 0; }); });
  return pressed || 'no row to press';
}, 1000);
test.run('a tab for it opens, and is active', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  const tOne = await tabNamed('zzOne');
  return tOne.length === 1 && tOne[0].on ? true : 'tabs: ' + short(await tabs());
}, 1000);
// Andy, on what he saw: "the tabs should name owner-bundle".
test.run('the tab names owner-bundle: node-zzOne', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  const tOne = await tabNamed('zzOne');
  return tOne.length === 1 && tOne[0].text.indexOf('node-zzOne') !== -1 ? true : 'tabs: ' + short(await tabs());
}, 1000);
test.run('its close button is small, on the tab\'s right side', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  const place = await B.chrome.evaluate('(function () { var c = document.querySelector("#zzBox [data-tab-close]"); if (!c) return null; var b = c.closest(".tab-button") || c.parentElement; var r = c.getBoundingClientRect(), o = b.getBoundingClientRect(); return { right: r.right <= o.right + 1 && r.left > o.left + (o.width / 3), small: r.width <= o.width / 2 }; }())');
  return !!place && place.right && place.small ? true : 'close button: ' + short(place);
}, 1000);

// goal/G41.32: the branchEditor's Delete row
const WORDS = 'Delete zzOne bundle and branches';
test.run('it says "Delete zzOne bundle and branches"', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  await waitFor(function () { return pageText().then(function (t) { return t.indexOf(WORDS) !== -1; }); });
  const paneText = await pageText();
  return paneText.indexOf(WORDS) !== -1 || 'not said: ' + short(paneText.slice(-300));
}, 1000);
test.run('in a rowForm below the others, ❌, the words, a button', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  const atBottom = await B.chrome.evaluate('(function () { var forms = Array.prototype.slice.call(' + IN + '(".shell-row-form")).filter(function (f) { return f.offsetParent !== null && !f.querySelector(".app-container-close"); }); var last = forms[forms.length - 1]; if (!last) return null; return { icon: last.textContent.indexOf("❌") !== -1, words: last.textContent.indexOf(' + JSON.stringify(WORDS) + ') !== -1, button: !!last.querySelector("button"), below: forms.length > 1 && forms[0].getBoundingClientRect().top < last.getBoundingClientRect().top }; }())');
  return !!atBottom && atBottom.icon && atBottom.words && atBottom.button && atBottom.below ? true : 'the row: ' + short(atBottom);
}, 1000);

// goal/G41.32: a bundle already open: its tab is made active
test.run('back to the Bundles tab', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  return await click('Bundles', '#zzBox .tab-button') || await click('Bundles') || 'no way back to the Bundles tab';
}, 1000);
test.run('zzOne pressed again: no second tab, its tab is active', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  await waitFor(function () { return shown('zzTwo'); });
  await click('zzOne', '#zzBox .bundle-selector-face-pane');
  await H.sleep(800);
  const again = await tabNamed('zzOne');
  return again.length === 1 && again[0].on ? true : 'tabs: ' + short(await tabs());
}, 3000);

// goal/G41.32: the close button takes the tab away, the bundle stays
test.run('the tab is gone', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  const closed = await B.chrome.evaluate('(function () { var c = Array.prototype.slice.call(' + IN + '("[data-tab-close]"))[0]; if (!c) return false; c.click(); return true; }())');
  await waitFor(function () { return tabNamed('zzOne').then(function (t) { return t.length === 0; }); });
  return closed === true && (await tabNamed('zzOne')).length === 0 ? true : 'tabs: ' + short(await tabs());
}, 1000);
test.run('the bundle is there', 0.2, async function () {
  if (!B.one || !B.one.body) return NO_NODE;
  return (await home('auth.bundle', { op: 'get', id: B.one.body.id })).status === 200 || 'closing a tab deleted the bundle';
}, 1000);

// goal/G41.32: the Delete row deletes, by the arming button, and the tab closes
const DELBTN = 'Array.prototype.slice.call(' + IN + '(".shell-row-form")).filter(function (f) { return f.offsetParent !== null && f.textContent.indexOf("Delete zzTwo") !== -1; })[0]';
test.run('one press only arms: the bundle stays', 0.2, async function () {
  if (!B.tile || !B.two || !B.two.body) return NO_PAGE;
  await click('Bundles', '#zzBox .tab-button');
  await waitFor(function () { return shown('zzTwo'); });
  await click('zzTwo', '#zzBox .bundle-selector-face-pane');
  await waitFor(function () { return pageText().then(function (t) { return t.indexOf('Delete zzTwo bundle and branches') !== -1; }); });
  B.hadTwo = (await tabNamed('zzTwo')).length === 1;
  const pressedOnce = await B.chrome.evaluate('(function () { var f = ' + DELBTN + '; var b = f && f.querySelector("button"); if (!b) return false; b.click(); return true; }())');
  await H.sleep(500);
  return pressedOnce === true && (await home('auth.bundle', { op: 'get', id: B.two.body.id })).status === 200 ? true : 'one press: pressed ' + pressedOnce + ', the bundle answered ' + (await home('auth.bundle', { op: 'get', id: B.two.body.id })).status;
}, 2000);
test.run('the second press deletes it', 0.2, async function () {
  if (!B.tile || !B.two || !B.two.body) return NO_PAGE;
  await B.chrome.evaluate('(function () { var f = ' + DELBTN + '; var b = f && f.querySelector("button"); if (b) b.click(); }())');
  await waitFor(function () { return home('auth.bundle', { op: 'get', id: B.two.body.id }).then(function (a) { return a.status !== 200; }); });
  return (await home('auth.bundle', { op: 'get', id: B.two.body.id })).status !== 200 || 'the bundle is still there after two presses';
}, 1000);
test.run('and its tab closes', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  await waitFor(function () { return tabNamed('zzTwo').then(function (t) { return t.length === 0; }); });
  return B.hadTwo && (await tabNamed('zzTwo')).length === 0 ? true : (B.hadTwo ? 'tabs: ' + short(await tabs()) : 'zzTwo never had a tab: nothing judged');
}, 1000);

// goal/G41.32: a bundle deleted elsewhere closes its tab
test.run('zzThree has its tab', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  await click('Bundles', '#zzBox .tab-button');
  await waitFor(function () { return shown('zzThree'); });
  await click('zzThree', '#zzBox .bundle-selector-face-pane');
  await waitFor(function () { return tabNamed('zzThree').then(function (t) { return t.length === 1; }); });
  B.hadThree = (await tabNamed('zzThree')).length === 1;
  return B.hadThree || 'tabs: ' + short(await tabs());
}, 1000);
test.run('deleted at the door, its tab closes by itself', 0.2, async function () {
  if (!B.tile || !B.three || !B.three.body) return NO_PAGE;
  await home('auth.bundle', { op: 'delete', id: B.three.body.id });
  await waitFor(function () { return tabNamed('zzThree').then(function (t) { return t.length === 0; }); });
  return B.hadThree && (await tabNamed('zzThree')).length === 0 ? true : (B.hadThree ? 'the tab stayed: ' + short(await tabs()) : 'zzThree never had a tab: nothing judged');
}, 1000);

// goal/G41.32: a server's bundle is read-only. With no server's bundle on the scratch node these fail, as the world before them.
const NO_SERVER_BUNDLE = 'no bundle of a server on the scratch node: the world failed';
test.run('its row opens', 0.2, async function () {
  if (!B.tile) return NO_PAGE;
  if (!B.serverBundle) return NO_SERVER_BUNDLE;
  await click('Bundles', '#zzBox .tab-button');
  await waitFor(function () { return shown(B.serverBundle.label); });
  const opened = await click(B.serverBundle.label, '#zzBox .bundle-selector-face-pane');
  await waitFor(function () { return tabNamed(B.serverBundle.label).then(function (t) { return t.length === 1; }); });
  return opened || 'no row for ' + B.serverBundle.label;
}, 1000);
test.run('its tab names owner-bundle', 0.2, async function () {
  if (!B.serverBundle) return NO_SERVER_BUNDLE;
  return (await tabNamed(B.serverBundle.owner + '-' + B.serverBundle.label)).length === 1 || 'tabs: ' + short(await tabs());
}, 1000);
// The panel's own title bar (panel.js, ✕) is a rowForm too: it is the shell's, not the bundle's.
test.run('no add form and no Delete row on it', 0.2, async function () {
  if (!B.serverBundle) return NO_SERVER_BUNDLE;
  const editable = await B.chrome.evaluate('JSON.stringify(Array.prototype.slice.call(' + IN + '(".shell-row-form")).filter(function (f) { return f.offsetParent !== null && !f.querySelector(".app-container-close"); }).map(function (f) { return f.textContent.trim().slice(0, 60); }))');
  return JSON.parse(editable || '[]').length === 0 || 'forms on a read-only bundle: ' + editable;
}, 1000);
test.run('and no Delete on its branches', 0.2, async function () {
  if (!B.serverBundle) return NO_SERVER_BUNDLE;
  const delBtns = await B.chrome.evaluate('Array.prototype.slice.call(' + IN + '("button")).filter(function (b) { return b.offsetParent !== null && /delete/i.test(b.textContent); }).length');
  return delBtns === 0 || delBtns + ' Delete buttons on a read-only bundle';
}, 1000);
test.run('its branches are there to read, under its label', 0.2, async function () {
  if (!B.serverBundle) return NO_SERVER_BUNDLE;
  return (await pageText()).indexOf(B.serverBundle.label) !== -1 || 'the page does not name it';
}, 1000);
test.run('and the node refuses its delete at the door, with a code', 0.8, async function () {
  if (!B.serverBundle) return NO_SERVER_BUNDLE;
  const refused = await home('auth.bundle', { op: 'delete', id: B.serverBundle.id });
  return refused.status >= 400 && refused.status < 500 && !!(refused.body && refused.body.code) ? true : 'auth.bundle delete of a server\'s bundle: ' + refused.status + ' ' + short(refused.text);
}, 1000);

// goal/G41.32: with no tabContainer configured, the pane lists and a press throws nothing
// "in the agent app, this will be the tabContainer in the center tab of the workBench, oos for this item. and Edit/Delete
// in the bundleSelector:pane go anyway."
test.run('no Edit or Delete there either', 0.2, async function () {
  if (!B.page) return 'no page: the world failed';
  B.mark = B.chrome.heard.length;
  await B.chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/bundleEditor.js")).then(function () { var h = document.createElement("div"); h.id = "zzAgentLike"; h.style.cssText = "position:absolute;left:0;top:0;width:100%;height:300px;background:#fff;z-index:10000"; document.body.appendChild(h); window.spirit.element.spirit.element.bundleEditor.create(h, {}); return true; })');
  await waitFor(function () { return B.chrome.evaluate('(function () { ' + LEAF + ' return !!leaf("zzOne", "#zzAgentLike"); }())'); }, 5000);
  const noBtn = await B.chrome.evaluate('Array.prototype.slice.call(document.querySelectorAll("#zzAgentLike button")).filter(function (b) { return /^(Edit|Delete)$/.test(b.textContent.trim()); }).length');
  return noBtn === 0 || noBtn + ' Edit or Delete buttons with no tabContainer';
}, 1000);
test.run('a row there is pressed', 0.2, async function () {
  if (!B.page) return 'no page: the world failed';
  const pressed = await click('zzOne', '#zzAgentLike');
  await H.sleep(500);
  return pressed || 'no zzOne row with no tabContainer: ' + short(await B.chrome.evaluate('(document.getElementById("zzAgentLike") || {}).innerText || ""'));
}, 2000);
test.run('a press on a row throws nothing', 0.2, function () {
  if (!B.page) return 'no page: the world failed';
  const threw = B.chrome.heard.slice(B.mark).filter(function (x) { return x.method === 'Runtime.exceptionThrown'; }).map(function (x) { return x.params.exceptionDetails.text + ' ' + short((x.params.exceptionDetails.exception || {}).description || ''); });
  return !threw.length || 'it threw: ' + threw.slice(0, 2).join(' | ');
}, 1000);

// ── THE WRAPPER PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// Grants IN spirit/app/, A WRAPPER MOUNTED THE NEW SHELL'S WAY (goal/G43.24, requirements 1 to 7; spec: ./element.md, section "wrapper"): the
// tests of spirit/app/grants/element.js and its grants.json. Andy: "i just moved them, didn't fix the manifest.", "no i want those apps
// to basically be wrappers for spirit/element/ things....", and "box that these apps must mount in the new format of the new
// shell." The tree read as it is, its own test run, then a real node on a scratch copy of the tree's files and real clicks in
// a real Chrome on /face.html, on the shell app as boot.js draws it. Neither Andy's node nor an agent's is touched.
// The wrapper part runs this file again as a child (its box 4); that child (SPIRIT_TEST_OWN_ONLY) runs the tests above only.
const { spawnSync } = require('child_process');
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
// The box, requirement 1: "Icon and label as they were: Info ℹ️, Grants 🔒".
const NAME = 'grants';
const WANT = { label: 'Grants', icon: '🔒' };
const APP_DIR = path.join(RUN, 'spirit', 'app', NAME);
// The red files that must name the old path to judge it.
// The wrapper parts live in each app's one test file since the fold (spirit/test/TEST_SYSTEM.md).
const MINE = ['spirit/run/spirit/app/info/test/element.js', 'spirit/run/spirit/app/info/test/element.md',
  'spirit/run/spirit/app/grants/test/element.js', 'spirit/run/spirit/app/grants/test/element.md',
  'spirit/run/spirit/test/coreFiles.js', 'spirit/run/spirit/test/coreFiles.md',
  // nodeInfo-rotate's part is in the one test file of nodeInfo.js (spirit/test/TEST_SYSTEM.md).
  'spirit/run/spirit/element/test/nodeInfo.js', 'spirit/run/spirit/element/test/nodeInfo.md'];
async function wcall(base, verb, args) {
  try {
    const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
}
async function wboot(run) {
  const port = await H.freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await H.until(function () { return wcall(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
// THE PAGE'S HANDS: everything judged is what shows in #zzBox; a hidden layer never counts.
const HANDS = '(function () {' +
  'function box() { return document.getElementById("zzBox"); }' +
  'function seen(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }' +
  'function all(sel) { var b = box(); return b ? Array.prototype.slice.call(b.querySelectorAll(sel)).filter(seen) : []; }' +
  'window.__t = {' +
  '  text: function () { var b = box(); return b ? String(b.innerText || "").replace(/\\s+/g, " ") : ""; },' +
  '  tiles: function () { return all(".app-icon[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
  '  tile: function (k) { var t = all(".app-icon[data-key]").filter(function (e) { return e.getAttribute("data-key") === k; })[0]; if (!t) return false; t.click(); return true; },' +
  '  bars: function () { return all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }).map(function (b) { return String(b.parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim(); }); },' +
  '  close: function (label) { var b = all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || "") && String(b.parentElement.innerText || "").indexOf(label) !== -1; }); if (!b.length) return false; b[b.length - 1].click(); return true; },' +
  '  count: function (sel) { return all(sel).length; },' +
  '  buttons: function () { return all("button").map(function (b) { return String(b.textContent).replace(/\\s+/g, " ").trim(); }); },' +
  '  tabs: function () { return all("button.tab-button[data-tab]").map(function (b) { return String(b.textContent).replace(/\\s+/g, " ").trim(); }); },' +
  '}; return "hands"; }())';
// What the wrapper part's world made.
const R = {};
const T = function (expr) { return R.c.evaluate('window.__t.' + expr); };
const wwaitFor = function (expr, ms) { return H.until(function () { return R.c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };
const R_NO_NODE = 'no scratch node for the wrapper: the world failed';
const R_NO_PAGE = 'no wrapper page: the world failed';

if (!process.env.SPIRIT_TEST_OWN_ONLY) {
  test.after(async function () {
    try { if (R.c && R.c.sock) R.c.sock.close(); } catch (e) { /* gone */ }
    try { if (R.c && R.c.kid) R.c.kid.kill(); } catch (e) { /* gone */ }
    if (R.N) await stop(R.N.child);
    if (R.s) { try { fs.rmSync(R.s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  });

  // wrapper: Grants in spirit/app/, a wrapper mounted the new shell's way (goal/G43.24)
  // the box, 1: "each app has its <name>.json in the spirit/app form, as icons.json and file.json have it"
  test.run('the world: file.json, the form, has identity, mount, shell and node', 0.2, function () {
    R.fileJson = readJson(path.join(RUN, 'spirit', 'app', 'file', 'file.json')) || {};
    return same(Object.keys(R.fileJson).sort(), ['identity', 'mount', 'node', 'shell']) || 'file.json reads ' + short(R.fileJson);
  }, 1000);
  test.run('the world: spirit/app/grants/grants.json is there and reads', 0.2, function () {
    R.j = readJson(path.join(APP_DIR, NAME + '.json'));
    return !!R.j || 'no readable spirit/app/' + NAME + '/' + NAME + '.json: nothing judged';
  }, 1000);
  const NO_JSON = 'no grants.json: the world failed';
  test.run('grants.json: its identity is the icon 🔒, the label Grants, and intrinsic true', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(R.j.identity, { icon: WANT.icon, label: WANT.label, intrinsic: true }) || NAME + '.json identity: ' + short(R.j.identity);
  }, 1000);
  test.run('grants.json: it mounts element.js', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(R.j.mount, { 'element.js': true }) || NAME + '.json mount: ' + short(R.j.mount);
  }, 1000);
  test.run('grants.json: in the shell it mounts and has a tile, and is no shell itself', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(R.j.shell, { true: false, mount: true, tile: true }) || NAME + '.json shell: ' + short(R.j.shell);
  }, 1000);
  test.run('grants.json: the node mounts no server for it', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(R.j.node, { mount: false }) || NAME + '.json node: ' + short(R.j.node);
  }, 1000);
  test.run('grants.json holds what file.json holds, nothing of the old form', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(Object.keys(R.j).sort(), Object.keys(R.fileJson).sort()) || NAME + '.json keys: ' + short(Object.keys(R.j));
  }, 1000);
  test.run('Q1, the old description sentence: "it goes.", and grants.json holds none', 0.2, function () {
    if (!R.j) return NO_JSON;
    return JSON.stringify(R.j).indexOf('"description"') === -1 || NAME + '.json still says a description: ' + short(R.j.description);
  }, 1000);

  // the box, 6: "each app's <name>.js only loads spirit/element/ parts (spirit.require) and mounts them into its container"
  test.run('the world: its element.js is there', 0.2, function () {
    R.c0 = code(path.join(APP_DIR, 'element.js'));
    return R.c0.length > 0 || 'no spirit/app/' + NAME + '/' + NAME + '.js: nothing judged';
  }, 1000);
  const NO_CODE = 'no element.js: the world failed';
  test.run('it loads only spirit/element/ parts, through spirit.require', 0.2, function () {
    if (!R.c0) return NO_CODE;
    // What it loads: every script it names, and every spirit.require.
    const named = (R.c0.match(/['"][^'"\n]*\.js['"]/g) || []).map(function (s) { return s.slice(1, -1); }).filter(function (s) { return s !== 'element.js' && s !== 'spirit/app/' + NAME + '/element.js'; }); // goal/G43.32, decided 5: its own path is where it places itself, no load
    const asks = (R.c0.match(/\brequire\s*\(/g) || []).length;
    const strays = named.filter(function (s) { return !/^spirit\/element\/[^]+\.js$/.test(s); });
    return asks > 0 && named.length > 0 && !strays.length ? true : (asks && named.length ? NAME + '.js loads what is no element: ' + short(strays) : NAME + '.js loads nothing through spirit.require: nothing judged');
  }, 1000);
  test.run('it loads no data family of its own (no cacheManager)', 0.2, function () {
    if (!R.c0) return NO_CODE;
    return !/\bcacheManager\s*\(/.test(R.c0) || NAME + '.js asks a cacheManager itself';
  }, 1000);
  test.run('it calls no verb of its own', 0.2, function () {
    if (!R.c0) return NO_CODE;
    const verbs = [/\.verb\s*\(/, /\bspirit\.outcome\b/, /\bcallDialog\b/, /\bfetch\s*\(/, /\brelay\W{1,4}status\b/, /\bnode\W{1,4}card\b/, /\bauth\W{1,4}(search|grant|revoke)\b/]
      .filter(function (re) { return re.test(R.c0); }).map(String);
    return !verbs.length || NAME + '.js still calls: ' + short(verbs);
  }, 1000);
  test.run('as a wrapper, it draws no markup of its own', 0.2, function () {
    if (!R.c0) return NO_CODE;
    const markup = R.c0.match(/['"][^'"\n]*<(div|span|button|input|table|b)\b[^'"\n]*['"]/g) || [];
    return !markup.length || NAME + '.js draws: ' + short(markup);
  }, 1000);

  // the box, 7: "no spirit.shell.activateApp, the old shell's way"
  test.run('it mounts through no spirit.shell.activateApp', 0.2, function () {
    const c0 = R.c0 || '';
    return c0.length > 0 && !/\bactivateApp\b/.test(c0) && !/\bspirit\.shell\b/.test(c0) ? true : (c0.length ? NAME + '.js still calls spirit.shell.activateApp' : 'no ' + NAME + '.js: nothing judged');
  }, 1000);

  // the box, 4: "info/test/info.js and grants/test/grants.js find the run root at their new depth"
  const OWN = path.join(APP_DIR, 'test', 'element.js');
  test.run('the world: its own test is there', 0.2, function () {
    return fs.existsSync(OWN) || 'no spirit/app/' + NAME + '/test/' + NAME + '.js: nothing judged';
  }, 1000);
  test.run('its own test runs from the new place: testReport.js found, its completion line printed', 0.2, async function () {
    if (!fs.existsSync(OWN)) return 'no own test: the world failed';
    // The bundle lines' node and Chrome go first, so the child's own do not run beside them.
    await closeBundleWorld();
    // This part lives in that file now: the child runs the file's own checks only (SPIRIT_TEST_OWN_ONLY), as it did when
    // this part was a file of its own, and does not run this part again.
    const r = spawnSync(process.execPath, [OWN], { cwd: RUN, encoding: 'utf8', timeout: 240000, env: Object.assign({}, process.env, { LAB_MASTER_PORT: process.env.LAB_MASTER_PORT || '45420', SPIRIT_TEST_OWN_ONLY: '1' }) });
    const out = String(r.stdout || '') + String(r.stderr || '');
    const lost = /Cannot find module[^\n]*/.exec(out);
    return !lost && /Test completed\./.test(out) ? true : (lost ? NAME + '.js: ' + short(lost[0]) : NAME + '.js printed no completion line: ' + short(out.slice(-300)));
  }, 19000);

  // the box, 5: "no file names shell/info or shell/grants any more" (shell/grants)
  test.run('the world: more than five hundred of the tree\'s files are read', 0.2, function () {
    R.tracked = execSync('git ls-files --cached --others --exclude-standard', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
      .filter(function (f) { return MINE.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
    return R.tracked.length > 500 || 'only ' + R.tracked.length + ' files read: nothing judged';
  }, 1000);
  test.run('no file names shell/grants', 0.2, function () {
    if (!R.tracked) return 'no files read: the world failed';
    const OLD = new RegExp('shell/' + NAME + '(?![\\w-])');
    const naming = R.tracked.filter(function (f) {
      let t = '';
      try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; }
      return t.indexOf('\u0000') === -1 && OLD.test(t);
    });
    return !naming.length || naming.length + ' files still name it: ' + naming.join(', ');
  }, 1000);

  test.run('the world: a scratch node comes up', 0.2, async function () {
    await closeBundleWorld();
    R.s = scratch();
    R.N = await wboot(R.s.run);
    return R.N.up || 'the scratch node did not come up: nothing judged';
  }, 8000);

  // the box, 2: intrinsic "as spirit/app apps say it": the node says so
  test.run('the world: the node lists Files, intrinsic', 0.2, async function () {
    if (!R.N || !R.N.up) return R_NO_NODE;
    const listed = await wcall(R.N.base, 'app.search', { q: '' });
    R.rows = {};
    ((listed.body && listed.body.items) || []).forEach(function (i) { R.rows[i.key] = parsed(i.label) || {}; });
    return !!R.rows.file && R.rows.file.intrinsic === true ? true : 'app.search: ' + short(listed.text);
  }, 1000);
  test.run('the node lists grants intrinsic, so always active', 0.2, function () {
    if (!R.rows) return R_NO_NODE;
    return !!R.rows[NAME] && R.rows[NAME].intrinsic === true && R.rows[NAME].active === true ? true : 'app.search\'s ' + NAME + ': ' + short(R.rows[NAME]);
  }, 1000);

  test.run('the world: the wrapper\'s Chrome page', 0.2, async function () {
    if (!R.N || !R.N.up) return R_NO_NODE;
    const where = H.findChrome();
    if (!where) return 'no Chrome here: the page was not judged';
    const c = await H.chromePage(where);
    if (c.error) return 'Chrome: ' + c.error;
    R.c = c;
    return true;
  }, 2000);
  test.run('the world: the wrapper\'s face page has its spirit', 0.2, async function () {
    if (!R.c) return 'no Chrome page: the world failed';
    await R.c.send('Page.navigate', { url: R.N.base + '/face.html' });
    R.page = !!(await H.until(function () { return R.c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000));
    if (R.page) await R.c.evaluate(HANDS);
    return R.page || 'the page has no spirit: nothing judged';
  }, 2000);

  // the box, 7: "its <name>.js sets spirit.elements.<name> = { create(container, opts) -> { destroy() } }"
  test.run('its element\'s create draws into the container it is given and answers destroy', 0.2, async function () {
    if (!R.page) return R_NO_PAGE;
    const made = await R.c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:50%;height:50%"; document.body.appendChild(b); var p; try { p = spirit.require("spirit/app/' + NAME + '/element.js"); } catch (e) { return "load threw: " + e; } return Promise.resolve(p).then(function () { var E = spirit.element.spirit.app[' + JSON.stringify(NAME) + '] && spirit.element.spirit.app[' + JSON.stringify(NAME) + '].element; if (!E || typeof E.create !== "function") return "no spirit.element.spirit.app.' + NAME + '.element.create"; var m = E.create(b, {}); if (!m || typeof m.destroy !== "function") return "create answered " + typeof m; return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { var drew = b.innerHTML.length > 0; m.destroy(); b.remove(); return drew ? "ok" : "it drew nothing"; }); }, function (e) { b.remove(); return "load: " + e; }); }())');
    return made === 'ok' || NAME + ': ' + short(made);
  }, 8000);

  // the box, 3: "both show in the shell as before: a tile each, and each opens as it did"
  // The shell app, as boot.js hands it the page's app area, here in a box of its own over the page.
  test.run('the world: the shell draws its tiles, Files among them', 0.2, async function () {
    if (!R.page) return R_NO_PAGE;
    const shell = await R.c.evaluate('(function () { var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__shell = spirit.element.spirit.app.app.element.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
    return shell === 'made' && await wwaitFor('tiles().indexOf("file") !== -1', 10000) ? true : 'the shell: ' + short(shell) + ', tiles ' + short(await T('tiles()'));
  }, 1000);
  test.run('Grants has its tile, with nothing pressed', 0.2, async function () {
    if (!R.page) return R_NO_PAGE;
    return await wwaitFor('tiles().indexOf("' + NAME + '") !== -1', 6000) ? true : 'no ' + NAME + ' tile: ' + short(await T('tiles()'));
  }, 1000);

  // Grants opens as it did: its Grants and Bundles tabs, the panel configured.
  test.run('Grants\' tile opens Grants: its Grants and Bundles tabs', 0.2, async function () {
    if (!R.page) return R_NO_PAGE;
    const grPressed = await T('tile("grants")');
    R.grOpen = grPressed && await wwaitFor('tabs().indexOf("Grants") !== -1 && tabs().indexOf("Bundles") !== -1', 10000);
    return R.grOpen ? true : (grPressed ? 'Grants shows: ' + short(await T('text()')) + ', tabs ' + short(await T('tabs()')) : 'no Grants tile to press: nothing judged');
  }, 1000);
  test.run('its Grants tab draws the grants panel, configured', 0.2, async function () {
    if (!R.page) return R_NO_PAGE;
    await H.sleep(1500);
    const grText = await T('text()');
    return R.grOpen && !/not configured|could not be loaded/i.test(grText) ? true : (R.grOpen ? 'Grants: ' + short(grText) : 'Grants did not open: nothing judged');
  }, 5000);
  test.run('over the tiles one bar in view, 🔒 Grants', 0.2, async function () {
    if (!R.page) return R_NO_PAGE;
    const grBars = await T('bars()');
    return R.grOpen && grBars.length === 1 && grBars[0] === WANT.icon + ' Grants' ? true : (R.grOpen ? 'bars: ' + short(grBars) : 'Grants did not open: nothing judged');
  }, 1000);
}
