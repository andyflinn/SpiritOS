'use strict';

// spirit/run/spirit/app/info/test/element.js
// The tests of spirit/app/info/element.js, and of no other module (spec: ./info.md; goal/G43.24, requirements 6 and 7). Since
// G43.24 the app is a wrapper mounted the new shell's way: all of Info is nodeInfo (spirit/element/nodeInfo.js, tested in
// spirit/element/test/nodeInfo.js). The browser file runs in node on a BARE window (rule/26): nodeInfo is put on the page
// only once the app requires it, a stand-in that keeps what the app handed it. Its manifest, its tile and its opening in a
// real Chrome are judged in its wrapper part, below.
// This is the one test file of its script (spirit/test/TEST_SYSTEM.md): the wrapper part, once a file of its own, is a
// section at its end, run after the checks above and counted with them.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
// spirit/app/info/test/ -> the run root, four up.
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'element.js');
const SRC = fs.existsSync(FILE) ? fs.readFileSync(FILE, 'utf8') : '';
const CODE = SRC.replace(/\/\/.*$/gm, '');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

test.startTest('info.js: the Info app, a wrapper of nodeInfo');
process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

(async function () {
  ok(!!SRC, 'spirit/app/info/element.js is there', 'there is no spirit/app/info/element.js');
  if (!SRC) return;

  test.subHeading('mounted the new shell\'s way (goal/G43.24, requirement 7)');
  const w = world();
  const I = w.els.info;
  ok(!!I && typeof I.create === 'function', 'it sets spirit.element.spirit.app.info.element = { create }', 'elements: ' + short(Object.keys(w.els)));
  if (!I) return;
  ok(!/\bactivateApp\b|\bspirit\.shell\b/.test(CODE), 'no spirit.shell.activateApp, the old shell\'s way', 'info.js still mounts through spirit.shell');

  test.subHeading('a wrapper: it loads nodeInfo, and nothing of its own (requirement 6)');
  ok(JSON.stringify(w.required) === '["spirit/element/nodeInfo.js"]', 'it requires spirit/element/nodeInfo.js, and only that', 'required: ' + short(w.required));
  ok(!/\.verb\s*\(|\bapi\b|\boutcome\b|\bcacheManager\b|\brelay\b|\bnode\.card\b|\bcallDialog\b|\bfetch\s*\(/.test(CODE), 'it asks nothing itself: no verb, no api, no cache, no relay, no card', 'info.js still asks something of its own');
  ok(!/['"][^'"\n]*<(div|span|button|input|b)\b/.test(CODE) && !/createElement/.test(CODE), 'it draws no markup of its own', 'info.js draws markup of its own');

  test.subHeading('create(container, { open }): nodeInfo mounted into the container, handed the mounter\'s stack');
  const box = node('<container>');
  box.innerHTML = '<p>left over</p>';
  const open = function () {};
  const m = I.create(box, { open: open });
  ok(!!m && typeof m.destroy === 'function', 'create answers { destroy() }', 'create answered ' + short(m && Object.keys(m)));
  ok(box.innerHTML === '', 'it empties its container', 'left: ' + short(box.innerHTML));
  await settle();
  ok(w.made.length === 1 && w.made[0].host === box, 'it makes nodeInfo in its container', 'made: ' + w.made.length);
  ok(w.made[0] && w.made[0].opts && w.made[0].opts.open === open && Object.keys(w.made[0].opts).join() === 'open', 'handed { open }, the stack its mounter opens layers in, and nothing else', 'handed: ' + short(w.made[0] && w.made[0].opts));
  const w2 = world();
  const box2 = node('<container>');
  w2.els.info.create(box2);
  await settle();
  ok(w2.made.length === 1 && w2.made[0].opts && w2.made[0].opts.open === undefined, 'made with no opts, nodeInfo gets no open, and keeps its own stack', 'handed: ' + short(w2.made[0] && w2.made[0].opts));

  test.subHeading('destroy');
  m.destroy();
  ok(w.destroyed === 1 && box.innerHTML === '', 'destroy destroys nodeInfo and empties its container', 'destroyed ' + w.destroyed + ', left ' + short(box.innerHTML));
  let letGo = null;
  const late = world({ held: new Promise(function (r) { letGo = r; }) });
  const box3 = node('<container>');
  const m3 = late.els.info ? late.els.info.create(box3, {}) : null;
  ok(!!m3, 'the world: made while nodeInfo is still loading', 'no info.create on a loading page');
  if (m3) { m3.destroy(); letGo(); await settle(); }
  ok(late.made.length === 0 && box3.innerHTML === '', 'destroyed before nodeInfo loads, nothing is made', 'made ' + late.made.length);

  test.subHeading('nodeInfo refused');
  const no = world({ refuse: true });
  const box4 = node('<container>');
  no.els.info.create(box4, {});
  await settle();
  ok(box4.textContent === 'Info could not be loaded.' && no.made.length === 0, 'it says Info could not be loaded.', 'said: ' + short(box4.textContent));
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
  // Info IN spirit/app/, A WRAPPER MOUNTED THE NEW SHELL'S WAY (goal/G43.24, requirements 1 to 7; spec: ./element.md, section "wrapper"): the
  // tests of spirit/app/info/element.js and its info.json. Andy: "i just moved them, didn't fix the manifest.", "no i want those apps
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

  test.subHeading('wrapper: Info in spirit/app/, a wrapper mounted the new shell\'s way (goal/G43.24)');

  await (async function () {
    test.subHeading('the box, 1: "each app has its <name>.json in the spirit/app form, as icons.json and file.json have it"');
    const fileJson = readJson(path.join(RUN, 'spirit', 'app', 'file', 'file.json')) || {};
    ok(same(Object.keys(fileJson).sort(), ['identity', 'mount', 'node', 'shell']), 'the world: file.json, the form, has identity, mount, shell and node', 'file.json reads ' + short(fileJson));
    const j = readJson(path.join(APP_DIR, NAME + '.json'));
    ok(!!j, 'the world: spirit/app/' + NAME + '/' + NAME + '.json is there and reads', 'no readable spirit/app/' + NAME + '/' + NAME + '.json: nothing judged');
    if (j) {
      ok(same(j.identity, { icon: WANT.icon, label: WANT.label, intrinsic: true }), NAME + '.json: identity {icon ' + WANT.icon + ', label ' + WANT.label + ', intrinsic: true}', NAME + '.json identity: ' + short(j.identity));
      const mount = { 'element.js': true };
      ok(same(j.mount, mount), NAME + '.json: mount {"' + NAME + '.js": true}', NAME + '.json mount: ' + short(j.mount));
      ok(same(j.shell, { true: false, mount: true, tile: true }), NAME + '.json: shell {true: false, mount: true, tile: true}', NAME + '.json shell: ' + short(j.shell));
      ok(same(j.node, { mount: false }), NAME + '.json: node {mount: false}', NAME + '.json node: ' + short(j.node));
      ok(same(Object.keys(j).sort(), Object.keys(fileJson).sort()), NAME + '.json holds what file.json holds, nothing of the old form', NAME + '.json keys: ' + short(Object.keys(j)));
      ok(JSON.stringify(j).indexOf('"description"') === -1, 'Q1, the old description sentence: "it goes." (' + NAME + '.json)', NAME + '.json still says a description: ' + short(j.description));
    }

    test.subHeading('the box, 6: "each app\'s <name>.js only loads spirit/element/ parts (spirit.require) and mounts them into its container"');
    const c0 = code(path.join(APP_DIR, 'element.js'));
    ok(c0.length > 0, 'the world: spirit/app/' + NAME + '/' + NAME + '.js is there', 'no spirit/app/' + NAME + '/' + NAME + '.js: nothing judged');
    if (c0) {
      // What it loads: every script it names, and every spirit.require.
      const named = (c0.match(/['"][^'"\n]*\.js['"]/g) || []).map(function (s) { return s.slice(1, -1); }).filter(function (s) { return s !== 'element.js' && s !== 'spirit/app/' + NAME + '/element.js'; }); // goal/G43.32, decided 5: its own path is where it places itself, no load
      const asks = (c0.match(/\brequire\s*\(/g) || []).length;
      const strays = named.filter(function (s) { return !/^spirit\/element\/[^]+\.js$/.test(s); });
      ok(asks > 0 && named.length > 0 && !strays.length, NAME + '.js loads only spirit/element/ parts, through spirit.require (' + named.join(', ') + ')', asks && named.length ? NAME + '.js loads what is no element: ' + short(strays) : NAME + '.js loads nothing through spirit.require: nothing judged');
      ok(!/\bcacheManager\s*\(/.test(c0), NAME + '.js loads no data family of its own (no cacheManager)', NAME + '.js asks a cacheManager itself');
      const verbs = [/\.verb\s*\(/, /\bspirit\.outcome\b/, /\bcallDialog\b/, /\bfetch\s*\(/, /\brelay\W{1,4}status\b/, /\bnode\W{1,4}card\b/, /\bauth\W{1,4}(search|grant|revoke)\b/]
        .filter(function (re) { return re.test(c0); }).map(String);
      ok(!verbs.length, NAME + '.js calls no verb of its own', NAME + '.js still calls: ' + short(verbs));
      const markup = c0.match(/['"][^'"\n]*<(div|span|button|input|table|b)\b[^'"\n]*['"]/g) || [];
      ok(!markup.length, NAME + '.js draws no markup of its own', NAME + '.js draws: ' + short(markup));
    }
    // Info: "They move into one new element, spirit/element/nodeInfo.js (Q2)".
    ok(/['"]spirit\/element\/nodeInfo\.js['"]/.test(c0), 'info.js loads spirit/element/nodeInfo.js', 'info.js does not load spirit/element/nodeInfo.js');

    test.subHeading('the box, 7: "no spirit.shell.activateApp, the old shell\'s way"');
    ok(c0.length > 0 && !/\bactivateApp\b/.test(c0) && !/\bspirit\.shell\b/.test(c0), NAME + '.js mounts through no spirit.shell.activateApp', c0.length ? NAME + '.js still calls spirit.shell.activateApp' : 'no ' + NAME + '.js: nothing judged');

    test.subHeading('the box, 4: "info/test/info.js and grants/test/grants.js find the run root at their new depth"');
    const own = path.join(APP_DIR, 'test', 'element.js');
    ok(fs.existsSync(own), 'the world: spirit/app/' + NAME + '/test/' + NAME + '.js is there', 'no spirit/app/' + NAME + '/test/' + NAME + '.js: nothing judged');
    if (fs.existsSync(own)) {
      // This part lives in that file now: the child runs the file's own checks only (SPIRIT_TEST_OWN_ONLY), as it did when
      // this part was a file of its own, and does not run this part again.
      const r = spawnSync(process.execPath, [own], { cwd: RUN, encoding: 'utf8', timeout: 240000, env: Object.assign({}, process.env, { LAB_MASTER_PORT: process.env.LAB_MASTER_PORT || '45420', SPIRIT_TEST_OWN_ONLY: '1' }) });
      const out = String(r.stdout || '') + String(r.stderr || '');
      const lost = /Cannot find module[^\n]*/.exec(out);
      ok(!lost && /Test completed\./.test(out), NAME + '/test/' + NAME + '.js runs from the new place: testReport.js found, its completion line printed',
        lost ? NAME + '.js: ' + short(lost[0]) : NAME + '.js printed no completion line: ' + short(out.slice(-300)));
    }

    test.subHeading('the box, 5: "no file names shell/info or shell/grants any more" (shell/' + NAME + ')');
    const tracked = execSync('git ls-files --cached --others --exclude-standard', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
      .filter(function (f) { return MINE.indexOf(f) === -1 && fs.existsSync(path.join(REPO, f)) && fs.statSync(path.join(REPO, f)).isFile(); });
    ok(tracked.length > 500, 'the world: the tree\'s files are read (' + tracked.length + ')', 'only ' + tracked.length + ' files read: nothing judged');
    const OLD = new RegExp('shell/' + NAME + '(?![\\w-])');
    const naming = tracked.filter(function (f) {
      let t = '';
      try { t = fs.readFileSync(path.join(REPO, f), 'utf8'); } catch (e) { return false; }
      return t.indexOf('\u0000') === -1 && OLD.test(t);
    });
    ok(!naming.length, 'no file names shell/' + NAME, naming.length + ' files still name it: ' + naming.join(', '));

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
      ok(!!rows[NAME] && rows[NAME].intrinsic === true && rows[NAME].active === true, 'the node lists ' + NAME + ' intrinsic, so always active', 'app.search\'s ' + NAME + ': ' + short(rows[NAME]));

      const where = findChrome();
      if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
      c = await chromePage(where);
      if (c.error) { test.fail('Chrome: ' + c.error); return; }
      await c.send('Page.navigate', { url: N.base + '/face.html' });
      ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000), 'the world: the face page has its spirit', 'the page has no spirit: nothing judged');
      await c.evaluate(HANDS);
      const T = function (expr) { return c.evaluate('window.__t.' + expr); };
      const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };

      test.subHeading('the box, 7: "its <name>.js sets spirit.elements.<name> = { create(container, opts) -> { destroy() } }"');
      const made = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzOwn"; b.style.cssText = "position:absolute;left:0;top:0;width:50%;height:50%"; document.body.appendChild(b); var p; try { p = spirit.require("spirit/app/' + NAME + '/element.js"); } catch (e) { return "load threw: " + e; } return Promise.resolve(p).then(function () { var E = spirit.element.spirit.app[' + JSON.stringify(NAME) + '] && spirit.element.spirit.app[' + JSON.stringify(NAME) + '].element; if (!E || typeof E.create !== "function") return "no spirit.element.spirit.app.' + NAME + '.element.create"; var m = E.create(b, {}); if (!m || typeof m.destroy !== "function") return "create answered " + typeof m; return new Promise(function (r) { setTimeout(r, 2500); }).then(function () { var drew = b.innerHTML.length > 0; m.destroy(); b.remove(); return drew ? "ok" : "it drew nothing"; }); }, function (e) { b.remove(); return "load: " + e; }); }())');
      ok(made === 'ok', 'spirit.element.spirit.app.' + NAME + '.element.create(container, opts) draws into it and answers { destroy() }', NAME + ': ' + short(made));

      test.subHeading('the box, 3: "both show in the shell as before: a tile each, and each opens as it did"');
      // The shell app, as boot.js hands it the page's app area, here in a box of its own over the page.
      const shell = await c.evaluate('(function () { var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__shell = spirit.element.spirit.app.app.element.create(b); return "made"; }, function (e) { return "load: " + e; }); }())');
      ok(shell === 'made' && await waitFor('tiles().indexOf("file") !== -1', 10000), 'the world: the shell draws its tiles, Files among them', 'the shell: ' + short(shell) + ', tiles ' + short(await T('tiles()')));
      ok(await waitFor('tiles().indexOf("' + NAME + '") !== -1', 6000), WANT.label + ' has its tile, with nothing pressed', 'no ' + NAME + ' tile: ' + short(await T('tiles()')));

      // Info opens as it did: its name and description fields, and the rotate button.
      const infoPressed = await T('tile("info")');
      const infoOpen = infoPressed && await waitFor('count("[data-field=label]") === 1 && count("[data-field=description]") === 1', 10000);
      ok(infoOpen, 'Info\'s tile opens Info: its name and its description field', infoPressed ? 'Info shows: ' + short(await T('text()')) : 'no Info tile to press: nothing judged');
      ok(infoOpen && await waitFor('buttons().some(function (b) { return /^Rotate this node.s cipher key$/.test(b); })', 6000), 'Info shows its Rotate this node\'s cipher key button', infoOpen ? 'Info\'s buttons: ' + short(await T('buttons()')) : 'Info did not open: nothing judged');
      const infoBars = await T('bars()');
      ok(infoOpen && infoBars.length === 1 && infoBars[0] === WANT.icon + ' Info', 'over the tiles one bar in view, ' + WANT.icon + ' Info', infoOpen ? 'bars: ' + short(infoBars) : 'Info did not open: nothing judged');
      ok(infoOpen && !/could not be loaded/i.test(await T('text()')), 'Info says nothing could not be loaded', infoOpen ? 'Info: ' + short(await T('text()')) : 'Info did not open: nothing judged');
      if (infoOpen) await T('close("Info")');
      ok(infoOpen && await waitFor('tiles().indexOf("info") !== -1', 6000), 'the world: Info\'s ✕ shows the tiles again', infoOpen ? 'after ✕: ' + short(await T('text()')) : 'Info did not open: nothing judged');

    } finally {
      try { if (c && c.sock) c.sock.close(); } catch (e) { /* gone */ }
      try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
      if (N) await stop(N.child);
      try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}
