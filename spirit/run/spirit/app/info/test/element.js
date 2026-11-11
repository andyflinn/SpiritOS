'use strict';

// spirit/run/spirit/app/info/test/element.js
// The tests of spirit/app/info/element.js, and of no other module (spec: ./info.md; goal/G43.24, requirements 6 and 7). Since
// G43.24 the app is a wrapper mounted the new shell's way: all of Info is nodeInfo (spirit/element/nodeInfo.js, tested in
// spirit/element/test/nodeInfo.js). The browser file runs in node on a BARE window (rule/26): nodeInfo is put on the page
// only once the app requires it, a stand-in that keeps what the app handed it. Its manifest, its tile and its opening in a
// real Chrome are judged in its wrapper part, below.
// This is the one test file of its script (spirit/test/TEST_SYSTEM.md): the wrapper part, once a file of its own, is a
// section at its end, run after the checks above and counted with them. One test.run per test (goal/G47.2).

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/app/info/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'element.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
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
  // at spirit.element.spirit.app.info.element as it runs; nodeInfo stands where it reads it, spirit.element.spirit.element.nodeInfo.
  win.spirit = { element: { spirit: { element: els, app: {} } },
    require: function (p) {
      w.required.push(String(p));
      if (opt.refuse) return Promise.reject(new Error('not-found ' + p));
      const put = function () { if (p === 'spirit/element/nodeInfo.js') els.nodeInfo = nodeInfo; return {}; };
      return opt.held ? opt.held.then(put) : Promise.resolve(put());
    } };
  require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
  if (SRC) vm.runInContext(SRC, win, { filename: FILE });
  w.win = win; w.els = { info: (win.spirit.element.spirit.app.info || {}).element };
  return w;
}

// info.js: the Info app, a wrapper of nodeInfo. What each test made, for the tests after it.
const U = {};
const NO_APP = 'no spirit.element.spirit.app.info.element: the tests before failed';

test.run('spirit/app/info/element.js is there', 0.2, function () {
  return !!SRC || 'there is no spirit/app/info/element.js';
}, 1000);

// mounted the new shell's way (goal/G43.24, requirement 7)
test.run('it sets spirit.element.spirit.app.info.element = { create }', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/info/element.js';
  U.w = world();
  U.I = U.w.els.info;
  return !!U.I && typeof U.I.create === 'function' ? true : 'elements: ' + short(Object.keys(U.w.els));
}, 1000);
test.run('no spirit.shell.activateApp, the old shell\'s way', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/info/element.js';
  return !/\bactivateApp\b|\bspirit\.shell\b/.test(CODE) || 'info.js still mounts through spirit.shell';
}, 1000);

