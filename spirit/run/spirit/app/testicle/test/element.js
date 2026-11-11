'use strict';

// spirit/run/spirit/app/testicle/test/element.js
// The tests of spirit/app/testicle/element.js, testicle's face, and of no other module (spec: ./element.md; goal/G45.1). The
// box: "a first-cut face of testicle: a workBench with one 📁 icon, its file viewer showing production *.js files only",
// "testicle's face calls no verbs in this round: it shows a file pane in the leftmost workBench pane, and nothing else", "A
// face-only app is its manifest and its element.js, as contact and starter are", "The file viewer is the existing file list
// with a filter for production *.js files: no new list." A real node on a scratch copy of the tracked files, with planted files
// of every kind the filter must tell apart, and the face mounted in a real Chrome on /face.html. Neither Andy's node nor an
// agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; } }

const APP = path.join(RUN, 'spirit', 'app', 'testicle');
const FACE = path.join(APP, 'element.js');
// THE PLANTED FILES: one of each kind the filter must tell apart, under one folder of its own, found by its word "zzTesticle".
// Production *.js shows; anything else never does: another type, a test in a test/ folder, a vendored library's script.
const PLANT = {
  'spirit/zzTesticle/shown.js': '// a production script\n',
  'spirit/zzTesticle/inner/alsoShown.js': '// a production script, deeper\n',
  'spirit/zzTesticle/notes.md': '# no script\n',
  'spirit/zzTesticle/data.json': '{}\n',
  'spirit/zzTesticle/test/shown.js': '// a test, in a test/ folder\n',
  // goal/G47.1, the UI cycle: eta has no test of its own until this test writes one; gone is removed as it is clicked.
  'spirit/zzTesticle/eta.js': '\'use strict\';\n// eta, no test of its own yet\n',
  'spirit/zzTesticle/gone.js': '\'use strict\';\n// gone, removed as it is clicked\n',
  // goal/G47.1, the cycle "run a suite from the script tab": iota's own test really runs, waiting a moment, then two tests.
  'spirit/zzTesticle/iota.js': '\'use strict\';\n// iota\n',
  'spirit/zzTesticle/test/iota.js': '\'use strict\';\nconst path = require(\'path\');\nconst test = require(path.join(__dirname, \'..\', \'..\', \'test\', \'testReport.js\'));\n' + [
    "test.run('the world: iota waits a moment', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 3000); }); }, test.limit.quick);",
    "test.run('iota answers when its suite is run', 0.2, function () { return true; }, test.limit.quick);",
  ].join('\n') + '\n',
};
const SHOWN = ['spirit/zzTesticle/shown.js', 'spirit/zzTesticle/inner/alsoShown.js'];
const HIDDEN = ['spirit/zzTesticle/notes.md', 'spirit/zzTesticle/data.json', 'spirit/zzTesticle/test/shown.js'];

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-testicle-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  return { root: root, run: run };
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

