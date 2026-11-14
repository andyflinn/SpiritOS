'use strict';

// spirit/run/spirit/app/testicle/element/search/testicle/test/listElement.js
// The tests of spirit/app/testicle/element/search/testicle/listElement.js, and of no other module (spec: ./listElement.md). Its own test,
// owed since the rule "every production script has its own test" (goal/G47.1, box v72). The testicle list: every current
// test row of testicle's test table, what the testicle search draws in the first tab of testicle's face.
//
// The world of spirit/element/search/test/testicle.js, as it is: a real node on a scratch copy of the tracked files,
// testicle turned on there, the general suites stubbed, tests of planted scripts set through testicle.testicle.set, and
// the list mounted alone in a real Chrome on /face.html. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../../../../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

const MODULE = path.join(RUN, 'spirit', 'app', 'testicle', 'element', 'search', 'testicle', 'listElement.js');
// THE PLANTED SCRIPTS, under one folder of their own, each with its own test.
const Z = 'spirit/zzTlist/';
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
const PASSES = 'alpha passes';
const FAILS = 'beta fails';
const FLIPS = 'alpha flips';
const GREENS = 150;

function scratch() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  // testicle turned on there, as an owner turns a server on (spirit/test/headLessChrome.js scratchNode).
  const on = path.join(run, 'spirit', 'state', 'testicle');
  fs.mkdirSync(on, { recursive: true });
  fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
  // THE GENERAL SUITES TAKEN AWAY, as spirit/element/search/test/testicle.js does: each keeps its name, so its reach, and
  // judges and reports nothing.
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

// THE PAGE'S HANDS, those of spirit/element/search/test/testicle.js, and one more: click(key), a row pressed.
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
  '  cells: function () { return main().map(function (r) { return { key: r.getAttribute("data-key"), cells: Array.prototype.slice.call(r.querySelectorAll("td")).filter(seen).map(function (td) { return { field: td.getAttribute("data-field") || "", text: String(td.innerText || "").trim(), tip: tipOf(td) }; }) }; }); },' +
  '  heads: function () { return all("th").filter(function (h) { return !inSel(h) && seen(h); }).map(function (h) { return { text: String(h.innerText || "").trim(), sort: h.getAttribute("data-sort") }; }); },' +
  '  filter: function (word) { var re = new RegExp(word, "i"); var b = all("button[data-filter][data-value]").filter(function (x) { return !inSel(x) && seen(x) && (re.test(x.getAttribute("data-value")) || re.test(x.innerText)); })[0]; return b ? { on: Number(getComputedStyle(b).fontWeight) >= 600 } : null; },' +
  '  press: function (word) { var re = new RegExp(word, "i"); var b = all("button[data-filter][data-value]").filter(function (x) { return !inSel(x) && seen(x) && (re.test(x.getAttribute("data-value")) || re.test(x.innerText)); })[0]; if (!b) return false; b.click(); return true; },' +
  '  selectors: function () { return [0, 1].map(function (i) { var s = sel(i); return s ? { field: s.querySelector("button[id$=\\"field\\"]") ? String(s.querySelector("button[id$=\\"field\\"]").innerText || "").trim() : null } : null; }); },' +
  '  openSel: function (i) { var s = sel(i); var f = s ? s.querySelector("button[id$=\\"field\\"]") : null; if (!f) return false; f.click(); return true; },' +
  '  typeSel: function (i, w) { var s = sel(i); var t = s ? s.querySelector("input[id$=\\"text\\"]") : null; if (!t) return false; t.value = w; t.dispatchEvent(new Event("input", { bubbles: true })); return true; },' +
  '  selRows: function (i) { var s = sel(i); return s ? Array.prototype.slice.call(s.querySelectorAll("[id$=\\"popup\\"] tr[data-key]")).map(function (r) { return r.getAttribute("data-key"); }) : []; },' +
  '  pickSel: function (i, k) { var s = sel(i); var r = s ? Array.prototype.slice.call(s.querySelectorAll("[id$=\\"popup\\"] tr[data-key]")).filter(function (r) { return r.getAttribute("data-key") === k; })[0] : null; if (!r) return false; r.click(); return true; },' +
  '  noneSel: function (i) { var s = sel(i); var n = s ? s.querySelector("button[id$=\\"none\\"]") : null; if (!n) return false; n.click(); return true; },' +
  '  click: function (k) { var r = main().filter(function (r) { return r.getAttribute("data-key") === k; })[0]; if (!r) return false; var td = r.querySelector("td"); (td || r).click(); return true; },' +
  '}; return "hands"; }())';

