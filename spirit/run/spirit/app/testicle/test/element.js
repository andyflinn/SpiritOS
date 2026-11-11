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
  // goal/G47.1, the UI cycle: eta has no test of its own until this test writes one; gone is removed as it is clicked.
  'spirit/zzTesticle/eta.js': '\'use strict\';\n// eta, no test of its own yet\n',
  'spirit/zzTesticle/gone.js': '\'use strict\';\n// gone, removed as it is clicked\n',
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
  // server will serve one first verb, \"busy\"", and the verbs cycle: testicle.script.get and testicle.suite.search, each
  // with its json description (Andy's rule 6). The server's own checks are ./testicle.js.
  ok(!!own && !!own.node && own.node.mount === true, 'a server beside the face: node.mount true', 'node: ' + short(own && own.node));
  const held = fs.existsSync(APP) ? fs.readdirSync(APP).filter(function (f) { return f !== 'test'; }).sort() : [];
  ok(JSON.stringify(held) === JSON.stringify(['api.js', 'busy.json', 'data.js', 'element.js', 'script.get.json', 'subscribe.json', 'suite.search.json', 'testicle.js', 'testicle.json', 'unsubscribe.json']), 'its folder holds its manifest, its face, its server, its api.js and data.js, and a json description of each verb, busy, script.get, suite.search, subscribe and unsubscribe, and its test/ folder, nothing else', 'its folder holds ' + short(held));
  ok(!!own && !!own.mount && own.mount['element.js'] === true, 'its mount names element.js', 'mount: ' + short(own && own.mount));
  // The box: "spirit/app/test/ stays the app branch's test folder".
  ok(fs.existsSync(path.join(RUN, 'spirit', 'app', 'test')) && !fs.existsSync(path.join(RUN, 'spirit', 'app', 'test', 'test.json')), 'spirit/app/test/ stays the app branch\'s test folder, no app', 'spirit/app/test/ holds a test.json, or is gone');

  test.subHeading('the box: "calls no verbs in this round", "the existing file list ...: no new list"');
  const src = code(FACE);
  ok(src !== '', 'spirit/app/testicle/element.js is there', 'no spirit/app/testicle/element.js');
  ok(/['"]spirit\/element\/workBench\.js['"]/.test(src), 'it draws with the workBench element, spirit/element/workBench.js', 'it does not require spirit/element/workBench.js');
  ok(/['"]spirit\/element\/search\/file\.js['"]/.test(src), 'its file viewer is the existing file list, spirit/element/search/file.js', 'it does not require spirit/element/search/file.js');
  ok(src !== '' && !/\.element\.search\.create\(|createElement\(['"](tr|li|table)['"]\)/.test(src), 'it makes no list of its own', 'it makes a list of its own');
  // goal/G47.1, the UI cycle: the face asks testicle.script.get on a click, through spirit; never by itself.
  ok(src !== '' && !/\.peerPost\(|\bfetch\(|XMLHttpRequest/.test(src), 'it asks the node only through spirit: no peerPost, no fetch', 'it asks the node something itself');
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
    // goal/G47.1, the UI cycle. The box: "When a user clicks on a production file in the left pane of the production file
    // list", "A new tab is opened and activated in the center pane's tabContainer: the file detail", "The tab header shows
    // the production file name without path", "The detail shows as title row the full file name, and below it a standard
    // testicle.suite.search", "All tabs are closable", "The tab opens first, with its title line; then file.get runs, and
    // below the title line it shows either the error file.get gives (\"not a production script\", \"no such file\") or
    // the suite search for that file", "The UI must listen to changes on all tables it interacts with, and the server, of
    // course, publishes changes", "the suite search is spirit/element/search/suite.js and its folder".
    test.subHeading('the box: "A new tab is opened and activated in the center pane\'s tabContainer: the file detail"');
    const F1 = SHOWN[0];
    const want1 = concerning(s.run, F1);
    ok(want1.indexOf('spirit/zzTesticle/test/shown.js') !== -1 && want1.length > 1, 'the world: shown.js is concerned by its own test and by general tests', 'testModule.js names ' + short(want1));
    ok(await T('click(' + JSON.stringify(F1) + ')'), 'the world: a production file in the left pane is clicked', 'no row for ' + F1 + ' to click: ' + short(await T('rows()')));
    ok(await waitFor('tabs().length === 1', 10000), 'a click on a production file opens one tab in the centre', 'tabs: ' + short(await T('tabs()')));
    const t1 = (await T('tabs()'))[0] || {};
    ok(t1.selected === true, 'the new tab is the active one', 'tabs: ' + short(await T('tabs()')));
    ok(t1.label === 'shown.js', 'its header shows the file name without its path', 'header: ' + short(t1.label));
    ok(t1.closable === true, 'its tab is closable', 'tabs: ' + short(await T('tabs()')));
    test.subHeading('the box: "as title row the full file name, and below it a standard testicle.suite.search"');
    ok(await waitFor('shown() && shown().first === ' + JSON.stringify(F1), 10000), 'the detail\'s title row is the full file name', 'the detail reads ' + short(await T('shown()')));
    ok(await waitFor('shown() && shown().rows.length >= ' + want1.length, 15000), 'the world: below the title the suite search draws rows', 'the detail: ' + short(await T('shown()')));
    const d1 = (await T('shown()')) || { rows: [] };
    const named = function (rows, suite) { return rows.some(function (r) { return r.key === suite || r.key === F1 + '|' + suite || String(r.text).indexOf(suite) !== -1; }); };
    const lacking = want1.filter(function (w) { return !named(d1.rows, w); });
    ok(!lacking.length, 'below the title it lists every suite that concerns the file', 'missing: ' + short(lacking) + '; rows ' + short(d1.rows.map(function (r) { return r.key; })));
    ok(d1.rows.length === want1.length, 'and no other: each suite once', d1.rows.length + ' rows for ' + want1.length + ' suites: ' + short(d1.rows.map(function (r) { return r.key; })));
    // shown.js was never changed: its rows exist only if the click's script.get made them. Asked by suite.search, which makes none.
    const rowsMade = await call(N.base, 'testicle.suite.search', { script: F1, text: '' });
    ok(rowsMade.status === 200 && rowsMade.body && Array.isArray(rowsMade.body.items) && rowsMade.body.items.length === want1.length, 'the click made the script\'s rows: script.get ran for it', 'suite.search after the click: ' + short(rowsMade.text));
    const srcNow = code(FACE);
    ok(/['"]spirit\/element\/search\/suite\.js['"]/.test(srcNow) && fs.existsSync(path.join(RUN, 'spirit', 'element', 'search', 'suite.js')), 'the suite search is spirit/element/search/suite.js, which the face loads', 'the face does not load spirit/element/search/suite.js, or it is not there');

    test.subHeading('the box: a second click');
    ok(await T('click(' + JSON.stringify(F1) + ')') && await waitFor('tabs().length === 1 && tabs()[0].selected', 3000), 'a second click on the same file opens no second tab: its tab is made active', 'tabs: ' + short(await T('tabs()')));
    const F2 = SHOWN[1];
    ok(await T('click(' + JSON.stringify(F2) + ')') && await waitFor('tabs().length === 2', 10000), 'a click on another file opens a second tab', 'tabs: ' + short(await T('tabs()')));
    const two = await T('tabs()');
    ok(two.length === 2 && two.filter(function (t) { return t.selected; }).length === 1 && (two.filter(function (t) { return t.selected; })[0] || {}).label === 'alsoShown.js', 'the newest tab is the active one, and only it', 'tabs: ' + short(two));
    ok(two.length === 2 && two.every(function (t) { return t.closable; }), 'all tabs are closable', 'tabs: ' + short(two));
    ok(await waitFor('shown() && shown().first === ' + JSON.stringify(F2), 10000), 'the active tab shows its own file\'s detail', 'the detail reads ' + short(await T('shown()')));

    test.subHeading('the box: "The UI must listen to changes on all tables it interacts with"');
    const F3 = 'spirit/zzTesticle/eta.js';
    ok(await T('click(' + JSON.stringify(F3) + ')') && await waitFor('shown() && shown().first === ' + JSON.stringify(F3) + ' && shown().rows.length > 0', 15000), 'the world: eta.js\'s detail lists its suites', 'the detail: ' + short(await T('shown()')));
    const etaOwn = 'spirit/zzTesticle/test/eta.js';
    const etaBefore = await T('shown()');
    ok(!!etaBefore && etaBefore.first === F3 && !named(etaBefore.rows, etaOwn), 'the world: before its own test is written, eta.js lists none', 'the detail: ' + short(etaBefore));
    fs.mkdirSync(path.join(s.run, 'spirit', 'zzTesticle', 'test'), { recursive: true });
    fs.writeFileSync(path.join(s.run, etaOwn), '\'use strict\';\n// the new test of eta\n');
    ok(await until(function () { return T('shown()').then(function (d) { return !!d && d.rows.some(function (r) { return r.key === etaOwn || String(r.text).indexOf(etaOwn) !== -1; }); }); }, 10000), 'a suite written for the file shows in its open detail, with no click: the detail listens, the server publishes', 'the detail after the new suite: ' + short(await T('shown()')));

    test.subHeading('the box: "The tab opens first ... or the error script.get gives"');
    const F4 = 'spirit/zzTesticle/gone.js';
    ok((await T('rows()')).indexOf(F4) !== -1, 'the world: gone.js is listed in the left pane', 'gone.js is not listed: ' + short(await T('rows()')));
    fs.rmSync(path.join(s.run, F4));
    const clicked = await T('click(' + JSON.stringify(F4) + ')');
    ok(clicked, 'the world: gone.js, removed, is still there to click', 'its row went before the click: nothing judged');
    ok(await waitFor('tabs().some(function (t) { return t.label === "gone.js" && t.selected; })', 5000), 'its tab opens and is the active one, though script.get will refuse', 'tabs: ' + short(await T('tabs()')));
    ok(await waitFor('shown() && shown().first === ' + JSON.stringify(F4) + ' && /no such file/.test(shown().text)', 10000), 'below the title line it shows the error script.get gives: no such file', 'the detail reads ' + short(await T('shown()')));
    const goneShown = await T('shown()');
    ok(!!goneShown && goneShown.first === F4 && goneShown.rows.length === 0, 'and no suite search', 'the detail: ' + short(goneShown));

    test.subHeading('the box: "All tabs are closable"');
    const before = (await T('tabs()')).length;
    ok(await T('closeTab(' + JSON.stringify(F4) + ')') && await waitFor('tabs().length === ' + (before - 1) + ' && !tabs().some(function (t) { return t.label === "gone.js"; })', 3000), 'a tab\'s close button takes it away', 'tabs after closing gone.js: ' + short(await T('tabs()')));

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