// THE SUITES THAT CONCERN A FILE (goal/G47.1, the server cycle): its own test/<name>.js, and the general tests whose run
// with no file argument includes it, as the scratch tree's own testModule.js lists them, run as its own process.
function concerning(run, name) {
  const lines = require('child_process').execFileSync(process.execPath, [path.join(run, 'spirit', 'test', 'testModule.js')], { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean);
  const own = path.posix.join(path.posix.dirname(name), 'test', path.posix.basename(name));
  const out = [];
  if (fs.existsSync(path.join(run, own))) out.push(own);
  lines.forEach(function (l) { const p = l.split(' '); if (p[1] === name && out.indexOf(p[0]) === -1) out.push(p[0]); });
  return out.sort();
}

// THE PAGE'S HANDS: everything judged is what shows in #zzBox; a hidden layer never counts.
const HANDS = '(function () {' +
  'function box() { return document.getElementById("zzBox"); }' +
  'function seen(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }' +
  'function all(sel, from) { var b = from || box(); return b ? Array.prototype.slice.call(b.querySelectorAll(sel)).filter(seen) : []; }' +
  // The workBench's strips and panes (spirit/element/workBench.js): a strip's tools are its buttons, data-side its side and
  // data-tool its name, the glyph drawn in each; its panes are ids ending pane-left, center and pane-right.
  'window.__t = {' +
  '  icons: function (side) { return all("button[data-side=\\"" + side + "\\"][data-tool]").map(function (i) { return String(i.textContent || "").trim() || String(i.getAttribute("title") || ""); }); },' +
  '  left: function () { var b = box(); return b ? b.querySelector("[id$=\\"pane-left\\"]") : null; },' +
  '  rows: function () { var l = window.__t.left(); return l ? all("tr[data-key]", l).map(function (t) { return t.getAttribute("data-key"); }) : []; },' +
  // What a row shows, as read: a part hidden by the tree's look (its path) is not in it.
  '  rowText: function (k) { var l = window.__t.left(); var r = l ? all("tr[data-key]", l).filter(function (t) { return t.getAttribute("data-key") === k; })[0] : null; return r ? String(r.innerText || "") : null; },' +
  '  inLeft: function (sel) { var l = window.__t.left(); return l ? all(sel, l).length : 0; },' +
  // What the leftmost pane holds, for a failure line: whether it is there and shown, and its first markup.
  '  leftSays: function () { var l = window.__t.left(); return l ? { shown: seen(l), html: String(l.innerHTML).slice(0, 300) } : { none: true }; },' +
  '  type: function (w) { var l = window.__t.left(); var i = l ? all("input[id$=text]", l)[0] : null; if (!i) return false; i.value = w; i.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  // goal/G47.1, the UI cycle: the centre's tabs (spirit/element/tabContainer.js: button.tab-button[data-tab], aria-selected,
  // a close [data-tab-close]), the shown tab's content, and the rows a list draws there.
  '  center: function () { var b = box(); return b ? b.querySelector("[id$=\\"center\\"]") : null; },' +
  '  tabs: function () { var c = window.__t.center(); return c ? all("button[data-tab]", c).map(function (t) { return { name: t.getAttribute("data-tab"), label: String((t.firstChild && t.firstChild.textContent) || t.textContent || "").replace("✕", "").trim(), selected: t.getAttribute("aria-selected") === "true", closable: !!t.querySelector("[data-tab-close]") }; }) : []; },' +
  '  shown: function () { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; if (!t) return null; var kids = Array.prototype.slice.call(t.querySelectorAll("*")).filter(seen); return { text: String(t.innerText || "").trim(), first: String(t.innerText || "").trim().split("\\n")[0].trim(), rows: all("tr[data-key]", t).map(function (r) { return { key: r.getAttribute("data-key"), text: String(r.innerText || "") }; }) }; },' +
  '  click: function (k) { var l = window.__t.left(); var r = l ? all("tr[data-key]", l).filter(function (t) { return t.getAttribute("data-key") === k; })[0] : null; if (!r) return false; r.click(); return true; },' +
  '  closeTab: function (n) { var c = window.__t.center(); var x = c ? all("[data-tab-close]", c).filter(function (e) { return e.getAttribute("data-tab-close") === n; })[0] : null; if (!x) return false; x.click(); return true; },' +
  '  inCenter: function (sel) { var c = window.__t.center(); return c ? all(sel, c).length : 0; },' +
  // A row of the testicle search in the centre, pressed by its key; the [data-key] elements of the shown tab, in order.
  '  pressCenter: function (k) { var c = window.__t.center(); var r = c ? all("tr[data-key]", c).filter(function (t) { return t.getAttribute("data-key") === k; })[0] : null; if (!r) return false; r.click(); return true; },' +
  '  shownKeys: function () { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; return t ? all("[data-key]", t).map(function (e) { return e.getAttribute("data-key"); }) : []; },' +
  '  selectTab: function (n) { var c = window.__t.center(); var b = c ? all("button[data-tab]", c).filter(function (e) { return e.getAttribute("data-tab") === n; })[0] : null; if (!b) return false; b.click(); return true; },' +
  // The 🏃‍♂️ of a suite row in the shown tab: whether the row's first cell holds it, a press on it, and whether it is busy.
  '  runCell: function (k) { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; var r = t ? all("tr[data-key]", t).filter(function (x) { return x.getAttribute("data-key") === k; })[0] : null; var td = r ? r.querySelector("td") : null; var b = td ? td.querySelector("button") : null; return r ? { first: td ? String(td.innerText || "").trim() : null, button: !!b, glyph: b ? String(b.innerText || "").trim() : null, disabled: b ? !!b.disabled : null } : null; },' +
  '  runPress: function (k) { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; var r = t ? all("tr[data-key]", t).filter(function (x) { return x.getAttribute("data-key") === k; })[0] : null; var b = r && r.querySelector("td") ? r.querySelector("td").querySelector("button") : null; if (!b) return false; b.click(); return true; },' +
  '  centerText: function () { var b = box(); var c = b ? b.querySelector("[id$=\\"center\\"]") : null; return c ? String(c.innerText || "").trim() : null; },' +
  '}; return "hands"; }())';

// What the tests share, made by the tests in order: the scratch tree, its node, the Chrome page and what each step read.
let own = null, id = {}, src = '', s = null, N = null, c = null, made = '', bare = [], rows = [], files = [], want1 = [], d1 = { rows: [] }, t1 = {}, two = [], etaBefore = null, clicked = false, goneShown = null, before = 0;
const live = [];
const NONODE = 'no scratch node: the world failed';
const NOPAGE = 'no page: the world failed';
const NOFACE = 'the face did not mount: the world failed';
const T = function (expr) { return c.evaluate('window.__t.' + expr); };
const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 10000); };
const named = function (rows, suite) { return rows.some(function (r) { return r.key === suite || r.key === SHOWN[0] + '|' + suite || String(r.text).indexOf(suite) !== -1; }); };
const F1 = SHOWN[0];
const F2 = SHOWN[1];
const F3 = 'spirit/zzTesticle/eta.js';
const F4 = 'spirit/zzTesticle/gone.js';
const etaOwn = 'spirit/zzTesticle/test/eta.js';
// Whether the face is mounted on its page, else why not.
const face = function () { return !N || !N.up ? NONODE : (!c || c.error || !c.evaluate) ? NOPAGE : made !== 'made' ? NOFACE : ''; };

