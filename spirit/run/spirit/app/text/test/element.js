'use strict';

// spirit/run/spirit/app/text/test/element.js
// The tests of spirit/app/text/element.js for goal/G43.17, whose box built it first: "Four elements: file, fstat, text and media",
// and "text and media take a file when mounted, and show their whole selves with it, the file picker too, also when launched from file". With
// one is judged where Files hands it one (../../file/test/file.js); here it is mounted with none. A real node on a scratch copy of
// the tracked files and a real Chrome on / (spirit/shell/face.html); neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = SPIRIT.requireScript('spirit/test/headLessChrome.js');
const REPO = path.resolve(RUN, '..', '..');
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const { freePort, until, sleep, chromePage, findChrome } = SPIRIT.requireScript('spirit/test/headLessChrome.js');

const NAME = 'text';
const APP = path.join(RUN, 'spirit', 'app', NAME);
// Its id, its folder's path in dots (goal/G49.19): the key app.active takes and its tile carries.
const KEY = 'spirit.app.' + NAME;
// The box: "[✏️] "Text Editor:" + file-name; [icon] "Media Viewer:" + file-name, the icon ... the media viewer's own while no
// file is picked (Q15)".
const LABEL = { text: 'Text Editor', media: 'Media Viewer' }[NAME];
const ICON = NAME === 'text' ? '✏️' : ((readJson(path.join(APP, NAME + '.json')) || {}).identity || {}).icon;

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
  const up = await until(function () { return fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; }); }, 60000);
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

// the box: "Four elements: file, fstat, text and media", and "New never requires old"
test.run('its element file is there', 0.2, function () {
  return !!code(path.join(APP, 'element.js')) || false;
}, test.limit.quick);
test.run('it names neither the old shell nor a shell/ path', 0.2, function () {
  const own = code(path.join(APP, 'element.js'));
  return !!own && !/shell\/|spirit\.shell\b|\.shell\./.test(own) ? true : false;
}, test.limit.quick);
test.run('it loads the files list it draws its picker with', 0.2, function () {
  const own = code(path.join(APP, 'element.js'));
  return !!own && /spirit\/element\/search\/file\/script\.js/.test(own) ? true : false;
}, test.limit.quick);

test.run('a scratch node comes up for this suite', 0.2, async function () {
  W.s = scratch();
  const N = W.N = await boot(W.s.run); W.child = N.child;
  return N.up || false;
}, test.limit.slow);
test.run('a Chrome page opens', 0.2, async function () {
  if (!W.N || !W.N.up) return false;
  const where = findChrome();
  if (!where) return false;
  W.c = await chromePage(where);
  if (W.c.error) { W.c = null; return false; }
  return true;
}, test.limit.quick);
test.run('the face shell has its spirit', 0.2, async function () {
  if (!W.c) return false;
  await W.c.send('Page.navigate', { url: W.N.base + '/' });
  W.page = !!(await until(function () { return W.c.evaluate('!!(window.spirit && window.spirit.readyPromise && window.spirit.eventStream)'); }, 20000));
  return W.page || false;
}, test.limit.quick);

// the box: "without one they show it"
test.run('its element\'s create, handed a container, answers an object with a destroy', 0.2, async function () {
  if (!W.page) return false;
  const made = await W.c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.requireScript("spirit/app/' + NAME + '/element.js").then(function () { var E = ((spirit.required.spirit.app || {})[' + JSON.stringify(NAME) + '] || {}).element; if (!E || typeof E.create !== "function") return false; window.__m = E.create(b); return window.__m && typeof window.__m.destroy === "function" ? "ok" : false; }, function () { return false; }); }())');
  return made === 'ok' || false;
}, test.limit.quick);
// A file picker is the files list as a dropdown (G43.16's box): its field, a button (spirit/element/search/script.js).
test.run('mounted with no file, it shows the file picker', 0.2, async function () {
  if (!W.page) return false;
  W.picker = await until(function () { return W.c.evaluate('Array.prototype.some.call(document.querySelectorAll("#zzBox button[id$=field]"), function (b) { return b.getClientRects().length > 0; })'); }, 10000);
  return !!W.picker || false;
}, test.limit.quick);
// The box: "That row is a bubble of the same kind as rowForm uses": rowForm's root is .shell-bubble (spirit/element/rowForm/script.js).
test.run('the picker sits in a bubble of the kind rowForm uses', 0.2, async function () {
  if (!W.page) return false;
  const bubbled = await W.c.evaluate('Array.prototype.filter.call(document.querySelectorAll("#zzBox button[id$=field]"), function (b) { return b.getClientRects().length > 0; }).every(function (b) { return !!b.closest(".shell-bubble"); })');
  return !!W.picker && bubbled ? true : false;
}, test.limit.quick);
// The box: "Rows are inline, not boxes: they fold when the width gets smaller."
test.run('in a narrow pane the row folds, with nothing past its edge', 0.2, async function () {
  if (!W.page) return false;
  const folded = await W.c.evaluate('(function () { var b = document.getElementById("zzBox"); b.style.width = "120px"; return new Promise(function (r) { setTimeout(r, 400); }).then(function () { var row = (document.querySelector("#zzBox button[id$=field]") || {}).closest ? document.querySelector("#zzBox button[id$=field]").closest(".shell-bubble") : null; if (!row) return false; var w = row.getBoundingClientRect(), o = b.getBoundingClientRect(); var out = row.scrollWidth > row.clientWidth + 1 || w.right > o.right + 1; b.style.width = "100%"; return out ? false : "ok"; }); }())');
  return folded === 'ok' || false;
}, test.limit.quick);
test.run('destroy leaves its container empty', 0.2, async function () {
  if (!W.page) return false;
  const gone = await W.c.evaluate('(function () { if (!window.__m) return false; window.__m.destroy(); return document.getElementById("zzBox").innerHTML === "" ? "ok" : false; }())');
  return gone === 'ok' || false;
}, test.limit.quick);

