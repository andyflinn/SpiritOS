'use strict';

// spirit/run/spirit/element/search/test/testicle.js
// The tests of spirit/app/testicle/element/search/testicle.js, the testicle search, and of the parts in its folder, and of no other module
// (spec: ./testicle.md; goal/G47.1, the cycle "the testicle search"). The box: "the testicle search,
// spirit/app/testicle/element/search/testicle.js, with its companion folder holding its rowElement and detailElement", "a script selector,
// unselected (all) the default", "a suite selector, unselected (all) the default", "two filters, red and green; at least one
// of the two is selected at all times", "The test row also shows its severity, two decimal places, even for 0 and 1", "The
// list is sortable by all its columns", "The script selector: the file search as a dropdown, production scripts only", "with
// the script selector blank (all scripts), the suite selector lists every suite, each once", "The script column and the suite column show the
// file name only, no path; hovering over a script or a suite shows its full name as a tooltip", "The test title is shown in
// full", "The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity second; the
// title third; then the script name (no path), then the suite name (no path)", "The search is the standard search over
// testicle.testicle.search, a view of the testicle branch data.js keeps, the current rows shown".
//
// A real node on a scratch copy of the tracked files, testicle turned on there, tests of planted scripts set on it through
// testicle.testicle.set, and the search mounted alone in a real Chrome on /face.html. Neither Andy's node nor an agent's is
// touched. Where it opens a test's detail is the face's (spirit/app/testicle/test/element.js).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../../../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); } catch (e) { return ''; } }

const MODULE = path.join(RUN, 'spirit', 'app', 'testicle', 'element', 'search', 'testicle.js');
const FOLDER = path.join(RUN, 'spirit', 'app', 'testicle', 'element', 'search', 'testicle');
// THE PLANTED SCRIPTS, under one folder of their own, each with its own test.
const Z = 'spirit/zzTsearch/';
const A = Z + 'alpha.js';
const B = Z + 'beta.js';
const AS = Z + 'test/alpha.js';
const BS = Z + 'test/beta.js';
const PLANT = {};
PLANT[A] = '\'use strict\';\n// alpha\n';
PLANT[B] = '\'use strict\';\n// beta\n';
PLANT[AS] = '\'use strict\';\n// the test of alpha\n';
PLANT[BS] = '\'use strict\';\n// the test of beta\n';
PLANT[Z + 'notes.md'] = '# no script\n';
// THE REDS (goal/G47.1, the box: "Opened with no words and no selector, the page shows the reds first, more than 20 when
// there are"): gamma, in a folder of its own so the checks of the three tests above never count its rows, fails 30 tests,
// more than one answer holds.
const Z2 = 'spirit/zzTsearchRed/';
const G = Z2 + 'gamma.js';
const GS = Z2 + 'test/gamma.js';
const GAMMA_REDS = 30;
PLANT[G] = '\'use strict\';\n// gamma\n';
PLANT[GS] = '\'use strict\';\n// the test of gamma\n';
// THE TESTS SET: alpha's long title passing at 0, beta's failing at 1, alpha's flip in a general suite at 0.2, passing then
// failing, so two rows of it are kept and one is current.
const LONG = 'alpha answers every question it is asked, however long the question, and this title is shown in full';
const FAILS = 'beta fails';
const FLIPS = 'alpha flips';