test.after(async function () {
  try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  for (const k of live) await stop(k);
  try { if (s) fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

// the box: "A face-only app is its manifest and its element.js, as contact and starter are"
test.run('spirit/app/testicle/testicle.json is there, and JSON', 0.2, function () {
  own = readJson(path.join(APP, 'testicle.json'));
  id = (own && own.identity) || {};
  return !!own || 'no spirit/app/testicle/testicle.json, or no JSON';
}, test.limit.quick);
test.run('it names an icon and a label', 0.2, function () {
  return (typeof id.icon === 'string' && !!id.icon && typeof id.label === 'string' && !!id.label) || 'identity: ' + short(id);
}, test.limit.quick);
// The goal box: "testicle: an intrinsic app with a server and a face".
test.run('it is intrinsic', 0.2, function () {
  return id.intrinsic === true || 'identity.intrinsic: ' + short(id.intrinsic);
}, test.limit.quick);
test.run('it has a face: shell.mount true', 0.2, function () {
  return (!!own && !!own.shell && own.shell.mount === true) || 'shell: ' + short(own && own.shell);
}, test.limit.quick);
// goal/G47.1, the server cycle: "The server mounts beside the face (testicle.json: node.mount true)", "The testicle
// server will serve one first verb, \"busy\"", and the verbs cycle: testicle.script.get and testicle.suite.search, each
// with its json description (Andy's rule 6). The server's own checks are ./testicle.js.
test.run('a server beside the face: node.mount true', 0.2, function () {
  return (!!own && !!own.node && own.node.mount === true) || 'node: ' + short(own && own.node);
}, test.limit.quick);
test.run('its folder holds its manifest, its face, its server, its api.js and data.js, and a json description of each verb, busy, script.get, suite.search, testicle.set, testicle.search, red, run, subscribe and unsubscribe, and its test/ folder, nothing else', 0.2, function () {
  const held = fs.existsSync(APP) ? fs.readdirSync(APP).filter(function (f) { return f !== 'test'; }).sort() : [];
  return JSON.stringify(held) === JSON.stringify(['api.js', 'busy.json', 'data.js', 'element.js', 'red.json', 'run.json', 'script.get.json', 'subscribe.json', 'suite.search.json', 'testicle.js', 'testicle.json', 'testicle.search.json', 'testicle.set.json', 'unsubscribe.json']) || 'its folder holds ' + short(held);
}, test.limit.quick);
test.run('its mount names element.js', 0.2, function () {
  return (!!own && !!own.mount && own.mount['element.js'] === true) || 'mount: ' + short(own && own.mount);
}, test.limit.quick);
// The box: "spirit/app/test/ stays the app branch's test folder".
test.run('spirit/app/test/ stays the app branch\'s test folder, no app', 0.2, function () {
  return (fs.existsSync(path.join(RUN, 'spirit', 'app', 'test')) && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'test', 'test.json'))) || 'spirit/app/test/ holds a test.json, or is gone';
}, test.limit.quick);

// the box: "calls no verbs in this round", "the existing file list ...: no new list"
test.run('spirit/app/testicle/element.js is there', 0.2, function () {
  src = code(FACE);
  return src !== '' || 'no spirit/app/testicle/element.js';
}, test.limit.quick);
test.run('it draws with the workBench element, spirit/element/workBench.js', 0.2, function () {
  return (/['"]spirit\/element\/workBench\.js['"]/).test(src) || 'it does not require spirit/element/workBench.js';
}, test.limit.quick);
test.run('its file viewer is the existing file list, spirit/element/search/file.js', 0.2, function () {
  return (/['"]spirit\/element\/search\/file\.js['"]/).test(src) || 'it does not require spirit/element/search/file.js';
}, test.limit.quick);
test.run('it makes no list of its own', 0.2, function () {
  return (src !== '' && !/\.element\.search\.create\(|createElement\(['"](tr|li|table)['"]\)/.test(src)) || 'it makes a list of its own';
}, test.limit.quick);
// goal/G47.1, the UI cycle: the face asks testicle.script.get on a click, through spirit; never by itself.
test.run('it asks the node only through spirit: no peerPost, no fetch', 0.2, function () {
  return (src !== '' && !/\.peerPost\(|\bfetch\(|XMLHttpRequest/.test(src)) || 'it asks the node something itself';
}, test.limit.quick);
// goal/G47.1, the box: "testicle turns flat on."
test.run('it draws the file list with flat on', 0.2, function () {
  return (/\bflat\s*:\s*true\b/).test(src) || 'it does not hand the file list flat: true';
}, test.limit.quick);

test.run('the world: a scratch node comes up', 0.2, async function () {
  s = scratch();
  N = await boot(s.run); live.push(N.child);
  return N.up || 'the scratch node did not come up: nothing judged';
}, test.limit.long);
// Chrome, opened on the node's face page: its failures are this test's.
test.run('the world: the face page has its spirit', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  const where = findChrome();
  if (!where) return 'no Chrome here: the page was not judged';
  c = await chromePage(where);
  if (c.error) return 'Chrome: ' + c.error;
  await c.send('Page.navigate', { url: N.base + '/face.html' });
  return !!(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) || 'the page has no spirit: nothing judged';
}, test.limit.long);

// its place: spirit.element.spirit.app.testicle.element, with a create
test.run('it loads through spirit.require and mounts with create(container), answering { destroy }', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  if (!c || c.error || !c.evaluate) return NOPAGE;
  await c.evaluate(HANDS);
  made = await c.evaluate('window.spirit.ready.then(function () { return window.spirit.require("spirit/app/testicle/element.js"); }).then(function () {' +
    ' var E = ((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element; if (!E || typeof E.create !== "function") return "no create";' +
    ' var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:1200px;height:800px;display:flex;"; document.body.appendChild(b);' +
    ' window.__made = E.create(b, {}); return window.__made && typeof window.__made.destroy === "function" ? "made" : "no destroy"; }, function (e) { return "refused: " + (e && e.message || e); })');
  return made === 'made' || 'it did not mount: ' + short(made);
}, test.limit.slow);

// the box: "a workBench with one 📁 icon"
test.run('the world: the workBench\'s left strip is drawn', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('icons("left") && icons("left").length > 0')) || 'no left strip: ' + short(await T('icons("left")'));
}, test.limit.slow);
test.run('its left strip holds exactly one icon, 📁', 0.2, async function () {
  if (face()) return face();
  const left = await T('icons("left")');
  return (Array.isArray(left) && left.length === 1 && /📁/.test(left[0])) || 'the left strip holds ' + short(left);
}, test.limit.quick);
test.run('its right strip holds none', 0.2, async function () {
  if (face()) return face();
  const right = await T('icons("right")');
  return (!right || right.length === 0) || 'the right strip holds ' + short(right);
}, test.limit.quick);

// the box: "it shows a file pane in the leftmost workBench pane, and nothing else"
test.run('the leftmost pane shows the file list, its search field there', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('inLeft("input[id$=text]") > 0', 15000)) || 'no file list in the leftmost pane: ' + short(await T('leftSays()'));
}, test.limit.slow);
// goal/G47.1, the cycle "the testicle search", the box: "The UI gets its first non-closable tab in the workbench centre pane:
// the testicle search", "the tab is the tabContainer's, closable false, first in the centre, before any script's tab; the
// script tabs stay closable".
test.run('at the start the centre holds one tab, the testicle search, and it is not closable', 0.2, async function () {
  if (face()) return face();
  await waitFor('tabs().length > 0', 10000);
  const tabs0 = (await T('tabs()')) || [];
  return (tabs0.length === 1 && tabs0[0].closable === false) || 'tabs: ' + short(tabs0);
}, test.limit.slow);
test.run('its tab shows the testicle search, spirit/element/search/testicle.js, which the face loads', 0.2, async function () {
  if (face()) return face();
  const loaded = /['"]spirit\/element\/search\/testicle\.js['"]/.test(code(FACE));
  const there = await c.evaluate('!!(((((window.spirit.element || {}).spirit || {}).element || {}).search || {}).testicle)');
  return (loaded && there && !!(await waitFor('shown() !== null && inCenter("input[id$=text]") > 0', 10000))) || 'loaded by the face ' + loaded + ', on the page ' + there + ', the tab shows ' + short(await T('shown()'));
}, test.limit.slow);

// goal/G47.1, the box: "With flat on: no folder rows, never the indented tree; with an empty field every file the app
// accepts is listed, each with its path; typing narrows it."
test.run('the world: with the field empty the list draws rows', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('rows().length > 0', 15000)) || 'no rows with the field empty: ' + short(await T('leftSays()'));
}, test.limit.slow);
// A folder's key has no extension; every production script's has .js.
test.run('with the field empty no folder row shows', 0.2, async function () {
  if (face()) return face();
  bare = (await T('rows()')) || [];
  const folders = bare.filter(function (k) { return !/\.[a-z0-9]+$/i.test(k); });
  return folders.length === 0 || 'folder rows: ' + short(folders.slice(0, 10));
}, test.limit.quick);
test.run('with the field empty files deep in the tree show, no folder opened', 0.2, function () {
  const deep = bare.filter(function (k) { return k.split('/').length >= 3; });
  return deep.length > 0 || 'rows: ' + short(bare.slice(0, 10));
}, test.limit.quick);
test.run('with the field empty each row shows its path', 0.2, async function () {
  if (face()) return face();
  const one = bare.filter(function (k) { return k.split('/').length >= 3; })[0] || '';
  const said = one ? await T('rowText(' + JSON.stringify(one) + ')') : null;
  return (!!one && typeof said === 'string' && said.indexOf(one.slice(0, one.lastIndexOf('/') + 1)) !== -1) || 'the row of ' + short(one) + ' reads ' + short(said);
}, test.limit.quick);

// the box: "its file viewer showing production *.js files only"
test.run('the world: a planted production script is found by its word', 0.2, async function () {
  if (face()) return face();
  await T('type("zzTesticle")');
  return !!(await waitFor('rows().indexOf("' + SHOWN[0] + '") !== -1', 15000)) || 'the planted script is not listed: ' + short(await T('rows()'));
}, test.limit.slow);
test.run('every planted production *.js file shows', 0.2, async function () {
  if (face()) return face();
  rows = (await T('rows()')) || [];
  files = rows.filter(function (k) { return /\.[a-z0-9]+$/i.test(k); });
  return SHOWN.every(function (f) { return rows.indexOf(f) !== -1; }) || 'shown: ' + short(rows) + ', wanted ' + SHOWN.join(', ');
}, test.limit.quick);
test.run('no other file shows: not a .md, not a .json, not a test in a test/ folder', 0.2, function () {
  return !HIDDEN.some(function (f) { return rows.indexOf(f) !== -1; }) || 'shown, though no production script: ' + short(HIDDEN.filter(function (f) { return rows.indexOf(f) !== -1; }));
}, test.limit.quick);
test.run('with words typed no folder row shows', 0.2, function () {
  return (rows.indexOf('spirit/zzTesticle') === -1 && rows.indexOf('spirit/zzTesticle/inner') === -1 && rows.indexOf('spirit/zzTesticle/test') === -1) || 'folder rows: ' + short(rows.filter(function (k) { return !/\.[a-z0-9]+$/i.test(k); }));
}, test.limit.quick);
test.run('every file it lists is a .js outside any test/ folder', 0.2, function () {
  return (files.length > 0 && files.every(function (k) { return /\.js$/.test(k) && k.split('/').indexOf('test') === -1; })) || 'it lists ' + short(files.filter(function (k) { return !/\.js$/.test(k) || k.split('/').indexOf('test') !== -1; }));
}, test.limit.quick);
// goal/G47.1, the UI cycle. The box: "When a user clicks on a production file in the left pane of the production file
// list", "A new tab is opened and activated in the center pane's tabContainer: the file detail", "The tab header shows
// the production file name without path", "The detail shows as title row the full file name, and below it a standard
// testicle.suite.search", "All tabs are closable", "The tab opens first, with its title line; then file.get runs, and
// below the title line it shows either the error file.get gives (\"not a production script\", \"no such file\") or
// the suite search for that file", "The UI must listen to changes on all tables it interacts with, and the server, of
// course, publishes changes", "the suite search is spirit/element/search/suite.js and its folder".
// the box: "A new tab is opened and activated in the center pane's tabContainer: the file detail"
test.run('the world: shown.js is concerned by its own test and by general tests', 0.2, function () {
  if (!N || !N.up) return NONODE;
  want1 = concerning(s.run, F1);
  return (want1.indexOf('spirit/zzTesticle/test/shown.js') !== -1 && want1.length > 1) || 'testModule.js names ' + short(want1);
}, test.limit.quick);
test.run('the world: a production file in the left pane is clicked', 0.2, async function () {
  if (face()) return face();
  return !!(await T('click(' + JSON.stringify(F1) + ')')) || 'no row for ' + F1 + ' to click: ' + short(await T('rows()'));
}, test.limit.quick);
test.run('a click on a production file opens one tab in the centre, after the testicle search\'s', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('tabs().length === 2 && tabs()[0].closable === false', 10000)) || 'tabs: ' + short(await T('tabs()'));
}, test.limit.slow);
test.run('the new tab is the active one', 0.2, async function () {
  if (face()) return face();
  t1 = ((await T('tabs()')) || [])[1] || {};
  return t1.selected === true || 'tabs: ' + short(await T('tabs()'));
}, test.limit.quick);
test.run('its header shows the file name without its path', 0.2, function () {
  return t1.label === 'shown.js' || 'header: ' + short(t1.label);
}, test.limit.quick);
test.run('its tab is closable', 0.2, async function () {
  if (face()) return face();
  return t1.closable === true || 'tabs: ' + short(await T('tabs()'));
}, test.limit.quick);
// the box: "as title row the full file name, and below it a standard testicle.suite.search"
test.run('the detail\'s title row is the full file name', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('shown() && shown().first === ' + JSON.stringify(F1), 10000)) || 'the detail reads ' + short(await T('shown()'));
}, test.limit.slow);
test.run('the world: below the title the suite search draws rows', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('shown() && shown().rows.length >= ' + want1.length, 15000)) || 'the detail: ' + short(await T('shown()'));
}, test.limit.slow);
test.run('below the title it lists every suite that concerns the file', 0.2, async function () {
  if (face()) return face();
  d1 = (await T('shown()')) || { rows: [] };
  const lacking = want1.filter(function (w) { return !named(d1.rows, w); });
  return !lacking.length || 'missing: ' + short(lacking) + '; rows ' + short(d1.rows.map(function (r) { return r.key; }));
}, test.limit.quick);
test.run('and no other: each suite once', 0.2, function () {
  return d1.rows.length === want1.length || d1.rows.length + ' rows for ' + want1.length + ' suites: ' + short(d1.rows.map(function (r) { return r.key; }));
}, test.limit.quick);
// shown.js was never changed: its rows exist only if the click's script.get made them. Asked by suite.search, which makes none.
test.run('the click made the script\'s rows: script.get ran for it', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  const rowsMade = await call(N.base, 'testicle.suite.search', { script: F1, text: '' });
  return (rowsMade.status === 200 && rowsMade.body && Array.isArray(rowsMade.body.items) && rowsMade.body.items.length === want1.length) || 'suite.search after the click: ' + short(rowsMade.text);
}, test.limit.quick);
test.run('the suite search is spirit/element/search/suite.js, which the face loads', 0.2, function () {
  const srcNow = code(FACE);
  return (/['"]spirit\/element\/search\/suite\.js['"]/.test(srcNow) && fs.existsSync(path.join(RUN, 'spirit', 'element', 'search', 'suite.js'))) || 'the face does not load spirit/element/search/suite.js, or it is not there';
}, test.limit.quick);

// the box: a second click
test.run('a second click on the same file opens no second tab: its tab is made active', 0.2, async function () {
  if (face()) return face();
  return (await T('click(' + JSON.stringify(F1) + ')') && !!(await waitFor('tabs().length === 2 && tabs()[1].selected', 3000))) || 'tabs: ' + short(await T('tabs()'));
}, test.limit.slow);
test.run('a click on another file opens a second tab', 0.2, async function () {
  if (face()) return face();
  return (await T('click(' + JSON.stringify(F2) + ')') && !!(await waitFor('tabs().length === 3', 10000))) || 'tabs: ' + short(await T('tabs()'));
}, test.limit.slow);
test.run('the newest tab is the active one, and only it', 0.2, async function () {
  if (face()) return face();
  two = ((await T('tabs()')) || []).slice(1);
  return (two.length === 2 && two.filter(function (t) { return t.selected; }).length === 1 && (two.filter(function (t) { return t.selected; })[0] || {}).label === 'alsoShown.js') || 'tabs: ' + short(two);
}, test.limit.quick);
test.run('every script tab is closable', 0.2, function () {
  return (two.length === 2 && two.every(function (t) { return t.closable; })) || 'tabs: ' + short(two);
}, test.limit.quick);
test.run('the testicle search\'s tab stays first, and not closable', 0.2, async function () {
  if (face()) return face();
  const first = ((await T('tabs()')) || [])[0] || {};
  return first.closable === false || 'tabs: ' + short(await T('tabs()'));
}, test.limit.quick);
test.run('the active tab shows its own file\'s detail', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('shown() && shown().first === ' + JSON.stringify(F2), 10000)) || 'the detail reads ' + short(await T('shown()'));
}, test.limit.slow);

