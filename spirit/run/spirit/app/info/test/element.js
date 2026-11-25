'use strict';

// spirit/run/spirit/app/info/test/element.js
// The tests of spirit/app/info/element.js, and of no other module (spec: ./info.md; goal/G43.24, requirements 6 and 7). Since
// G43.24 the app is a wrapper mounted the new shell's way: all of Info is nodeInfo (spirit/element/nodeInfo/script.js, tested in
// spirit/element/nodeInfo/test/script.js). The browser file runs in node on a BARE window (rule/26): nodeInfo is put on the page
// only once the app requires it, a stand-in that keeps what the app handed it. Its manifest, its tile and its opening in a
// real Chrome are judged in its wrapper part, below.
// This is the one test file of its script (spirit/test/TEST_SYSTEM.md): the wrapper part, once a file of its own, is a
// section at its end, run after the checks above and counted with them. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/app/info/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
// A page script run as the page's loader runs it, in a module box (goal/G49.9).
const PAGE_LOAD = require(path.join(RUN, 'spirit', 'script.js')).requireScript('spirit/test/headLessChrome.js');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = SPIRIT.requireScript('spirit/test/headLessChrome.js');
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const FILE = path.join(__dirname, '..', 'element.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');

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
  const w = { required: [], made: [], destroyed: 0 };
  const els = {};
  const nodeInfo = { create: function (host, x) { const m = { host: host, opts: x, args: arguments.length, destroy: function () { w.destroyed += 1; } }; w.made.push(m); return m; } };
  const win = {
    document: { createElement: function (t) { return node('<' + t + '>'); } },
    setTimeout: setTimeout, Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String,
    console: { log: function () {}, error: function () {} },
  };
  win.window = win;
  vm.createContext(win);
  // goal/G43.32: a page's spirit (spirit/test/headLessChrome.js pageSpirit), so info.js places itself by installSpiritElement
  // at spirit.required.spirit.app.info.element as it runs; nodeInfo is what its require answers.
  win.spirit = { required: { spirit: { element: els, app: {} } },
    requireScript: function (p) {
      w.required.push(String(p));
      if (opt.refuse) return Promise.reject(new Error());
      // NODEINFO IS requireScript's ANSWER (goal/G49.9, box v5: "a test hands its stand-ins as requireScript's answers ... never by
      // writing them into spirit.required"; Andy: "spirit.requireScript must allways return either an object or a function... or
      // fail/throw"); any other path an empty object.
      const put = function () { return p === 'spirit/element/nodeInfo/script.js' ? nodeInfo : {}; };
      return opt.held ? opt.held.then(put) : Promise.resolve(put());
    } };
  SPIRIT.requireScript('spirit/test/headLessChrome.js').pageSpirit(win.spirit);
  if (SRC) PAGE_LOAD.runAsPage(FILE, win, SRC);
  w.win = win; w.els = { info: (win.spirit.required.spirit.app.info || {}).element };
  return w;
}

// info.js: the Info app, a wrapper of nodeInfo. What each test made, for the tests after it.
const U = {};

test.run('spirit/app/info/element.js is there', 0.2, function () {
  return !!SRC || false;
}, test.limit.quick);

// mounted the new shell's way (goal/G43.24, requirement 7)
test.run('it sets spirit.required.spirit.app.info.element to an object with create', 0.2, function () {
  if (!SRC) return false;
  U.w = world();
  U.I = U.w.els.info;
  return !!U.I && typeof U.I.create === 'function' ? true : false;
}, test.limit.quick);
test.run('it uses no spirit.shell.activateApp, the old shell\'s way', 0.2, function () {
  if (!SRC) return false;
  return !/\bactivateApp\b|\bspirit\.shell\b/.test(CODE) || false;
}, test.limit.quick);