// SAVE IS BUSY UNTIL THE NODE ANSWERS (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer
// comes"): mounted with a file, its save held unanswered, the Save button is disabled in the instant after the press, and
// plain again once the answer comes.
test.run('mounted with a file, it shows that file loaded', 0.2, async function () {
  if (!W.page) return false;
  await W.c.evaluate('(function () { var b = document.getElementById("zzBox"); return spirit.requireScript("spirit/app/' + NAME + '/element.js").then(function () { window.__m = spirit.required.spirit.app[' + JSON.stringify(NAME) + '].element.create(b, { path: "spirit/app/text/text.json" }); return "made"; }); }())');
  W.loaded = !!(await until(function () { return W.c.evaluate('(document.querySelector("#zzBox [data-text=status]") || {}).textContent === "loaded"'); }, 15000));
  return W.loaded || false;
}, test.limit.quick);
test.run('Save is busy in the instant after its press, while the node has not answered', 0.2, async function () {
  if (!W.loaded) return false;
  W.busy = await W.c.evaluate('(function () { var F = window.spirit.required.spirit.fs; window.__real = F.saveFile; F.saveFile = function () { return new Promise(function (r) { window.__answer = function () { r({ ok: true }); }; }); }; var b = document.querySelector("#zzBox [data-text=save]"); b.click(); return b.disabled === true; }())');
  return W.busy === true || false;
}, test.limit.quick);
test.run('Save is plain again once the answer has come', 0.2, async function () {
  if (W.busy !== true) return false;
  await W.c.evaluate('(function () { if (window.__answer) window.__answer(); window.spirit.required.spirit.fs.saveFile = window.__real; return true; }())');
  const plain = await until(function () { return W.c.evaluate('(document.querySelector("#zzBox [data-text=save]") || {}).disabled === false'); }, 5000);
  await W.c.evaluate('(function () { if (window.__m) window.__m.destroy(); return true; }())');
  return !!plain || false;
}, test.limit.quick);

// the box: its title bar, ✏️ "Text Editor:" + file-name, and its own icon while no file is picked
test.run('app.active switches the app on', 0.2, async function () {
  if (!W.N || !W.N.up) return false;
  const on = await fetch(W.N.base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: KEY, active: true } }) }).then(function (r) { return r.status; }, function () { return 0; });
  return on === 200 || false;
}, test.limit.quick);
test.run('its tile is there and is pressed', 0.2, async function () {
  if (!W.page) return false;
  await W.c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzSel"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:10000;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.requireScript("spirit/element/script.js").then(function () { window.__sel = spirit.required.spirit.element.create(b, { face: "tiles" }); return "made"; }); }())');
  const pressed = await until(function () { return W.c.evaluate('(function () { var t = document.querySelector("#zzSel .app-icon[data-key=\\"' + KEY + '\\"]"); if (!t) return false; t.click(); return true; }())'); }, 15000);
  return !!pressed || false;
}, test.limit.quick);
test.run('with no file picked, the one bar in view reads its icon and its label', 0.2, async function () {
  if (!W.page) return false;
  const readBar = function () { return W.c.evaluate('(function () { var x = Array.prototype.filter.call(document.querySelectorAll("#zzSel button"), function (b) { return b.getClientRects().length > 0 && String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }); return x.length === 1 ? String(x[0].parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim() : ""; }())'); };
  await until(readBar, 10000);
  const bar = await readBar();
  return !!ICON && typeof bar === 'string' && bar.indexOf(ICON + ' ' + LABEL) === 0 ? true : false;
}, test.limit.quick);

// nothing threw on the page
test.run('no uncaught error on the page', 0.2, async function () {
  if (!W.c) return false;
  await sleep(300);
  const thrown = W.c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; });
  return !thrown.length || false;
}, test.limit.quick);