// the box: "The UI must listen to changes on all tables it interacts with"
test.run('the world: eta.js\'s detail lists its suites', 0.2, async function () {
  if (face()) return face();
  return (await T('click(' + JSON.stringify(F3) + ')') && !!(await waitFor('shown() && shown().first === ' + JSON.stringify(F3) + ' && shown().rows.length > 0', 15000))) || 'the detail: ' + short(await T('shown()'));
}, test.limit.slow);
test.run('the world: before its own test is written, eta.js lists none', 0.2, async function () {
  if (face()) return face();
  etaBefore = await T('shown()');
  return (!!etaBefore && etaBefore.first === F3 && !named(etaBefore.rows, etaOwn)) || 'the detail: ' + short(etaBefore);
}, test.limit.quick);
test.run('a suite written for the file shows in its open detail, with no click: the detail listens, the server publishes', 0.2, async function () {
  if (face()) return face();
  fs.mkdirSync(path.join(s.run, 'spirit', 'zzTesticle', 'test'), { recursive: true });
  fs.writeFileSync(path.join(s.run, etaOwn), '\'use strict\';\n// the new test of eta\n');
  return !!(await until(function () { return T('shown()').then(function (d) { return !!d && d.rows.some(function (r) { return r.key === etaOwn || String(r.text).indexOf(etaOwn) !== -1; }); }); }, 10000)) || 'the detail after the new suite: ' + short(await T('shown()'));
}, test.limit.slow);