function scratch() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  // testicle turned on there, as an owner turns a server on (spirit/test/headLessChrome.js scratchNode).
  const on = path.join(run, 'spirit', 'state', 'testicle');
  fs.mkdirSync(on, { recursive: true });
  fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
  // THE GENERAL SUITES TAKEN AWAY (goal/G47.1, the queue cycle): the scratch node's testicle runs every flagged suite by
  // itself, and the real general suites, run for the planted scripts, would draw rows of their own among the planted ones.
  // This test judges the search, not them: every general suite file keeps its name, so its reach is the same (a general
  // test's name is its reach), and its contents become a stub that judges and reports nothing.
  const gen = generalFor(run, A);
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return /(^|\/)test\/[^/]*-(sibling|child)-[^/]*\.js$/.test(f); })
    .forEach(function (f) { fs.writeFileSync(path.join(root, f), '\'use strict\';\n// a stub in this scratch tree: it judges nothing\n'); });
  return { root: root, run: run, gen: gen };
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
// A general test that judges alpha, as the scratch tree's own testModule.js lists it.
function generalFor(run, name) {
  return execFileSync(process.execPath, [path.join(run, 'spirit', 'test', 'testModule.js')], { cwd: run, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .map(function (l) { return l.split(' '); }).filter(function (p) { return p[1] === name && /-sibling-|-child-/.test(p[0]); }).map(function (p) { return p[0]; })[0] || '';
}
function base(p) { return p.slice(p.lastIndexOf('/') + 1); }

// THE PAGE'S HANDS: what shows in #zzBox. The list's rows are tr[data-key] outside the selector row; a cell is a td; a header
// that sorts is th[data-sort] (spirit/element/search.js); a filter's choice is button[data-filter][data-value], drawn bold
// when on; a selector is the span ending selector<i> in the row ending selectors, a dropdown there opened by its button
// ending field, its rows in its popup, its None button ending none.
const HANDS = '(function () {' +
  'function box() { return document.getElementById("zzBox"); }' +
  'function seen(e) { return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }' +
  'function all(sel, from) { var b = from || box(); return b ? Array.prototype.slice.call(b.querySelectorAll(sel)) : []; }' +
  'function inSel(e) { return !!(e.closest && e.closest("[id$=\\"selectors\\"]")); }' +
  'function main() { return all("tr[data-key]").filter(function (r) { return !inSel(r) && seen(r); }); }' +
  'function tipOf(td) { if (td.getAttribute("title")) return td.getAttribute("title"); var t = td.querySelector("[title]"); return t ? t.getAttribute("title") : ""; }' +
  'function sel(i) { return all("[id$=\\"selector" + i + "\\"]")[0] || null; }' +
  'window.__t = {' +
  '  keys: function () { return main().map(function (r) { return r.getAttribute("data-key"); }); },' +
  '  cells: function () { return main().map(function (r) { return { key: r.getAttribute("data-key"), cells: Array.prototype.slice.call(r.querySelectorAll("td")).filter(seen).map(function (td) { return { field: td.getAttribute("data-field") || "", text: String(td.innerText || "").trim(), tip: tipOf(td), clipped: td.scrollWidth > td.clientWidth + 1 }; }) }; }); },' +
  '  heads: function () { return all("th").filter(function (h) { return !inSel(h) && seen(h); }).map(function (h) { return { text: String(h.innerText || "").trim(), sort: h.getAttribute("data-sort") }; }); },' +
  '  sortBy: function (i) { var h = all("th[data-sort]").filter(function (h) { return !inSel(h) && seen(h); })[i]; if (!h) return false; h.click(); return true; },' +
  '  filter: function (word) { var re = new RegExp(word, "i"); var b = all("button[data-filter][data-value]").filter(function (x) { return !inSel(x) && seen(x) && (re.test(x.getAttribute("data-value")) || re.test(x.innerText)); })[0]; return b ? { on: Number(getComputedStyle(b).fontWeight) >= 600 } : null; },' +
  '  press: function (word) { var re = new RegExp(word, "i"); var b = all("button[data-filter][data-value]").filter(function (x) { return !inSel(x) && seen(x) && (re.test(x.getAttribute("data-value")) || re.test(x.innerText)); })[0]; if (!b) return false; b.click(); return true; },' +
  '  selectors: function () { return [0, 1].map(function (i) { var s = sel(i); return s ? { field: s.querySelector("button[id$=\\"field\\"]") ? String(s.querySelector("button[id$=\\"field\\"]").innerText || "").trim() : null } : null; }); },' +
  '  openSel: function (i) { var s = sel(i); var f = s ? s.querySelector("button[id$=\\"field\\"]") : null; if (!f) return false; f.click(); return true; },' +
  '  typeSel: function (i, w) { var s = sel(i); var t = s ? s.querySelector("input[id$=\\"text\\"]") : null; if (!t) return false; t.value = w; t.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  '  selRows: function (i) { var s = sel(i); return s ? Array.prototype.slice.call(s.querySelectorAll("[id$=\\"popup\\"] tr[data-key]")).map(function (r) { return r.getAttribute("data-key"); }) : []; },' +
  '  pickSel: function (i, k) { var s = sel(i); var r = s ? Array.prototype.slice.call(s.querySelectorAll("[id$=\\"popup\\"] tr[data-key]")).filter(function (r) { return r.getAttribute("data-key") === k; })[0] : null; if (!r) return false; r.click(); return true; },' +
  '  typeMain: function (w) { var t = all("input[id$=\\"text\\"]").filter(function (x) { return !inSel(x); })[0]; if (!t) return false; t.value = w; t.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  '  noneSel: function (i) { var s = sel(i); var n = s ? s.querySelector("button[id$=\\"none\\"]") : null; if (!n) return false; n.click(); return true; },' +
  '}; return "hands"; }())';

// What the tests share, made by the tests in order.
let s = null, N = null, c = null, made = '', GEN = '', planted = false, drawn = [], cols = [], byTitle = {};
const live = [];
const NONODE = 'no scratch node: the world failed';
const T = function (expr) { return c.evaluate('window.__t.' + expr); };
const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 10000); };
const mounted = function () { return !N || !N.up ? NONODE : (!c || c.error || !c.evaluate) ? 'no page: the world failed' : made !== 'made' ? 'the search did not mount: the world failed' : !planted ? 'no tests were set: the world failed' : ''; };
// The title cell: by its field where the list names it (while words are typed the list draws a column more), else the third.
const titleOf = function (row) { const t = row && row.cells ? row.cells.filter(function (cl) { return cl.field === 'test'; })[0] || row.cells[2] : null; return t ? t.text : ''; };
const keyOf = function (script, suite, title, flipped) { return script + '|' + suite + '|' + title + '|' + flipped; };
let current = {};

test.after(async function () {
  try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  for (const k of live) await stop(k);
  try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
});

// the box: "spirit/app/testicle/element/search/testicle.js, with its companion folder holding its rowElement and detailElement"
test.run('spirit/app/testicle/element/search/testicle.js is there', 0.2, function () {
  return fs.existsSync(MODULE) || 'no ' + path.relative(RUN, MODULE);
}, test.limit.quick);
test.run('its folder spirit/app/testicle/element/search/testicle/ holds its rowElement.js and its detailElement.js', 0.2, function () {
  const held = fs.existsSync(FOLDER) ? fs.readdirSync(FOLDER) : [];
  return (held.indexOf('rowElement.js') !== -1 && held.indexOf('detailElement.js') !== -1) || 'its folder holds ' + short(held);
}, test.limit.quick);
// the box: "The script selector: the file search as a dropdown"
test.run('its script selector is the file search, spirit/element/search/file.js, which it loads', 0.2, function () {
  const src = [MODULE].concat(fs.existsSync(FOLDER) ? fs.readdirSync(FOLDER).map(function (f) { return path.join(FOLDER, f); }) : []).map(code).join('\n');
  return /['"]spirit\/element\/search\/file\.js['"]/.test(src) || 'neither the search nor its folder loads spirit/element/search/file.js';
}, test.limit.quick);

test.run('the world: a scratch node comes up, testicle on', 0.2, async function () {
  s = scratch();
  N = await boot(s.run); live.push(N.child);
  return N.up || 'the scratch node did not come up: nothing judged';
}, test.limit.long);
test.run('the world: tests of the planted scripts are set on it', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  GEN = s.gen;
  if (!GEN) return 'no general test judges ' + A;
  const sets = [
    { script: A, suite: AS, test: LONG, verified: true, severity: 0 },
    { script: B, suite: BS, test: FAILS, verified: false, severity: 1 },
    { script: A, suite: GEN, test: FLIPS, verified: true, severity: 0.2 },
  ];
  const out = [];
  for (const a of sets) { out.push(await call(N.base, 'testicle.testicle.set', a)); await sleep(20); }
  out.push(await call(N.base, 'testicle.testicle.set', { script: A, suite: GEN, test: FLIPS, verified: false, severity: 0.2 }));
  planted = out.every(function (r) { return r.status === 200; });
  out.forEach(function (r, i) { const b = r.body || {}; if (r.status === 200 && b.key) current[i === 3 ? FLIPS : i === 0 ? LONG : i === 1 ? FAILS : 'replaced'] = b; });
  return planted || 'testicle.testicle.set: ' + short(out.map(function (r) { return r.status + ' ' + r.text; }));
}, test.limit.slow);
let gammaPlanted = false;
test.run('the world: gamma\'s 30 failed tests are set on it, before the page opens', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  const bad = [];
  for (let i = 1; i <= GAMMA_REDS; i++) {
    const r = await call(N.base, 'testicle.testicle.set', { script: G, suite: GS, test: 'gamma fails its question ' + i, verified: false, severity: 0.5 });
    if (r.status !== 200) bad.push(r.status + ' ' + r.text);
  }
  gammaPlanted = !bad.length;
  return gammaPlanted || 'testicle.testicle.set: ' + short(bad);
}, test.limit.slow);
test.run('the world: the face page has its spirit', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  const where = findChrome();
  if (!where) return 'no Chrome here: the page was not judged';
  c = await chromePage(where);
  if (c.error) return 'Chrome: ' + c.error;
  await c.send('Page.navigate', { url: N.base + '/face.html' });
  return !!(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) || 'the page has no spirit: nothing judged';
}, test.limit.long);