// What the tests share, made by the tests in order.
let s = null, N = null, c = null, made = '', GEN = '', planted = false;
const current = {};
const live = [];
const NONODE = 'no scratch node: the world failed';
const T = function (expr) { return c.evaluate('window.__t.' + expr); };
const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 10000); };
const mounted = function () { return !N || !N.up ? NONODE : (!c || c.error || !c.evaluate) ? 'no page: the world failed' : made !== 'made' ? 'the list did not mount: the world failed' : !planted ? 'no tests were set: the world failed' : ''; };
const titleOf = function (row) { const t = row && row.cells ? row.cells.filter(function (cl) { return cl.field === 'test'; })[0] || row.cells[2] : null; return t ? t.text : ''; };
const planted0 = function () { return T('cells()').then(function (rows) { return (rows || []).filter(function (r) { return String(r.key).indexOf(Z) === 0; }); }); };
const column = function (i) { return planted0().then(function (rows) { return rows.map(function (r) { return (r.cells[i] || {}).text; }); }); };

test.after(async function () {
  try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  for (const k of live) await stop(k);
  try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
});

test.run('spirit/app/testicle/element/search/testicle/listElement.js is there', 0.2, function () {
  return fs.existsSync(MODULE) || 'no ' + path.relative(RUN, MODULE);
}, test.limit.quick);
test.run('the world: a scratch node comes up, testicle on', 0.2, async function () {
  s = scratch();
  N = await boot(s.run); live.push(N.child);
  if (!N.up) return 'the scratch node did not come up: nothing judged';
  // Its testicle answers once its app server runs, a moment after the node.
  N.up = !!(await until(function () { return call(N.base, 'testicle.busy').then(function (r) { return r.status === 200; }); }, 30000));
  return N.up || 'testicle never answered testicle.busy on the scratch node: nothing judged';
}, test.limit.long);
test.run('the world: tests of the planted scripts are set on it, alpha\'s flip twice', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  GEN = s.gen;
  if (!GEN) return 'no general test judges ' + A;
  const sets = [
    { script: A, suite: AS, test: PASSES, verified: true, severity: 0 },
    { script: B, suite: BS, test: FAILS, verified: false, severity: 1 },
    { script: A, suite: GEN, test: FLIPS, verified: true, severity: 0.2 },
    { script: A, suite: GEN, test: FLIPS, verified: false, severity: 0.2 },
  ];
  const out = [];
  for (const a of sets) { out.push(await call(N.base, 'testicle.testicle.set', a)); await sleep(20); }
  planted = out.every(function (r) { return r.status === 200; });
  [PASSES, FAILS, 'replaced', FLIPS].forEach(function (t, i) { if (out[i].body && out[i].body.key) current[t] = out[i].body; });
  return planted || 'testicle.testicle.set: ' + short(out.map(function (r) { return r.status + ' ' + r.text; }));
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

test.run('it loads alone through spirit.require and mounts with create(container, { pick }), answering destroy', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  if (!c || c.error || !c.evaluate) return 'no page: the world failed';
  await c.evaluate(HANDS);
  made = await c.evaluate('window.spirit.ready.then(function () { return window.spirit.require("spirit/app/testicle/element/search/testicle/listElement.js"); }).then(function () {' +
    ' var E = ((((((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element || {}).search || {}).testicle || {}).listElement); if (!E || typeof E.create !== "function") return "no create";' +
    ' var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:1400px;height:800px;display:flex;"; document.body.appendChild(b);' +
    ' window.__picked = []; window.__made = E.create(b, { pick: function (row, key) { window.__picked.push(key); } }); return window.__made && typeof window.__made.destroy === "function" ? "made" : "no destroy"; }, function (e) { return "refused: " + (e && e.message || e); })');
  return made === 'made' || 'it did not mount: ' + short(made);
}, test.limit.slow);