// the box: "The tab opens first ... or the error script.get gives"
test.run('the world: gone.js is listed in the left pane', 0.2, async function () {
  if (face()) return face();
  return ((await T('rows()')) || []).indexOf(F4) !== -1 || 'gone.js is not listed: ' + short(await T('rows()'));
}, test.limit.quick);
test.run('the world: gone.js, removed, is still there to click', 0.2, async function () {
  if (face()) return face();
  fs.rmSync(path.join(s.run, F4));
  clicked = await T('click(' + JSON.stringify(F4) + ')');
  return !!clicked || 'its row went before the click: nothing judged';
}, test.limit.quick);
test.run('its tab opens and is the active one, though script.get will refuse', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('tabs().some(function (t) { return t.label === "gone.js" && t.selected; })', 5000)) || 'tabs: ' + short(await T('tabs()'));
}, test.limit.slow);
test.run('below the title line it shows the error script.get gives: no such file', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('shown() && shown().first === ' + JSON.stringify(F4) + ' && /no such file/.test(shown().text)', 10000)) || 'the detail reads ' + short(await T('shown()'));
}, test.limit.slow);
test.run('and no suite search', 0.2, async function () {
  if (face()) return face();
  goneShown = await T('shown()');
  return (!!goneShown && goneShown.first === F4 && goneShown.rows.length === 0) || 'the detail: ' + short(goneShown);
}, test.limit.quick);