// a wrapper: it loads nodeInfo, and nothing of its own (requirement 6)
test.run('it requires spirit/element/nodeInfo/script.js, and only that', 0.2, function () {
  if (!U.w) return false;
  return JSON.stringify(U.w.required) === '["spirit/element/nodeInfo/script.js"]' || false;
}, test.limit.quick);
test.run('it asks nothing itself: no verb, no api, no cache, no relay, no card', 0.2, function () {
  if (!SRC) return false;
  return !/\.verb\s*\(|\bapi\b|\boutcome\b|['"][^'"\n]*data\.js['"]|\brelay\b|\bnode\.card\b|\bcallDialog\b|\bfetch\s*\(/.test(CODE) || false;
}, test.limit.quick);
test.run('it draws no markup of its own', 0.2, function () {
  if (!SRC) return false;
  return !/['"][^'"\n]*<(div|span|button|input|b)\b/.test(CODE) && !/createElement/.test(CODE) ? true : false;
}, test.limit.quick);

// create(container, { open }): nodeInfo mounted into the container, handed the mounter's stack
test.run('create answers an object with a destroy function', 0.2, function () {
  if (!U.I || typeof U.I.create !== 'function') return false;
  U.box = node('<container>');
  U.box.innerHTML = '<p>left over</p>';
  U.open = function () {};
  U.m = U.I.create(U.box, { open: U.open });
  return !!U.m && typeof U.m.destroy === 'function' ? true : false;
}, test.limit.quick);
test.run('it empties its container', 0.2, async function () {
  if (!U.box) return false;
  const left = U.box.innerHTML;
  await settle();
  return left === '' || false;
}, test.limit.quick);
test.run('it makes nodeInfo in its container', 0.2, function () {
  if (!U.box) return false;
  return U.w.made.length === 1 && U.w.made[0].host === U.box ? true : false;
}, test.limit.quick);
test.run('nodeInfo is handed open, the stack its mounter opens layers in, and nothing else', 0.2, function () {
  if (!U.box) return false;
  const made = U.w.made[0];
  return made && made.opts && made.opts.open === U.open && Object.keys(made.opts).join() === 'open' ? true : false;
}, test.limit.quick);
test.run('made with no opts, nodeInfo gets no open, and keeps its own stack', 0.2, async function () {
  if (!SRC) return false;
  const w2 = world();
  const box2 = node('<container>');
  w2.els.info.create(box2);
  await settle();
  return w2.made.length === 1 && w2.made[0].opts && w2.made[0].opts.open === undefined ? true : false;
}, test.limit.quick);

// destroy
test.run('destroy destroys nodeInfo and empties its container', 0.2, function () {
  if (!U.m) return false;
  U.m.destroy();
  return U.w.destroyed === 1 && U.box.innerHTML === '' ? true : false;
}, test.limit.quick);
test.run('the element can be made while nodeInfo is still loading', 0.2, function () {
  if (!SRC) return false;
  U.late = world({ held: new Promise(function (r) { U.letGo = r; }) });
  U.box3 = node('<container>');
  U.m3 = U.late.els.info ? U.late.els.info.create(U.box3, {}) : null;
  return !!U.m3 || false;
}, test.limit.quick);
test.run('destroyed before nodeInfo loads, nothing is made', 0.2, async function () {
  if (!U.m3) return false;
  U.m3.destroy(); U.letGo(); await settle();
  return U.late.made.length === 0 && U.box3.innerHTML === '' ? true : false;
}, test.limit.quick);

// nodeInfo refused
test.run('when nodeInfo is refused it says Info could not be loaded.', 0.2, async function () {
  if (!SRC) return false;
  const no = world({ refuse: true });
  const box4 = node('<container>');
  no.els.info.create(box4, {});
  await settle();
  return box4.textContent === 'Info could not be loaded.' && no.made.length === 0 ? true : false;
}, test.limit.quick);

// ── THE WRAPPER PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// Info IN spirit/app/, A WRAPPER MOUNTED THE NEW SHELL'S WAY (goal/G43.24, requirements 1 to 7; spec: ./element.md, section "wrapper"): the
// tests of spirit/app/info/element.js and its info.json. Andy: "i just moved them, didn't fix the manifest.", "no i want those apps
// to basically be wrappers for spirit/element/ things....", and "box that these apps must mount in the new format of the new
// shell." The tree read as it is, its own test run, then a real node on a scratch copy of the tree's files and real clicks in
// a real Chrome on / (spirit/shell/face.html), on the shell app as boot.js draws it. Neither Andy's node nor an agent's is touched.
const os = require('os');
const { spawn, execSync } = require('child_process');
const REPO = path.resolve(RUN, '..', '..');
const H = SPIRIT.requireScript('spirit/test/headLessChrome.js');
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
// The box, requirement 1: "Icon and label as they were: Info ℹ️, Grants 🔒".
const NAME = 'info';
const WANT = { label: 'Info', icon: 'ℹ️' };
const APP_DIR = path.join(RUN, 'spirit', 'app', NAME);
// The tree's files under spirit/run, the tracked ones and the new ones not ignored, as they are on the disk.
function treeFiles() {
  return execSync('git ls-files --cached --others --exclude-standard -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 })
    .split('\n').filter(Boolean).filter(function (f) { return fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
}
function scratch() {
  const root = LABH.scratchTree().root;
  return { root: root, run: path.join(root, 'spirit', 'run') };
}
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: '', body: null }; }
}
async function boot(run) {
  const port = await H.freePort();
  const child = LABH.startNodeOn(run, port);
  const base = 'http://127.0.0.1:' + port;
  const up = await H.until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
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
// What the wrapper part's world made.
const R = {};
const T = function (expr) { return R.c.evaluate('window.__t.' + expr); };
const waitFor = function (expr, ms) { return H.until(function () { return R.c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };

{
  test.after(async function () {
    try { if (R.c && R.c.sock) R.c.sock.close(); } catch (e) { /* gone */ }
    try { if (R.c && R.c.kid) R.c.kid.kill(); } catch (e) { /* gone */ }
    if (R.N) await stop(R.N.child);
    if (R.s) { try { LABH.freeTree(R.s); } catch (e) { /* scratch */ } }
  });

  // wrapper: Info in spirit/app/, a wrapper mounted the new shell's way (goal/G43.24)
  // the box, 1: "each app has its <name>.json in the spirit/app form, as icons.json and file.json have it"
  test.run('file.json, the form, has identity, mount, shell and node', 0.2, function () {
    R.fileJson = readJson(path.join(RUN, 'spirit', 'app', 'file', 'file.json')) || {};
    return same(Object.keys(R.fileJson).sort(), ['identity', 'mount', 'node', 'shell']) || false;
  }, test.limit.quick);
  test.run('spirit/app/info/info.json is there and reads', 0.2, function () {
    R.j = readJson(path.join(APP_DIR, NAME + '.json'));
    return !!R.j || false;
  }, test.limit.quick);
  test.run('the identity in info.json is the icon ℹ️, the label Info, and intrinsic true', 0.2, function () {
    if (!R.j) return false;
    return same(R.j.identity, { icon: WANT.icon, label: WANT.label, intrinsic: true }) || false;
  }, test.limit.quick);
  test.run('info.json mounts element.js', 0.2, function () {
    if (!R.j) return false;
    return same(R.j.mount, { 'element.js': true }) || false;
  }, test.limit.quick);
  test.run('info.json says that in the shell it mounts and has a tile, and is no shell itself', 0.2, function () {
    if (!R.j) return false;
    return same(R.j.shell, { true: false, mount: true, tile: true }) || false;
  }, test.limit.quick);
  test.run('info.json says the node mounts no server for it', 0.2, function () {
    if (!R.j) return false;
    return same(R.j.node, { mount: false }) || false;
  }, test.limit.quick);
  test.run('info.json holds what file.json holds, nothing of the old form', 0.2, function () {
    if (!R.j) return false;
    return same(Object.keys(R.j).sort(), Object.keys(R.fileJson).sort()) || false;
  }, test.limit.quick);
  test.run('the old description sentence goes, and info.json holds none', 0.2, function () {
    if (!R.j) return false;
    return JSON.stringify(R.j).indexOf('"description"') === -1 || false;
  }, test.limit.quick);

  // the box, 6: "each app's <name>.js only loads spirit/element/ parts (spirit.require) and mounts them into its container"
  test.run('its element.js is there', 0.2, function () {
    R.c0 = code(path.join(APP_DIR, 'element.js'));
    return R.c0.length > 0 || false;
  }, test.limit.quick);
  test.run('it loads only spirit/element/ parts, through spirit.requireScript', 0.2, function () {
    if (!R.c0) return false;
    // What it loads: every script it names, and every spirit.requireScript.
    const named = (R.c0.match(/['"][^'"\n]*\.js['"]/g) || []).map(function (s) { return s.slice(1, -1); }).filter(function (s) { return s !== 'element.js' && s !== 'spirit/app/' + NAME + '/element.js'; }); // goal/G43.32, decided 5: its own path is where it places itself, no load
    const asks = (R.c0.match(/\brequire(?:Script)?\s*\(/g) || []).length;
    const strays = named.filter(function (s) { return !/^spirit\/element\/[^]+\.js$/.test(s); });
    return asks > 0 && named.length > 0 && !strays.length ? true : false;
  }, test.limit.quick);
  test.run('it loads no data branch of its own, requiring no data.js', 0.2, function () {
    if (!R.c0) return false;
    return !/['"][^'"\n]*data\.js['"]/.test(R.c0) || false;
  }, test.limit.quick);
  test.run('it calls no verb of its own', 0.2, function () {
    if (!R.c0) return false;
    const verbs = [/\.verb\s*\(/, /\bspirit\.outcome\b/, /\bcallDialog\b/, /\bfetch\s*\(/, /\brelay\W{1,4}status\b/, /\bnode\W{1,4}card\b/, /\bauth\W{1,4}(search|grant|revoke)\b/]
      .filter(function (re) { return re.test(R.c0); });
    return !verbs.length || false;
  }, test.limit.quick);
  test.run('as a wrapper, it draws no markup of its own', 0.2, function () {
    if (!R.c0) return false;
    const markup = R.c0.match(/['"][^'"\n]*<(div|span|button|input|table|b)\b[^'"\n]*['"]/g) || [];
    return !markup.length || false;
  }, test.limit.quick);
  // Info: "They move into one new element, spirit/element/nodeInfo/script.js (Q2)".
  test.run('info.js loads spirit/element/nodeInfo/script.js', 0.2, function () {
    const LOADS = /['"]spirit\/element\/nodeInfo\/script\.js['"]/;
    return LOADS.test(R.c0 || '') || false;
  }, test.limit.quick);

  // the box, 7: "no spirit.shell.activateApp, the old shell's way"
  test.run('it mounts through no spirit.shell.activateApp', 0.2, function () {
    const c0 = R.c0 || '';
    return c0.length > 0 && !/\bactivateApp\b/.test(c0) && !/\bspirit\.shell\b/.test(c0) ? true : false;
  }, test.limit.quick);

  // Its own test running from its new place, and no file naming its old shell/ folder (the box, 4 and 5): the move is long
  // done and shell/ is gone; a require of a file that is not there is the general test's (goal/G47.1).

  test.run('a scratch node comes up', 0.2, async function () {
    R.s = scratch();
    R.N = await boot(R.s.run);
    return R.N.up || false;
  }, test.limit.slow);

  // the box, 2: intrinsic "as spirit/app apps say it": the node says so
  test.run('the node lists Files as intrinsic', 0.2, async function () {
    if (!R.N || !R.N.up) return false;
    const listed = await call(R.N.base, 'app.search', { q: '' });
    R.rows = {};
    ((listed.body && listed.body.items) || []).forEach(function (i) { R.rows[i.key] = parsed(i.label) || {}; });
    return !!R.rows.file && R.rows.file.intrinsic === true ? true : false;
  }, test.limit.quick);
  test.run('the node lists info intrinsic, so always active', 0.2, function () {
    if (!R.rows) return false;
    return !!R.rows[NAME] && R.rows[NAME].intrinsic === true && R.rows[NAME].active === true ? true : false;
  }, test.limit.quick);

  test.run('a Chrome page opens', 0.2, async function () {
    if (!R.N || !R.N.up) return false;
    const where = H.findChrome();
    if (!where) return false;
    const c = await H.chromePage(where);
    if (c.error) return false;
    R.c = c;
    return true;
  }, test.limit.quick);
  test.run('the face page has its spirit', 0.2, async function () {
    if (!R.c) return false;
    await R.c.send('Page.navigate', { url: R.N.base + '/' });
    R.page = !!(await H.until(function () { return R.c.evaluate('!!(window.spirit && window.spirit.readyPromise && window.spirit.eventStream)'); }, 20000));
    if (R.page) await R.c.evaluate(HANDS);
    return R.page || false;
  }, test.limit.quick);

  // the box, 7: "its <name>.js sets spirit.elements.<name> = { create(container, opts) -> { destroy() } }"
  test.run('its element\'s create draws into the container it is given and answers destroy', 0.2, async function () {
    if (!R.page) return false;
    const made = await R.c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:50%;height:50%"; document.body.appendChild(b); var p; try { p = spirit.requireScript("spirit/app/' + NAME + '/element.js"); } catch (e) { return false; } return Promise.resolve(p).then(function () { var E = spirit.required.spirit.app[' + JSON.stringify(NAME) + '] && spirit.required.spirit.app[' + JSON.stringify(NAME) + '].element; if (!E || typeof E.create !== "function") return false; var m = E.create(b, {}); if (!m || typeof m.destroy !== "function") return false; return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { var drew = b.innerHTML.length > 0; m.destroy(); b.remove(); return drew ? "ok" : false; }); }, function () { b.remove(); return false; }); }())');
    return made === 'ok' || false;
  }, test.limit.slow);

  // the box, 3: "both show in the shell as before: a tile each, and each opens as it did"
  // The shell app, as boot.js hands it the page's app area, here in a box of its own over the page.
  test.run('the shell draws its tiles, Files among them', 0.2, async function () {
    if (!R.page) return false;
    const shell = await R.c.evaluate('(function () { var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.requireScript("spirit/element/script.js").then(function () { window.__shell = spirit.required.spirit.element.create(b); return "made"; }, function () { return false; }); }())');
    return shell === 'made' && await waitFor('tiles().indexOf("file") !== -1', 10000) ? true : false;
  }, test.limit.quick);
  test.run('Info has its tile, with nothing pressed', 0.2, async function () {
    if (!R.page) return false;
    return await waitFor('tiles().indexOf("' + NAME + '") !== -1', 6000) ? true : false;
  }, test.limit.quick);

  // Info opens as it did: its name and description fields, and the rotate button.
  test.run('Info\'s tile opens Info with its name and its description field', 0.2, async function () {
    if (!R.page) return false;
    const infoPressed = await T('tile("info")');
    R.infoOpen = !!(infoPressed && await waitFor('count("[data-field=label]") === 1 && count("[data-field=description]") === 1', 10000));
    return R.infoOpen ? true : false;
  }, test.limit.quick);
  test.run('Info shows its Rotate this node\'s cipher key button', 0.2, async function () {
    if (!R.infoOpen) return false;
    return await waitFor('buttons().some(function (b) { return /^Rotate this node.s cipher key$/.test(b); })', 6000) ? true : false;
  }, test.limit.quick);
  test.run('over the tiles one bar is in view, ℹ️ Info', 0.2, async function () {
    if (!R.infoOpen) return false;
    const infoBars = await T('bars()');
    return infoBars.length === 1 && infoBars[0] === WANT.icon + ' Info' ? true : false;
  }, test.limit.quick);
  test.run('Info says nothing could not be loaded', 0.2, async function () {
    if (!R.infoOpen) return false;
    return !/could not be loaded/i.test(await T('text()')) || false;
  }, test.limit.quick);
  test.run('Info\'s ✕ shows the tiles again', 0.2, async function () {
    if (!R.infoOpen) return false;
    await T('close("Info")');
    return await waitFor('tiles().indexOf("info") !== -1', 6000) ? true : false;
  }, test.limit.quick);
}