// goal/G47.1: "The default equals testicle.red" (Andy: "the default setting for testicle search should be EQUAL the the RED
// verb of testicle. ALL scripts, ALL suites, reds only, most SERVERE FIRST DAMMIT.")
test.run('opened, red is on and green is off', 0.2, async function () {
  if (mounted()) return mounted();
  await waitFor('filter("red") && filter("green")', 10000);
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!red && !!green && red.on && !green.on) || 'red ' + short(red) + ', green ' + short(green);
}, test.limit.slow);
test.run('opened, it shows the reds of every script, the most severe first, and no success', 0.2, async function () {
  if (mounted()) return mounted();
  const ok = await until(function () { return column(2).then(function (l) { return l.indexOf(FAILS) !== -1 && l.indexOf(FLIPS) !== -1; }); }, 15000);
  const icons = await column(0), sev = await column(1), titles = await column(2);
  const down = sev.every(function (v, i) { return i === 0 || Number(sev[i - 1]) >= Number(v); });
  return (!!ok && icons.every(function (v) { return v === '❌'; }) && down && titles[0] === FAILS) || 'results ' + short(icons) + ', severities ' + short(sev) + ', titles ' + short(titles);
}, test.limit.slow);
test.run('the world: green pressed, both filters on', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("green")');
  const ok = await waitFor('filter("green").on && filter("red").on', 5000);
  await until(function () { return column(2).then(function (l) { return l.indexOf(PASSES) !== -1; }); }, 10000);
  return !!ok || 'red ' + short(await T('filter("red")')) + ', green ' + short(await T('filter("green")'));
}, test.limit.slow);

// "its current rows only, by a filter not drawn: the branch keeps a flipped test's replaced row beside its current one"
test.run('it lists each test once, by its current row alone', 0.2, async function () {
  if (mounted()) return mounted();
  const keys = ((await T('keys()')) || []).filter(function (k) { return k.indexOf(Z) === 0; }).sort();
  const want = [current[PASSES], current[FAILS], current[FLIPS]].map(function (r) { return r && r.key; }).sort();
  return JSON.stringify(keys) === JSON.stringify(want) || 'rows ' + short(keys) + ', the current rows ' + short(want);
}, test.limit.quick);

// the box: "The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity second;
// the title third; then the script name (no path), then the suite name (no path)", "The list is sortable by all its columns"
test.run('its five columns, in order: result, severity, title, script, suite, every one a sort trigger', 0.2, async function () {
  if (mounted()) return mounted();
  const heads = (await T('heads()')) || [];
  const fields = heads.map(function (h) { return h.sort; });
  return JSON.stringify(fields) === JSON.stringify(['verified', 'severity', 'test', 'script', 'suite']) || 'headers: ' + short(heads);
}, test.limit.quick);
test.run('a row shows its result as an icon, its title, and its script and suite by file name, no path', 0.2, async function () {
  if (mounted()) return mounted();
  const row = ((await planted0()) || []).filter(function (r) { return titleOf(r) === FAILS; })[0];
  const t = row ? row.cells.map(function (cl) { return cl.text; }) : [];
  return JSON.stringify(t) === JSON.stringify(['❌', '1.00', FAILS, base(B), base(BS)]) || 'the row of ' + FAILS + ': ' + short(t);
}, test.limit.quick);

// the box: "two filters, red and green; at least one of the two is selected at all times: the only combination forbidden
// is both off"
test.run('with red off and green on, only the successes show', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("red")');
  const ok = await until(function () { return column(0).then(function (l) { return l.length > 0 && l.every(function (v) { return v === '✅'; }); }); }, 5000);
  return (!!ok && !(await T('filter("red")')).on) || 'results shown ' + short(await column(0)) + ', red ' + short(await T('filter("red")'));
}, test.limit.slow);
test.run('with red off, a press on green leaves it on: both off is refused', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("green")');
  await sleep(300);
  const green = await T('filter("green")');
  return (!!green && green.on) || 'green ' + short(green);
}, test.limit.slow);
test.run('the world: both filters on again', 0.2, async function () {
  if (mounted()) return mounted();
  await T('press("red")');
  await sleep(300);
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!red && !!green && red.on && green.on) || 'red ' + short(red) + ', green ' + short(green);
}, test.limit.slow);