// the box: "All tabs are closable"
test.run('a tab\'s close button takes it away', 0.2, async function () {
  if (face()) return face();
  before = ((await T('tabs()')) || []).length;
  return (await T('closeTab(' + JSON.stringify(F4) + ')') && !!(await waitFor('tabs().length === ' + (before - 1) + ' && !tabs().some(function (t) { return t.label === "gone.js"; })', 3000))) || 'tabs after closing gone.js: ' + short(await T('tabs()'));
}, test.limit.slow);

// goal/G47.1, the cycle "the test table streamed, and the page showing the current tests", the box: "The testicle server
// streams every update, to every table: on a flip, the replaced row turning current false is published too, beside the new
// current row", "The UI then sorts out the current tests from the old ones: the page keeps test rows by their full key,
// script|suite|test|flipped". What the page keeps is read from its own spirit.data, the test table's branch that
// spirit/app/testicle/data.js names; nothing is asked of the node for it.
const ETA_TEST = 'eta answers its question';
const pageTests = function () {
  return c.evaluate('(function () { var R = window.spirit.data.testicle && window.spirit.data.testicle.data; if (!R) return null; ' +
    'var b = window.spirit.data.getPath(R.branch("testicle")) || {}; return Object.keys(b).map(function (k) { return { key: k, row: b[k] }; }); }())');
};
const etaRows = function (all) { return (all || []).filter(function (e) { return e.row && e.row.script === F3 && e.row.suite === etaOwn && e.row.test === ETA_TEST; }); };
let flipSet = null, kept = null;
test.run('the world: a test of eta.js is set passing, then failing: a flip', 0.2, async function () {
  if (face()) return face();
  const one = await call(N.base, 'testicle.testicle.set', { script: F3, suite: etaOwn, test: ETA_TEST, verified: true, severity: 0.2 });
  await sleep(20);
  flipSet = await call(N.base, 'testicle.testicle.set', { script: F3, suite: etaOwn, test: ETA_TEST, verified: false, severity: 0.2 });
  return (one.status === 200 && flipSet.status === 200) || 'test.set: ' + one.status + ' ' + short(one.text) + '; then ' + flipSet.status + ' ' + short(flipSet.text);
}, test.limit.quick);
test.run('on a flip the replaced row reaches the page too, current false, beside the new current row', 0.2, async function () {
  if (face()) return face();
  if (!flipSet || flipSet.status !== 200) return 'no flip was set: the world failed';
  await until(function () { return pageTests().then(function (a) { const e = etaRows(a); return e.some(function (x) { return x.row.current === false; }) && e.some(function (x) { return x.row.current === true; }); }); }, 10000);
  kept = etaRows(await pageTests());
  const old = kept.filter(function (x) { return x.row.current === false; });
  const cur = kept.filter(function (x) { return x.row.current === true; });
  return (old.length === 1 && cur.length === 1 && old[0].row.verified === true && cur[0].row.verified === false) || 'the page holds for the test: ' + short(kept);
}, test.limit.slow);
test.run('the page keeps every test row by its full key, script|suite|test|flipped', 0.2, async function () {
  if (face()) return face();
  const all = (await pageTests()) || [];
  if (!all.length) return 'the page keeps no test row';
  const wrong = all.filter(function (e) { return !e.row || e.key !== e.row.script + '|' + e.row.suite + '|' + e.row.test + '|' + e.row.flipped; });
  return wrong.length === 0 || 'kept under another key: ' + short(wrong.map(function (e) { return e.key; }));
}, test.limit.quick);
test.run('the flipped test keeps both its rows, the replaced one and the current one, each under its own key', 0.2, function () {
  if (face()) return face();
  const keys = (kept || []).map(function (e) { return e.key; });
  return (keys.length === 2 && keys[0] !== keys[1]) || 'the test\'s rows on the page: ' + short(kept);
}, test.limit.quick);

