'use strict';

// spirit/run/spirit/app/grants/test/grants.js
// The tests of spirit/app/grants/grants.js, and of no other module (spec: ./grants.md; goal/G41.5, G41.13, G41.14, G41.16,
// G41.32, G43.24). Since G43.24 the app is a wrapper mounted the new shell's way: its Grants tab is the grants panel
// (spirit/element/grantsPanel.js) configured with the contacts and the panel's own grantsPanel.nodeGrants, both tested in
// spirit/element/test/grantsPanel.js; its Bundles tab is the bundle editor. The browser file runs in node on a BARE window
// (rule/26): each element is put on the page only once the app requires it, a stand-in that keeps what the app handed it.
// Then the bundle lines of goal/G41.32, judged by real clicks in the Grants app as the shell app opens it, on /face.html of
// a real node on a scratch copy of the tree's files. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn, execSync } = require('child_process');
// spirit/app/grants/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'grants.js');
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
  const FILES = { 'spirit/element/tabContainer.js': 'tabContainer', 'spirit/element/bundleEditor.js': 'bundleEditor', 'spirit/element/grantsPanel.js': 'grantsPanel' };
  // goal/G43.32: the parts stand where grants.js reads them, at spirit.element.spirit.element.<name>; a page's spirit
  // (spirit/test/headLessChrome.js pageSpirit), so grants.js places itself at spirit.element.spirit.app.grants.grants as it runs.
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
      const put = function () { if (FILES[p]) page[FILES[p]] = E[FILES[p]]; return {}; };
      return opt.held ? opt.held.then(put) : Promise.resolve(put());
    } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.els = { grants: (win.spirit.element.spirit.app.grants || {}).grants }; w.NODE_GRANTS = NODE_GRANTS;
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
  ok(!!SRC, 'spirit/app/grants/grants.js is there', 'there is no spirit/app/grants/grants.js');
  if (!SRC) return;

  test.subHeading('mounted the new shell\'s way (goal/G43.24, requirement 7)');
  const w = world();
  const G = w.els.grants;
  ok(!!G && typeof G.create === 'function', 'it sets spirit.element.spirit.app.grants.grants = { create }', 'elements: ' + short(Object.keys(w.els)));
  if (!G) return;
  ok(!/\bactivateApp\b|\bspirit\.shell\b/.test(CODE), 'no spirit.shell.activateApp, the old shell\'s way', 'grants.js still mounts through spirit.shell');
  ok(!/shellCreateListSearch|api\.ui\.elements|apiBranchSelector/.test(CODE), 'nothing of the old shell: no shellCreateListSearch, no api.ui.elements, no apiBranchSelector', 'grants.js still names one');

  test.subHeading('a wrapper: it loads the panel, the tabs and the bundle editor, and nothing of its own (requirement 6)');
  ['spirit/element/grantsPanel.js', 'spirit/element/tabContainer.js', 'spirit/element/bundleEditor.js'].forEach(function (p) {
    ok(w.required.indexOf(p) !== -1, 'it requires ' + p, 'required: ' + short(w.required));
  });
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
  ok(Object.keys(ed.opts).sort().join() === 'tabLabel,tabs', 'and nothing else: no api handed', 'handed: ' + short(Object.keys(ed.opts)));

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
    ok(!!serverBundle, 'the world: and a server\'s bundle, ' + (serverBundle && serverBundle.label), 'no bundle of a server on the scratch node: read-only judges nothing');

    await chrome.send('Page.navigate', { url: base + '/face.html' });
    ok(await H.until(function () { return chrome.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.events)'); }, 20000), 'the world: the face page has its spirit', 'the page has no spirit: nothing judged');
    // The shell app, as boot.js hands it the page's app area, here in a box of its own over the page.
    const made = await chrome.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/shell/shell.js").then(function () { window.__shell = spirit.element.spirit.app.shell.shell.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
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
    ok(paneText.indexOf(WORDS) !== -1, 'it says "' + WORDS + '"', 'not said: ' + short(paneText.slice(-300)));
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
      ok((await tabNamed(serverBundle.owner + '-' + serverBundle.label)).length === 1, 'its tab names owner-bundle: ' + serverBundle.owner + '-' + serverBundle.label, 'tabs: ' + short(await tabs()));
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
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