// its place: spirit.element.spirit.app.testicle.element.search.testicle, with a create
test.run('it loads through spirit.require and mounts with create(container), answering destroy', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  if (!c || c.error || !c.evaluate) return 'no page: the world failed';
  await c.evaluate(HANDS);
  made = await c.evaluate('window.spirit.ready.then(function () { return window.spirit.require("spirit/app/testicle/element/search/testicle.js"); }).then(function () {' +
    ' var E = (((((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element || {}).search || {}).testicle); if (!E || typeof E.create !== "function") return "no create";' +
    ' var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:1400px;height:800px;display:flex;"; document.body.appendChild(b);' +
    ' window.__made = E.create(b, {}); return window.__made && typeof window.__made.destroy === "function" ? "made" : "no destroy"; }, function (e) { return "refused: " + (e && e.message || e); })');
  return made === 'made' || 'it did not mount: ' + short(made);
}, test.limit.slow);

// goal/G47.1, the box: "The testicle search's default equals testicle.red: all scripts, all suites, reds only, most severe
// first" (Andy: "the default setting for testicle search should be EQUAL the the RED verb of testicle."); and earlier
// (Andy: "the empty search string with no script or suite selected should already fill up with more that 20 reds when i
// open the app!"). gamma's 30 reds are more than one answer holds.
test.run('opened, red is on and green is off', 0.2, async function () {
  if (mounted()) return mounted();
  await waitFor('filter("red") && filter("green")', 10000);
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!red && !!green && red.on && !green.on) || 'red ' + short(red) + ', green ' + short(green);
}, test.limit.slow);
test.run('opened, it shows more than 20 reds: every one of gamma\'s 30', 0.2, async function () {
  if (mounted()) return mounted();
  if (!gammaPlanted) return 'gamma\'s tests were not set: the world failed';
  const ok = await waitFor('keys().filter(function (k) { return k.indexOf("' + Z2 + '") === 0; }).length >= ' + GAMMA_REDS, 15000);
  return !!ok || 'gamma\'s rows shown: ' + ((await T('keys()')) || []).filter(function (k) { return k.indexOf(Z2) === 0; }).length + ' of ' + GAMMA_REDS;
}, test.limit.slow);
test.run('opened, it shows reds only, the most severe first', 0.2, async function () {
  if (mounted()) return mounted();
  const sev = await columnNow(1);
  const icons = await columnNow(0);
  const down = sev.every(function (v, i) { return i === 0 || Number(sev[i - 1]) >= Number(v); });
  return (icons.length > 0 && icons.every(function (v) { return v === '❌'; }) && down) || 'results ' + short(icons.join('')) + ', severities ' + short(sev);
}, test.limit.quick);
test.run('the world: green pressed, both filters on', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("green")');
  const ok = await waitFor('filter("green").on && filter("red").on', 5000);
  return !!ok || 'red ' + short(await T('filter("red")')) + ', green ' + short(await T('filter("green")'));
}, test.limit.slow);

// the box: "the current rows shown"
test.run('the world: the list draws the planted tests', 0.2, async function () {
  if (mounted()) return mounted();
  return !!(await waitFor('keys().filter(function (k) { return k.indexOf("' + Z + '") === 0; }).length >= 3', 15000)) || 'rows: ' + short(await T('keys()'));
}, test.limit.slow);
test.run('it lists each test once, by its current row alone', 0.2, async function () {
  if (mounted()) return mounted();
  const keys = ((await T('keys()')) || []).filter(function (k) { return k.indexOf(Z) === 0; });
  const want = [current[LONG], current[FAILS], current[FLIPS]].map(function (r) { return r && r.key; }).sort();
  return JSON.stringify(keys.slice().sort()) === JSON.stringify(want) || 'rows ' + short(keys) + ', the current rows ' + short(want);
}, test.limit.quick);
test.run('the world: each planted row\'s cells are read', 0.2, async function () {
  if (mounted()) return mounted();
  drawn = ((await T('cells()')) || []).filter(function (r) { return String(r.key).indexOf(Z) === 0; });
  byTitle = {};
  drawn.forEach(function (r) { [LONG, FAILS, FLIPS].forEach(function (t) { if (r.cells.some(function (cl) { return cl.text === t; })) byTitle[t] = r; }); });
  return Object.keys(byTitle).length === 3 || 'rows read ' + short(drawn);
}, test.limit.quick);

