'use strict';

// spirit/run/spirit/element/test/panel.js
// The tests of spirit/element/panel.js (spec: ./panel.md; goal/G43.17, Q12: "yes." to panel, in spirit/element/panel.js). Andy's
// box, "What mounts covers its mounter": one generic panel element, used by the appSelector and file, each pane keeping its own
// stack. A real node on a scratch copy of the tracked files, and real clicks in a real Chrome on /face.html, on the appSelector
// as appMigration makes it. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const VENDORED_FOLDERS = require(path.join(RUN, 'spirit', 'fileSystem.js')).VENDORED_FOLDERS;
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

// The code of the tree, its comments out, its tests out: what runs.
function codeNaming(re) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { if (VENDORED_FOLDERS.holds(path.join(d, e.name)) || e.name === 'state' || e.name === 'agents' || e.name === 'test') return; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(RUN));
  return out.filter(function (f) { return /\.(js|html)$/.test(f) && re.test(code(f).replace(/<!--[\s\S]*?-->/g, '')); }).map(function (f) { return path.relative(RUN, f); });
}

const PANEL = path.join(RUN, 'spirit', 'element', 'panel.js');
const USERS = { appSelector: path.join(RUN, 'spirit', 'app', 'app', 'element.js'), file: path.join(RUN, 'spirit', 'app', 'file', 'element.js') };
const PLANT = { 'zzFiles/notes.txt': 'alpha\nbeta\n' };

function scratch() {
  const root = LABH.scratchTree().root;
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
  const child = LABH.startNodeOn(run, port);
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }

// THE PAGE'S HANDS: everything judged is what shows in #zzBox; a hidden layer never counts as shown.
const HANDS = '(function () {' +
  'function box() { return document.getElementById("zzBox"); }' +
  'function seen(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }' +
  'function all(sel) { var b = box(); return b ? Array.prototype.slice.call(b.querySelectorAll(sel)).filter(seen) : []; }' +
  'function closers() { return all("button").filter(function (b) { return String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }); }' +
  'window.__t = {' +
  '  text: function () { var b = box(); return b ? String(b.innerText || "").replace(/\\s+/g, " ") : ""; },' +
  '  rows: function () { return all("tr[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
  '  tiles: function () { return all(".app-icon[data-key]").map(function (t) { return t.getAttribute("data-key"); }); },' +
  '  press: function (k) { var r = all("tr[data-key], .app-icon[data-key]").filter(function (t) { return t.getAttribute("data-key") === k; })[0]; if (!r) return false; (r.querySelector("td:last-child") || r).click(); return true; },' +
  '  type: function (w) { var i = all("input[id$=text]")[0]; if (!i) return false; i.value = w; i.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  '  words: function () { var i = all("input[id$=text]")[0]; return i ? i.value : null; },' +
  '  bars: function () { return closers().map(function (b) { return String(b.parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim(); }); },' +
  '  close: function (label) { var b = closers().filter(function (b) { return String(b.parentElement.innerText || "").indexOf(label) !== -1; }); if (!b.length) return false; b[0].click(); return true; },' +
  '  count: function (sel) { return all(sel).length; },' +
  // A row's own cell pressed, not an action of it: what a press on the row opens.
  '  openRow: function (k) { var r = all("tr[data-key]").filter(function (t) { return t.getAttribute("data-key") === k; })[0]; if (!r) return false; (r.querySelector("td") || r).click(); return true; },' +
  '  depth: function () { var n = window.spirit.elements && window.spirit.elements.navigation; return n && typeof n.depth === "function" ? n.depth() : 0; },' +
  // A mark on what shows now, but not on what showed before: the layer just opened.
  '  markBefore: function () { all("*").forEach(function (e) { e.setAttribute("data-zz-before", "1"); }); return true; },' +
  '  markLayer: function (name) { var n = 0; all("*").forEach(function (e) { if (!e.hasAttribute("data-zz-before")) { e.setAttribute("data-zz-" + name, "1"); n++; } }); return n; },' +
  // A mark on what one selector draws, and all inside it: the layer's own, never the list it covers, which redraws its rows.
  '  markSel: function (name, sel) { var n = 0; all(sel).forEach(function (e) { [e].concat(Array.prototype.slice.call(e.querySelectorAll("*"))).forEach(function (k) { k.setAttribute("data-zz-" + name, "1"); n++; }); }); return n; },' +
  '  marked: function (name) { return document.querySelectorAll("[data-zz-" + name + "]").length; },' +
  '  markedShown: function (name) { return all("[data-zz-" + name + "]").length; },' +
  '}; return "hands"; }())';

