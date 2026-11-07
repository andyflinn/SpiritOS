'use strict';

// spirit/run/spirit/app/test/infoGrants.js
// INFO AND GRANTS IN spirit/app/, WRAPPERS MOUNTED THE NEW SHELL'S WAY (goal/G43.24, requirements 1 to 7; spec: ./infoGrants.md).
// Andy: "i just moved them, didn't fix the manifest.", "no i want those apps to basically be wrappers for spirit/element/
// things....", and "box that these apps must mount in the new format of the new shell." The tree read as it is, the two
// moved tests run, then a real node on a scratch copy of the tree's files and real clicks in a real Chrome on /face.html, on
// the shell app as boot.js draws it. Neither Andy's node nor an agent's is touched. Requirement 8 (the rotate key dialog) is
// judged by spirit/element/test/nodeInfoRotate.js.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// The box, requirement 1: "Icon and label as they were: Info ℹ️, Grants 🔒".
const APPS = { info: { label: 'Info', icon: 'ℹ️' }, grants: { label: 'Grants', icon: '🔒' } };
const APP_DIR = function (name) { return path.join(RUN, 'spirit', 'app', name); };
// This item's own red files: they must name the old paths to judge them.
const MINE = ['spirit/run/spirit/app/test/infoGrants.js', 'spirit/run/spirit/app/test/infoGrants.md',
  'spirit/run/spirit/element/test/nodeInfoRotate.js', 'spirit/run/spirit/element/test/nodeInfoRotate.md'];

