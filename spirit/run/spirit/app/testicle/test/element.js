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
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
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
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  // testicle turned on there, as an owner turns a server on, now that it is not intrinsic (spirit/test/headLessChrome.js
  // scratchNode; the server's test does the same).
  const on = path.join(run, 'spirit', 'state', 'testicle');
  fs.mkdirSync(on, { recursive: true });
  fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
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
  const child = LABH.startNodeOn(run, port);
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
  // A filter of the shown tab turned on: its button pressed when it is not bold (spirit/element/search.js draws a choice on bold).
  '  filterOn: function (v) { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; var b = t ? all("button[data-filter][data-value]", t).filter(function (x) { return x.getAttribute("data-value") === v; })[0] : null; if (!b) return false; if (Number(getComputedStyle(b).fontWeight) < 600) b.click(); return true; },' +
  // Words typed into the shown tab's own search field.
  '  typeCenter: function (w) { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; var i = t ? all("input[id$=text]", t)[0] : null; if (!i) return false; i.value = w; i.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  '  selectTab: function (n) { var c = window.__t.center(); var b = c ? all("button[data-tab]", c).filter(function (e) { return e.getAttribute("data-tab") === n; })[0] : null; if (!b) return false; b.click(); return true; },' +
  // The 🏃‍♂️ of a suite row in the shown tab: whether the row's first cell holds it, a press on it, and whether it is busy.
  '  runCell: function (k) { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; var r = t ? all("tr[data-key]", t).filter(function (x) { return x.getAttribute("data-key") === k; })[0] : null; var td = r ? r.querySelector("td") : null; var b = td ? td.querySelector("button") : null; return r ? { first: td ? String(td.innerText || "").trim() : null, button: !!b, glyph: b ? String(b.innerText || "").trim() : null, disabled: b ? !!b.disabled : null } : null; },' +
  '  runPress: function (k) { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; var r = t ? all("tr[data-key]", t).filter(function (x) { return x.getAttribute("data-key") === k; })[0] : null; var b = r && r.querySelector("td") ? r.querySelector("td").querySelector("button") : null; if (!b) return false; b.click(); return true; },' +
  // goal/G47.1, the missing own test: the first shown element under the shown tab's title line, its text and whether it is
  // red (its colour's red well above its green and blue).
  '  underTitle: function () { var c = window.__t.center(); var t = c ? all(".tab-content", c)[0] : null; if (!t) return null; var first = String(t.innerText || "").trim().split("\\n")[0].trim(); var els = Array.prototype.slice.call(t.querySelectorAll("*")).filter(seen); var head = els.filter(function (e) { return String(e.innerText || "").trim() === first; }).pop(); if (!head) return null; var after = els.filter(function (e) { return !head.contains(e) && !e.contains(head) && (head.compareDocumentPosition(e) & 4) && String(e.innerText || "").trim(); })[0]; if (!after) return { text: "", red: false }; while (after.firstElementChild && seen(after.firstElementChild) && String(after.firstElementChild.innerText || "").trim() === String(after.innerText || "").trim()) after = after.firstElementChild; var m = String(getComputedStyle(after).color).match(/\\d+/g) || [0, 0, 0]; return { text: String(after.innerText || "").trim(), red: +m[0] > +m[1] + 60 && +m[0] > +m[2] + 60 }; },' +
  // goal/G47.1, the monitor row: the shown element of #zzBox whose text starts with a busy icon, the widest such that does
  // not hold the workBench's left pane; its icon, text, height and top, the left pane's top, and its message element: the
  // deepest element holding the message, with its overflow, wrap and ellipsis.
  '  monitor: function () { var b = box(); var l = window.__t.left(); if (!b) return null; var re = /^(?:(🤖|🖖)\\s*)?(🛌|🚶‍➡️)/; var cands = all("*").filter(function (e) { return re.test(String(e.innerText || "").trim()) && !(l && e.contains(l)); }); if (!cands.length) return null; var row = cands.sort(function (a, c) { return String(c.innerText).length - String(a.innerText).length; })[0]; var text = String(row.innerText || "").trim(); var hit = text.match(re); var mode = hit[1] || null; var icon = hit[2]; var msg = text.slice(hit[0].length).trim(); var me = row; Array.prototype.slice.call(row.querySelectorAll("*")).forEach(function (e) { if (msg && String(e.textContent || "").trim() === msg) me = e; }); var cs = getComputedStyle(me); var r = row.getBoundingClientRect(); return { mode: mode, icon: icon, message: msg, height: r.height, bottom: r.bottom, benchTop: l ? l.getBoundingClientRect().top : null, nowrap: cs.whiteSpace === "nowrap" || cs.whiteSpace === "pre", ellipsis: cs.textOverflow === "ellipsis", hidden: cs.overflow === "hidden" || cs.overflowX === "hidden", overflows: me.scrollWidth > me.clientWidth }; },' +
  // Every icon the monitor row shows, in order, from the moment this is called.
  '  recordIcons: function () { window.__icons = []; var last = null; var note = function () { var m = window.__t.monitor(); var i = m ? m.icon : null; if (i && i !== last) { window.__icons.push(i); last = i; } }; note(); new MutationObserver(note).observe(box(), { subtree: true, childList: true, characterData: true }); return true; },' +
  '  icons_seen: function () { return window.__icons || []; },' +
  // goal/G47.1: every message the monitor row shows, in order, from the moment this is called.
  '  recordMessages: function () { window.__msgs = []; var last = null; var note = function () { var m = window.__t.monitor(); var x = m ? m.message : null; if (x && x !== last) { window.__msgs.push(x); last = x; } }; note(); new MutationObserver(note).observe(box(), { subtree: true, childList: true, characterData: true }); return true; },' +
  '  messages_seen: function () { return window.__msgs || []; },' +
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
  try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
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
// Not intrinsic, for now: Andy's own commit bad27e1e, "testicle non-intrinsic for now.", in place of the goal box's "testicle:
// an intrinsic app with a server and a face". An owner turns it on (below, in the scratch tree).
test.run('it is not intrinsic, for now', 0.2, function () {
  return id.intrinsic === false || 'identity.intrinsic: ' + short(id.intrinsic);
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
test.run('its folder holds its manifest, its face, its server, its api.js and data.js, and a json description of each verb, busy, preferences, script.get, script.classify, suite.search, suite.success, testicle.set, testicle.search, red, run, subscribe and unsubscribe, its element/ folder and its test/ folder, nothing else', 0.2, function () {
  const held = fs.existsSync(APP) ? fs.readdirSync(APP).filter(function (f) { return f !== 'test'; }).sort() : [];
  return JSON.stringify(held) === JSON.stringify(['api.js', 'busy.json', 'data.js', 'element', 'element.js', 'preferences.json', 'red.json', 'run.json', 'script.classify.json', 'script.get.json', 'subscribe.json', 'suite.search.json', 'suite.success.json', 'testicle.js', 'testicle.json', 'testicle.search.json', 'testicle.set.json', 'unsubscribe.json']) || 'its folder holds ' + short(held);
}, test.limit.quick);
// spirit/app/testicle/element/ PROPERLY DONE (goal/G47.1, box v134: "every part of testicle's face an element of its own in
// element/<name>/<name>.js with its own test (the file detail, the monitor row with the status box, the settings panel);
// element.js only mounts them and the searches; each loads its own, mounts empty, judged by -browser"; Andy: "what you're
// doing with this monolith style of coding, your avoiding precise quality control").
const PARTS = path.join(APP, 'element');
// Box v135: "just spirit/app/testicle/element/<element-name>.js, its test in element/test/<element-name>.js, no folder per
// element. the three: element/scriptDetail.js, element/statusBox.js, element/settingsPanel.js".
const PART_NAMES = ['scriptDetail', 'settingsPanel', 'statusBox'];
// And the searches, moved there by Andy (6eb9e4f5, d94d6e08, 1db7136e; box v141: "spirit/app/testicle/element/search/suite.js
// and ./suite/, testicle.js and ./testicle/").
test.run('its element/ folder holds scriptDetail.js, settingsPanel.js and statusBox.js, its search/ folder and its test/ folder, nothing else', 0.4, function () {
  let held = []; try { held = fs.readdirSync(PARTS).sort(); } catch (e) { held = []; }
  return JSON.stringify(held) === JSON.stringify(['scriptDetail.js', 'search', 'settingsPanel.js', 'statusBox.js', 'test']) || 'element/ holds ' + short(held);
}, test.limit.quick);
test.run('each part has its own test, element/test/<name>.js', 0.4, function () {
  const bad = PART_NAMES.filter(function (n) { return !fs.existsSync(path.join(PARTS, 'test', n + '.js')); });
  return !bad.length || 'no own test: ' + short(bad);
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

// Box v134: each part loads its own and stands as an element of its own, so any app can mount it.
test.run('once the face is mounted, each part stands at spirit.element.spirit.app.testicle.element.<name> with a create', 0.4, async function () {
  if (face()) return face();
  const got = await c.evaluate('(function () { var n = ' + JSON.stringify(PART_NAMES) + '; var at = (((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element || {}); return n.filter(function (k) { return !(at[k] && typeof at[k].create === "function"); }); }())');
  return (Array.isArray(got) && !got.length) || 'not standing with a create: ' + short(got);
}, test.limit.slow);

// the box: "a workBench with one 📁 icon"
test.run('the world: the workBench\'s left strip is drawn', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('icons("left") && icons("left").length > 0')) || 'no left strip: ' + short(await T('icons("left")'));
}, test.limit.slow);
// goal/G47.1, box v79, 2: "a new left-strip-icon in the UI: ⚙", "the second icon below the existing one".
test.run('its left strip holds two icons, 📁 then ⚙', 0.2, async function () {
  if (face()) return face();
  const left = await T('icons("left")');
  return (Array.isArray(left) && left.length === 2 && /📁/.test(left[0]) && /⚙/.test(left[1])) || 'the left strip holds ' + short(left);
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
test.run('its tab shows the testicle search, spirit/app/testicle/element/search/testicle.js, which the face loads', 0.2, async function () {
  if (face()) return face();
  const loaded = /['"]spirit\/app\/testicle\/element\/search\/testicle\.js['"]/.test(code(FACE));
  const there = await c.evaluate('!!(((((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element || {}).search || {}).testicle)');
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
// course, publishes changes", "the suite search is spirit/app/testicle/element/search/suite.js and its folder".
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
test.run('the suite search is spirit/app/testicle/element/search/suite.js, which the face loads', 0.2, function () {
  const srcNow = code(FACE);
  return (/['"]spirit\/app\/testicle\/element\/search\/suite\.js['"]/.test(srcNow) && fs.existsSync(path.join(RUN, 'spirit', 'app', 'testicle', 'element', 'search', 'suite.js'))) || 'the face does not load spirit/app/testicle/element/search/suite.js, or it is not there';
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

// goal/G47.1, the box: "A script tab shows, right under its title line, the name of the script's own test in red when that
// test is missing on disc: the folder test/ beside the script, the same file name (for spirit/app/x/x.js,
// spirit/app/x/test/x.js) ... When the own test is there, nothing shows in that place. It follows the disc: once the test
// file is written, the red name goes by itself" (Andy: "the script tabs, right under the title line, must show A RED test
// file name, if the scripts "personal" test is missing."). alsoShown.js has no own test; shown.js has; eta.js gets one.
const alsoOwn = 'spirit/zzTesticle/inner/test/alsoShown.js';
test.run('a script with no own test shows that test\'s name in red, right under its title line', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('shown() && shown().first === ' + JSON.stringify(F2) + ' && underTitle() && underTitle().text === ' + JSON.stringify(alsoOwn) + ' && underTitle().red', 10000)) || 'under alsoShown.js\'s title: ' + short(await T('underTitle()'));
}, test.limit.slow);
test.run('a script with its own test shows no red name under its title line', 0.2, async function () {
  if (face()) return face();
  if (!(await T('click(' + JSON.stringify(F1) + ')')) || !(await waitFor('shown() && shown().first === ' + JSON.stringify(F1) + ' && shown().rows.length > 0', 10000))) return 'shown.js\'s detail: ' + short(await T('shown()'));
  await sleep(500);
  const u = await T('underTitle()');
  return (!!u && !u.red) || 'under shown.js\'s title: ' + short(u);
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
test.run('the world: before its own test is written, eta.js shows that test\'s name in red', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('underTitle() && underTitle().text === ' + JSON.stringify(etaOwn) + ' && underTitle().red', 5000)) || 'under eta.js\'s title: ' + short(await T('underTitle()'));
}, test.limit.slow);
test.run('a suite written for the file shows in its open detail, with no click: the detail listens, the server publishes', 0.2, async function () {
  if (face()) return face();
  fs.mkdirSync(path.join(s.run, 'spirit', 'zzTesticle', 'test'), { recursive: true });
  fs.writeFileSync(path.join(s.run, etaOwn), '\'use strict\';\n// the new test of eta\n');
  return !!(await until(function () { return T('shown()').then(function (d) { return !!d && d.rows.some(function (r) { return r.key === etaOwn || String(r.text).indexOf(etaOwn) !== -1; }); }); }, 10000)) || 'the detail after the new suite: ' + short(await T('shown()'));
}, test.limit.slow);
test.run('once its own test is written, the red name goes by itself', 0.2, async function () {
  if (face()) return face();
  return !!(await waitFor('shown() && shown().first === ' + JSON.stringify(F3) + ' && underTitle() && !underTitle().red && underTitle().text !== ' + JSON.stringify(etaOwn), 10000)) || 'under eta.js\'s title: ' + short(await T('underTitle()'));
}, test.limit.slow);
// goal/G47.1, the box: "Every element of testicle's face updates itself in response to the server stream: what the server
// streams, a row or busy, shows in every element drawing it, never asked again and never waiting for a reload" (Andy: "ADD to
// THIS cycle, EVERY element updates itself in response to the server stream."). eta's own test removed: the server marks its
// suite row deleted and streams it; the open detail drops it with no click.
test.run('a suite removed from disc shows so in the open detail by itself: the deleted row streamed is drawn', 0.2, async function () {
  if (face()) return face();
  fs.rmSync(path.join(s.run, etaOwn), { force: true });
  const live = function (r) { return (r.key === etaOwn || r.key === F3 + '|' + etaOwn || String(r.text).indexOf(etaOwn) !== -1) && !/deleted/i.test(String(r.text)); };
  return !!(await until(function () { return T('shown()').then(function (d) { return !!d && d.first === F3 && d.rows.length > 0 && !d.rows.some(live); }); }, 10000)) || 'the detail after the suite is removed, its row neither gone nor drawn deleted: ' + short(await T('shown()'));
}, test.limit.slow);
test.run('the world: eta\'s own test is written again', 0.2, async function () {
  if (face()) return face();
  fs.writeFileSync(path.join(s.run, etaOwn), '\'use strict\';\n// the test of eta, again\n');
  return !!(await until(function () { return T('shown()').then(function (d) { return !!d && d.rows.some(function (r) { return r.key === etaOwn || r.key === F3 + '|' + etaOwn || String(r.text).indexOf(etaOwn) !== -1; }); }); }, 10000)) || 'the detail: ' + short(await T('shown()'));
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
// goal/G47.1, the box: "testicle's face has a monitor row above the workbench. It shows first the busy status in icon form,
// 🛌 idle (sleeping), 🚶‍➡️ working, as the server streams it ... then the last change: a row added, deleted or updated in
// any of its three tables", "The row has a constant height, and the message is ellipsed, never wrapped", "busy is streamed by
// the server ... the page never asks testicle.busy". Its icons are recorded from here, so iota's run below is seen.
test.run('above the workbench, a monitor row, its first a busy icon, 🛌 or 🚶‍➡️', 0.2, async function () {
  if (face()) return face();
  const ok = await waitFor('monitor() && monitor().benchTop !== null && monitor().bottom <= monitor().benchTop + 0.5', 10000);
  return !!ok || 'the monitor row: ' + short(await T('monitor()'));
}, test.limit.slow);
// goal/G47.1, box v80, 2: "the status display has one extra icon at the beginning: 🤖 auto / 🖖 interactive, ahead of the
// 🛌/🚶‍➡️ icon, from the stream." The scratch node starts interactive, the default.
test.run('the monitor row\'s first icon is the mode, 🖖 interactive at the start, ahead of the busy icon', 0.2, async function () {
  if (face()) return face();
  const ok = await waitFor('monitor() && monitor().mode === "🖖"', 10000);
  return !!ok || 'the monitor row: ' + short(await T('monitor()'));
}, test.limit.slow);
test.run('the face never asks testicle.busy: the icon is what the server streams', 0.2, function () {
  const files = ['spirit/app/testicle/element.js', 'spirit/app/testicle/data.js'];
  const asks = files.filter(function (f) { return /testicle\s*(\.\s*busy\b|\[\s*['"]busy['"]\s*\])/.test(code(path.join(RUN, f))); });
  return !asks.length || short(asks) + ' asks testicle.busy';
}, test.limit.quick);
test.run('the world: the monitor\'s icons are recorded from here', 0.2, async function () {
  if (face()) return face();
  return (await T('recordIcons()')) === true || 'no recorder';
}, test.limit.quick);

// THE FIRST START CLASSIFIES THE TREE (goal/G47.1, box v95, 5 and box v94, 1: at start every script of the scratch tree gets
// its row, and classifying comes before any run; Andy: "if the initial run takes long ... who gives a fuck!"): the press below
// waits for that, so the world waits for testicle to go idle first.
test.run('the world: testicle has brought its tables up to date and classified the tree, and is idle', 0.2, async function () {
  if (face()) return face();
  const idle = await until(function () { return call(N.base, 'testicle.busy', {}).then(function (r) { return r.status === 200 && r.body === false; }); }, 280000);
  return !!idle || 'testicle still busy after 280 s';
}, test.limit.long);
let iotaRows = [], iotaKey = '', searchBefore = 0;
// The rows the shown tab draws, by key.
const searchRows = function () { return T('shown()').then(function (d) { return ((d && d.rows) || []).map(function (r) { return r.key; }); }); };
test.run('the world: iota.js\'s tab is opened, its suites listed', 0.2, async function () {
  if (face()) return face();
  const had = await call(N.base, 'testicle.testicle.search', { script: F5, text: '' });
  // iota's own suite's tests alone: its classifier row (spirit/test/scriptClassify.js, classifyable) is there from the start
  // (goal/G47.1, box v94, 1).
  searchBefore = ((had.body && had.body.items) || []).filter(function (i) { return String(i.key).indexOf(F5 + '|' + iotaOwn + '|') === 0; }).length;
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
  const files = ['spirit/app/testicle/element/search/suite.js', 'spirit/app/testicle/element/search/suite/listElement.js', 'spirit/app/testicle/element/search/suite/rowElement.js', 'spirit/app/testicle/element.js'];
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
// the box: busy "stays the one answer it is today (a write, a wait, files pending, a script.get, a suite running)": iota's
// own suite waits three seconds before its first test reports, so in that time only the suite running makes the server work.
test.run('before any test of the suite reports, the suite running alone shows 🚶‍➡️', 0.2, async function () {
  if (face()) return face();
  const ok = await waitFor('monitor() && monitor().icon === "🚶‍➡️"', 2000);
  return !!ok || 'the monitor while iota waits: ' + short(await T('monitor()'));
}, test.limit.slow);
test.run('the suite runs: the permanent testicle search tab shows iota\'s tests by itself', 0.2, async function () {
  if (face()) return face();
  const first = ((await T('tabs()')) || [])[0] || {};
  if (!first.name || !(await T('selectTab(' + JSON.stringify(first.name) + ')'))) return 'no first tab to show: ' + short(await T('tabs()'));
  // iota's two tests pass, and the search opens on the reds alone (goal/G47.1, the box: "The testicle search's default
  // equals testicle.red: all scripts, all suites, reds only, most severe first"): green turned on, so they can show.
  if (!(await T('filterOn("green")'))) return 'no green filter in the search tab';
  // A scratch node's whole tree holds more green rows than one answer: the words narrow to iota's (testicle.search,
  // spirit/app/testicle/api.js: "the words narrowing them").
  if (!(await T('typeCenter("zzTesticle/test/iota")'))) return 'no search field in the search tab';
  const ok = await until(function () { return searchRows().then(function (k) { return (k || []).filter(function (x) { return x.indexOf(F5 + '|' + iotaOwn + '|') === 0; }).length >= 2; }); }, 40000);
  return (!!ok && searchBefore === 0) || 'iota\'s tests on the node before the press ' + searchBefore + '; the search tab now shows ' + short(((await searchRows()) || []).filter(function (x) { return x.indexOf(F5) === 0; }));
}, test.limit.slow);

// The monitor row, after iota's run: the server worked while the suite it started ran (busy counts it), then slept.
test.run('while a suite the server started runs, the monitor shows 🚶‍➡️', 0.2, async function () {
  if (face()) return face();
  return ((await T('icons_seen()')) || []).indexOf('🚶‍➡️') !== -1 || 'icons seen: ' + short(await T('icons_seen()'));
}, test.limit.quick);
test.run('once the server is back to listening, the monitor shows 🛌', 0.2, async function () {
  if (face()) return face();
  const ok = await waitFor('monitor() && monitor().icon === "🛌" && icons_seen().indexOf("🚶‍➡️") !== -1', 20000);
  return !!ok || 'the monitor: ' + short(await T('monitor()')) + ', icons seen ' + short(await T('icons_seen()'));
}, test.limit.slow);
const LASTFILE = 'spirit/zzTesticle/zzMonitorLast.js';
const LONGFILE = 'spirit/zzTesticle/zzMonitor' + 'Long'.repeat(60) + '.js';
let monitorBefore = null;
test.run('after the icon, the message is the last change: a new script\'s row', 0.2, async function () {
  if (face()) return face();
  fs.writeFileSync(path.join(s.run, LASTFILE), '\'use strict\';\n// a new script, for the monitor\n');
  const ok = await waitFor('monitor() && monitor().message.indexOf("zzMonitorLast.js") !== -1', 15000);
  monitorBefore = await T('monitor()');
  return !!ok || 'the monitor: ' + short(monitorBefore);
}, test.limit.slow);
test.run('a long message leaves the row\'s height as it was', 0.2, async function () {
  if (face()) return face();
  if (!monitorBefore) return 'no monitor row before';
  fs.writeFileSync(path.join(s.run, LONGFILE), '\'use strict\';\n// a script with a long name, for the monitor\n');
  const ok = await waitFor('monitor() && monitor().message.indexOf("LongLongLong") !== -1', 15000);
  const m = await T('monitor()');
  return (!!ok && Math.abs(m.height - monitorBefore.height) < 0.5) || 'height before ' + monitorBefore.height + ', now ' + short(m);
}, test.limit.slow);
test.run('a long message is ellipsed, never wrapped', 0.2, async function () {
  if (face()) return face();
  const m = await T('monitor()');
  return (!!m && m.nowrap && m.ellipsis && m.hidden && m.overflows) || 'the message: ' + short(m);
}, test.limit.quick);

// ── goal/G47.1, box v79, 2 and 4: the ⚙ Configuration panel ──
// "this icon opens a panel in the left workbench pane, titled: \"⚙ Configuration\"", "the one switch it maintains in a
// rowForm is: interactive | auto, default \"interactive\"", "It is the preference interactive: true is interactive, false is
// auto." 4: "a set is published to testicle's subscribers, so the ⚙ panel and any other page follow it."
// The page's hands for it, markup-blind: the ⚙ button pressed; the left pane's text; the switch's two choices found by their
// words; the one shown as chosen (a select's selected option, a checked radio, or the pressed, checked or bold choice).
const GEAR = '(function () { var b = document.getElementById("zzBox"); var t = b ? Array.prototype.slice.call(b.querySelectorAll("button[data-side=\\"left\\"][data-tool]")).filter(function (i) { return /⚙/.test(String(i.textContent || "") + String(i.getAttribute("title") || "")); })[0] : null; if (!t) return false; t.click(); return true; }())';
// The toggle (spirit/element/search/app/rowFormToggle.js, as the app list's): its state drawn 🟢 on or 🔴 off, the button
// the other, its words beside. On is interactive (box: "true is interactive, false is auto").
const TOGGLE = '(function () { var l = window.__t.left(); if (!l) return { none: true };' +
  ' var seen = function (e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; };' +
  ' var buttons = Array.prototype.slice.call(l.querySelectorAll("button")).filter(seen);' +
  ' var txt = function (e) { return String(e.innerText || e.textContent || "").trim(); };' +
  ' var tb = buttons.filter(function (x) { return /🟢|🔴/.test(txt(x)); });' +
  ' var all = txt(l); var bt = tb.length ? txt(tb[0]) : "";' +
  ' var rest = all.replace(bt, ""); var state = /🟢/.test(rest) ? "🟢" : /🔴/.test(rest) ? "🔴" : null;' +
  ' return { toggles: tb.length, state: state, button: bt, save: buttons.some(function (x) { return /^save$/i.test(txt(x)); }), selects: l.querySelectorAll("select").length, words: rest.replace("⚙ Configuration", "").replace(/🟢|🔴/g, "").trim().toLowerCase() }; }())';
const PRESS = '(function () { var l = window.__t.left(); var b = l ? Array.prototype.slice.call(l.querySelectorAll("button")).filter(function (x) { return /🟢|🔴/.test(String(x.innerText || x.textContent || "")); })[0] : null; if (!b) return false; b.click(); return true; }())';
const prefsNow = async function () { const r = await call(N.base, 'testicle.preferences', {}); const b = r && r.body; return (b && typeof b.preferences === 'object' && b.preferences) || b || {}; };
let gear = false;
test.run('the world: ⚙ on the left strip is pressed', 0.2, async function () {
  if (face()) return face();
  gear = !!(await c.evaluate(GEAR));
  return gear || 'no ⚙ on the left strip: ' + short(await T('icons("left")'));
}, test.limit.quick);
test.run('it opens a panel in the left pane, titled "⚙ Configuration"', 0.2, async function () {
  if (!gear) return 'no ⚙ pressed: the world failed';
  return !!(await waitFor('leftSays().shown && left().innerText.indexOf("⚙ Configuration") !== -1', 10000)) || 'the left pane: ' + short(await T('leftSays()'));
}, test.limit.slow);
test.run('its switch is the app\'s toggle form: one toggle, no Save button, no select', 0.2, async function () {
  if (!gear) return 'no ⚙ pressed: the world failed';
  await waitFor('left().innerText.indexOf("🟢") !== -1 || left().innerText.indexOf("🔴") !== -1', 10000);
  const t = await c.evaluate(TOGGLE);
  return (!!t && t.toggles === 1 && t.save === false && t.selects === 0) || 'the panel: ' + short(t);
}, test.limit.slow);
test.run('its words say what it switches: interactive or auto', 0.2, async function () {
  if (!gear) return 'no ⚙ pressed: the world failed';
  const t = await c.evaluate(TOGGLE);
  return (!!t && /interactive|auto/.test(t.words || '')) || 'the words: ' + short(t);
}, test.limit.quick);
test.run('it shows interactive at the start, the default: the toggle on, 🟢', 0.2, async function () {
  if (!gear) return 'no ⚙ pressed: the world failed';
  const t = await c.evaluate(TOGGLE);
  return (!!t && t.state === '🟢') || 'the toggle: ' + short(t);
}, test.limit.quick);
let pressed = false;
test.run('one press of the toggle sends it at once: the node\'s preference interactive is false, nothing else pressed', 0.2, async function () {
  if (!gear) return 'no ⚙ pressed: the world failed';
  pressed = !!(await c.evaluate(PRESS));
  if (!pressed) return 'no toggle to press: ' + short(await c.evaluate(TOGGLE));
  const ok = await until(function () { return prefsNow().then(function (p) { return p.interactive === false; }); }, 5000);
  return !!ok || 'the node\'s preferences: ' + short(await prefsNow());
}, test.limit.slow);
test.run('the stream sets the switch: the toggle off, 🔴', 0.2, async function () {
  if (!pressed) return 'no toggle pressed: the world failed';
  const ok = await until(function () { return c.evaluate(TOGGLE).then(function (t) { return !!t && t.state === '🔴'; }); }, 10000);
  return !!ok || 'the toggle: ' + short(await c.evaluate(TOGGLE));
}, test.limit.slow);
test.run('and the monitor row\'s first icon follows: 🤖 auto', 0.2, async function () {
  if (!pressed) return 'no toggle pressed: the world failed';
  return !!(await waitFor('monitor() && monitor().mode === "🤖"', 10000)) || 'the monitor row: ' + short(await T('monitor()'));
}, test.limit.slow);
test.run('a set by the verb elsewhere is followed: interactive true shows the toggle on, 🟢, and the monitor 🖖', 0.2, async function () {
  if (!gear) return 'no ⚙ pressed: the world failed';
  await call(N.base, 'testicle.preferences', { interactive: true });
  const ok = await until(function () { return c.evaluate(TOGGLE).then(function (t) { return !!t && t.state === '🟢'; }); }, 10000);
  const m = await waitFor('monitor() && monitor().mode === "🖖"', 10000);
  return (!!ok && !!m) || 'the toggle ' + short(await c.evaluate(TOGGLE)) + ', the monitor ' + short(await T('monitor()'));
}, test.limit.slow);

// ── WHAT TESTICLE IS DOING, SAID IN THE STATUS BAR (Andy, on cw's offer of "classifying 120 of 253" while it classifies,
// "running <suite>" while it tests: "cw, do that", "wsl, test that this is how it's done.") ──
const ZM = 'spirit/zzTesticle/zzMonitorRun.js', ZMS = 'spirit/zzTesticle/test/zzMonitorRun.js';
let msgsAt = false;
test.run('the world: the monitor row\'s messages recorded, and the classifier changed, so every script is classified again', 0.2, async function () {
  if (face()) return face();
  msgsAt = (await T('recordMessages()')) === true;
  fs.appendFileSync(path.join(s.run, 'spirit', 'test', 'scriptClassify.js'), '// the classifier, changed, for the status bar\n');
  return msgsAt || 'no recorder';
}, test.limit.quick);
test.run('while it classifies, the status bar says "classifying N of M", N counting up', 0.2, async function () {
  if (!msgsAt) return 'no recorder: the world failed';
  const ok = await waitFor('messages_seen().filter(function (m) { return /^classifying \\d+ of \\d+$/.test(m); }).length >= 2', 240000);
  const seen = ((await T('messages_seen()')) || []).filter(function (m) { return /^classifying \d+ of \d+$/.test(m); });
  const ns = seen.map(function (m) { return Number(/^classifying (\d+)/.exec(m)[1]); });
  const up = ns.length >= 2 && ns.every(function (n, i) { return i === 0 || n >= ns[i - 1]; });
  return (!!ok && up) || 'classifying messages seen: ' + short(seen.slice(0, 6));
}, test.limit.long);
test.run('while it runs a suite, the status bar says "running <suite> for <script>"', 0.2, async function () {
  if (!msgsAt) return 'no recorder: the world failed';
  fs.mkdirSync(path.join(s.run, 'spirit', 'zzTesticle', 'test'), { recursive: true });
  fs.writeFileSync(path.join(s.run, ZMS), "'use strict';\nconst path = require('path');\nconst test = require(path.join(__dirname, '..', '..', 'test', 'testReport.js'));\ntest.run('the world: zzMonitorRun waits', 0.2, function () { return new Promise(function (r) { setTimeout(function () { r(true); }, 3000); }); }, test.limit.quick);\n");
  fs.writeFileSync(path.join(s.run, ZM), "'use strict';\n// zzMonitorRun\n");
  await until(function () { return call(N.base, 'testicle.suite.search', { script: ZM, text: '' }).then(function (r) { return !!(r.body && (r.body.items || []).length); }); }, 240000);
  const press = await call(N.base, 'testicle.run', { script: ZM, suite: ZMS });
  // Its own test is run: the suite named (cw's build names it by its file name; a general suite adds " for <script>").
  const ok = await waitFor('messages_seen().some(function (m) { return /^running (spirit\\/zzTesticle\\/test\\/)?zzMonitorRun\\.js( for |$)/.test(m); })', 240000);
  return !!ok || 'the press answered ' + press.status + ' ' + short(press.text) + '; messages seen: ' + short(((await T('messages_seen()')) || []).slice(-8));
}, test.limit.long);

// destroy
test.run('destroy leaves its container empty', 0.2, async function () {
  if (face()) return face();
  const after = await c.evaluate('(function () { window.__made.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
  return (after === '' || after === 'gone') || 'after destroy: ' + short(after).slice(0, 200);
}, test.limit.quick);