// What the tests make, shared by the tests after them.
let pushing, s, live, c, heardBefore, N, where, bars, marks, detail, agent, off, loaded, planted, found, people,
  relay, contact, D, planted2, listBar, a, b, thrown;
test.run('spirit/element/panel.js is there (Q12)', 0.2, function () {
  // the box: "That is one generic panel element, used by the appSelector and file; neither draws it with a <div> of its own (Q3)"
  return (fs.existsSync(PANEL)) ? true : 'no spirit/element/panel.js';
}, test.limit.quick);
test.run('appSelector loads spirit/element/panel.js', 0.2, function () {
  // appSelector and file: each loads the panel, and draws no title bar or close of its own.
  return (/spirit\/element\/panel\.js/.test(code(USERS.appSelector))) ? true : 'appSelector does not load spirit/element/panel.js';
}, test.limit.quick);
test.run('appSelector draws no title bar or close of its own', 0.2, function () {
  return (!!code(USERS.appSelector) && !/✕|app-container/.test(code(USERS.appSelector))) ? true : 'appSelector still draws a ✕ or an app-container';
}, test.limit.quick);
test.run('file loads spirit/element/panel.js', 0.2, function () {
  return (/spirit\/element\/panel\.js/.test(code(USERS.file))) ? true : 'file does not load spirit/element/panel.js';
}, test.limit.quick);
test.run('file draws no title bar or close of its own', 0.2, function () {
  return (!!code(USERS.file) && !/✕|app-container/.test(code(USERS.file))) ? true : 'file still draws a ✕ or an app-container';
}, test.limit.quick);
test.run('no app or element under spirit/ calls navigation.push', 0.2, function () {
  // goal/G43.18, Andy: "contact details and relay details should be proper panels in the newest shell style.", and "add it to a
  // general test that panels must be panels....": what opens over its mounter opens as a layer of this element, so no code pushes
  // a page on the navigation for it.
  // The navigation wrapper itself is gone with shell/ (goal/G43.30): nothing opens a page on it any more. The apps and elements
  // are spirit/.
  // Andy: "panels must be panels": no app or element opens a page on the navigation, what it opens over itself is a panel
  pushing = codeNaming(/navigation\.push\s*\(/).filter(function (f) { return f.split(path.sep)[0] === 'spirit'; });
  return (!pushing.length) ? true : pushing.length + ' still do: ' + short(pushing);
}, test.limit.quick);
test.run('the world: a scratch node comes up', 0.2, async function () {
  s = scratch();
  live = [];
  c = null;
  heardBefore = Infinity;
  N = await boot(s.run);
  live.push(N.child);
  return (N.up) ? true : 'the scratch node did not come up: nothing judged';
}, test.limit.slow);
test.run('the world: Chrome is here', 0.2, function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  where = findChrome();
  return (!!where) ? true : 'no Chrome here: the page was not judged';
}, test.limit.quick);
test.run('the world: a Chrome page opens', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  c = await chromePage(where);
  return (!c.error) ? true : 'Chrome: ' + c.error;
}, test.limit.quick);
const open = async function () {
  await c.evaluate('window.__zzOld = true').catch(function () {});
  await c.send('Page.navigate', { url: N.base + '/face.html' });
  const up = await until(function () { return c.evaluate('!window.__zzOld && !!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000);
  await c.evaluate(HANDS);
  return up;
};
test.run('the world: the face shell has its spirit', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  // A new page, not the old one before the reload lands: the old one carries a mark the new one has not.
  return (await open()) ? true : 'the page has no spirit: nothing judged';
}, test.limit.quick);
const T = function (expr) { return c.evaluate('window.__t.' + expr); };
const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 8000); };
const selector = function (face) {
  return c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__sel = spirit.element.spirit.app.app.element.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
};
test.run('the world: the tiles show Files', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  // Every hand in expr is the page's, not only the first: "rows() ... && tiles()" asks both.
  // the box: "An element mounts over ALL of the one that mounts it, its title bar too", under "its own title bar [icon] <label> [✕]"
  await selector('tiles');
  return (await waitFor('tiles().indexOf("file") !== -1', 10000)) ? true : 'tiles: ' + short(await T('tiles()'));
}, test.limit.quick);
test.run('the world: Files opens', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('press("file")');
  return (await waitFor('rows().indexOf("zzFiles") !== -1', 10000)) ? true : 'the app: ' + short(await T('text()'));
}, test.limit.quick);
test.run('Files opens over the tiles under one bar: its icon, its label, ✕', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return (short(await T('bars()')) === short(['📁 Files'])) ? true : 'bars: ' + short(await T('bars()'));
}, test.limit.quick);
test.run('the tiles are out of view under it', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return ((await T('bars()')).length === 1 && (await T('tiles()')).length === 0) ? true : 'tiles: ' + short(await T('tiles()'));
}, test.limit.quick);
test.run('a file opens over Files, in the same pane', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('press("zzFiles")');
  await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1');
  await T('markBefore()');
  await T('press("zzFiles/notes.txt")');
  return (await waitFor('bars().length === 1 && /notes\\.txt$/.test(bars()[0])', 10000)) ? true : 'bars: ' + short(await T('bars()'));
}, test.limit.quick);
test.run('the box: "over ALL of the one that mounts it, its title bar too": one bar in view, an icon, ending in notes.txt', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  bars = await T('bars()');
  return (bars.length === 1 && /^\S+ .*notes\.txt$/.test(bars[0])) ? true : 'bars: ' + short(bars);
}, test.limit.quick);
test.run('the list is out of view under it', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return ((await T('bars()')).length === 1 && (await T('rows()')).length === 0) ? true : 'rows: ' + short(await T('rows()'));
}, test.limit.quick);
test.run('its ✕ shows Files again, under its one bar', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await waitFor('count(".CodeMirror") > 0', 10000);
  marks = await T('markSel("notes", ".CodeMirror")');
  // the box: "✕ shows the mounter again", and "A closed layer is hidden, not destroyed"
  await T('close("notes.txt")');
  return (await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1') && short(await T('bars()')) === short(['📁 Files'])) ? true : 'bars: ' + short(await T('bars()'));
}, test.limit.quick);
test.run('the closed layer is still on the page, out of view', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return (marks > 0 && (await T('marked("notes")')) > 0 && (await T('markedShown("notes")')) === 0) ? true : 'marked ' + marks + ', kept ' + (await T('marked("notes")')) + ', shown ' + (await T('markedShown("notes")'));
}, test.limit.quick);
test.run('reopening it shows what was there: the same layer, not a new one', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('press("zzFiles/notes.txt")');
  return (await waitFor('markedShown("notes") > 0', 10000)) ? true : 'shown ' + (await T('markedShown("notes")')) + ' of ' + marks;
}, test.limit.quick);
test.run('the file\'s ✕ goes one step back, to Files', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  // the box: "One stack; each ✕ goes one step back (Q17)"
  await T('close("notes.txt")');
  return (await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1') && short(await T('bars()')) === short(['📁 Files'])) ? true : 'bars: ' + short(await T('bars()'));
}, test.limit.quick);
test.run('Files\' ✕ goes one more, to the tiles', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('close("Files")');
  return (await waitFor('bars().length === 0 && tiles().indexOf("file") !== -1')) ? true : 'bars: ' + short(await T('bars()')) + ', tiles ' + short(await T('tiles()'));
}, test.limit.quick);
test.run('the Files tile opens it again', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('press("file")');
  return (await waitFor('rows().indexOf("zzFiles") !== -1', 10000)) ? true : 'the app: ' + short(await T('text()'));
}, test.limit.quick);
test.run('reopened in the same session it shows what was there: its words kept', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('type("notes")');
  await sleep(500);
  await T('close("Files")');
  await waitFor('bars().length === 0');
  await T('press("file")');
  return (await waitFor('rows().indexOf("zzFiles/notes.txt") !== -1 && words() === "notes"', 10000)) ? true : 'words: ' + short(await T('words()'));
}, test.limit.slow);
test.run('after a reload Files opens with no words', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  // the box: "a reload starts clean"
  await open();
  await selector('tiles');
  await waitFor('tiles().indexOf("file") !== -1', 10000);
  await T('press("file")');
  return (await waitFor('rows().indexOf("zzFiles") !== -1', 10000) && (await T('words()')) === '') ? true : 'words: ' + short(await T('words()'));
}, test.limit.quick);
test.run('the world: the pane lists the Agent', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  // the box: "The appSelector's ✕ hides too (Q3)"
  await selector('pane');
  return (await waitFor('rows().indexOf("agent") !== -1', 10000)) ? true : 'rows: ' + short(await T('rows()'));
}, test.limit.quick);
test.run('the Agent\'s detail opens under one bar', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('markBefore()');
  await T('press("agent")');
  return (await waitFor('bars().length === 1', 10000)) ? true : 'bars: ' + short(await T('bars()'));
}, test.limit.quick);
test.run('its ✕ hides the detail: still on the page, out of view', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await sleep(1000);
  detail = await T('markLayer("detail")');
  await T('close("Agent")');
  return (await waitFor('bars().length === 0 && rows().indexOf("agent") !== -1') && detail > 0 && (await T('marked("detail")')) > 0) ? true : 'marked ' + detail + ', kept ' + (await T('marked("detail")'));
}, test.limit.slow);
test.run('pressed again, the same detail shows', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('press("agent")');
  return (await waitFor('markedShown("detail") > 0', 10000)) ? true : 'shown ' + (await T('markedShown("detail")'));
}, test.limit.quick);
test.run('the world: the Agent, active, has its tile', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  // the box: "A deactivated app's layer only leaves the view; it stays loaded until the shell boots again, and is not loaded then (Q11)"
  await call(N.base, 'app.active', { key: 'agent', active: true });
  await selector('tiles');
  return (await waitFor('tiles().indexOf("agent") !== -1', 15000)) ? true : 'tiles: ' + short(await T('tiles()'));
}, test.limit.quick);
test.run('the world: its tile opens the Agent', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await T('markBefore()');
  await T('press("agent")');
  return (await waitFor('bars().length === 1', 15000)) ? true : 'bars: ' + short(await T('bars()'));
}, test.limit.quick);
test.run('the world: app.active switches the Agent off', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await sleep(2000);
  agent = await T('markLayer("agent")');
  // What threw is judged up to here: after the switch-off the Agent's kept layer is the Agent's own (Q11: it stays loaded).
  heardBefore = c.heard.length;
  off = await call(N.base, 'app.active', { key: 'agent', active: false });
  return (off.status === 200) ? true : 'app.active: ' + short(off.text);
}, test.limit.slow);
test.run('its open layer leaves the view', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return (await waitFor('markedShown("agent") === 0', 10000)) ? true : 'shown ' + (await T('markedShown("agent")')) + ' of ' + agent;
}, test.limit.quick);
test.run('and stays on the page, loaded', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return (agent > 0 && (await T('marked("agent")')) > 0) ? true : 'marked ' + agent + ', kept ' + (await T('marked("agent")'));
}, test.limit.quick);
test.run('its tile is gone, so it cannot be reopened', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return ((await T('tiles()')).indexOf('agent') === -1) ? true : 'tiles: ' + short(await T('tiles()'));
}, test.limit.quick);
test.run('after the shell boots again none of it is loaded', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await open();
  await selector('tiles');
  await waitFor('tiles().indexOf("file") !== -1', 10000);
  await sleep(2000);
  loaded = await c.evaluate('performance.getEntriesByType("resource").map(function (e) { return e.name.replace(/^https?:\\/\\/[^/]+/, ""); }).filter(function (n) { return /\\/spirit\\/app\\/agent\\//.test(n); })');
  return (Array.isArray(loaded) && !loaded.length && (await c.evaluate('!(window.spirit.app && window.spirit.app.agent) && !(window.spirit.element && window.spirit.element.spirit && window.spirit.element.spirit.app && window.spirit.element.spirit.app.agent)'))) ? true : 'loaded: ' + short(loaded);
}, test.limit.slow);
const zzKey = require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
test.run('the world: a person is in the book', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  // goal/G43.18, Andy: "contact details and relay details should be proper panels in the newest shell style."
  // Andy: "contact details and relay details should be proper panels in the newest shell style."
  // A person in the book beside the relay the node starts with: a key of our own, blocked, so the book holds it.
  planted = await call(N.base, 'contact.block', { publicKey: zzKey, publicLabel: 'zzPerson' });
  return (planted.status === 200) ? true : 'contact.block: ' + short(planted.text);
}, test.limit.quick);
const detailsOf = async function (who) {
  const d = {};
  await selector('tiles');
  await waitFor('tiles().indexOf("contact") !== -1', 10000);
  await T('press("contact")');
  d.listed = await waitFor('bars().length === 1 && rows().indexOf(' + JSON.stringify(who.key) + ') !== -1', 10000);
  d.shown = 'bars: ' + short(await T('bars()')) + ', rows: ' + short(await T('rows()'));
  const contacts = (await T('bars()'))[0];
  d.depth = await T('depth()');
  await T('openRow(' + JSON.stringify(who.key) + ')');
  d.over = await waitFor('bars().length === 1 && bars()[0] !== ' + JSON.stringify(contacts), 10000);
  d.overBars = 'bars: ' + short(await T('bars()'));
  d.rows = await T('rows()');
  d.depthNow = await T('depth()');
  const own = (await T('bars()'))[0];
  await T('close(' + JSON.stringify(String(own || '').slice(-12)) + ')');
  d.back = await waitFor('bars().length === 1 && bars()[0] === ' + JSON.stringify(contacts) + ' && rows().indexOf(' + JSON.stringify(who.key) + ') !== -1', 10000);
  d.backBars = 'bars: ' + short(await T('bars()')) + ', rows: ' + short(await T('rows()'));
  return d;
};
test.run('the world: the node knows a relay', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  found = await call(N.base, 'contact.search', { q: '' });
  people = ((found.body && found.body.items) || []).map(function (i) { return Object.assign({ key: i.key }, parsed(i.label) || {}); });
  // Each kind's flow, its results kept for its checks: Contacts opened, the row's details opened over it, and closed.
  relay = people.filter(function (p) { return p.relay === true; })[0];
  contact = people.filter(function (p) { return p.relay !== true; })[0];
  return (!!relay) ? true : 'the world: no relay on the scratch node: ' + short(people);
}, test.limit.quick);
test.run('the world: the node knows a contact', 0.2, function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return (!!contact) ? true : 'the world: no contact on the scratch node: ' + short(people);
}, test.limit.quick);
D = {};
test.run('the world: Contacts opens and lists the relay', 0.2, async function () {
  if (!relay) return 'no relay on the scratch node: the world failed';
  D.relay = await detailsOf(relay);
  return D.relay.listed || D.relay.shown;
}, test.limit.quick);
test.run('the relay\'s details open over Contacts under one bar of their own', 0.2, function () {
  if (!D.relay) return 'the relay was not opened: the world failed';
  return D.relay.over || D.relay.overBars;
}, test.limit.quick);
test.run('the list is out of view under them', 0.2, function () {
  if (!D.relay) return 'the relay was not opened: the world failed';
  return D.relay.rows.indexOf(relay.key) === -1 || 'rows: ' + short(D.relay.rows);
}, test.limit.quick);
test.run('no page is pushed on the navigation', 0.2, function () {
  if (!D.relay) return 'the relay was not opened: the world failed';
  return D.relay.depthNow === D.relay.depth || 'the navigation went from ' + D.relay.depth + ' to ' + D.relay.depthNow;
}, test.limit.quick);
test.run('their ✕ shows Contacts again, one step back', 0.2, function () {
  if (!D.relay) return 'the relay was not opened: the world failed';
  return D.relay.back || D.relay.backBars;
}, test.limit.quick);
test.run('the world: Contacts opens and lists the contact', 0.2, async function () {
  if (!contact) return 'no contact on the scratch node: the world failed';
  D.contact = await detailsOf(contact);
  return D.contact.listed || D.contact.shown;
}, test.limit.quick);
test.run('the contact\'s details open over Contacts under one bar of their own', 0.2, function () {
  if (!D.contact) return 'the contact was not opened: the world failed';
  return D.contact.over || D.contact.overBars;
}, test.limit.quick);
test.run('the contact: the list is out of view under them', 0.2, function () {
  if (!D.contact) return 'the contact was not opened: the world failed';
  return D.contact.rows.indexOf(contact.key) === -1 || 'rows: ' + short(D.contact.rows);
}, test.limit.quick);
test.run('the contact: no page is pushed on the navigation', 0.2, function () {
  if (!D.contact) return 'the contact was not opened: the world failed';
  return D.contact.depthNow === D.contact.depth || 'the navigation went from ' + D.contact.depth + ' to ' + D.contact.depthNow;
}, test.limit.quick);
test.run('the contact: their ✕ shows Contacts again, one step back', 0.2, function () {
  if (!D.contact) return 'the contact was not opened: the world failed';
  return D.contact.back || D.contact.backBars;
}, test.limit.quick);
const zzKey2 = require('crypto').generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
test.run('the world: a second person is in the book', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  // goal/G43.18, Andy: "now you need to give each contact row its own detail panel, similar to the concept where tabs in
  // "agent" can hold the same ui for different rows, thing of the contact list in the exact same way."
  // Andy: "give each contact row its own detail panel", as the agent's tabs hold the same ui for different rows
  planted2 = await call(N.base, 'contact.block', { publicKey: zzKey2, publicLabel: 'zzPersonTwo' });
  return (planted2.status === 200) ? true : 'contact.block: ' + short(planted2.text);
}, test.limit.quick);
test.run('the world: Contacts lists both', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await selector('tiles');
  await waitFor('tiles().indexOf("contact") !== -1', 10000);
  await T('press("contact")');
  return (await waitFor('rows().indexOf(' + JSON.stringify(zzKey) + ') !== -1 && rows().indexOf(' + JSON.stringify(zzKey2) + ') !== -1', 10000)) ? true : 'rows: ' + short(await T('rows()'));
}, test.limit.quick);
const openOne = async function (key, mark) {
await T('markBefore()');
await T('openRow(' + JSON.stringify(key) + ')');
const up = await waitFor('bars().length === 1 && bars()[0] !== ' + JSON.stringify(listBar), 10000);
await sleep(1000);
return up ? T('markLayer(' + JSON.stringify(mark) + ')') : 0;
};
const closeOne = async function () { const b = (await T('bars()'))[0]; await T('close(' + JSON.stringify(String(b || '').slice(-12)) + ')'); return waitFor('bars()[0] === ' + JSON.stringify(listBar), 10000); };
const inView = function () { return c.evaluate('String((document.getElementById("zzBox") || {}).innerText || "")'); };
const showsOwn = function (handle) { return inView().then(function (t) { return /Public Handle/.test(t) && /Unblock/.test(t) && new RegExp('Public Handle\\s*' + handle + '(?![A-Za-z])').test(t); }); };
test.run('the world: the first person\'s details open', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  listBar = (await T('bars()'))[0];
  // One row's details: what it draws is marked, then closed.
  // Andy: "the first detail shows the right data, the second row i open always shows nothing.... THAT's the problem.": each
  // panel shows its own row, read from what is in view: its Public Handle fact (detailElement.js) and, blocked, Unblock.
  a = await openOne(zzKey, 'rowA');
  return (a > 0) ? true : 'nothing drew for the first person';
}, test.limit.slow);
test.run('the first person\'s panel shows their data: Public Handle zzPerson, Unblock', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return (await until(function () { return showsOwn('zzPerson'); }, 8000)) ? true : 'the first panel shows: ' + short(await c.evaluate('String((document.getElementById("zzBox") || {}).innerText || "")'));
}, test.limit.quick);
test.run('the second person\'s panel shows their own data: Public Handle zzPersonTwo, Unblock', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await closeOne();
  b = await openOne(zzKey2, 'rowB');
  return (await until(function () { return showsOwn('zzPersonTwo'); }, 8000)) ? true : 'the second panel shows: ' + short(await c.evaluate('String((document.getElementById("zzBox") || {}).innerText || "")'));
}, test.limit.slow);
test.run('the second person\'s details are a panel of their own: new, and the first\'s out of view', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return (b > 0 && (await T('markedShown("rowA")')) === 0) ? true : 'drawn for the second ' + b + ', the first\'s shown ' + (await T('markedShown("rowA")'));
}, test.limit.quick);
test.run('and the first person\'s panel is kept, not drawn over', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  return ((await T('marked("rowA")')) > 0) ? true : 'the first person\'s panel is gone: marked ' + (await T('marked("rowA")'));
}, test.limit.quick);
test.run('the first person pressed again: their own panel shows, as it was left, with their data', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await closeOne();
  await T('openRow(' + JSON.stringify(zzKey) + ')');
  return (await waitFor('markedShown("rowA") > 0 && markedShown("rowB") === 0', 10000) && await showsOwn('zzPerson')) ? true : 'shown: first ' + (await T('markedShown("rowA")')) + ', second ' + (await T('markedShown("rowB")'));
}, test.limit.quick);
test.run('no uncaught error on the page outside the Agent, up to the Agent switched off', 0.2, async function () {
  if (!N || !N.up) return 'no scratch node: the world failed';
  if (!where) return 'no Chrome here: the world failed';
  if (!c || c.error) return 'no Chrome page: the world failed';
  await closeOne();
  // nothing threw on the page
  // The Agent is the world here, opened with no agent server on the scratch node; what its own table throws is the Agent's, not
  // the panel's (its stack in spirit/app/agent/).
  thrown = c.heard.slice(0, heardBefore).filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; })
  .filter(function (t) { return !/^\s+at .*spirit\/app\/agent\//m.test(String(t)); });
  return (!thrown.length) ? true : 'thrown: ' + short(thrown);
}, test.limit.quick);
test.after(async function () {
  if (N) await stop(N.child);
  (live || []).forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
  if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
  await sleep(300);
  try { if (s) LABH.freeTree(s); } catch (e) { /* a door still closing; the temp folder keeps it */ }
});