// goal/G47.1, the box: "The testicle search finds the reds" (Andy: "the empty search string with no script or suite
// selected should already fill up with more that 20 reds when i open the app!, and typing in the search bar sends requests
// and returns NOTHING$! WTF!"): "Every test search answers its failed tests first", "the page asks for the following
// answers while the server says there are more, up to 100 tests", "typed words show the tests they find".
test.run('typed words show the tests they find, the best match first', 0.2, async function () {
  if (mounted()) return mounted();
  if (!gammaPlanted) return 'gamma\'s tests were not set: the world failed';
  if (!(await T('typeMain("gamma fails its question 17")'))) return 'no search field to type in';
  // While words are typed the list draws its match column first (spirit/element/search.js headHtml): the title is
  // looked for among the row's cells.
  const titled = function (row) { return !!row && row.cells.some(function (cl) { return cl.text === 'gamma fails its question 17'; }); };
  const ok = await until(function () { return T('cells()').then(function (rows) { return !!rows && rows.length > 0 && titled(rows[0]); }); }, 10000);
  const shown = ((await T('cells()')) || []).map(function (r) { return r.cells.map(function (cl) { return cl.text; }).join(' | '); });
  await T('typeMain("")');
  await sleep(500);
  return !!ok || 'the rows shown, top down: ' + short(shown.slice(0, 5)) + ' of ' + shown.length;
}, test.limit.slow);

// the box: "The columns, in this order: the result first, as an icon ... severity second; the title third; then the script
// name (no path), then the suite name (no path)"
test.run('each row has five columns', 0.2, function () {
  if (mounted()) return mounted();
  const bad = drawn.filter(function (r) { return r.cells.length !== 5; });
  return (drawn.length > 0 && !bad.length) || 'cells per row: ' + short(drawn.map(function (r) { return r.cells.length; }));
}, test.limit.quick);
test.run('the first column is the result as an icon: ❌ for a failure, ✅ for a success', 0.2, function () {
  if (mounted()) return mounted();
  const f = (byTitle[FAILS] || { cells: [] }).cells[0] || {};
  const p = (byTitle[LONG] || { cells: [] }).cells[0] || {};
  const fl = (byTitle[FLIPS] || { cells: [] }).cells[0] || {};
  return (f.text === '❌' && p.text === '✅' && fl.text === '❌') || 'first cells: failing ' + short(f.text) + ', passing ' + short(p.text) + ', flipped to failing ' + short(fl.text);
}, test.limit.quick);
// the box: "The test row also shows its severity, two decimal places, even for 0 and 1 (0.00, 1.00)"
test.run('the second column is the severity with two decimals, 0.00 and 1.00 too', 0.2, function () {
  if (mounted()) return mounted();
  const got = [LONG, FAILS, FLIPS].map(function (t) { return ((byTitle[t] || { cells: [] }).cells[1] || {}).text; });
  return JSON.stringify(got) === JSON.stringify(['0.00', '1.00', '0.20']) || 'severities ' + short(got) + ', wanted 0.00, 1.00, 0.20';
}, test.limit.quick);
// the box: "The test title is shown in full"
test.run('the third column is the title, shown in full', 0.2, function () {
  if (mounted()) return mounted();
  const t = (byTitle[LONG] || { cells: [] }).cells[2] || {};
  return (t.text === LONG && !t.clipped) || 'the title cell: ' + short(t);
}, test.limit.quick);
// the box: "The script column and the suite column show the file name only, no path"
test.run('the fourth column is the script\'s file name, no path', 0.2, function () {
  if (mounted()) return mounted();
  const got = [LONG, FAILS].map(function (t) { return ((byTitle[t] || { cells: [] }).cells[3] || {}).text; });
  return JSON.stringify(got) === JSON.stringify([base(A), base(B)]) || 'script cells ' + short(got);
}, test.limit.quick);
test.run('the fifth column is the suite\'s file name, no path', 0.2, function () {
  if (mounted()) return mounted();
  const got = [LONG, FLIPS].map(function (t) { return ((byTitle[t] || { cells: [] }).cells[4] || {}).text; });
  return JSON.stringify(got) === JSON.stringify([base(AS), base(GEN)]) || 'suite cells ' + short(got);
}, test.limit.quick);
// the box: "hovering over a script or a suite shows its full name as a tooltip"
test.run('hovering over a script name shows its full name', 0.2, function () {
  if (mounted()) return mounted();
  const tip = ((byTitle[FAILS] || { cells: [] }).cells[3] || {}).tip;
  return tip === B || 'the script cell\'s tooltip: ' + short(tip);
}, test.limit.quick);
test.run('hovering over a suite name shows its full name', 0.2, function () {
  if (mounted()) return mounted();
  const tip = ((byTitle[FLIPS] || { cells: [] }).cells[4] || {}).tip;
  return tip === GEN || 'the suite cell\'s tooltip: ' + short(tip);
}, test.limit.quick);