// the box: "a script selector, unselected (all) the default", "the file search as a dropdown, production scripts only",
// "a suite selector, unselected (all) the default"
test.run('it has two selectors, the script selector first, the suite selector second, each a dropdown showing all', 0.2, async function () {
  if (mounted()) return mounted();
  const sels = (await T('selectors()')) || [];
  return (sels.length === 2 && !!sels[0] && !!sels[1] && /all scripts/.test(sels[0].field || '') && /all suites/.test(sels[1].field || '')) || 'selectors: ' + short(sels);
}, test.limit.quick);
test.run('the script selector lists production scripts only: no test, no other kind of file', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(0)');
  await T('typeSel(0, "zzTlist")');
  await waitFor('selRows(0).length > 0', 10000);
  const keys = ((await T('selRows(0)')) || []).filter(function (k) { return String(k).indexOf(Z) !== -1; });
  return (keys.indexOf(A) !== -1 && keys.every(function (k) { return /\.js$/.test(k) && k.split('/').indexOf('test') === -1; })) || 'it lists ' + short(keys);
}, test.limit.slow);
test.run('a script chosen narrows the rows to that script\'s tests', 0.2, async function () {
  if (mounted()) return mounted();
  if (!(await T('pickSel(0, ' + JSON.stringify(A) + ')'))) return 'no row for ' + A + ' to pick: ' + short(await T('selRows(0)'));
  const ok = await until(function () { return column(3).then(function (l) { return l.length > 0 && l.every(function (v) { return v === base(A); }); }); }, 5000);
  return !!ok || 'scripts shown ' + short(await column(3));
}, test.limit.slow);
test.run('with a script chosen, the suite selector lists that script\'s suites alone', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(1)');
  await waitFor('selRows(1).filter(function (k) { return k === ' + JSON.stringify(A + '|' + AS) + ' || k === ' + JSON.stringify(A + '|' + GEN) + '; }).length >= 2', 15000);
  const keys = (await T('selRows(1)')) || [];
  return (keys.indexOf(A + '|' + AS) !== -1 && keys.indexOf(A + '|' + GEN) !== -1 && !keys.some(function (k) { return String(k).indexOf(BS) !== -1; })) || 'it lists ' + short(keys);
}, test.limit.slow);
test.run('the script unselected again, every script\'s tests show', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(1)');
  await T('openSel(0)');
  if (!(await T('noneSel(0)'))) return 'the script selector has no None to unselect with';
  const ok = await until(function () { return column(3).then(function (l) { return l.indexOf(base(A)) !== -1 && l.indexOf(base(B)) !== -1; }); }, 5000);
  return !!ok || 'scripts shown ' + short(await column(3));
}, test.limit.slow);
// the box: "The testicle search can search by a suite alone: with the script selector blank (all scripts), the suite
// selector lists every suite, each once"; beta's test in GEN makes it a suite of two scripts.
test.run('with no script chosen, a suite chosen shows that suite\'s tests of every script', 0.2, async function () {
  if (mounted()) return mounted();
  const r = await call(N.base, 'testicle.testicle.set', { script: B, suite: GEN, test: 'beta holds the general rule', verified: true, severity: 0.2 });
  if (r.status !== 200) return 'testicle.testicle.set: ' + r.status + ' ' + short(r.text);
  await T('openSel(1)');
  await T('typeSel(1, ' + JSON.stringify(path.posix.basename(GEN, '.js')) + ')');
  await waitFor('selRows(1).length > 0', 10000);
  await sleep(500);
  const keys = ((await T('selRows(1)')) || []).filter(function (k) { return String(k).slice(-GEN.length) === GEN; });
  if (keys.length !== 1) return 'with all scripts, ' + GEN + ' is listed as ' + short(keys);
  if (!(await T('pickSel(1, ' + JSON.stringify(keys[0]) + ')'))) return 'no row for ' + GEN + ' to pick';
  const ok = await until(function () {
    return Promise.all([column(3), column(4)]).then(function (l) { return l[1].length > 0 && l[1].every(function (v) { return v === base(GEN); }) && l[0].indexOf(base(A)) !== -1 && l[0].indexOf(base(B)) !== -1; });
  }, 10000);
  return !!ok || 'scripts shown ' + short(await column(3)) + ', suites shown ' + short(await column(4));
}, test.limit.slow);
test.run('the world: the suite unselected, every suite shows', 0.2, async function () {
  if (mounted()) return mounted();
  await T('openSel(1)');
  if (!(await T('noneSel(1)'))) return 'the suite selector has no None to unselect with';
  const ok = await until(function () { return column(4).then(function (l) { return l.indexOf(base(AS)) !== -1 && l.indexOf(base(BS)) !== -1; }); }, 5000);
  return !!ok || 'suites shown ' + short(await column(4));
}, test.limit.slow);

// "a row clicked is handed to pick"
test.run('a row pressed is handed to pick, by its key', 0.2, async function () {
  if (mounted()) return mounted();
  const k = current[FAILS] && current[FAILS].key;
  if (!k || !(await T('click(' + JSON.stringify(k) + ')'))) return 'no row of ' + FAILS + ' to press';
  await sleep(300);
  const got = await c.evaluate('window.__picked');
  return (Array.isArray(got) && got.indexOf(k) !== -1) || 'pick was handed ' + short(got);
}, test.limit.slow);