// goal/G47.1, the cycle "the testicle search", the box: "The testicle detail is a history of flips, and opens in a closable
// tab when a test row is clicked". eta's test was set passing, then failing: its history is two rows, the failing one newest.
let histKeys = [];
test.run('the world: the testicle search\'s tab is shown again, and lists eta\'s test', 0.2, async function () {
  if (face()) return face();
  const first = ((await T('tabs()')) || [])[0] || {};
  if (!first.name || !(await T('selectTab(' + JSON.stringify(first.name) + ')'))) return 'no first tab to show: ' + short(await T('tabs()'));
  const cur = (kept || []).filter(function (x) { return x.row.current === true; })[0];
  if (!cur) return 'no current row of eta\'s test: the world failed';
  return !!(await waitFor('shown() && shown().rows.some(function (r) { return r.key === ' + JSON.stringify(cur.key) + '; })', 10000)) || 'the search shows ' + short(await T('shown()'));
}, test.limit.slow);
test.run('a click on a test row opens a new tab, active and closable', 0.2, async function () {
  if (face()) return face();
  const cur = (kept || []).filter(function (x) { return x.row.current === true; })[0];
  before = ((await T('tabs()')) || []).length;
  if (!cur || !(await T('pressCenter(' + JSON.stringify(cur.key) + ')'))) return 'no row of eta\'s test to click: ' + short(await T('shown()'));
  const ok = await waitFor('tabs().length === ' + (before + 1) + ' && tabs()[tabs().length - 1].selected && tabs()[tabs().length - 1].closable', 10000);
  return !!ok || 'tabs: ' + short(await T('tabs()'));
}, test.limit.slow);
test.run('the detail is the test\'s history of flips: both its rows, the newest first', 0.2, async function () {
  if (face()) return face();
  const old = (kept || []).filter(function (x) { return x.row.current === false; })[0];
  const cur = (kept || []).filter(function (x) { return x.row.current === true; })[0];
  if (!old || !cur) return 'eta\'s two rows were not kept: the world failed';
  await waitFor('shownKeys().indexOf(' + JSON.stringify(old.key) + ') !== -1', 10000);
  histKeys = ((await T('shownKeys()')) || []).filter(function (k) { return k === old.key || k === cur.key; });
  return (histKeys.length === 2 && histKeys[0] === cur.key && histKeys[1] === old.key) || 'the detail holds ' + short(await T('shownKeys()'));
}, test.limit.slow);