// the box: "The list is sortable by all its columns"
test.run('every one of its five column headers is a sort trigger', 0.2, async function () {
  if (mounted()) return mounted();
  cols = (await T('heads()')) || [];
  return (cols.length === 5 && cols.every(function (h) { return !!h.sort; })) || 'headers: ' + short(cols);
}, test.limit.quick);
// The order of one column's cells, of the planted rows, as drawn.
async function columnNow(i) {
  const rows = ((await T('cells()')) || []).filter(function (r) { return String(r.key).indexOf(Z) === 0; });
  return rows.map(function (r) { return (r.cells[i] || {}).text; });
};
const ordered = function (list, i, dir) {
  const val = function (v) { return i === 1 ? Number(v) : String(v); };
  for (let k = 1; k < list.length; k++) {
    const a = val(list[k - 1]), b = val(list[k]);
    const cmp = typeof a === 'number' ? a - b : String(a).localeCompare(String(b));
    if (dir === 'asc' ? cmp > 0 : cmp < 0) return false;
  }
  return true;
};
// One test per column: a press sorts by it, a second press reverses.
const sortsBy = async function (i) {
  if (mounted()) return mounted();
  if (!(await T('sortBy(' + i + ')'))) return 'no header ' + i + ' to press: ' + short(await T('heads()'));
  await sleep(200);
  const first = await columnNow(i);
  await T('sortBy(' + i + ')');
  await sleep(200);
  const second = await columnNow(i);
  const one = ordered(first, i, 'asc') ? 'asc' : ordered(first, i, 'desc') ? 'desc' : '';
  const other = one === 'asc' ? 'desc' : 'asc';
  return (!!one && ordered(second, i, other) && JSON.stringify(first) !== JSON.stringify(second)) || 'after one press ' + short(first) + ', after two ' + short(second);
};
test.run('a press on the severity header sorts the rows by it, a second press the other way', 0.2, function () { return sortsBy(1); }, test.limit.slow);
test.run('a press on the title header sorts the rows by it, a second press the other way', 0.2, function () { return sortsBy(2); }, test.limit.slow);
test.run('a press on the script header sorts the rows by it, a second press the other way', 0.2, function () { return sortsBy(3); }, test.limit.slow);
test.run('a press on the suite header sorts the rows by it, a second press the other way', 0.2, function () { return sortsBy(4); }, test.limit.slow);
test.run('a press on the header of the result sorts the failures and the successes apart, a second press the other way', 0.2, async function () {
  if (mounted()) return mounted();
  if (!(await T('sortBy(0)'))) return 'no header 0 to press: ' + short(await T('heads()'));
  await sleep(200);
  const first = await columnNow(0);
  await T('sortBy(0)');
  await sleep(200);
  const second = await columnNow(0);
  const grouped = function (l) { const f = l.indexOf('✅'), x = l.indexOf('❌'); return f !== -1 && x !== -1 && (l.lastIndexOf('✅') < x || l.lastIndexOf('❌') < f); };
  return (grouped(first) && grouped(second) && first[0] !== second[0]) || 'after one press ' + short(first) + ', after two ' + short(second);
}, test.limit.slow);

// the box: "two filters, red and green; at least one of the two is selected at all times: the only combination forbidden is
// both off"
test.run('it has the filters red and green, both on once green was pressed', 0.2, async function () {
  if (mounted()) return mounted();
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!red && !!green && red.on && green.on) || 'red ' + short(red) + ', green ' + short(green);
}, test.limit.quick);
test.run('with red off and green on, only the successes show', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("red")');
  const ok = await until(function () { return columnNow(0).then(function (l) { return l.length > 0 && l.every(function (v) { return v === '✅'; }); }); }, 5000);
  return (!!ok && !(await T('filter("red")')).on) || 'results shown ' + short(await columnNow(0)) + ', red ' + short(await T('filter("red")'));
}, test.limit.slow);
test.run('with red off, a press on green leaves it on: both off is refused', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("green")');
  await sleep(300);
  const green = await T('filter("green")');
  const shown = await columnNow(0);
  return (!!green && green.on && shown.length > 0 && shown.every(function (v) { return v === '✅'; })) || 'green ' + short(green) + ', results shown ' + short(shown);
}, test.limit.slow);
test.run('with green off and red on, only the failures show', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("red")');
  await sleep(200);
  await T('press("green")');
  const ok = await until(function () { return columnNow(0).then(function (l) { return l.length > 0 && l.every(function (v) { return v === '❌'; }); }); }, 5000);
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!ok && red.on && !green.on) || 'results shown ' + short(await columnNow(0)) + ', red ' + short(red) + ', green ' + short(green);
}, test.limit.slow);
test.run('with red off, a press on red leaves it on: both off is refused', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("red")');
  await sleep(300);
  const red = await T('filter("red")');
  return (!!red && red.on) || 'red ' + short(red);
}, test.limit.slow);
test.run('the world: both filters on again', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("green")');
  await sleep(300);
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!red && !!green && red.on && green.on) || 'red ' + short(red) + ', green ' + short(green);
}, test.limit.slow);

// the box: "a script selector, unselected (all) the default", "the file search as a dropdown, production scripts only"
test.run('it has two selectors, the script selector first, the suite selector second, each a dropdown', 0.2, async function () {
  if (mounted()) return mounted();
  const sels = (await T('selectors()')) || [];
  return (sels.length === 2 && sels.every(function (x) { return x && x.field !== null; })) || 'selectors: ' + short(sels);
}, test.limit.quick);
test.run('with no script chosen, every script\'s tests show', 0.2, async function () {
  if (mounted()) return mounted();
  const shown = await columnNow(3);
  return (shown.indexOf(base(A)) !== -1 && shown.indexOf(base(B)) !== -1) || 'scripts shown ' + short(shown);
}, test.limit.quick);
test.run('the script selector lists production scripts only: no test, no other kind of file', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(0)');
  await T('typeSel(0, "zzTsearch")');
  await waitFor('selRows(0).length > 0', 10000);
  const keys = (await T('selRows(0)')) || [];
  const planted0 = keys.filter(function (k) { return String(k).indexOf(Z) !== -1; });
  return (planted0.length > 0 && planted0.every(function (k) { return /\.js$/.test(k) && k.split('/').indexOf('test') === -1; }) && planted0.some(function (k) { return k === A; })) || 'it lists ' + short(keys);
}, test.limit.slow);
test.run('a script chosen narrows the rows to that script\'s tests', 0.2, async function () {
  if (mounted()) return mounted();
  if (!(await T('pickSel(0, ' + JSON.stringify(A) + ')'))) return 'no row for ' + A + ' to pick: ' + short(await T('selRows(0)'));
  const ok = await until(function () { return columnNow(3).then(function (l) { return l.length > 0 && l.every(function (v) { return v === base(A); }); }); }, 5000);
  return !!ok || 'scripts shown ' + short(await columnNow(3));
}, test.limit.slow);