// "The server publishes every row it writes, so a test set anywhere shows by itself."
test.run('a test set on the node shows in the list with no press', 0.2, async function () {
  if (mounted()) return mounted();
  const r = await call(N.base, 'testicle.testicle.set', { script: B, suite: BS, test: 'beta answers later', verified: true, severity: 0.4 });
  if (r.status !== 200) return 'testicle.testicle.set: ' + r.status + ' ' + short(r.text);
  const ok = await until(function () { return column(2).then(function (l) { return l.indexOf('beta answers later') !== -1; }); }, 10000);
  return !!ok || 'titles after the set: ' + short(await column(2));
}, test.limit.slow);

// "the branch keeps a flipped test's replaced row beside its current one": a flip streamed in while the list is open.
test.run('a test flipped on the node while the list is open shows once, by its new current row', 0.2, async function () {
  if (mounted()) return mounted();
  const r = await call(N.base, 'testicle.testicle.set', { script: B, suite: BS, test: FAILS, verified: true, severity: 1 });
  if (r.status !== 200 || !r.body || !r.body.key) return 'testicle.testicle.set: ' + r.status + ' ' + short(r.text);
  const ok = await until(function () { return T('keys()').then(function (k) { return (k || []).indexOf(r.body.key) !== -1; }); }, 10000);
  await sleep(500);
  const ks = ((await T('keys()')) || []).filter(function (k) { return k.indexOf(B + '|' + BS + '|' + FAILS + '|') === 0; });
  return (!!ok && ks.length === 1 && ks[0] === r.body.key) || 'rows of ' + FAILS + ': ' + short(ks) + ', its current row ' + r.body.key;
}, test.limit.slow);

// "answer after answer while it says more, up to 100 tests"
test.run('the world: 150 more passing tests of beta are set', 0.2, async function () {
  if (mounted()) return mounted();
  const bad = [];
  for (let i = 1; i <= GREENS; i++) {
    const r = await call(N.base, 'testicle.testicle.set', { script: B, suite: BS, test: 'beta passes, number ' + i, verified: true, severity: 0.5 });
    if (r.status !== 200) bad.push(r.status + ' ' + r.text);
  }
  return !bad.length || 'testicle.testicle.set: ' + short(bad);
}, test.limit.long);
test.run('with green alone and words typed, it asks answer after answer while there are more, and stops at 100 tests', 0.2, async function () {
  if (mounted()) return mounted();
  // Every ask the list makes of testicle.testicle.search, recorded on the page's own interface.
  const hooked = await c.evaluate('(function () { var T = window.spirit.testicle; var f = T && T["testicle.search"]; if (typeof f !== "function") return false; window.__asks = []; T["testicle.search"] = function (a) { window.__asks.push(a); return f.apply(this, arguments); }; return true; }())');
  if (!hooked) return 'the page has no testicle.testicle.search to watch';
  await T('press("red")');
  await sleep(1500);
  await c.evaluate('window.__asks = []');
  const typed = await c.evaluate('(function () { var t = Array.prototype.slice.call(document.querySelectorAll("#zzBox input[id$=\\"text\\"]")).filter(function (x) { return !(x.closest && x.closest("[id$=\\"selectors\\"]")); })[0]; if (!t) return false; t.value = "beta passes"; t.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
  if (!typed) return 'no search field to type in';
  // Settled: no new ask for two seconds, up to 30.
  let n = -1;
  await until(async function () { const now = ((await c.evaluate('window.__asks')) || []).length; const still = now === n && now > 0; n = now; if (!still) await sleep(1750); return still; }, 30000);
  const asks = ((await c.evaluate('window.__asks')) || []).filter(function (a) { return a && a.text === 'beta passes'; });
  const froms = asks.map(function (a) { return Number(a.from) || 0; });
  const last = Math.max.apply(null, froms.concat([0]));
  return (asks.length > 1 && asks.every(function (a) { return a.result === 'green'; }) && last < 100 && last >= 100 - 20) || 'the asks: ' + short(asks);
}, test.limit.slow);

test.run('destroy leaves its container empty', 0.2, async function () {
  if (mounted()) return mounted();
  const after = await c.evaluate('(function () { window.__made.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
  return after === '' || 'after destroy: ' + short(after).slice(0, 200);
}, test.limit.quick);
