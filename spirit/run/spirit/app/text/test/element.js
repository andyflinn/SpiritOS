'use strict';

// spirit/run/spirit/app/text/test/element.js
// The tests of spirit/app/text/element.js for goal/G43.17, whose box built it first: "Four elements: file, fstat, text and media",
// and "text and media take a file when mounted, and show their whole selves with it, the file picker too, also when launched from file". With
// one is judged where Files hands it one (../../file/test/file.js); here it is mounted with none. A real node on a scratch copy of
// the tracked files and a real Chrome on /face.html; neither Andy's node nor an agent's is touched.

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

const NAME = 'text';
const APP = path.join(RUN, 'spirit', 'app', NAME);
// The box: "[✏️] "Text Editor:" + file-name; [icon] "Media Viewer:" + file-name, the icon ... the media viewer's own while no
// file is picked (Q15)".
const LABEL = { text: 'Text Editor', media: 'Media Viewer' }[NAME];
const ICON = NAME === 'text' ? '✏️' : ((readJson(path.join(APP, NAME + '.json')) || {}).identity || {}).icon;

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

function scratch() {
  const root = LABH.scratchTree().root;
  return { root: root, run: path.join(root, 'spirit', 'run') };
}
async function boot(run) {
  const port = await freePort();
  const child = LABH.startNodeOn(run, port);
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; }); }, 60000);
  return { child: child, base: base, up: !!up };
}

// text.js: with no file it shows the file picker (goal/G43.17). One test.run per test (goal/G47.2).
// What the world made, for the tests after it.
const W = {};
test.after(async function () {
  if (W.child) { try { W.child.kill(); } catch (e) { /* gone */ } }
  if (W.c && W.c.kid) { try { W.c.kid.kill(); } catch (e) { /* gone */ } }
  await sleep(300);
  if (W.s) { try { LABH.freeTree(W.s); } catch (e) { /* a door still closing; the temp folder keeps it */ } }
});
const NO_NODE = 'no scratch node: the world failed';
const NO_PAGE = 'no page: the world failed';

// the box: "Four elements: file, fstat, text and media", and "New never requires old"
test.run('its element file is there', 0.2, function () {
  return !!code(path.join(APP, 'element.js')) || 'no spirit/app/' + NAME + '/element.js';
}, test.limit.quick);
test.run('it names neither the old shell nor a shell/ path', 0.2, function () {
  const own = code(path.join(APP, 'element.js'));
  return !!own && !/shell\/|spirit\.shell\b|\.shell\./.test(own) ? true : NAME + '.js names the old shell';
}, test.limit.quick);
test.run('it loads the files list it draws its picker with', 0.2, function () {
  const own = code(path.join(APP, 'element.js'));
  return !!own && /spirit\/element\/search\/file\.js/.test(own) ? true : NAME + '.js does not load the files list';
}, test.limit.quick);