// The tree's files under spirit/run, the tracked ones and the new ones not ignored, as they are on the disk.
function treeFiles() {
  return execSync('git ls-files --cached --others --exclude-standard -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
}
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-ig-'));
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

test.startTest('infoGrants.js: Info and Grants in spirit/app/, wrappers mounted the new shell\'s way (goal/G43.24)');

(async function () {
  // ── 1. THE MANIFESTS ────────────────────────────────────────────────────────────────────────────────────────────────
  test.subHeading('the box, 1: "each app has its <name>.json in the spirit/app form, as icons.json and file.json have it"');
  const fileJson = readJson(path.join(APP_DIR('file'), 'file.json')) || {};
  ok(same(Object.keys(fileJson).sort(), ['identity', 'mount', 'node', 'shell']), 'the world: file.json, the form, has identity, mount, shell and node', 'file.json reads ' + short(fileJson));
  Object.keys(APPS).forEach(function (name) {
    const want = APPS[name];
    const j = readJson(path.join(APP_DIR(name), name + '.json'));
    ok(!!j, 'the world: spirit/app/' + name + '/' + name + '.json is there and reads', 'no readable spirit/app/' + name + '/' + name + '.json: nothing judged');
    if (!j) return;
    ok(same(j.identity, { icon: want.icon, label: want.label, intrinsic: true }), name + '.json: identity {icon ' + want.icon + ', label ' + want.label + ', intrinsic: true}', name + '.json identity: ' + short(j.identity));
    const mount = {}; mount[name + '.js'] = true;
    ok(same(j.mount, mount), name + '.json: mount {"' + name + '.js": true}', name + '.json mount: ' + short(j.mount));
    ok(same(j.shell, { true: false, mount: true, tile: true }), name + '.json: shell {true: false, mount: true, tile: true}', name + '.json shell: ' + short(j.shell));
    ok(same(j.node, { mount: false }), name + '.json: node {mount: false}', name + '.json node: ' + short(j.node));
    ok(same(Object.keys(j).sort(), Object.keys(fileJson).sort()), name + '.json holds what file.json holds, nothing of the old form', name + '.json keys: ' + short(Object.keys(j)));
    ok(JSON.stringify(j).indexOf('"description"') === -1, 'Q1, the old description sentence: "it goes." (' + name + '.json)', name + '.json still says a description: ' + short(j.description));
  });

  // ── 2. INTRINSIC BY THEIR OWN <name>.json ─────────────────────────────────────────────────────────────────────────
  test.subHeading('the box, 2: "both are intrinsic by their own <name>.json, as spirit/app apps say it"');
  let core = null;
  try { core = require(path.join(RUN, 'spirit', 'coreFiles.js')); } catch (e) { core = null; }
  ok(!!core && Array.isArray(core.INTRINSIC) && core.INTRINSIC.length > 0 && typeof core.appIntrinsic === 'function', 'the world: coreFiles.js answers its INTRINSIC list (' + (core && core.INTRINSIC ? core.INTRINSIC.length : 0) + ') and appIntrinsic', 'coreFiles.js: no INTRINSIC list or no appIntrinsic: nothing judged');
  if (core && Array.isArray(core.INTRINSIC)) {
    ['shell/info', 'shell/grants'].forEach(function (f) {
      ok(core.INTRINSIC.map(function (x) { return String(x).toLowerCase(); }).indexOf(f) === -1, f + ' leaves coreFiles.js\'s INTRINSIC list', 'coreFiles.js INTRINSIC still lists ' + f + ': ' + short(core.INTRINSIC));
    });
    Object.keys(APPS).forEach(function (name) {
      ok(core.appIntrinsic(REPO, name) === true, 'coreFiles.appIntrinsic reads ' + name + ' intrinsic from its own ' + name + '.json', 'appIntrinsic(' + name + '): ' + short(core.appIntrinsic(REPO, name)));
    });
  }
  const oldShell = code(path.join(RUN, 'spirit', 'client', 'shell.js'));
  const folders = /INTRINSIC_APP_FOLDERS\s*=\s*\[([^\]]*)\]/.exec(oldShell);
  ok(!!folders, 'the world: the old shell\'s INTRINSIC_APP_FOLDERS is found in client/shell.js', 'no INTRINSIC_APP_FOLDERS in client/shell.js: nothing judged');
  if (folders) {
    const listed = (folders[1].match(/['"]([^'"]*)['"]/g) || []).map(function (s) { return s.slice(1, -1); });
    ['info', 'grants'].forEach(function (f) {
      ok(listed.indexOf(f) === -1, f + ' leaves the old shell\'s INTRINSIC_APP_FOLDERS', 'INTRINSIC_APP_FOLDERS still names ' + f + ': ' + short(listed));
    });
  }

  // ── 6. WRAPPERS OF spirit/element/ ────────────────────────────────────────────────────────────────────────────────
  test.subHeading('the box, 6: "each app\'s <name>.js only loads spirit/element/ parts (spirit.require) and mounts them into its container"');
  Object.keys(APPS).forEach(function (name) {
    const c = code(path.join(APP_DIR(name), name + '.js'));
    ok(c.length > 0, 'the world: spirit/app/' + name + '/' + name + '.js is there', 'no spirit/app/' + name + '/' + name + '.js: nothing judged');
    if (!c) return;
    // What it loads: every script it names, and every spirit.require.
    const named = (c.match(/['"][^'"\n]*\.js['"]/g) || []).map(function (s) { return s.slice(1, -1); }).filter(function (s) { return s !== name + '.js'; });
    const asks = (c.match(/\brequire\s*\(/g) || []).length;
    const strays = named.filter(function (s) { return !/^spirit\/element\/[^]+\.js$/.test(s); });
    ok(asks > 0 && named.length > 0 && !strays.length, name + '.js loads only spirit/element/ parts, through spirit.require (' + named.join(', ') + ')', asks && named.length ? name + '.js loads what is no element: ' + short(strays) : name + '.js loads nothing through spirit.require: nothing judged');
    ok(!/\bcacheManager\s*\(/.test(c), name + '.js loads no data family of its own (no cacheManager)', name + '.js asks a cacheManager itself');
    const verbs = [/\.verb\s*\(/, /\bspirit\.outcome\b/, /\bcallDialog\b/, /\bfetch\s*\(/, /\brelay\W{1,4}status\b/, /\bnode\W{1,4}card\b/, /\bauth\W{1,4}(search|grant|revoke)\b/]
      .filter(function (re) { return re.test(c); }).map(String);
    ok(!verbs.length, name + '.js calls no verb of its own', name + '.js still calls: ' + short(verbs));
    const markup = c.match(/['"][^'"\n]*<(div|span|button|input|table|b)\b[^'"\n]*['"]/g) || [];
    ok(!markup.length, name + '.js draws no markup of its own', name + '.js draws: ' + short(markup));
  });
  // Grants: "Still its own: the panel's data source, auth.search and auth.grant / auth.revoke over the auth cache (GR_GRANTS). It moves into grantsPanel."
  const panel = code(path.join(RUN, 'spirit', 'element', 'grantsPanel.js'));
  ok(panel.length > 0, 'the world: spirit/element/grantsPanel.js is there', 'no grantsPanel.js: nothing judged');
  ['search', 'grant', 'revoke'].forEach(function (v) {
    ok(new RegExp('\\bauth\\W{1,4}' + v + '\\b').test(panel), 'Grants\' data source moves into grantsPanel: it asks auth.' + v, 'grantsPanel.js asks no auth.' + v);
  });
  ok(/\bdata\.auth\b|cacheManager\s*\(\s*['"]auth['"]/.test(panel), 'grantsPanel holds the auth cache it reads (spirit.data.auth)', 'grantsPanel.js reads no auth cache');
  // Info: "the page layout, the relays ... (relay.status), the card ... (node.card), the rotate button ... They move into one new element, spirit/element/nodeInfo.js (Q2)".
  const nodeInfo = code(path.join(RUN, 'spirit', 'element', 'nodeInfo.js'));
  ok(nodeInfo.length > 0, 'Q2: spirit/element/nodeInfo.js is there', 'no spirit/element/nodeInfo.js');
  ok(/['"]spirit\/element\/nodeInfo\.js['"]/.test(code(path.join(APP_DIR('info'), 'info.js'))), 'info.js loads spirit/element/nodeInfo.js', 'info.js does not load spirit/element/nodeInfo.js');
  ok(/\brelay\W{1,4}status\b/.test(nodeInfo), 'nodeInfo asks relay.status, the relays this node holds a seat on', 'nodeInfo.js asks no relay.status');
  ok(/\bnode\W{1,4}card\b/.test(nodeInfo), 'nodeInfo puts the card into the node cache (node.card)', 'nodeInfo.js asks no node.card');
  ok(/Rotate this node/.test(nodeInfo), 'nodeInfo draws the rotate button', 'nodeInfo.js draws no rotate button');

  // ── 7. THE NEW SHELL'S WAY ─────────────────────────────────────────────────────────────────────────────────────────
  test.subHeading('the box, 7: "no spirit.shell.activateApp, the old shell\'s way"');
  Object.keys(APPS).forEach(function (name) {
    const c = code(path.join(APP_DIR(name), name + '.js'));
    ok(c.length > 0 && !/\bactivateApp\b/.test(c) && !/\bspirit\.shell\b/.test(c), name + '.js mounts through no spirit.shell.activateApp', c.length ? name + '.js still calls spirit.shell.activateApp' : 'no ' + name + '.js: nothing judged');
  });

  // ── 4. THE MOVED TESTS FIND THE RUN ROOT ───────────────────────────────────────────────────────────────────────────
  test.subHeading('the box, 4: "info/test/info.js and grants/test/grants.js find the run root at their new depth"');
  Object.keys(APPS).forEach(function (name) {
    const f = path.join(APP_DIR(name), 'test', name + '.js');
    ok(fs.existsSync(f), 'the world: spirit/app/' + name + '/test/' + name + '.js is there', 'no spirit/app/' + name + '/test/' + name + '.js: nothing judged');
    if (!fs.existsSync(f)) return;
    const r = spawnSync(process.execPath, [f], { cwd: RUN, encoding: 'utf8', timeout: 240000, env: Object.assign({}, process.env, { LAB_MASTER_PORT: process.env.LAB_MASTER_PORT || '45420' }) });
    const out = String(r.stdout || '') + String(r.stderr || '');
    const lost = /Cannot find module[^\n]*/.exec(out);
    ok(!lost && /Test completed\./.test(out), name + '/test/' + name + '.js runs from the new place: testReport.js found, its completion line printed',
      lost ? name + '.js: ' + short(lost[0]) : name + '.js printed no completion line: ' + short(out.slice(-300)));
  });

  // ── 5. NOTHING NAMES THE OLD PLACES ────────────────────────────────────────────────────────────────────────────────
  test.subHeading('the box, 5: "no file names shell/info or shell/grants any more"');
  const tracked = execSync('git ls-files --cached --others --exclude-standard', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return MINE.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
  ok(tracked.length > 500, 'the world: the tree\'s files are read (' + tracked.length + ')', 'only ' + tracked.length + ' files read: nothing judged');
  const OLD = /shell\/(info|grants)(?![\w-])/;
  const naming = tracked.filter(function (f) {
    let t = '';
    try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; }
    return t.indexOf('\u0000') === -1 && OLD.test(t);
  });
  ok(!naming.length, 'no file names shell/info or shell/grants', naming.length + ' files still name them: ' + naming.join(', '));

  // ── 3, 2, 6, 7 ON THE PAGE ─────────────────────────────────────────────────────────────────────────────────────────
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
    Object.keys(APPS).forEach(function (name) {
      const r = rows[name];
      ok(!!r && r.intrinsic === true && r.active === true, 'the node lists ' + name + ' intrinsic, so always active', 'app.search\'s ' + name + ': ' + short(r));
    });

    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.events)'); }, 20000), 'the world: the face page has its spirit', 'the page has no spirit: nothing judged');
    await c.evaluate(HANDS);
    const T = function (expr) { return c.evaluate('window.__t.' + expr); };
    const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };

    test.subHeading('the box, 7: "its <name>.js sets spirit.elements.<name> = { create(container, opts) -> { destroy() } }"');
    for (const name of Object.keys(APPS)) {
      const made = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:50%;height:50%"; document.body.appendChild(b); var p; try { p = spirit.require("spirit/app/' + name + '/' + name + '.js"); } catch (e) { return "load threw: " + e; } return Promise.resolve(p).then(function () { var E = spirit.elements && spirit.elements.' + name + '; if (!E || typeof E.create !== "function") return "no spirit.elements.' + name + '.create"; var m = E.create(b, {}); if (!m || typeof m.destroy !== "function") return "create answered " + typeof m; return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { var drew = b.innerHTML.length > 0; m.destroy(); b.remove(); return drew ? "ok" : "it drew nothing"; }); }, function (e) { b.remove(); return "load: " + e; }); }())');
      ok(made === 'ok', 'spirit.elements.' + name + '.create(container, opts) draws into it and answers { destroy() }', name + ': ' + short(made));
    }

    test.subHeading('the box, 3: "both show in the shell as before: a tile each, and each opens as it did"');
    // The shell app, as boot.js hands it the page's app area, here in a box of its own over the page.
    const shell = await c.evaluate('(function () { var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/shell/shell.js").then(function () { window.__shell = spirit.elements.shell.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
    ok(shell === 'made' && await waitFor('tiles().indexOf("file") !== -1', 10000), 'the world: the shell draws its tiles, Files among them', 'the shell: ' + short(shell) + ', tiles ' + short(await T('tiles()')));
    for (const name of Object.keys(APPS)) {
      ok(await waitFor('tiles().indexOf("' + name + '") !== -1', 6000), APPS[name].label + ' has its tile, with nothing pressed', 'no ' + name + ' tile: ' + short(await T('tiles()')));
    }

    // Info opens as it did: its name and description fields, and the rotate button.
    const infoPressed = await T('tile("info")');
    const infoOpen = infoPressed && await waitFor('count("[data-field=label]") === 1 && count("[data-field=description]") === 1', 10000);
    ok(infoOpen, 'Info\'s tile opens Info: its name and its description field', infoPressed ? 'Info shows: ' + short(await T('text()')) : 'no Info tile to press: nothing judged');
    ok(infoOpen && await waitFor('buttons().some(function (b) { return /^Rotate this node.s cipher key$/.test(b); })', 6000), 'Info shows its Rotate this node\'s cipher key button', infoOpen ? 'Info\'s buttons: ' + short(await T('buttons()')) : 'Info did not open: nothing judged');
    const infoBars = await T('bars()');
    ok(infoOpen && infoBars.length === 1 && infoBars[0] === APPS.info.icon + ' Info', 'over the tiles one bar in view, ' + APPS.info.icon + ' Info', infoOpen ? 'bars: ' + short(infoBars) : 'Info did not open: nothing judged');
    ok(infoOpen && !/could not be loaded/i.test(await T('text()')), 'Info says nothing could not be loaded', infoOpen ? 'Info: ' + short(await T('text()')) : 'Info did not open: nothing judged');
    if (infoOpen) await T('close("Info")');
    ok(infoOpen && await waitFor('tiles().indexOf("grants") !== -1', 6000), 'the world: Info\'s ✕ shows the tiles again', infoOpen ? 'after ✕: ' + short(await T('text()')) : 'Info did not open: nothing judged');

    // Grants opens as it did: its Grants and Bundles tabs, the panel configured.
    const grPressed = await T('tile("grants")');
    const grOpen = grPressed && await waitFor('tabs().indexOf("Grants") !== -1 && tabs().indexOf("Bundles") !== -1', 10000);
    ok(grOpen, 'Grants\' tile opens Grants: its Grants and Bundles tabs', grPressed ? 'Grants shows: ' + short(await T('text()')) + ', tabs ' + short(await T('tabs()')) : 'no Grants tile to press: nothing judged');
    await sleep(1500);
    const grText = await T('text()');
    ok(grOpen && !/not configured|could not be loaded/i.test(grText), 'its Grants tab draws the grants panel, configured', grOpen ? 'Grants: ' + short(grText) : 'Grants did not open: nothing judged');
    const grBars = await T('bars()');
    ok(grOpen && grBars.length === 1 && grBars[0] === APPS.grants.icon + ' Grants', 'over the tiles one bar in view, ' + APPS.grants.icon + ' Grants', grOpen ? 'bars: ' + short(grBars) : 'Grants did not open: nothing judged');
  } finally {
    try { if (c && c.sock) c.sock.close(); } catch (e) { /* gone */ }
    try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    if (N) await stop(N.child);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