// the box: "a suite selector, unselected (all) the default"
test.run('with a script chosen, the suite selector lists that script\'s suites', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(1)');
  // The rows come as their answer lands: waited for until the two it judges are in, not merely the first two rows.
  await waitFor('selRows(1).filter(function (k) { return k === ' + JSON.stringify(AS) + ' || k === ' + JSON.stringify(A + '|' + AS) + ' || k === ' + JSON.stringify(GEN) + ' || k === ' + JSON.stringify(A + '|' + GEN) + '; }).length >= 2', 15000);
  const keys = (await T('selRows(1)')) || [];
  const has = function (suite) { return keys.some(function (k) { return k === suite || k === A + '|' + suite; }); };
  return (has(AS) && has(GEN) && !has(BS)) || 'it lists ' + short(keys);
}, test.limit.slow);
test.run('a suite chosen narrows the rows to that suite\'s tests', 0.2, async function () {
  if (mounted()) return mounted();
  const keys = (await T('selRows(1)')) || [];
  const k = keys.filter(function (x) { return x === GEN || x === A + '|' + GEN; })[0];
  if (!k || !(await T('pickSel(1, ' + JSON.stringify(k) + ')'))) return 'no row for ' + GEN + ' to pick: ' + short(keys);
  const ok = await until(function () { return columnNow(4).then(function (l) { return l.length > 0 && l.every(function (v) { return v === base(GEN); }); }); }, 5000);
  return !!ok || 'suites shown ' + short(await columnNow(4));
}, test.limit.slow);
test.run('the suite unselected again, every suite of the script shows', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(1)');
  if (!(await T('noneSel(1)'))) return 'the suite selector has no None to unselect with';
  const ok = await until(function () { return columnNow(4).then(function (l) { return l.indexOf(base(AS)) !== -1 && l.indexOf(base(GEN)) !== -1; }); }, 5000);
  return !!ok || 'suites shown ' + short(await columnNow(4));
}, test.limit.slow);
test.run('the script unselected again, every script\'s tests show', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(0)');
  if (!(await T('noneSel(0)'))) return 'the script selector has no None to unselect with';
  const ok = await until(function () { return columnNow(3).then(function (l) { return l.indexOf(base(A)) !== -1 && l.indexOf(base(B)) !== -1; }); }, 5000);
  return !!ok || 'scripts shown ' + short(await columnNow(3));
}, test.limit.slow);
// goal/G47.1, the box: "The testicle search can search by a suite alone: with the script selector blank (all scripts), the
// suite selector lists every suite, each once, and suite.search given no script answers that list; a suite chosen with
// the script blank shows every test of that suite, whichever script it ran for." It replaces the line "with all scripts,
// there is no suite to choose" (Andy: "the testicle search must be able to search for test with the fucking script filter
// blank AND a suite selected!!!"). GEN judges both planted scripts, so it is one suite of two scripts.
function suiteKeysOf(keys, suite) { return keys.filter(function (k) { return k === suite || String(k).slice(-(suite.length + 1)) === '|' + suite; }); }
test.run('with no script chosen, the suite selector lists the suites of every script', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(1)');
  await T('typeSel(1, "zzTsearch")');
  await waitFor('selRows(1).length > 1', 10000);
  const keys = (await T('selRows(1)')) || [];
  return (suiteKeysOf(keys, AS).length > 0 && suiteKeysOf(keys, BS).length > 0) || 'with all scripts it lists ' + short(keys);
}, test.limit.slow);
test.run('with no script chosen, a suite of two scripts is listed once', 0.2, async function () {
  if (mounted()) return mounted();
  await T('typeSel(1, ' + JSON.stringify(path.posix.basename(GEN, '.js')) + ')');
  await waitFor('selRows(1).length > 0', 10000);
  await sleep(500);
  const keys = (await T('selRows(1)')) || [];
  return suiteKeysOf(keys, GEN).length === 1 || 'with all scripts, ' + GEN + ' is listed as ' + short(suiteKeysOf(keys, GEN)) + ' among ' + short(keys);
}, test.limit.slow);
test.run('a suite chosen with no script shows that suite\'s tests of every script', 0.2, async function () {
  if (mounted()) return mounted();
  const r = await call(N.base, 'testicle.testicle.set', { script: B, suite: GEN, test: 'beta holds the general rule', verified: true, severity: 0.2 });
  if (r.status !== 200) return 'testicle.testicle.set: ' + r.status + ' ' + short(r.text);
  const k = suiteKeysOf((await T('selRows(1)')) || [], GEN)[0];
  if (!k || !(await T('pickSel(1, ' + JSON.stringify(k) + ')'))) return 'no row for ' + GEN + ' to pick: ' + short(await T('selRows(1)'));
  const ok = await until(function () {
    return Promise.all([columnNow(3), columnNow(4)]).then(function (l) {
      return l[1].length > 0 && l[1].every(function (v) { return v === base(GEN); }) && l[0].indexOf(base(A)) !== -1 && l[0].indexOf(base(B)) !== -1;
    });
  }, 10000);
  return !!ok || 'scripts shown ' + short(await columnNow(3)) + ', suites shown ' + short(await columnNow(4));
}, test.limit.slow);
test.run('the suite unselected with no script, every script\'s tests show again', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(1)');
  if (!(await T('noneSel(1)'))) return 'the suite selector has no None to unselect with';
  const ok = await until(function () { return columnNow(4).then(function (l) { return l.indexOf(base(AS)) !== -1 && l.indexOf(base(BS)) !== -1; }); }, 5000);
  return !!ok || 'suites shown ' + short(await columnNow(4));
}, test.limit.slow);

// the box: "a view of the testicle branch data.js keeps": a test set on the node shows by itself.
test.run('a test set on the node shows in the list with no press', 0.2, async function () {
  if (mounted()) return mounted();
  const r = await call(N.base, 'testicle.testicle.set', { script: B, suite: BS, test: 'beta answers later', verified: true, severity: 0.4 });
  if (r.status !== 200) return 'testicle.testicle.set: ' + r.status + ' ' + short(r.text);
  const ok = await until(function () { return T('cells()').then(function (rows) { return (rows || []).some(function (x) { return titleOf(x) === 'beta answers later'; }); }); }, 10000);
  return !!ok || 'the list after the set: ' + short((await T('cells()') || []).map(titleOf));
}, test.limit.slow);