test.run('the world: a scratch node comes up', 0.2, async function () {
  W.s = scratch();
  const N = W.N = await boot(W.s.run); W.child = N.child;
  return N.up || 'the scratch node did not come up: nothing judged';
}, test.limit.slow);
test.run('the world: a Chrome page', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const where = findChrome();
  if (!where) return 'no Chrome here: the page was not judged';
  W.c = await chromePage(where);
  if (W.c.error) { const e = W.c.error; W.c = null; return 'Chrome: ' + e; }
  return true;
}, test.limit.quick);
test.run('the world: the face shell has its spirit', 0.2, async function () {
  if (!W.c) return 'no Chrome page: the world failed';
  await W.c.send('Page.navigate', { url: W.N.base + '/face.html' });
  W.page = !!(await until(function () { return W.c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000));
  return W.page || 'the page has no spirit: nothing judged';
}, test.limit.quick);

// the box: "without one they show it"
test.run('its element\'s create(container) answers { destroy }', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const made = await W.c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/' + NAME + '/element.js").then(function () { var E = ((spirit.element.spirit.app || {})[' + JSON.stringify(NAME) + '] || {}).element; if (!E || typeof E.create !== "function") return "no spirit.element.spirit.app.' + NAME + '.element.create"; window.__m = E.create(b); return window.__m && typeof window.__m.destroy === "function" ? "ok" : "create answered " + typeof window.__m; }, function (e) { return "load: " + e; }); }())');
  return made === 'ok' || NAME + ': ' + short(made);
}, test.limit.quick);
// A file picker is the files list as a dropdown (G43.16's box): its field, a button (spirit/element/search.js).
test.run('mounted with no file, it shows the file picker', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  W.picker = await until(function () { return W.c.evaluate('Array.prototype.some.call(document.querySelectorAll("#zzBox button[id$=field]"), function (b) { return b.getClientRects().length > 0; })'); }, 10000);
  return !!W.picker || 'the box: ' + short(await W.c.evaluate('(document.getElementById("zzBox") || {}).innerText || ""'));
}, test.limit.quick);
// The box: "That row is a bubble of the same kind as rowForm uses": rowForm's root is .shell-bubble (spirit/element/rowForm.js).
test.run('the box: the picker sits in a bubble of the kind rowForm uses', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const bubbled = await W.c.evaluate('Array.prototype.filter.call(document.querySelectorAll("#zzBox button[id$=field]"), function (b) { return b.getClientRects().length > 0; }).every(function (b) { return !!b.closest(".shell-bubble"); })');
  return !!W.picker && bubbled ? true : 'the picker is not in a .shell-bubble';
}, test.limit.quick);
// The box: "Rows are inline, not boxes: they fold when the width gets smaller."
test.run('the box: in a narrow pane the row folds, nothing past its edge', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const folded = await W.c.evaluate('(function () { var b = document.getElementById("zzBox"); b.style.width = "120px"; return new Promise(function (r) { setTimeout(r, 400); }).then(function () { var row = (document.querySelector("#zzBox button[id$=field]") || {}).closest ? document.querySelector("#zzBox button[id$=field]").closest(".shell-bubble") : null; if (!row) return "no row"; var w = row.getBoundingClientRect(), o = b.getBoundingClientRect(); var out = row.scrollWidth > row.clientWidth + 1 || w.right > o.right + 1; b.style.width = "100%"; return out ? "past the box: " + Math.round(w.right) + " of " + Math.round(o.right) + ", scroll " + row.scrollWidth + " of " + row.clientWidth : "ok"; }); }())');
  return folded === 'ok' || 'narrow: ' + short(folded);
}, test.limit.quick);
test.run('destroy leaves its container empty', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const gone = await W.c.evaluate('(function () { if (!window.__m) return "nothing made"; window.__m.destroy(); return document.getElementById("zzBox").innerHTML === "" ? "ok" : "left " + document.getElementById("zzBox").innerHTML.length; }())');
  return gone === 'ok' || 'destroy: ' + short(gone);
}, test.limit.quick);

// the box: its title bar, ✏️ "Text Editor:" + file-name, and its own icon while no file is picked
test.run('the world: app.active switches it on', 0.2, async function () {
  if (!W.N || !W.N.up) return NO_NODE;
  const on = await fetch(W.N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: NAME, active: true } }) }).then(function (r) { return r.status; }, function () { return 0; });
  return on === 200 || 'app.active of ' + NAME + ' answered ' + on;
}, test.limit.quick);
test.run('the world: its tile is there and pressed', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  await W.c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzSel"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:10000;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__sel = spirit.element.spirit.app.app.element.create(b, { face: "tiles" }); return "made"; }); }())');
  const pressed = await until(function () { return W.c.evaluate('(function () { var t = document.querySelector("#zzSel .app-icon[data-key=' + NAME + ']"); if (!t) return false; t.click(); return true; }())'); }, 15000);
  return !!pressed || 'no tile ' + NAME;
}, test.limit.quick);
test.run('the one bar in view reads its icon and its label, no file picked', 0.2, async function () {
  if (!W.page) return NO_PAGE;
  const readBar = function () { return W.c.evaluate('(function () { var x = Array.prototype.filter.call(document.querySelectorAll("#zzSel button"), function (b) { return b.getClientRects().length > 0 && String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }); return x.length === 1 ? String(x[0].parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim() : ""; }())'); };
  await until(readBar, 10000);
  const bar = await readBar();
  return !!ICON && typeof bar === 'string' && bar.indexOf(ICON + ' ' + LABEL) === 0 ? true : 'bar: ' + short(bar) + ', wanted ' + ICON + ' ' + LABEL;
}, test.limit.quick);

// nothing threw on the page
test.run('no uncaught error on the page', 0.2, async function () {
  if (!W.c) return NO_PAGE;
  await sleep(300);
  const thrown = W.c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
  return !thrown.length || 'thrown: ' + short(thrown);
}, test.limit.quick);