// goal/G47.1, the cycle "run a suite from the script tab", the box: "In the script detail's suite search, a 🏃‍♂️ run icon-button
// runs that suite, for the script that was the argument for that closable tab", "The 🏃‍♂️ column is on every row of the script
// detail tab, the first column", "The button is the busy button exactly as it is (spirit/element/busyButton.js) ... busy only
// for that answer, never for the suite's run", "the permanent testicle search tab shows more rows by itself as suites run".
const F5 = 'spirit/zzTesticle/iota.js';
const iotaOwn = 'spirit/zzTesticle/test/iota.js';
let iotaRows = [], iotaKey = '', searchBefore = 0;
// The rows the shown tab draws, by key.
const searchRows = function () { return T('shown()').then(function (d) { return ((d && d.rows) || []).map(function (r) { return r.key; }); }); };
test.run('the world: iota.js\'s tab is opened, its suites listed', 0.2, async function () {
  if (face()) return face();
  const had = await call(N.base, 'testicle.testicle.search', { script: F5, text: '' });
  searchBefore = ((had.body && had.body.items) || []).length;
  if (!(await T('click(' + JSON.stringify(F5) + ')'))) return 'no row for ' + F5 + ' to click: ' + short(await T('rows()'));
  const ok = await waitFor('shown() && shown().first === ' + JSON.stringify(F5) + ' && shown().rows.length > 0', 15000);
  iotaRows = ok ? ((await T('shown()')) || { rows: [] }).rows : [];
  return iotaRows.length > 0 || 'the detail: ' + short(await T('shown()'));
}, test.limit.slow);
test.run('every suite row of the script detail has a 🏃‍♂️ button in its first column', 0.2, async function () {
  if (face()) return face();
  const cells = [];
  for (const r of iotaRows) cells.push(await T('runCell(' + JSON.stringify(r.key) + ')'));
  const bad = cells.filter(function (x) { return !x || !x.button || !/🏃/.test(String(x.glyph || x.first)); });
  return (cells.length > 0 && !bad.length) || 'first cells: ' + short(cells);
}, test.limit.quick);
test.run('the 🏃‍♂️ is the busy button, spirit/element/busyButton.js, which the suite list loads', 0.2, function () {
  const files = ['spirit/element/search/suite.js', 'spirit/element/search/suite/listElement.js', 'spirit/element/search/suite/rowElement.js', 'spirit/app/testicle/element.js'];
  return files.some(function (f) { return /['"]spirit\/element\/busyButton\.js['"]/.test(code(path.join(RUN, f))); }) || 'none of ' + files.join(', ') + ' loads spirit/element/busyButton.js';
}, test.limit.quick);
test.run('a press on iota\'s own suite\'s 🏃‍♂️ is answered at once: the button is no longer busy while the suite still runs', 0.2, async function () {
  if (face()) return face();
  const row = iotaRows.filter(function (r) { return r.key === iotaOwn || r.key === F5 + '|' + iotaOwn || String(r.text).indexOf('iota.js') !== -1 && String(r.text).indexOf('sibling') === -1; })[0];
  iotaKey = row ? row.key : '';
  if (!iotaKey || !(await T('runPress(' + JSON.stringify(iotaKey) + ')'))) return 'no 🏃‍♂️ of iota\'s own suite to press: ' + short(iotaRows);
  const back = await until(function () { return T('runCell(' + JSON.stringify(iotaKey) + ')').then(function (x) { return !!x && x.disabled === false; }); }, 2500);
  return !!back || 'the button after 2.5 s: ' + short(await T('runCell(' + JSON.stringify(iotaKey) + ')'));
}, test.limit.slow);
test.run('the suite runs: the permanent testicle search tab shows iota\'s tests by itself', 0.2, async function () {
  if (face()) return face();
  const first = ((await T('tabs()')) || [])[0] || {};
  if (!first.name || !(await T('selectTab(' + JSON.stringify(first.name) + ')'))) return 'no first tab to show: ' + short(await T('tabs()'));
  const ok = await until(function () { return searchRows().then(function (k) { return (k || []).filter(function (x) { return x.indexOf(F5 + '|' + iotaOwn + '|') === 0; }).length >= 2; }); }, 40000);
  return (!!ok && searchBefore === 0) || 'iota\'s tests on the node before the press ' + searchBefore + '; the search tab now shows ' + short(((await searchRows()) || []).filter(function (x) { return x.indexOf(F5) === 0; }));
}, test.limit.slow);

// destroy
test.run('destroy leaves its container empty', 0.2, async function () {
  if (face()) return face();
  const after = await c.evaluate('(function () { window.__made.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
  return (after === '' || after === 'gone') || 'after destroy: ' + short(after).slice(0, 200);
}, test.limit.quick);
