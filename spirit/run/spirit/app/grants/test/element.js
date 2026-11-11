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
// section at its end, run after the checks above and counted with them.

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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('grants.js: the Grants app, a wrapper of the grants panel and the bundle editor');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  ok(!!SRC, 'spirit/app/grants/element.js is there', 'there is no spirit/app/grants/element.js');
  if (!SRC) return;

  test.subHeading('mounted the new shell\'s way (goal/G43.24, requirement 7)');
  const w = world();
  const G = w.els.grants;
  ok(!!G && typeof G.create === 'function', 'it sets spirit.element.spirit.app.grants.element = { create }', 'elements: ' + short(Object.keys(w.els)));
  if (!G) return;
  ok(!/\bactivateApp\b|\bspirit\.shell\b/.test(CODE), 'no spirit.shell.activateApp, the old shell\'s way', 'grants.js still mounts through spirit.shell');
  ok(!/shellCreateListSearch|api\.ui\.elements|apiBranchSelector/.test(CODE), 'nothing of the old shell: no shellCreateListSearch, no api.ui.elements, no apiBranchSelector', 'grants.js still names one');

  test.subHeading('a wrapper: it loads the panel, the tabs and the bundle editor, and nothing of its own (requirement 6)');
  ok(w.required.indexOf('spirit/element/search/grant/grantsPanel.js') !== -1, 'it requires spirit/element/search/grant/grantsPanel.js', 'required: ' + short(w.required));
  ok(w.required.indexOf('spirit/element/tabContainer.js') !== -1, 'it requires spirit/element/tabContainer.js', 'required: ' + short(w.required));
  ok(w.required.indexOf('spirit/element/bundleEditor.js') !== -1, 'it requires spirit/element/bundleEditor.js', 'required: ' + short(w.required));
  ok(w.required.length === 3, 'and nothing else', 'required: ' + short(w.required));
  // goal/G43.24: "Still its own: the panel's data source, auth.search and auth.grant / auth.revoke over the auth cache
  // (GR_GRANTS). It moves into grantsPanel."
  ok(!/\.verb\s*\(|\bapi\b|\bauth\.|\bcacheManager\b|\bspirit\.data\b|\boutcome\b|\bfetch\s*\(/.test(CODE), 'it asks nothing itself: no verb, no api, no auth verb, no cache of its own', 'grants.js still asks or keeps something of its own');
  ok(!/['"][^'"\n]*<(div|span|button|input|table|b)\b/.test(CODE) && !/createElement|probabilitySearch|grantList|[cC]ontactSelector|[bB]undleSelector/.test(CODE),
    'it draws nothing itself: no markup, no list, no selector of its own', 'grants.js still draws or builds something of its own');

  const box = node('<container>');
  box.innerHTML = '<p>left over</p>';
  const m = G.create(box, {});
  ok(!!m && typeof m.destroy === 'function', 'create(container, opts) answers { destroy() }', 'create answered ' + short(m && Object.keys(m)));
  ok(box.innerHTML === '', 'it empties its container', 'left: ' + short(box.innerHTML));
  await settle();

  test.subHeading('two tabs: Grants, the grants panel; Bundles, the bundle editor (goal/G41.13)');
  const tabs = w.tabs[0];
  const list = tabs ? (tabs.opts.tabs || []) : [];
  ok(w.tabs.length === 1 && tabs.host === box, 'one tabContainer, in its container', 'tabContainers: ' + w.tabs.length);
  ok(JSON.stringify(list.map(function (t) { return [t.name, t.label]; })) === '[["grants","Grants"],["bundles","Bundles"]]', 'its tabs: grants (Grants), then bundles (Bundles)', 'tabs: ' + short(list.map(function (t) { return [t.name, t.label]; })));
  if (list.length !== 2 || typeof list[0].mount !== 'function' || typeof list[1].mount !== 'function') return;
  const gbox = node('<grants-tab>');
  const gp = list[0].mount(gbox);
  const p = w.panels[0];
  ok(w.panels.length === 1 && p.host === gbox && gp === p, 'the Grants tab is the grants panel, made in the tab\'s box and answered to it', 'panels: ' + w.panels.length);
  if (!p) return;

  test.subHeading('the app configures the panel: the contacts, and the node\'s grants (goal/G41.16)');
  // Andy: "the callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel element".
  ok(p.cfg.ids && p.cfg.ids.table === 'loopback://api/contact/search', 'its ID table is the contacts\', loopback://api/contact/search', 'ids: ' + short(p.cfg.ids));
  ok(p.cfg.grants === w.NODE_GRANTS, 'its grants table is the node\'s, the one the panel offers by name: grantsPanel.nodeGrants', 'grants: ' + short(p.cfg.grants));
  // Andy: "every fucking element gets the interfaces it needs".
  ok(Object.keys(p.cfg).sort().join() === 'grants,ids', 'and nothing else: no api handed', 'handed: ' + short(Object.keys(p.cfg)));

  test.subHeading('the Bundles tab: the bundle editor, opening its tabs in this tab row (goal/G41.32)');
  const bbox = node('<bundles-tab>');
  const be = list[1].mount(bbox);
  const ed = w.editors[0];
  ok(w.editors.length === 1 && ed.host === bbox && be === ed, 'the Bundles tab is the bundle editor, made in the tab\'s box', 'editors: ' + w.editors.length);
  if (!ed) return;
  // Andy: "in the Grants app, this will be the grant app's tabContainer."
  ok(ed.opts && ed.opts.tabs === tabs, 'handed the app\'s own tabContainer to open each bundle\'s tab in', 'tabs handed: ' + (ed.opts && ed.opts.tabs === tabs));
  // Andy: "Grants: <owner>-<bundle>."
  const tl = ed.opts && ed.opts.tabLabel;
  ok(typeof tl === 'function' && tl({ owner: 'node', label: 'Reader' }) === 'node-Reader' && tl({ owner: 'agent', label: 'Jobs' }) === 'agent-Jobs' && tl({ label: 'Lone' }) === 'node-Lone',
    'each tab named owner-bundle (node when no owner is said)', 'tabLabel: ' + short(typeof tl === 'function' ? [tl({ owner: 'node', label: 'Reader' }), tl({ label: 'Lone' })] : tl));
  ok(Object.keys(ed.opts).sort().join() === 'tabLabel,tabs', 'and the bundle editor is handed nothing else: no api', 'handed: ' + short(Object.keys(ed.opts)));

  test.subHeading('destroy');
  m.destroy();
  ok(tabs.destroyed === 1 && box.innerHTML === '', 'destroy destroys its tabs and empties its container', 'tabs destroyed ' + tabs.destroyed + ', left ' + short(box.innerHTML));
  let letGo = null;
  const late = world({ held: new Promise(function (r) { letGo = r; }) });
  const box2 = node('<container>');
  const m2 = late.els.grants.create(box2, {});
  m2.destroy(); letGo(); await settle();
  ok(late.tabs.length === 0, 'destroyed before its elements load, nothing is made', 'tabContainers made: ' + late.tabs.length);
  const no = world({ refuse: ['spirit/element/bundleEditor.js'] });
  const box3 = node('<container>');
  no.els.grants.create(box3, {});
  await settle();
  ok(box3.textContent === 'Grants could not be loaded.' && no.tabs.length === 0, 'an element refused: Grants could not be loaded.', 'said: ' + short(box3.textContent));

  // GOAL/G41.32, IN A REAL BROWSER ON A SCRATCH NODE. THE BOX: "the bundleSelector:pane looses both the 'Edit' button and the
  // 'Delete' Button. when some clicks on a (selects) a bundle row, a new closable tab opens in the tabContainer configured in
  // the bundleSelector:pane"; "if a bundle already has an branchEditor-tab in the configured tabContainer, that tab will
  // become the active tab"; "in the Grants app, this will be the grant app's tabContainer."; "i need the branchEditor to have
  // a rowForm at the bottom: [❌] "Delete <bundle-name> bundle and branches " [Delete (armingButton)]."; "a bundle that hears
  // its deletion, closes its branchEditor tab."; "A user can only create, change and delete node-owned bundles and branches,
  // and sees the others read-only". What a person sees is judged: a press is a real click on what is drawn, in the Grants
  // app the shell app opens from its tile (goal/G43.24: "both show in the shell as before").
  const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
  const s = scratch();
  let child = null;
  let chrome = null;
  try {
    const port = await H.freePort();
    child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: s.run, stdio: 'ignore' });
    const base = 'http://127.0.0.1:' + port;
    const home = async function (verb, args) {
      try {
        const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
        const text = await r.text();
        return { status: r.status, text: text, body: parsed(text) };
      } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
    };
    const up = await H.until(function () { return home('api').then(function (r) { return r.status === 200; }); }, 60000);
    if (!up) { test.fail('the scratch node did not come up: nothing judged'); return; }
    const where = H.findChrome();
    if (!where) { test.fail('no Chrome here: nothing judged'); return; }
    chrome = await H.chromePage(where);
    if (chrome.error) { test.fail('Chrome: ' + chrome.error); return; }
    // A real click on the innermost visible thing whose words are these, inside the shell's box (or the selector given).
    const LEAF = 'function leaf(words, within) { var root = document.querySelector(within || "#zzBox"); if (!root) return null; var all = Array.prototype.slice.call(root.querySelectorAll("*")); return all.filter(function (e) { return e.offsetParent !== null && e.textContent.trim() === words && !Array.prototype.some.call(e.children, function (c) { return c.textContent.trim() === words; }); })[0] || null; }';
    const click = function (words, within) { return chrome.evaluate('(function () { ' + LEAF + ' var e = leaf(' + JSON.stringify(words) + ', ' + JSON.stringify(within || '') + '); if (!e) return false; e.click(); return true; }())'); };
    const shown = function (words) { return chrome.evaluate('(function () { ' + LEAF + ' return !!leaf(' + JSON.stringify(words) + ', ""); }())'); };
    const pageText = function () { return chrome.evaluate('(function () { var b = document.getElementById("zzBox"); return b ? b.innerText : ""; }())').then(String); };
    const IN = 'document.getElementById("zzBox").querySelectorAll';
    const tabs = function () { return chrome.evaluate('JSON.stringify(Array.prototype.slice.call(' + IN + '(".tab-button")).filter(function (b) { return b.offsetParent !== null; }).map(function (b) { return { text: b.textContent.trim(), on: b.getAttribute("aria-selected") === "true" }; }))').then(function (t) { return JSON.parse(t || '[]'); }); };
    const tabNamed = async function (label) { return (await tabs()).filter(function (t) { return t.text.indexOf(label) !== -1; }); };
    const waitFor = function (fn, ms) { return H.until(fn, ms || 5000); };

    const one = await home('auth.bundle', { op: 'add', label: 'zzOne' });
    const two = await home('auth.bundle', { op: 'add', label: 'zzTwo' });
    const three = await home('auth.bundle', { op: 'add', label: 'zzThree' });
    ok(one.status === 200 && two.status === 200 && three.status === 200, 'the world: three bundles of the node\'s stand', 'nothing judged: ' + short(one.text));
    await home('auth.branch', { op: 'add', bundle: one.body && one.body.id, family: 'node', verb: 'card' });
    const all = await home('auth.bundle', { op: 'search', text: '' });
    const rows = ((all.body && all.body.items) || []).map(function (i) { return parsed(i.label) || {}; });
    const serverBundle = rows.filter(function (r) { return r.owner && r.owner !== 'node'; })[0];
    ok(!!serverBundle, 'the world: and a server\'s bundle', 'no bundle of a server on the scratch node: read-only judges nothing');

    await chrome.send('Page.navigate', { url: base + '/face.html' });
    ok(await H.until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000), 'the world: the face page has its spirit', 'the page has no spirit: nothing judged');
    // The shell app, as boot.js hands it the page's app area, here in a box of its own over the page.
    const made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__shell = spirit.element.spirit.app.app.element.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
    ok(made === 'made', 'the world: the shell app is drawn', 'the shell: ' + short(made));
    const tile = await waitFor(function () { return chrome.evaluate('(function () { var t = document.querySelector("#zzBox .app-icon[data-key=grants]"); if (!t || t.offsetParent === null) return false; t.click(); return true; }())'); }, 15000);
    ok(tile, 'the Grants app\'s tile is pressed', 'no Grants tile: nothing judged');
    await waitFor(function () { return tabNamed('Bundles').then(function (t) { return t.length > 0; }); }, 10000);
    ok(await click('Bundles', '#zzBox .tab-button') || await click('Bundles'), 'its Bundles tab is pressed', 'no Bundles tab: nothing judged');
    await waitFor(function () { return shown('zzOne'); }, 8000);

    test.subHeading('goal/G41.32: the pane has no Edit and no Delete');
    ok(await shown('zzOne'), 'the pane lists the bundles', 'zzOne is not listed: ' + short(await pageText()));
    ok(!(await shown('Edit')), 'no Edit button', 'an Edit button is still there');
    ok(!(await shown('Delete')), 'no Delete button', 'a Delete button is still there');

    test.subHeading('goal/G41.32: a row pressed opens its tab, in the app\'s own tab row');
    ok((await tabs()).length === 2, 'the app has its two tabs', 'tabs: ' + short(await tabs()));
    ok(await click('zzOne'), 'zzOne is pressed', 'no row to press');
    await waitFor(function () { return tabNamed('zzOne').then(function (t) { return t.length > 0; }); });
    const tOne = await tabNamed('zzOne');
    ok(tOne.length === 1 && tOne[0].on, 'a tab for it opens, and is active', 'tabs: ' + short(await tabs()));
    // Andy, on what he saw: "the tabs should name owner-bundle".
    ok(tOne.length === 1 && tOne[0].text.indexOf('node-zzOne') !== -1, 'the tab names owner-bundle: node-zzOne', 'tabs: ' + short(await tabs()));
    const place = await chrome.evaluate('(function () { var c = document.querySelector("#zzBox [data-tab-close]"); if (!c) return null; var b = c.closest(".tab-button") || c.parentElement; var r = c.getBoundingClientRect(), o = b.getBoundingClientRect(); return { right: r.right <= o.right + 1 && r.left > o.left + (o.width / 3), small: r.width <= o.width / 2 }; }())');
    ok(!!place && place.right && place.small, 'its close button is small, on the tab\'s right side', 'close button: ' + short(place));

    test.subHeading('goal/G41.32: the branchEditor\'s Delete row');
    const WORDS = 'Delete zzOne bundle and branches';
    await waitFor(function () { return pageText().then(function (t) { return t.indexOf(WORDS) !== -1; }); });
    const paneText = await pageText();
    ok(paneText.indexOf(WORDS) !== -1, 'it says "Delete zzOne bundle and branches"', 'not said: ' + short(paneText.slice(-300)));
    const atBottom = await chrome.evaluate('(function () { var forms = Array.prototype.slice.call(' + IN + '(".shell-row-form")).filter(function (f) { return f.offsetParent !== null && !f.querySelector(".app-container-close"); }); var last = forms[forms.length - 1]; if (!last) return null; return { icon: last.textContent.indexOf("❌") !== -1, words: last.textContent.indexOf(' + JSON.stringify(WORDS) + ') !== -1, button: !!last.querySelector("button"), below: forms.length > 1 && forms[0].getBoundingClientRect().top < last.getBoundingClientRect().top }; }())');
    ok(!!atBottom && atBottom.icon && atBottom.words && atBottom.button && atBottom.below, 'in a rowForm below the others, ❌, the words, a button', 'the row: ' + short(atBottom));

    test.subHeading('goal/G41.32: a bundle already open: its tab is made active');
    ok(await click('Bundles', '#zzBox .tab-button') || await click('Bundles'), 'back to the Bundles tab', 'no way back to the Bundles tab');
    await waitFor(function () { return shown('zzTwo'); });
    await click('zzOne', '#zzBox .bundle-selector-face-pane');
    await H.sleep(800);
    const again = await tabNamed('zzOne');
    ok(again.length === 1 && again[0].on, 'zzOne pressed again: no second tab, its tab is active', 'tabs: ' + short(await tabs()));

    test.subHeading('goal/G41.32: the close button takes the tab away, the bundle stays');
    const closed = await chrome.evaluate('(function () { var c = Array.prototype.slice.call(' + IN + '("[data-tab-close]"))[0]; if (!c) return false; c.click(); return true; }())');
    await waitFor(function () { return tabNamed('zzOne').then(function (t) { return t.length === 0; }); });
    ok(closed === true && (await tabNamed('zzOne')).length === 0, 'the tab is gone', 'tabs: ' + short(await tabs()));
    ok((await home('auth.bundle', { op: 'get', id: one.body.id })).status === 200, 'the bundle is there', 'closing a tab deleted the bundle');

    test.subHeading('goal/G41.32: the Delete row deletes, by the arming button, and the tab closes');
    await click('Bundles', '#zzBox .tab-button');
    await waitFor(function () { return shown('zzTwo'); });
    await click('zzTwo', '#zzBox .bundle-selector-face-pane');
    await waitFor(function () { return pageText().then(function (t) { return t.indexOf('Delete zzTwo bundle and branches') !== -1; }); });
    const hadTwo = (await tabNamed('zzTwo')).length === 1;
    const DELBTN = 'Array.prototype.slice.call(' + IN + '(".shell-row-form")).filter(function (f) { return f.offsetParent !== null && f.textContent.indexOf("Delete zzTwo") !== -1; })[0]';
    const pressedOnce = await chrome.evaluate('(function () { var f = ' + DELBTN + '; var b = f && f.querySelector("button"); if (!b) return false; b.click(); return true; }())');
    await H.sleep(500);
    ok(pressedOnce === true && (await home('auth.bundle', { op: 'get', id: two.body.id })).status === 200, 'one press only arms: the bundle stays', 'one press: pressed ' + pressedOnce + ', the bundle answered ' + (await home('auth.bundle', { op: 'get', id: two.body.id })).status);
    await chrome.evaluate('(function () { var f = ' + DELBTN + '; var b = f && f.querySelector("button"); if (b) b.click(); }())');
    await waitFor(function () { return home('auth.bundle', { op: 'get', id: two.body.id }).then(function (a) { return a.status !== 200; }); });
    ok((await home('auth.bundle', { op: 'get', id: two.body.id })).status !== 200, 'the second press deletes it', 'the bundle is still there after two presses');
    await waitFor(function () { return tabNamed('zzTwo').then(function (t) { return t.length === 0; }); });
    ok(hadTwo && (await tabNamed('zzTwo')).length === 0, 'and its tab closes', hadTwo ? 'tabs: ' + short(await tabs()) : 'zzTwo never had a tab: nothing judged');

    test.subHeading('goal/G41.32: a bundle deleted elsewhere closes its tab');
    await click('Bundles', '#zzBox .tab-button');
    await waitFor(function () { return shown('zzThree'); });
    await click('zzThree', '#zzBox .bundle-selector-face-pane');
    await waitFor(function () { return tabNamed('zzThree').then(function (t) { return t.length === 1; }); });
    const hadThree = (await tabNamed('zzThree')).length === 1;
    ok(hadThree, 'zzThree has its tab', 'tabs: ' + short(await tabs()));
    await home('auth.bundle', { op: 'delete', id: three.body.id });
    await waitFor(function () { return tabNamed('zzThree').then(function (t) { return t.length === 0; }); });
    ok(hadThree && (await tabNamed('zzThree')).length === 0, 'deleted at the door, its tab closes by itself', hadThree ? 'the tab stayed: ' + short(await tabs()) : 'zzThree never had a tab: nothing judged');

    test.subHeading('goal/G41.32: a server\'s bundle is read-only');
    if (serverBundle) {
      await click('Bundles', '#zzBox .tab-button');
      await waitFor(function () { return shown(serverBundle.label); });
      ok(await click(serverBundle.label, '#zzBox .bundle-selector-face-pane'), 'its row opens', 'no row for ' + serverBundle.label);
      await waitFor(function () { return tabNamed(serverBundle.label).then(function (t) { return t.length === 1; }); });
      ok((await tabNamed(serverBundle.owner + '-' + serverBundle.label)).length === 1, 'its tab names owner-bundle', 'tabs: ' + short(await tabs()));
      // The panel's own title bar (panel.js, ✕) is a rowForm too: it is the shell's, not the bundle's.
      const editable = await chrome.evaluate('JSON.stringify(Array.prototype.slice.call(' + IN + '(".shell-row-form")).filter(function (f) { return f.offsetParent !== null && !f.querySelector(".app-container-close"); }).map(function (f) { return f.textContent.trim().slice(0, 60); }))');
      ok(JSON.parse(editable || '[]').length === 0, 'no add form and no Delete row on it', 'forms on a read-only bundle: ' + editable);
      const delBtns = await chrome.evaluate('Array.prototype.slice.call(' + IN + '("button")).filter(function (b) { return b.offsetParent !== null && /delete/i.test(b.textContent); }).length');
      ok(delBtns === 0, 'and no Delete on its branches', delBtns + ' Delete buttons on a read-only bundle');
      ok((await pageText()).indexOf(serverBundle.label) !== -1, 'its branches are there to read, under its label', 'the page does not name it');
      const refused = await home('auth.bundle', { op: 'delete', id: serverBundle.id });
      ok(refused.status >= 400 && refused.status < 500 && !!(refused.body && refused.body.code), 'and the node refuses its delete at the door, with a code', 'auth.bundle delete of a server\'s bundle: ' + refused.status + ' ' + short(refused.text));
    }

    test.subHeading('goal/G41.32: with no tabContainer configured, the pane lists and a press throws nothing');
    // "in the agent app, this will be the tabContainer in the center tab of the workBench, oos for this item. and Edit/Delete
    // in the bundleSelector:pane go anyway."
    const mark = chrome.heard.length;
    await chrome.evaluate('Promise.resolve(window.spirit.require("spirit/element/bundleEditor.js")).then(function () { var h = document.createElement("div"); h.id = "zzAgentLike"; h.style.cssText = "position:absolute;left:0;top:0;width:100%;height:300px;background:#fff;z-index:10000"; document.body.appendChild(h); window.spirit.element.spirit.element.bundleEditor.create(h, {}); return true; })');
    await waitFor(function () { return chrome.evaluate('(function () { ' + LEAF + ' return !!leaf("zzOne", "#zzAgentLike"); }())'); }, 5000);
    const noBtn = await chrome.evaluate('Array.prototype.slice.call(document.querySelectorAll("#zzAgentLike button")).filter(function (b) { return /^(Edit|Delete)$/.test(b.textContent.trim()); }).length');
    ok(noBtn === 0, 'no Edit or Delete there either', noBtn + ' Edit or Delete buttons with no tabContainer');
    ok(await click('zzOne', '#zzAgentLike'), 'a row there is pressed', 'no zzOne row with no tabContainer: ' + short(await chrome.evaluate('(document.getElementById("zzAgentLike") || {}).innerText || ""')));
    await H.sleep(500);
    const threw = chrome.heard.slice(mark).filter(function (x) { return x.method === 'Runtime.exceptionThrown'; }).map(function (x) { return x.params.exceptionDetails.text + ' ' + short((x.params.exceptionDetails.exception || {}).description || ''); });
    ok(!threw.length, 'a press on a row throws nothing', 'it threw: ' + threw.slice(0, 2).join(' | '));
  } finally {
    try { if (chrome && chrome.sock) chrome.sock.close(); if (chrome && chrome.kid) chrome.kid.kill(); } catch (e) { /* gone */ }
    try { if (chrome && chrome.profile) fs.rmSync(chrome.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    await stop(child);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { return null; }, function (e) { test.fail('the test threw ' + (e && e.stack || e)); return 0; })
  .then(async function (failExit) {
    // The folded parts, in order, after the checks above; one count and one report for the whole file.
    // The wrapper part runs this file again as a child (its box 4); that child runs the checks above only.
    for (const part of (process.env.SPIRIT_TEST_OWN_ONLY ? [] : [wrapperPart])) {
      try { await part(); } catch (e) { test.fail('the ' + part.name.replace(/Part$/, '') + ' part threw ' + (e && e.stack || e)); }
    }
    test.reportSuccessFailureCount();
    process.exit(failExit === null ? (0) : failExit);
  });

// ── THE WRAPPER PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
async function wrapperPart() {
  // Grants IN spirit/app/, A WRAPPER MOUNTED THE NEW SHELL'S WAY (goal/G43.24, requirements 1 to 7; spec: ./element.md, section "wrapper"): the
  // tests of spirit/app/grants/element.js and its grants.json. Andy: "i just moved them, didn't fix the manifest.", "no i want those apps
  // to basically be wrappers for spirit/element/ things....", and "box that these apps must mount in the new format of the new
  // shell." The tree read as it is, its own test run, then a real node on a scratch copy of the tree's files and real clicks in
  // a real Chrome on /face.html, on the shell app as boot.js draws it. Neither Andy's node nor an agent's is touched.

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { spawn, spawnSync, execSync } = require('child_process');
  const RUN = path.resolve(__dirname, '..', '..', '..', '..');
  const REPO = path.resolve(RUN, '..', '..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
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

  // The tree's files under spirit/run, the tracked ones and the new ones not ignored, as they are on the disk.
  function treeFiles() {
    return execSync('git ls-files --cached --others --exclude-standard -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
  }
  function scratch() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-grants-'));
    treeFiles().forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
    return { root: root, run: path.join(root, 'spirit', 'run') };
  }
  async function call(base, verb, args) {
    try {
      const r = await fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    } catch (e) { return { status: 0, text: String(e && e.message), body: null }; }
  }
  async function boot(run) {
    const port = await freePort();
    const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
    const base = 'http://127.0.0.1:' + port;
    const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
    return { child: child, base: base, up: !!up };
  }
  function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

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

  test.subHeading('wrapper: Grants in spirit/app/, a wrapper mounted the new shell\'s way (goal/G43.24)');

  await (async function () {
    test.subHeading('the box, 1: "each app has its <name>.json in the spirit/app form, as icons.json and file.json have it"');
    const fileJson = readJson(path.join(RUN, 'spirit', 'app', 'file', 'file.json')) || {};
    ok(same(Object.keys(fileJson).sort(), ['identity', 'mount', 'node', 'shell']), 'the world: file.json, the form, has identity, mount, shell and node', 'file.json reads ' + short(fileJson));
    const j = readJson(path.join(APP_DIR, NAME + '.json'));
    ok(!!j, 'the world: spirit/app/grants/grants.json is there and reads', 'no readable spirit/app/' + NAME + '/' + NAME + '.json: nothing judged');
    if (j) {
      ok(same(j.identity, { icon: WANT.icon, label: WANT.label, intrinsic: true }), 'grants.json: its identity is the icon 🔒, the label Grants, and intrinsic true', NAME + '.json identity: ' + short(j.identity));
      const mount = { 'element.js': true };
      ok(same(j.mount, mount), 'grants.json: it mounts element.js', NAME + '.json mount: ' + short(j.mount));
      ok(same(j.shell, { true: false, mount: true, tile: true }), 'grants.json: in the shell it mounts and has a tile, and is no shell itself', NAME + '.json shell: ' + short(j.shell));
      ok(same(j.node, { mount: false }), 'grants.json: the node mounts no server for it', NAME + '.json node: ' + short(j.node));
      ok(same(Object.keys(j).sort(), Object.keys(fileJson).sort()), 'grants.json holds what file.json holds, nothing of the old form', NAME + '.json keys: ' + short(Object.keys(j)));
      ok(JSON.stringify(j).indexOf('"description"') === -1, 'Q1, the old description sentence: "it goes.", and grants.json holds none', NAME + '.json still says a description: ' + short(j.description));
    }

    test.subHeading('the box, 6: "each app\'s <name>.js only loads spirit/element/ parts (spirit.require) and mounts them into its container"');
    const c0 = code(path.join(APP_DIR, 'element.js'));
    ok(c0.length > 0, 'the world: its element.js is there', 'no spirit/app/' + NAME + '/' + NAME + '.js: nothing judged');
    if (c0) {
      // What it loads: every script it names, and every spirit.require.
      const named = (c0.match(/['"][^'"\n]*\.js['"]/g) || []).map(function (s) { return s.slice(1, -1); }).filter(function (s) { return s !== 'element.js' && s !== 'spirit/app/' + NAME + '/element.js'; }); // goal/G43.32, decided 5: its own path is where it places itself, no load
      const asks = (c0.match(/\brequire\s*\(/g) || []).length;
      const strays = named.filter(function (s) { return !/^spirit\/element\/[^]+\.js$/.test(s); });
      ok(asks > 0 && named.length > 0 && !strays.length, 'it loads only spirit/element/ parts, through spirit.require', asks && named.length ? NAME + '.js loads what is no element: ' + short(strays) : NAME + '.js loads nothing through spirit.require: nothing judged');
      ok(!/\bcacheManager\s*\(/.test(c0), 'it loads no data family of its own (no cacheManager)', NAME + '.js asks a cacheManager itself');
      const verbs = [/\.verb\s*\(/, /\bspirit\.outcome\b/, /\bcallDialog\b/, /\bfetch\s*\(/, /\brelay\W{1,4}status\b/, /\bnode\W{1,4}card\b/, /\bauth\W{1,4}(search|grant|revoke)\b/]
        .filter(function (re) { return re.test(c0); }).map(String);
      ok(!verbs.length, 'it calls no verb of its own', NAME + '.js still calls: ' + short(verbs));
      const markup = c0.match(/['"][^'"\n]*<(div|span|button|input|table|b)\b[^'"\n]*['"]/g) || [];
      ok(!markup.length, 'as a wrapper, it draws no markup of its own', NAME + '.js draws: ' + short(markup));
    }

    test.subHeading('the box, 7: "no spirit.shell.activateApp, the old shell\'s way"');
    ok(c0.length > 0 && !/\bactivateApp\b/.test(c0) && !/\bspirit\.shell\b/.test(c0), 'it mounts through no spirit.shell.activateApp', c0.length ? NAME + '.js still calls spirit.shell.activateApp' : 'no ' + NAME + '.js: nothing judged');

    test.subHeading('the box, 4: "info/test/info.js and grants/test/grants.js find the run root at their new depth"');
    const own = path.join(APP_DIR, 'test', 'element.js');
    ok(fs.existsSync(own), 'the world: its own test is there', 'no spirit/app/' + NAME + '/test/' + NAME + '.js: nothing judged');
    if (fs.existsSync(own)) {
      // This part lives in that file now: the child runs the file's own checks only (SPIRIT_TEST_OWN_ONLY), as it did when
      // this part was a file of its own, and does not run this part again.
      const r = spawnSync(process.execPath, [own], { cwd: RUN, encoding: 'utf8', timeout: 240000, env: Object.assign({}, process.env, { LAB_MASTER_PORT: process.env.LAB_MASTER_PORT || '45420', SPIRIT_TEST_OWN_ONLY: '1' }) });
      const out = String(r.stdout || '') + String(r.stderr || '');
      const lost = /Cannot find module[^\n]*/.exec(out);
      ok(!lost && /Test completed\./.test(out), 'its own test runs from the new place: testReport.js found, its completion line printed',
        lost ? NAME + '.js: ' + short(lost[0]) : NAME + '.js printed no completion line: ' + short(out.slice(-300)));
    }

    test.subHeading('the box, 5: "no file names shell/info or shell/grants any more" (shell/' + NAME + ')');
    const tracked = execSync('git ls-files --cached --others --exclude-standard', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
      .filter(function (f) { return MINE.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
    ok(tracked.length > 500, 'the world: more than five hundred of the tree\'s files are read', 'only ' + tracked.length + ' files read: nothing judged');
    const OLD = new RegExp('shell/' + NAME + '(?![\\w-])');
    const naming = tracked.filter(function (f) {
      let t = '';
      try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; }
      return t.indexOf('\u0000') === -1 && OLD.test(t);
    });
    ok(!naming.length, 'no file names shell/grants', naming.length + ' files still name it: ' + naming.join(', '));

    const s = scratch();
    let N = null;
    let c = null;
    try {
      N = await boot(s.run);
      ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
      if (!N.up) return;

      test.subHeading('the box, 2: intrinsic "as spirit/app apps say it": the node says so');
      const listed = await call(N.base, 'app.search', { q: '' });
      const rows = {};
      ((listed.body && listed.body.items) || []).forEach(function (i) { rows[i.key] = parsed(i.label) || {}; });
      ok(!!rows.file && rows.file.intrinsic === true, 'the world: the node lists Files, intrinsic', 'app.search: ' + short(listed.text));
      ok(!!rows[NAME] && rows[NAME].intrinsic === true && rows[NAME].active === true, 'the node lists grants intrinsic, so always active', 'app.search\'s ' + NAME + ': ' + short(rows[NAME]));

      const where = findChrome();
      if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
      c = await chromePage(where);
      if (c.error) { test.fail('Chrome: ' + c.error); return; }
      await c.send('Page.navigate', { url: N.base + '/face.html' });
      ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000), 'the world: the wrapper\'s face page has its spirit', 'the page has no spirit: nothing judged');
      await c.evaluate(HANDS);
      const T = function (expr) { return c.evaluate('window.__t.' + expr); };
      const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };

      test.subHeading('the box, 7: "its <name>.js sets spirit.elements.<name> = { create(container, opts) -> { destroy() } }"');
      const made = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:50%;height:50%"; document.body.appendChild(b); var p; try { p = spirit.require("spirit/app/' + NAME + '/element.js"); } catch (e) { return "load threw: " + e; } return Promise.resolve(p).then(function () { var E = spirit.element.spirit.app[' + JSON.stringify(NAME) + '] && spirit.element.spirit.app[' + JSON.stringify(NAME) + '].element; if (!E || typeof E.create !== "function") return "no spirit.element.spirit.app.' + NAME + '.element.create"; var m = E.create(b, {}); if (!m || typeof m.destroy !== "function") return "create answered " + typeof m; return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { var drew = b.innerHTML.length > 0; m.destroy(); b.remove(); return drew ? "ok" : "it drew nothing"; }); }, function (e) { b.remove(); return "load: " + e; }); }())');
      ok(made === 'ok', 'its element\'s create draws into the container it is given and answers destroy', NAME + ': ' + short(made));

      test.subHeading('the box, 3: "both show in the shell as before: a tile each, and each opens as it did"');
      // The shell app, as boot.js hands it the page's app area, here in a box of its own over the page.
      const shell = await c.evaluate('(function () { var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__shell = spirit.element.spirit.app.app.element.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
      ok(shell === 'made' && await waitFor('tiles().indexOf("file") !== -1', 10000), 'the world: the shell draws its tiles, Files among them', 'the shell: ' + short(shell) + ', tiles ' + short(await T('tiles()')));
      ok(await waitFor('tiles().indexOf("' + NAME + '") !== -1', 6000), 'Grants has its tile, with nothing pressed', 'no ' + NAME + ' tile: ' + short(await T('tiles()')));

      // Grants opens as it did: its Grants and Bundles tabs, the panel configured.
      const grPressed = await T('tile("grants")');
      const grOpen = grPressed && await waitFor('tabs().indexOf("Grants") !== -1 && tabs().indexOf("Bundles") !== -1', 10000);
      ok(grOpen, 'Grants\' tile opens Grants: its Grants and Bundles tabs', grPressed ? 'Grants shows: ' + short(await T('text()')) + ', tabs ' + short(await T('tabs()')) : 'no Grants tile to press: nothing judged');
      await sleep(1500);
      const grText = await T('text()');
      ok(grOpen && !/not configured|could not be loaded/i.test(grText), 'its Grants tab draws the grants panel, configured', grOpen ? 'Grants: ' + short(grText) : 'Grants did not open: nothing judged');
      const grBars = await T('bars()');
      ok(grOpen && grBars.length === 1 && grBars[0] === WANT.icon + ' Grants', 'over the tiles one bar in view, 🔒 Grants', grOpen ? 'bars: ' + short(grBars) : 'Grants did not open: nothing judged');

    } finally {
      try { if (c && c.sock) c.sock.close(); } catch (e) { /* gone */ }
      try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
      if (N) await stop(N.child);
      try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}
