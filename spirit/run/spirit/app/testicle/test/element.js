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

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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
  '  centerText: function () { var b = box(); var c = b ? b.querySelector("[id$=\\"center\\"]") : null; return c ? String(c.innerText || "").trim() : null; },' +
  '}; return "hands"; }())';

test.startTest('testicle/element.js: testicle\'s first-cut face, a workBench with one 📁 and the production scripts (goal/G45.1)');

(async function () {
  test.subHeading('the box: "A face-only app is its manifest and its element.js, as contact and starter are"');
  const own = readJson(path.join(APP, 'testicle.json'));
  ok(!!own, 'spirit/app/testicle/testicle.json is there, and JSON', 'no spirit/app/testicle/testicle.json, or no JSON');
  const id = (own && own.identity) || {};
  ok(typeof id.icon === 'string' && !!id.icon && typeof id.label === 'string' && !!id.label, 'it names an icon and a label', 'identity: ' + short(id));
  // The goal box: "testicle: an intrinsic app with a server and a face".
  ok(id.intrinsic === true, 'it is intrinsic', 'identity.intrinsic: ' + short(id.intrinsic));
  ok(!!own && !!own.shell && own.shell.mount === true, 'it has a face: shell.mount true', 'shell: ' + short(own && own.shell));
  // goal/G47.1, the server cycle: "The server mounts beside the face (testicle.json: node.mount true)", "The testicle
  // server will serve one first verb, \"busy\"". The server's own checks are ./testicle.js.
  ok(!!own && !!own.node && own.node.mount === true, 'a server beside the face: node.mount true', 'node: ' + short(own && own.node));
  const held = fs.existsSync(APP) ? fs.readdirSync(APP).filter(function (f) { return f !== 'test'; }).sort() : [];
  ok(JSON.stringify(held) === JSON.stringify(['api.js', 'busy.json', 'data.js', 'element.js', 'testicle.js', 'testicle.json']), 'its folder holds its manifest, its face, its server and the one verb\'s api.js, data.js and busy.json, and its test/ folder, nothing else', 'its folder holds ' + short(held));
  ok(!!own && !!own.mount && own.mount['element.js'] === true, 'its mount names element.js', 'mount: ' + short(own && own.mount));
  // The box: "spirit/app/test/ stays the app branch's test folder".
  ok(fs.existsSync(path.join(RUN, 'spirit', 'app', 'test')) && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'test', 'test.json')), 'spirit/app/test/ stays the app branch\'s test folder, no app', 'spirit/app/test/ holds a test.json, or is gone');

  test.subHeading('the box: "calls no verbs in this round", "the existing file list ...: no new list"');
  const src = code(FACE);
  ok(src !== '', 'spirit/app/testicle/element.js is there', 'no spirit/app/testicle/element.js');
  ok(/['"]spirit\/element\/workBench\.js['"]/.test(src), 'it draws with the workBench element, spirit/element/workBench.js', 'it does not require spirit/element/workBench.js');
  ok(/['"]spirit\/element\/search\/file\.js['"]/.test(src), 'its file viewer is the existing file list, spirit/element/search/file.js', 'it does not require spirit/element/search/file.js');
  ok(src !== '' && !/\.element\.search\.create\(|createElement\(['"](tr|li|table)['"]\)/.test(src), 'it makes no list of its own', 'it makes a list of its own');
  ok(src !== '' && !/\bready\b\s*\)?\s*\.then|\.peerPost\(|\bfetch\(|XMLHttpRequest/.test(src), 'it asks the node nothing: no verb through spirit.ready, no peerPost, no fetch', 'it asks the node something itself');
  // goal/G47.1, the box: "testicle turns flat on."
  ok(/\bflat\s*:\s*true\b/.test(src), 'it draws the file list with flat on', 'it does not hand the file list flat: true');

  const s = scratch();
  const live = [];
  let c = null;
  try {
    const N = await boot(s.run); live.push(N.child);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: the page was not judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    ok(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000), 'the world: the face page has its spirit', 'the page has no spirit: nothing judged');
    await c.evaluate(HANDS);
    const T = function (expr) { return c.evaluate('window.__t.' + expr); };
    const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 10000); };

    test.subHeading('its place: spirit.element.spirit.app.testicle.element, with a create');
    const made = await c.evaluate('window.spirit.ready.then(function () { return window.spirit.require("spirit/app/testicle/element.js"); }).then(function () {' +
      ' var E = ((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element; if (!E || typeof E.create !== "function") return "no create";' +
      ' var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:1200px;height:800px;display:flex;"; document.body.appendChild(b);' +
      ' window.__made = E.create(b, {}); return window.__made && typeof window.__made.destroy === "function" ? "made" : "no destroy"; }, function (e) { return "refused: " + (e && e.message || e); })');
    ok(made === 'made', 'it loads through spirit.require and mounts with create(container), answering { destroy }', 'it did not mount: ' + short(made));
    if (made !== 'made') return;

    test.subHeading('the box: "a workBench with one 📁 icon"');
    ok(await waitFor('icons("left") && icons("left").length > 0'), 'the world: the workBench\'s left strip is drawn', 'no left strip: ' + short(await T('icons("left")')));
    const left = await T('icons("left")');
    ok(Array.isArray(left) && left.length === 1 && /📁/.test(left[0]), 'its left strip holds exactly one icon, 📁', 'the left strip holds ' + short(left));
    const right = await T('icons("right")');
    ok(!right || right.length === 0, 'its right strip holds none', 'the right strip holds ' + short(right));

    test.subHeading('the box: "it shows a file pane in the leftmost workBench pane, and nothing else"');
    ok(await waitFor('inLeft("input[id$=text]") > 0', 15000), 'the leftmost pane shows the file list, its search field there', 'no file list in the leftmost pane: ' + short(await T('leftSays()')));
    const centre = await T('centerText()');
    ok(centre === null || centre === '', 'and nothing else: the centre is empty', 'the centre shows ' + short(centre));

    // goal/G47.1, the box: "With flat on: no folder rows, never the indented tree; with an empty field every file the app
    // accepts is listed, each with its path; typing narrows it."
    test.subHeading('the box: "With flat on: no folder rows, never the indented tree"');
    ok(await waitFor('rows().length > 0', 15000), 'the world: with the field empty the list draws rows', 'no rows with the field empty: ' + short(await T('leftSays()')));
    const bare = await T('rows()');
    // A folder's key has no extension; every production script's has .js.
    const folders = bare.filter(function (k) { return !/\.[a-z0-9]+$/i.test(k); });
    ok(folders.length === 0, 'with the field empty no folder row shows', 'folder rows: ' + short(folders.slice(0, 10)));
    const deep = bare.filter(function (k) { return k.split('/').length >= 3; });
    ok(deep.length > 0, 'with the field empty files deep in the tree show, no folder opened', 'rows: ' + short(bare.slice(0, 10)));
    const one = deep[0] || '';
    const said = one ? await T('rowText(' + JSON.stringify(one) + ')') : null;
    ok(!!one && typeof said === 'string' && said.indexOf(one.slice(0, one.lastIndexOf('/') + 1)) !== -1, 'with the field empty each row shows its path', 'the row of ' + short(one) + ' reads ' + short(said));

    test.subHeading('the box: "its file viewer showing production *.js files only"');
    await T('type("zzTesticle")');
    ok(await waitFor('rows().indexOf("' + SHOWN[0] + '") !== -1', 15000), 'the world: a planted production script is found by its word', 'the planted script is not listed: ' + short(await T('rows()')));
    const rows = await T('rows()');
    const files = rows.filter(function (k) { return /\.[a-z0-9]+$/i.test(k); });
    ok(SHOWN.every(function (f) { return rows.indexOf(f) !== -1; }), 'every planted production *.js file shows', 'shown: ' + short(rows) + ', wanted ' + SHOWN.join(', '));
    ok(!HIDDEN.some(function (f) { return rows.indexOf(f) !== -1; }), 'no other file shows: not a .md, not a .json, not a test in a test/ folder', 'shown, though no production script: ' + short(HIDDEN.filter(function (f) { return rows.indexOf(f) !== -1; })));
    ok(rows.indexOf('spirit/zzTesticle') === -1 && rows.indexOf('spirit/zzTesticle/inner') === -1 && rows.indexOf('spirit/zzTesticle/test') === -1, 'with words typed no folder row shows', 'folder rows: ' + short(rows.filter(function (k) { return !/\.[a-z0-9]+$/i.test(k); })));
    ok(files.length > 0 && files.every(function (k) { return /\.js$/.test(k) && k.split('/').indexOf('test') === -1; }), 'every file it lists is a .js outside any test/ folder', 'it lists ' + short(files.filter(function (k) { return !/\.js$/.test(k) || k.split('/').indexOf('test') !== -1; })));
    test.subHeading('destroy');
    const after = await c.evaluate('(function () { window.__made.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
    ok(after === '' || after === 'gone', 'destroy leaves its container empty', 'after destroy: ' + short(after).slice(0, 200));
  } finally {
    try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    for (const k of live) await stop(k);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
