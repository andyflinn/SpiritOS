'use strict';

// spirit/run/spirit/app/text/test/text.js
// The tests of spirit/app/text/text.js for goal/G43.17, whose box built it first: "Four elements: file, fstat, text and media",
// and "text and media take a file when mounted, and show their whole selves with it, the file picker too, also when launched from file". With
// one is judged where Files hands it one (../../file/test/file.js); here it is mounted with none. A real node on a scratch copy of
// the tracked files and a real Chrome on /face.html; neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

const NAME = path.basename(__filename, '.js');
const APP = path.join(RUN, 'spirit', 'app', NAME);
// The box: "[✏️] "Text Editor:" + file-name; [icon] "Media Viewer:" + file-name, the icon ... the media viewer's own while no
// file is picked (Q15)".
const LABEL = { text: 'Text Editor', media: 'Media Viewer' }[NAME];
const ICON = NAME === 'text' ? '✏️' : ((readJson(path.join(APP, NAME + '.json')) || {}).identity || {}).icon;

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); } catch (e) { return ''; } }

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-' + NAME + '-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  return { root: root, run: path.join(root, 'spirit', 'run') };
}
async function boot(run) {
  const port = await freePort();
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return fetch(base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'api', args: {} }) }).then(function (r) { return r.status === 200; }, function () { return false; }); }, 60000);
  return { child: child, base: base, up: !!up };
}

test.startTest(NAME + '.js: with no file it shows the file picker (goal/G43.17)');

(async function () {
  test.subHeading('the box: "Four elements: file, fstat, text and media", and "New never requires old"');
  const own = code(path.join(APP, NAME + '.js'));
  ok(!!own, 'spirit/app/' + NAME + '/' + NAME + '.js is there', 'no spirit/app/' + NAME + '/' + NAME + '.js');
  ok(!!own && !/shell\/|spirit\.shell\b|\.shell\./.test(own), 'it names neither the old shell nor a shell/ path', NAME + '.js names the old shell');
  ok(!!own && /spirit\/element\/search\/file\.js/.test(own), 'it loads the files list it draws its picker with', NAME + '.js does not load the files list');

  const s = scratch();
  let child = null;
  let c = null;
  try {
    const N = await boot(s.run); child = N.child;
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.events)'); }, 20000), 'the world: the face shell has its spirit', 'the page has no spirit: nothing judged');

    test.subHeading('the box: "without one they show it"');
    const made = await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzBox"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/' + NAME + '/' + NAME + '.js").then(function () { var E = ((spirit.element.spirit.app || {})[' + JSON.stringify(NAME) + '] || {})[' + JSON.stringify(NAME) + ']; if (!E || typeof E.create !== "function") return "no spirit.element.spirit.app.' + NAME + '.' + NAME + '.create"; window.__m = E.create(b); return window.__m && typeof window.__m.destroy === "function" ? "ok" : "create answered " + typeof window.__m; }, function (e) { return "load: " + e; }); }())');
    ok(made === 'ok', 'spirit.element.spirit.app.' + NAME + '.' + NAME + '.create(container) answers { destroy }', NAME + ': ' + short(made));
    // A file picker is the files list as a dropdown (G43.16's box): its field, a button (spirit/element/search.js).
    const picker = await until(function () { return c.evaluate('Array.prototype.some.call(document.querySelectorAll("#zzBox button[id$=field]"), function (b) { return b.getClientRects().length > 0; })'); }, 10000);
    ok(!!picker, 'mounted with no file, it shows the file picker', 'the box: ' + short(await c.evaluate('(document.getElementById("zzBox") || {}).innerText || ""')));
    // The box: "That row is a bubble of the same kind as rowForm uses": rowForm's root is .shell-bubble (spirit/element/rowForm.js).
    const bubbled = await c.evaluate('Array.prototype.filter.call(document.querySelectorAll("#zzBox button[id$=field]"), function (b) { return b.getClientRects().length > 0; }).every(function (b) { return !!b.closest(".shell-bubble"); })');
    ok(!!picker && bubbled, 'the box: the picker sits in a bubble of the kind rowForm uses', 'the picker is not in a .shell-bubble');
    // The box: "Rows are inline, not boxes: they fold when the width gets smaller."
    const folded = await c.evaluate('(function () { var b = document.getElementById("zzBox"); b.style.width = "120px"; return new Promise(function (r) { setTimeout(r, 400); }).then(function () { var row = (document.querySelector("#zzBox button[id$=field]") || {}).closest ? document.querySelector("#zzBox button[id$=field]").closest(".shell-bubble") : null; if (!row) return "no row"; var w = row.getBoundingClientRect(), o = b.getBoundingClientRect(); var out = row.scrollWidth > row.clientWidth + 1 || w.right > o.right + 1; b.style.width = "100%"; return out ? "past the box: " + Math.round(w.right) + " of " + Math.round(o.right) + ", scroll " + row.scrollWidth + " of " + row.clientWidth : "ok"; }); }())');
    ok(folded === 'ok', 'the box: in a narrow pane the row folds, nothing past its edge', 'narrow: ' + short(folded));
    const gone = await c.evaluate('(function () { if (!window.__m) return "nothing made"; window.__m.destroy(); return document.getElementById("zzBox").innerHTML === "" ? "ok" : "left " + document.getElementById("zzBox").innerHTML.length; }())');
    ok(gone === 'ok', 'destroy leaves its container empty', 'destroy: ' + short(gone));

    test.subHeading('the box: its title bar, ' + ICON + ' "' + LABEL + ':" + file-name, and its own icon while no file is picked');
    const on = await fetch(N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: 'app.active', args: { key: NAME, active: true } }) }).then(function (r) { return r.status; }, function () { return 0; });
    ok(on === 200, 'the world: app.active switches ' + NAME + ' on', 'app.active answered ' + on);
    await c.evaluate('(function () { var b = document.createElement("div"); b.id = "zzSel"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:10000;display:flex;flex-direction:column"; document.body.appendChild(b); return spirit.require("spirit/app/appSelector.js").then(function () { window.__sel = spirit.element.spirit.app.appSelector.create(b, { face: "tiles" }); return "made"; }); }())');
    const pressed = await until(function () { return c.evaluate('(function () { var t = document.querySelector("#zzSel .app-icon[data-key=' + NAME + ']"); if (!t) return false; t.click(); return true; }())'); }, 15000);
    ok(!!pressed, 'the world: its tile is there and pressed', 'no tile ' + NAME);
    const readBar = function () { return c.evaluate('(function () { var x = Array.prototype.filter.call(document.querySelectorAll("#zzSel button"), function (b) { return b.getClientRects().length > 0 && String(b.textContent).trim() === "✕" && !/clear$/.test(b.id || ""); }); return x.length === 1 ? String(x[0].parentElement.innerText || "").replace("✕", "").replace(/\\s+/g, " ").trim() : ""; }())'); };
    await until(readBar, 10000);
    const bar = await readBar();
    ok(!!ICON && typeof bar === 'string' && bar.indexOf(ICON + ' ' + LABEL) === 0, 'the one bar in view reads ' + ICON + ' ' + LABEL + ', no file picked', 'bar: ' + short(bar));

    test.subHeading('nothing threw on the page');
    await sleep(300);
    const thrown = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
    ok(!thrown.length, 'no uncaught error on the page', 'thrown: ' + short(thrown));
  } finally {
    if (child) { try { child.kill(); } catch (e) { /* gone */ } }
    if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
    await sleep(300);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* a door still closing; the temp folder keeps it */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