// destroy
test.run('destroy leaves its container empty', 0.2, async function () {
  if (mounted()) return mounted();
  const after = await c.evaluate('(function () { window.__made.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
  return (after === '' || after === 'gone') || 'after destroy: ' + short(after).slice(0, 200);
}, test.limit.quick);

// goal/G47.1, the box, the search fix (Andy: "the empty search string with no script or suite selected should already fill
// up with more that 20 reds when i open the app!, and typing in the search bar sends requests and returns NOTHING$!",
// "ALL, GO BOX IT, FIX IT!!!!!!!!!!", and to wsl: "YOU RIGHT SOME EXHAUSTIVE FUCKING TESTS FOR THE MOTHERFUKCING SEARCH
// NOW"): "Every test search answers its failed tests first, then by severity. Red, green, the script and the suite go to
// the server with the words, so the server narrows before it cuts an answer; a change of any of them asks again. One
// answer holds about 12 tests, so the page asks for the following answers while the server says there are more, up to 100
// tests. Opened with no words and no selector, the page shows the reds first, more than 20 when there are; typed words show
// the tests they find."
// THE WORLD: 110 passing tests of beta at severity 1, 25 failing tests of alpha at severity 0.3, and alpha's quiet pass
// (the word quokka) at severity 0, set before a fresh page opens, so what the page shows came from its own asks, not from
// the stream of the sets. With what was set above (gamma's 30 failures among them), 114 passing tests and 57 failing ones
// are current: 171, past 100. Rows of both planted folders are counted, spirit/zzTsearch/ and spirit/zzTsearchRed/.
const LOUDB = function (i) { return 'beta passes loudly, number ' + i; };
const REDA = function (i) { return 'alpha fails, number ' + i; };
const QUOKKA = 'alpha passes quietly, the quokka';
const REDS = 27 + GAMMA_REDS;
const PLANTED = 'spirit/zzTsearch';
const plantedCells = function () { return T('cells()').then(function (rows) { return (rows || []).filter(function (r) { return String(r.key).indexOf(PLANTED) === 0; }); }); };
let many = false, opened = '';
const results = function () { return plantedCells().then(function (rows) { return rows.map(function (r) { return (r.cells[0] || {}).text; }); }); };
const titles = function () { return plantedCells().then(function (rows) { return rows.map(titleOf); }); };
const reopened = function () { return !N || !N.up ? NONODE : !many ? 'the tests were not set: the world failed' : opened !== 'made' ? 'the search did not mount again: the world failed' : ''; };
test.run('the world: 110 passing tests of beta at severity 1, 25 failing tests of alpha at 0.3, alpha\'s quiet pass at 0', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  const out = [];
  for (let i = 0; i < 110; i++) out.push(await call(N.base, 'testicle.testicle.set', { script: B, suite: BS, test: LOUDB(i), verified: true, severity: 1 }));
  for (let i = 0; i < 25; i++) out.push(await call(N.base, 'testicle.testicle.set', { script: A, suite: AS, test: REDA(i), verified: false, severity: 0.3 }));
  out.push(await call(N.base, 'testicle.testicle.set', { script: A, suite: AS, test: QUOKKA, verified: true, severity: 0 }));
  many = out.every(function (r) { return r.status === 200; });
  return many || 'testicle.testicle.set: ' + short(out.filter(function (r) { return r.status !== 200; }).map(function (r) { return r.status + ' ' + r.text; }));
}, test.limit.long);
test.run('the world: a fresh page opens the search again, no words and no selector', 0.2, async function () {
  if (!many) return 'the tests were not set: the world failed';
  if (!c || c.error || !c.evaluate) return 'no page: the world failed';
  await c.send('Page.navigate', { url: N.base + '/face.html' });
  if (!(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000))) return 'the page has no spirit: nothing judged';
  await c.evaluate(HANDS);
  opened = await c.evaluate('window.spirit.ready.then(function () { return window.spirit.require("spirit/app/testicle/element/search/testicle.js"); }).then(function () {' +
    ' var E = window.spirit.element.spirit.app.testicle.element.search.testicle;' +
    ' var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:1400px;height:800px;display:flex;"; document.body.appendChild(b);' +
    ' window.__made = E.create(b, {}); return window.__made && typeof window.__made.destroy === "function" ? "made" : "no destroy"; }, function (e) { return "refused: " + (e && e.message || e); })');
  if (opened !== 'made') return 'it did not mount: ' + short(opened);
  // Settled: the count of rows the same twice, a second apart.
  let last = -1, now = 0;
  for (let i = 0; i < 30; i++) { now = ((await results()) || []).length; if (now === last && now > 0) break; last = now; await sleep(1000); }
  return now > 0 || 'nothing shows';
}, test.limit.long);
// goal/G47.1, the box: "The testicle search's default equals testicle.red: all scripts, all suites, reds only, most severe
// first". Opened, the 57 reds alone; then green pressed, both on, for the checks of the following answers.
const severities = function () { return plantedCells().then(function (rows) { return rows.map(function (r) { return Number((r.cells[1] || {}).text); }); }); };
test.run('opened with no words and no selector, more than 20 reds show: every one of the 57, and no success', 0.2, async function () {
  if (reopened()) return reopened();
  const got = (await results()) || [];
  const n = got.filter(function (v) { return v === '❌'; }).length;
  return (n === REDS && got.length === REDS) || n + ' reds show, of ' + REDS + ', among ' + got.length + ' rows';
}, test.limit.quick);
test.run('opened, the reds show the most severe first', 0.2, async function () {
  if (reopened()) return reopened();
  const sev = (await severities()) || [];
  return (sev.length > 0 && sev.every(function (v, i) { return i === 0 || sev[i - 1] >= v; })) || 'severities top down: ' + short(sev);
}, test.limit.quick);
test.run('the world: green pressed on the fresh page, both filters on', 0.2, async function () {
  if (reopened()) return reopened();
  await T('press("green")');
  const ok = await waitFor('filter("green").on && filter("red").on', 5000);
  if (!ok) return 'red ' + short(await T('filter("red")')) + ', green ' + short(await T('filter("green")'));
  let last = -1, now = 0;
  for (let i = 0; i < 30; i++) { now = ((await results()) || []).length; if (now === last && now > REDS) break; last = now; await sleep(1000); }
  return now > REDS || now + ' rows show with green on';
}, test.limit.long);
test.run('both on, the reds show first', 0.2, async function () {
  if (reopened()) return reopened();
  const got = (await results()) || [];
  const firstPass = got.indexOf('✅');
  return (got[0] === '❌' && (firstPass === -1 || got.slice(firstPass).indexOf('❌') === -1)) || 'results in order: ' + short(got.join(''));
}, test.limit.quick);
test.run('both on, the page asks for the following answers while there are more: with 171 tests, 100 show', 0.2, async function () {
  if (reopened()) return reopened();
  const n = ((await results()) || []).length;
  return n === 100 || n + ' tests show, of 171 current; wanted 100';
}, test.limit.quick);
test.run('both on, the quiet pass at severity 0 is not among the 100: it waits for a narrower ask', 0.2, async function () {
  if (reopened()) return reopened();
  const t = (await titles()) || [];
  return t.indexOf(QUOKKA) === -1 || 'the quiet pass shows among ' + t.length + ': the 100 are not the reds and the most severe';
}, test.limit.quick);
test.run('with green off, every failure shows and no success', 0.2, async function () {
  if (reopened()) return reopened();
  await T('press("green")');
  const ok = await until(function () { return results().then(function (l) { return l.length === REDS && l.every(function (v) { return v === '❌'; }); }); }, 15000);
  return !!ok || 'with green off: ' + short(((await results()) || []).join(''));
}, test.limit.slow);
test.run('with red off and green on, 100 successes show and no failure', 0.2, async function () {
  if (reopened()) return reopened();
  await T('press("green")');
  await sleep(300);
  await T('press("red")');
  const ok = await until(function () { return results().then(function (l) { return l.length === 100 && l.every(function (v) { return v === '✅'; }); }); }, 15000);
  const got = (await results()) || [];
  return !!ok || got.length + ' show with red off: ' + short(got.join(''));
}, test.limit.slow);
test.run('a script chosen asks the server again: alpha chosen, green alone, its quiet pass shows', 0.2, async function () {
  if (reopened()) return reopened();
  await T('openSel(0)');
  await T('typeSel(0, "zzTsearch")');
  await waitFor('selRows(0).length > 0', 10000);
  if (!(await T('pickSel(0, ' + JSON.stringify(A) + ')'))) return 'no row for ' + A + ' to pick: ' + short(await T('selRows(0)'));
  const ok = await until(function () { return titles().then(function (t) { return t.indexOf(QUOKKA) !== -1; }); }, 15000);
  const shown = await columnNow(3);
  return (!!ok && shown.every(function (v) { return v === base(A); })) || 'with alpha chosen, green alone: ' + short(await titles());
}, test.limit.slow);
test.run('the script unselected and alpha\'s own suite chosen, green alone, its quiet pass shows', 0.2, async function () {
  if (reopened()) return reopened();
  await T('openSel(0)');
  if (!(await T('noneSel(0)'))) return 'the script selector has no None to unselect with';
  await sleep(500);
  await T('openSel(1)');
  await T('typeSel(1, "zzTsearch")');
  await waitFor('selRows(1).length > 0', 10000);
  const k = suiteKeysOf((await T('selRows(1)')) || [], AS)[0];
  if (!k || !(await T('pickSel(1, ' + JSON.stringify(k) + ')'))) return 'no row for ' + AS + ' to pick: ' + short(await T('selRows(1)'));
  const ok = await until(function () { return titles().then(function (t) { return t.indexOf(QUOKKA) !== -1; }); }, 15000);
  const shown = await columnNow(4);
  return (!!ok && shown.every(function (v) { return v === base(AS); })) || 'with alpha\'s suite chosen, green alone: ' + short(await titles());
}, test.limit.slow);
test.run('the world: the suite unselected, red and green both on', 0.2, async function () {
  if (reopened()) return reopened();
  await T('openSel(1)');
  if (!(await T('noneSel(1)'))) return 'the suite selector has no None to unselect with';
  await T('press("red")');
  await sleep(500);
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!red && !!green && red.on && green.on) || 'red ' + short(red) + ', green ' + short(green);
}, test.limit.slow);
test.run('typed words show the tests they find: "quokka" shows the quiet pass', 0.2, async function () {
  if (reopened()) return reopened();
  if (!(await T('typeMain("quokka")'))) return 'no search field to type in';
  const ok = await until(function () { return titles().then(function (t) { return t.indexOf(QUOKKA) !== -1; }); }, 15000);
  return !!ok || '"quokka" shows ' + short(await titles());
}, test.limit.slow);
test.run('typed words show the tests they find: "fails" shows failures', 0.2, async function () {
  if (reopened()) return reopened();
  if (!(await T('typeMain("fails")'))) return 'no search field to type in';
  const ok = await until(function () { return titles().then(function (t) { return t.some(function (x) { return /fails/.test(x); }); }); }, 15000);
  return !!ok || '"fails" shows ' + short(await titles());
}, test.limit.slow);
test.run('the words cleared, the reds show first again', 0.2, async function () {
  if (reopened()) return reopened();
  await T('typeMain("")');
  const ok = await until(function () { return results().then(function (l) { return l.length === 100 && l.filter(function (v) { return v === '❌'; }).length === REDS && l[0] === '❌'; }); }, 15000);
  return !!ok || 'with the words cleared: ' + short(((await results()) || []).join(''));
}, test.limit.slow);
test.run('destroy leaves the fresh search\'s container empty', 0.2, async function () {
  if (reopened()) return reopened();
  const after = await c.evaluate('(function () { window.__made.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
  return (after === '' || after === 'gone') || 'after destroy: ' + short(after).slice(0, 200);
}, test.limit.quick);