// a wrapper: it loads nodeInfo, and nothing of its own (requirement 6)
test.run('it requires spirit/element/nodeInfo.js, and only that', 0.2, function () {
  if (!U.w) return NO_APP;
  return JSON.stringify(U.w.required) === '["spirit/element/nodeInfo.js"]' || 'required: ' + short(U.w.required);
}, 1000);
test.run('it asks nothing itself: no verb, no api, no cache, no relay, no card', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/info/element.js';
  return !/\.verb\s*\(|\bapi\b|\boutcome\b|\bcacheManager\b|\brelay\b|\bnode\.card\b|\bcallDialog\b|\bfetch\s*\(/.test(CODE) || 'info.js still asks something of its own';
}, 1000);
test.run('it draws no markup of its own', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/info/element.js';
  return !/['"][^'"\n]*<(div|span|button|input|b)\b/.test(CODE) && !/createElement/.test(CODE) ? true : 'info.js draws markup of its own';
}, 1000);

// create(container, { open }): nodeInfo mounted into the container, handed the mounter's stack
test.run('create answers { destroy() }', 0.2, function () {
  if (!U.I || typeof U.I.create !== 'function') return NO_APP;
  U.box = node('<container>');
  U.box.innerHTML = '<p>left over</p>';
  U.open = function () {};
  U.m = U.I.create(U.box, { open: U.open });
  return !!U.m && typeof U.m.destroy === 'function' ? true : 'create answered ' + short(U.m && Object.keys(U.m));
}, 1000);
test.run('it empties its container', 0.2, async function () {
  if (!U.box) return 'create was never called';
  const left = U.box.innerHTML;
  await settle();
  return left === '' || 'left: ' + short(left);
}, 1000);
test.run('it makes nodeInfo in its container', 0.2, function () {
  if (!U.box) return 'create was never called';
  return U.w.made.length === 1 && U.w.made[0].host === U.box ? true : 'made: ' + U.w.made.length;
}, 1000);
test.run('handed { open }, the stack its mounter opens layers in, and nothing else', 0.2, function () {
  if (!U.box) return 'create was never called';
  const made = U.w.made[0];
  return made && made.opts && made.opts.open === U.open && Object.keys(made.opts).join() === 'open' ? true : 'handed: ' + short(made && made.opts);
}, 1000);
test.run('made with no opts, nodeInfo gets no open, and keeps its own stack', 0.2, async function () {
  if (!SRC) return 'there is no spirit/app/info/element.js';
  const w2 = world();
  const box2 = node('<container>');
  w2.els.info.create(box2);
  await settle();
  return w2.made.length === 1 && w2.made[0].opts && w2.made[0].opts.open === undefined ? true : 'handed: ' + short(w2.made[0] && w2.made[0].opts);
}, 1000);

// destroy
test.run('destroy destroys nodeInfo and empties its container', 0.2, function () {
  if (!U.m) return 'create was never called';
  U.m.destroy();
  return U.w.destroyed === 1 && U.box.innerHTML === '' ? true : 'destroyed ' + U.w.destroyed + ', left ' + short(U.box.innerHTML);
}, 1000);
test.run('the world: made while nodeInfo is still loading', 0.2, function () {
  if (!SRC) return 'there is no spirit/app/info/element.js';
  U.late = world({ held: new Promise(function (r) { U.letGo = r; }) });
  U.box3 = node('<container>');
  U.m3 = U.late.els.info ? U.late.els.info.create(U.box3, {}) : null;
  return !!U.m3 || 'no info.create on a loading page';
}, 1000);
test.run('destroyed before nodeInfo loads, nothing is made', 0.2, async function () {
  if (!U.m3) return 'nothing made while loading: the world failed';
  U.m3.destroy(); U.letGo(); await settle();
  return U.late.made.length === 0 && U.box3.innerHTML === '' ? true : 'made ' + U.late.made.length;
}, 1000);

// nodeInfo refused
test.run('it says Info could not be loaded.', 0.2, async function () {
  if (!SRC) return 'there is no spirit/app/info/element.js';
  const no = world({ refuse: true });
  const box4 = node('<container>');
  no.els.info.create(box4, {});
  await settle();
  return box4.textContent === 'Info could not be loaded.' && no.made.length === 0 ? true : 'said: ' + short(box4.textContent);
}, 1000);

// ── THE WRAPPER PART (once its own file; one test file per script: spirit/test/TEST_SYSTEM.md) ──
// Info IN spirit/app/, A WRAPPER MOUNTED THE NEW SHELL'S WAY (goal/G43.24, requirements 1 to 7; spec: ./element.md, section "wrapper"): the
// tests of spirit/app/info/element.js and its info.json. Andy: "i just moved them, didn't fix the manifest.", "no i want those apps
// to basically be wrappers for spirit/element/ things....", and "box that these apps must mount in the new format of the new
// shell." The tree read as it is, its own test run, then a real node on a scratch copy of the tree's files and real clicks in
// a real Chrome on /face.html, on the shell app as boot.js draws it. Neither Andy's node nor an agent's is touched.
// The wrapper part runs this file again as a child (its box 4); that child (SPIRIT_TEST_OWN_ONLY) runs the tests above only.
const os = require('os');
const { spawn, spawnSync, execSync } = require('child_process');
const REPO = path.resolve(RUN, '..', '..');
const H = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
// The box, requirement 1: "Icon and label as they were: Info ℹ️, Grants 🔒".
const NAME = 'info';
const WANT = { label: 'Info', icon: 'ℹ️' };
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-info-'));
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
  const port = await H.freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
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
const R_NO_NODE = 'no scratch node: the world failed';
const R_NO_PAGE = 'no page: the world failed';
const NOT_OPEN = 'Info did not open: nothing judged';

if (!process.env.SPIRIT_TEST_OWN_ONLY) {
  test.after(async function () {
    try { if (R.c && R.c.sock) R.c.sock.close(); } catch (e) { /* gone */ }
    try { if (R.c && R.c.kid) R.c.kid.kill(); } catch (e) { /* gone */ }
    if (R.N) await stop(R.N.child);
    if (R.s) { try { fs.rmSync(R.s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ } }
  });

  // wrapper: Info in spirit/app/, a wrapper mounted the new shell's way (goal/G43.24)
  // the box, 1: "each app has its <name>.json in the spirit/app form, as icons.json and file.json have it"
  test.run('the world: file.json, the form, has identity, mount, shell and node', 0.2, function () {
    R.fileJson = readJson(path.join(RUN, 'spirit', 'app', 'file', 'file.json')) || {};
    return same(Object.keys(R.fileJson).sort(), ['identity', 'mount', 'node', 'shell']) || 'file.json reads ' + short(R.fileJson);
  }, 1000);
  test.run('the world: spirit/app/info/info.json is there and reads', 0.2, function () {
    R.j = readJson(path.join(APP_DIR, NAME + '.json'));
    return !!R.j || 'no readable spirit/app/' + NAME + '/' + NAME + '.json: nothing judged';
  }, 1000);
  const NO_JSON = 'no info.json: the world failed';
  test.run('info.json: its identity is the icon ℹ️, the label Info, and intrinsic true', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(R.j.identity, { icon: WANT.icon, label: WANT.label, intrinsic: true }) || NAME + '.json identity: ' + short(R.j.identity);
  }, 1000);
  test.run('info.json: it mounts element.js', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(R.j.mount, { 'element.js': true }) || NAME + '.json mount: ' + short(R.j.mount);
  }, 1000);
  test.run('info.json: in the shell it mounts and has a tile, and is no shell itself', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(R.j.shell, { true: false, mount: true, tile: true }) || NAME + '.json shell: ' + short(R.j.shell);
  }, 1000);
  test.run('info.json: the node mounts no server for it', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(R.j.node, { mount: false }) || NAME + '.json node: ' + short(R.j.node);
  }, 1000);
  test.run('info.json holds what file.json holds, nothing of the old form', 0.2, function () {
    if (!R.j) return NO_JSON;
    return same(Object.keys(R.j).sort(), Object.keys(R.fileJson).sort()) || NAME + '.json keys: ' + short(Object.keys(R.j));
  }, 1000);
  test.run('Q1, the old description sentence: "it goes.", and info.json holds none', 0.2, function () {
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
  // Info: "They move into one new element, spirit/element/nodeInfo.js (Q2)".
  test.run('info.js loads spirit/element/nodeInfo.js', 0.2, function () {
    const LOADS = /['"]spirit\/element\/nodeInfo\.js['"]/;
    return LOADS.test(R.c0 || '') || 'info.js does not load spirit/element/nodeInfo.js';
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
  test.run('its own test runs from the new place: testReport.js found, its completion line printed', 0.2, function () {
    if (!fs.existsSync(OWN)) return 'no own test: the world failed';
    // This part lives in that file now: the child runs the file's own checks only (SPIRIT_TEST_OWN_ONLY), as it did when
    // this part was a file of its own, and does not run this part again.
    const r = spawnSync(process.execPath, [OWN], { cwd: RUN, encoding: 'utf8', timeout: 240000, env: Object.assign({}, process.env, { LAB_MASTER_PORT: process.env.LAB_MASTER_PORT || '45420', SPIRIT_TEST_OWN_ONLY: '1' }) });
    const out = String(r.stdout || '') + String(r.stderr || '');
    const lost = /Cannot find module[^\n]*/.exec(out);
    return !lost && /Test completed\./.test(out) ? true : (lost ? NAME + '.js: ' + short(lost[0]) : NAME + '.js printed no completion line: ' + short(out.slice(-300)));
  }, 1000);

  // the box, 5: "no file names shell/info or shell/grants any more" (shell/info)
  test.run('the world: more than five hundred of the tree\'s files are read', 0.2, function () {
    R.tracked = execSync('git ls-files --cached --others --exclude-standard', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
      .filter(function (f) { return MINE.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
    return R.tracked.length > 500 || 'only ' + R.tracked.length + ' files read: nothing judged';
  }, 1000);
  test.run('no file names shell/info', 0.2, function () {
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
    R.s = scratch();
    R.N = await boot(R.s.run);
    return R.N.up || 'the scratch node did not come up: nothing judged';
  }, 6000);

  // the box, 2: intrinsic "as spirit/app apps say it": the node says so
  test.run('the world: the node lists Files, intrinsic', 0.2, async function () {
    if (!R.N || !R.N.up) return R_NO_NODE;
    const listed = await call(R.N.base, 'app.search', { q: '' });
    R.rows = {};
    ((listed.body && listed.body.items) || []).forEach(function (i) { R.rows[i.key] = parsed(i.label) || {}; });
    return !!R.rows.file && R.rows.file.intrinsic === true ? true : 'app.search: ' + short(listed.text);
  }, 1000);
  test.run('the node lists info intrinsic, so always active', 0.2, function () {
    if (!R.rows) return R_NO_NODE;
    return !!R.rows[NAME] && R.rows[NAME].intrinsic === true && R.rows[NAME].active === true ? true : 'app.search\'s ' + NAME + ': ' + short(R.rows[NAME]);
  }, 1000);

  test.run('the world: a Chrome page', 0.2, async function () {
    if (!R.N || !R.N.up) return R_NO_NODE;
    const where = H.findChrome();
    if (!where) return 'no Chrome here: the page was not judged';
    const c = await H.chromePage(where);
    if (c.error) return 'Chrome: ' + c.error;
    R.c = c;
    return true;
  }, 2000);
  test.run('the world: the face page has its spirit', 0.2, async function () {
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
    return shell === 'made' && await waitFor('tiles().indexOf("file") !== -1', 10000) ? true : 'the shell: ' + short(shell) + ', tiles ' + short(await T('tiles()'));
  }, 1000);
  test.run('Info has its tile, with nothing pressed', 0.2, async function () {
    if (!R.page) return R_NO_PAGE;
    return await waitFor('tiles().indexOf("' + NAME + '") !== -1', 6000) ? true : 'no ' + NAME + ' tile: ' + short(await T('tiles()'));
  }, 1000);

  // Info opens as it did: its name and description fields, and the rotate button.
  test.run('Info\'s tile opens Info: its name and its description field', 0.2, async function () {
    if (!R.page) return R_NO_PAGE;
    const infoPressed = await T('tile("info")');
    R.infoOpen = !!(infoPressed && await waitFor('count("[data-field=label]") === 1 && count("[data-field=description]") === 1', 10000));
    return R.infoOpen ? true : (infoPressed ? 'Info shows: ' + short(await T('text()')) : 'no Info tile to press: nothing judged');
  }, 1000);
  test.run('Info shows its Rotate this node\'s cipher key button', 0.2, async function () {
    if (!R.infoOpen) return NOT_OPEN;
    return await waitFor('buttons().some(function (b) { return /^Rotate this node.s cipher key$/.test(b); })', 6000) ? true : 'Info\'s buttons: ' + short(await T('buttons()'));
  }, 1000);
  test.run('over the tiles one bar in view, ℹ️ Info', 0.2, async function () {
    if (!R.infoOpen) return NOT_OPEN;
    const infoBars = await T('bars()');
    return infoBars.length === 1 && infoBars[0] === WANT.icon + ' Info' ? true : 'bars: ' + short(infoBars);
  }, 1000);
  test.run('Info says nothing could not be loaded', 0.2, async function () {
    if (!R.infoOpen) return NOT_OPEN;
    return !/could not be loaded/i.test(await T('text()')) || 'Info: ' + short(await T('text()'));
  }, 1000);
  test.run('the world: Info\'s ✕ shows the tiles again', 0.2, async function () {
    if (!R.infoOpen) return NOT_OPEN;
    await T('close("Info")');
    return await waitFor('tiles().indexOf("info") !== -1', 6000) ? true : 'after ✕: ' + short(await T('text()'));
  }, 1000);
}
