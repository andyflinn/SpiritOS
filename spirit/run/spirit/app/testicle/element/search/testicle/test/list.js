'use strict';

// spirit/run/spirit/app/testicle/element/search/testicle/test/list.js
// The tests of spirit/app/testicle/element/search/testicle/list.js, and of no other module (spec: ./list.md). Its own test,
// owed since the rule "every production script has its own test" (goal/G47.1, box v72). The testicle list: every current
// test row of testicle's test table, what the testicle search draws in the first tab of testicle's face.
//
// The world of spirit/element/search/test/testicle.js, as it is: a real node on a scratch copy of the tracked files,
// testicle turned on there, the general suites stubbed, tests of planted scripts set through testicle.testicle.set, and
// the list mounted alone in a real Chrome on / (spirit/shell/face.html). Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../../../../..');
const SPIRIT = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = SPIRIT.requireScript('spirit/test/headLessChrome.js');
const REPO = path.resolve(RUN, '..', '..');
const test = SPIRIT.requireScript('spirit/test/testReport.js');
const { freePort, until, sleep, chromePage, findChrome } = SPIRIT.requireScript('spirit/test/headLessChrome.js');

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

const MODULE = path.join(RUN, 'spirit', 'app', 'testicle', 'element', 'search', 'testicle', 'list.js');
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
  const on = path.join(run, 'spirit', 'state', 'app', 'testicle');
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
// A verb is called by the app's id (goal/G49.19): spirit.app.testicle.<verb>, never testicle.<verb>.
async function call(base, verb, args) {
  try {
    const r = await fetch(base + '/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
    const text = await r.text();
    return { status: r.status, text: text, body: parsed(text) };
  } catch (e) { return { status: 0, text: '', body: null }; }
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
const T = function (expr) { return c.evaluate('window.__t.' + expr); };
const waitFor = function (expr, ms) { return until(function () { return c.evaluate('(function () { with (window.__t) { return !!(' + expr + '); } }())'); }, ms || 10000); };
const mounted = function () { return !!(N && N.up && c && !c.error && c.evaluate && made === 'made' && planted); };
const titleOf = function (row) { const t = row && row.cells ? row.cells.filter(function (cl) { return cl.field === 'test'; })[0] || row.cells[2] : null; return t ? t.text : ''; };
const planted0 = function () { return T('cells()').then(function (rows) { return (rows || []).filter(function (r) { return String(r.key).indexOf(Z) === 0; }); }); };
const column = function (i) { return planted0().then(function (rows) { return rows.map(function (r) { return (r.cells[i] || {}).text; }); }); };

test.after(async function () {
  try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  for (const k of live) await stop(k);
  try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
});

test.run('spirit/app/testicle/element/search/testicle/list.js is there', 0.2, function () {
  return fs.existsSync(MODULE) || false;
}, test.limit.quick);
test.run('a scratch node comes up for this suite with testicle on', 0.2, async function () {
  s = scratch();
  N = await boot(s.run); live.push(N.child);
  if (!N.up) return false;
  // Its testicle answers once its app server runs, a moment after the node.
  N.up = !!(await until(function () { return call(N.base, 'spirit.app.testicle.busy').then(function (r) { return r.status === 200; }); }, 30000));
  return N.up || false;
}, test.limit.long);
test.run('tests of the planted scripts are set on the node, alpha\'s flipping test set twice', 0.2, async function () {
  if (!N || !N.up) return false;
  GEN = s.gen;
  if (!GEN) return false;
  const sets = [
    { script: A, suite: AS, test: PASSES, verified: true, severity: 0 },
    { script: B, suite: BS, test: FAILS, verified: false, severity: 1 },
    { script: A, suite: GEN, test: FLIPS, verified: true, severity: 0.2 },
    { script: A, suite: GEN, test: FLIPS, verified: false, severity: 0.2 },
  ];
  const out = [];
  for (const a of sets) { out.push(await call(N.base, 'spirit.app.testicle.testicle.set', a)); await sleep(20); }
  planted = out.every(function (r) { return r.status === 200; });
  [PASSES, FAILS, 'replaced', FLIPS].forEach(function (t, i) { if (out[i].body && out[i].body.key) current[t] = out[i].body; });
  return planted || false;
}, test.limit.slow);
test.run('the face page opens in Chrome with its spirit ready', 0.2, async function () {
  if (!N || !N.up) return false;
  const where = findChrome();
  if (!where) return false;
  c = await chromePage(where);
  if (c.error) return false;
  await c.send('Page.navigate', { url: N.base + '/' });
  return !!(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000)) || false;
}, test.limit.long);

test.run('it loads alone through spirit.requireScript and mounts with create(container, { pick }), answering destroy', 0.2, async function () {
  if (!N || !N.up) return false;
  if (!c || c.error || !c.evaluate) return false;
  await c.evaluate(HANDS);
  made = await c.evaluate('window.spirit.readyPromise.then(function () { return window.spirit.requireScript("spirit/app/testicle/element/search/testicle/list.js"); }).then(function () {' +
    ' var E = ((((((((window.spirit.required || {}).spirit || {}).app || {}).testicle || {}).element || {}).search || {}).testicle || {}).list); if (!E || typeof E.create !== "function") return null;' +
    ' var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:1400px;height:800px;display:flex;"; document.body.appendChild(b);' +
    ' window.__picked = []; window.__made = E.create(b, { pick: function (row, key) { window.__picked.push(key); } }); return window.__made && typeof window.__made.destroy === "function" ? "made" : null; }, function () { return null; })');
  return made === 'made' || false;
}, test.limit.slow);

// goal/G47.1: "The default equals testicle.red" (Andy: "the default setting for testicle search should be EQUAL the the RED
// verb of testicle. ALL scripts, ALL suites, reds only, most SERVERE FIRST DAMMIT.")
test.run('opened, red is on and green is off', 0.2, async function () {
  if (!mounted()) return false;
  await waitFor('filter("red") && filter("green")', 10000);
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!red && !!green && red.on && !green.on) || false;
}, test.limit.slow);
test.run('opened, it shows the reds of every script, the most severe first, and no success', 0.2, async function () {
  if (!mounted()) return false;
  const ok = await until(function () { return column(2).then(function (l) { return l.indexOf(FAILS) !== -1 && l.indexOf(FLIPS) !== -1; }); }, 15000);
  const icons = await column(0), sev = await column(1), titles = await column(2);
  const down = sev.every(function (v, i) { return i === 0 || Number(sev[i - 1]) >= Number(v); });
  return (!!ok && icons.every(function (v) { return v === '❌'; }) && down && titles[0] === FAILS) || false;
}, test.limit.slow);
test.run('pressing green turns both filters on', 0.2, async function () {
  if (!mounted()) return false;
  await T('press("green")');
  const ok = await waitFor('filter("green").on && filter("red").on', 5000);
  await until(function () { return column(2).then(function (l) { return l.indexOf(PASSES) !== -1; }); }, 10000);
  return !!ok || false;
}, test.limit.slow);

// "its current rows only, by a filter not drawn: the branch keeps a flipped test's replaced row beside its current one"
test.run('it lists each test once, by its current row alone', 0.2, async function () {
  if (!mounted()) return false;
  const keys = ((await T('keys()')) || []).filter(function (k) { return k.indexOf(Z) === 0; }).sort();
  const want = [current[PASSES], current[FAILS], current[FLIPS]].map(function (r) { return r && r.key; }).sort();
  return JSON.stringify(keys) === JSON.stringify(want) || false;
}, test.limit.quick);

// the box: "The columns, in this order: the result first, as an icon, ❌ for a failure, ✅ for a success; severity second;
// the title third; then the script name (no path), then the suite name (no path)", "The list is sortable by all its columns"
test.run('it has five columns in the order result, severity, title, script and suite, every one a sort trigger', 0.2, async function () {
  if (!mounted()) return false;
  const heads = (await T('heads()')) || [];
  const fields = heads.map(function (h) { return h.sort; });
  return JSON.stringify(fields) === JSON.stringify(['verified', 'severity', 'test', 'script', 'suite']) || false;
}, test.limit.quick);
test.run('a row shows its result as an icon, its title, and its script and suite by file name, no path', 0.2, async function () {
  if (!mounted()) return false;
  const row = ((await planted0()) || []).filter(function (r) { return titleOf(r) === FAILS; })[0];
  const t = row ? row.cells.map(function (cl) { return cl.text; }) : [];
  return JSON.stringify(t) === JSON.stringify(['❌', '1.00', FAILS, base(B), base(BS)]) || false;
}, test.limit.quick);

// the box: "two filters, red and green; at least one of the two is selected at all times: the only combination forbidden
// is both off"
test.run('with red off and green on, only the successes show', 0.2, async function () {
  if (!mounted()) return false;
  await T('press("red")');
  const ok = await until(function () { return column(0).then(function (l) { return l.length > 0 && l.every(function (v) { return v === '✅'; }); }); }, 5000);
  return (!!ok && !(await T('filter("red")')).on) || false;
}, test.limit.slow);
test.run('with red off, a press on green leaves it on: both off is refused', 0.2, async function () {
  if (!mounted()) return false;
  await T('press("green")');
  await sleep(300);
  const green = await T('filter("green")');
  return (!!green && green.on) || false;
}, test.limit.slow);
test.run('pressing red again turns both filters on again', 0.2, async function () {
  if (!mounted()) return false;
  await T('press("red")');
  await sleep(300);
  const red = await T('filter("red")'), green = await T('filter("green")');
  return (!!red && !!green && red.on && green.on) || false;
}, test.limit.slow);

// the box: "a script selector, unselected (all) the default", "the file search as a dropdown, production scripts only",
// "a suite selector, unselected (all) the default"
test.run('it has two selectors, the script selector first, the suite selector second, each a dropdown showing all', 0.2, async function () {
  if (!mounted()) return false;
  const sels = (await T('selectors()')) || [];
  return (sels.length === 2 && !!sels[0] && !!sels[1] && /all scripts/.test(sels[0].field || '') && /all suites/.test(sels[1].field || '')) || false;
}, test.limit.quick);
test.run('the script selector lists production scripts only: no test, no other kind of file', 0.2, async function () {
  if (!mounted()) return false;
  await T('openSel(0)');
  await T('typeSel(0, "zzTlist")');
  await waitFor('selRows(0).length > 0', 10000);
  const keys = ((await T('selRows(0)')) || []).filter(function (k) { return String(k).indexOf(Z) !== -1; });
  return (keys.indexOf(A) !== -1 && keys.every(function (k) { return /\.js$/.test(k) && k.split('/').indexOf('test') === -1; })) || false;
}, test.limit.slow);
test.run('a script chosen narrows the rows to that script\'s tests', 0.2, async function () {
  if (!mounted()) return false;
  if (!(await T('pickSel(0, ' + JSON.stringify(A) + ')'))) return false;
  const ok = await until(function () { return column(3).then(function (l) { return l.length > 0 && l.every(function (v) { return v === base(A); }); }); }, 5000);
  return !!ok || false;
}, test.limit.slow);
test.run('with a script chosen, the suite selector lists that script\'s suites alone', 0.2, async function () {
  if (!mounted()) return false;
  await T('openSel(1)');
  await waitFor('selRows(1).filter(function (k) { return k === ' + JSON.stringify(A + '|' + AS) + ' || k === ' + JSON.stringify(A + '|' + GEN) + '; }).length >= 2', 15000);
  const keys = (await T('selRows(1)')) || [];
  return (keys.indexOf(A + '|' + AS) !== -1 && keys.indexOf(A + '|' + GEN) !== -1 && !keys.some(function (k) { return String(k).indexOf(BS) !== -1; })) || false;
}, test.limit.slow);
test.run('with the script unselected again, every script\'s tests show', 0.2, async function () {
  if (!mounted()) return false;
  await T('openSel(1)');
  await T('openSel(0)');
  if (!(await T('noneSel(0)'))) return false;
  const ok = await until(function () { return column(3).then(function (l) { return l.indexOf(base(A)) !== -1 && l.indexOf(base(B)) !== -1; }); }, 5000);
  return !!ok || false;
}, test.limit.slow);
// the box: "The testicle search can search by a suite alone: with the script selector blank (all scripts), the suite
// selector lists every suite, each once"; beta's test in GEN makes it a suite of two scripts.
test.run('with no script chosen, a suite chosen shows that suite\'s tests of every script', 0.2, async function () {
  if (!mounted()) return false;
  const r = await call(N.base, 'spirit.app.testicle.testicle.set', { script: B, suite: GEN, test: 'beta holds the general rule', verified: true, severity: 0.2 });
  if (r.status !== 200) return false;
  await T('openSel(1)');
  await T('typeSel(1, ' + JSON.stringify(path.posix.basename(GEN, '.js')) + ')');
  await waitFor('selRows(1).length > 0', 10000);
  await sleep(500);
  const keys = ((await T('selRows(1)')) || []).filter(function (k) { return String(k).slice(-GEN.length) === GEN; });
  if (keys.length !== 1) return false;
  if (!(await T('pickSel(1, ' + JSON.stringify(keys[0]) + ')'))) return false;
  const ok = await until(function () {
    return Promise.all([column(3), column(4)]).then(function (l) { return l[1].length > 0 && l[1].every(function (v) { return v === base(GEN); }) && l[0].indexOf(base(A)) !== -1 && l[0].indexOf(base(B)) !== -1; });
  }, 10000);
  return !!ok || false;
}, test.limit.slow);
test.run('with the suite unselected again, every suite shows', 0.2, async function () {
  if (!mounted()) return false;
  await T('openSel(1)');
  if (!(await T('noneSel(1)'))) return false;
  const ok = await until(function () { return column(4).then(function (l) { return l.indexOf(base(AS)) !== -1 && l.indexOf(base(BS)) !== -1; }); }, 5000);
  return !!ok || false;
}, test.limit.slow);

// "a row clicked is handed to pick"
test.run('a row pressed is handed to pick, by its key', 0.2, async function () {
  if (!mounted()) return false;
  const k = current[FAILS] && current[FAILS].key;
  if (!k || !(await T('click(' + JSON.stringify(k) + ')'))) return false;
  await sleep(300);
  const got = await c.evaluate('window.__picked');
  return (Array.isArray(got) && got.indexOf(k) !== -1) || false;
}, test.limit.slow);

// "The server publishes every row it writes, so a test set anywhere shows by itself."
test.run('a test set on the node shows in the list with no press', 0.2, async function () {
  if (!mounted()) return false;
  const r = await call(N.base, 'spirit.app.testicle.testicle.set', { script: B, suite: BS, test: 'beta answers later', verified: true, severity: 0.4 });
  if (r.status !== 200) return false;
  const ok = await until(function () { return column(2).then(function (l) { return l.indexOf('beta answers later') !== -1; }); }, 10000);
  return !!ok || false;
}, test.limit.slow);

// "the branch keeps a flipped test's replaced row beside its current one": a flip streamed in while the list is open.
test.run('a test flipped on the node while the list is open shows once, by its new current row', 0.2, async function () {
  if (!mounted()) return false;
  const r = await call(N.base, 'spirit.app.testicle.testicle.set', { script: B, suite: BS, test: FAILS, verified: true, severity: 1 });
  if (r.status !== 200 || !r.body || !r.body.key) return false;
  const ok = await until(function () { return T('keys()').then(function (k) { return (k || []).indexOf(r.body.key) !== -1; }); }, 10000);
  await sleep(500);
  const ks = ((await T('keys()')) || []).filter(function (k) { return k.indexOf(B + '|' + BS + '|' + FAILS + '|') === 0; });
  return (!!ok && ks.length === 1 && ks[0] === r.body.key) || false;
}, test.limit.slow);

// "answer after answer while it says more, up to 100 tests"
test.run('150 more passing tests of beta are set on the node', 0.2, async function () {
  if (!mounted()) return false;
  const bad = [];
  for (let i = 1; i <= GREENS; i++) {
    const r = await call(N.base, 'spirit.app.testicle.testicle.set', { script: B, suite: BS, test: 'beta passes, number ' + i, verified: true, severity: 0.5 });
    if (r.status !== 200) bad.push(true);
  }
  return !bad.length || false;
}, test.limit.long);
test.run('with green alone and words typed, it asks the search with no from, so no answer comes in parts', 0.2, async function () {
  if (!mounted()) return false;
  // Every ask the list makes of testicle.testicle.search, recorded on the page's own interface.
  const hooked = await c.evaluate('(function () { var T = window.spirit.required.spirit.app.testicle.api; var f = T && T["testicle.search"]; if (typeof f !== "function") return false; window.__asks = []; T["testicle.search"] = function (a) { window.__asks.push(a); return f.apply(this, arguments); }; return true; }())');
  if (!hooked) return false;
  await T('press("red")');
  await sleep(1500);
  await c.evaluate('window.__asks = []');
  const typed = await c.evaluate('(function () { var t = Array.prototype.slice.call(document.querySelectorAll("#zzBox input[id$=\\"text\\"]")).filter(function (x) { return !(x.closest && x.closest("[id$=\\"selectors\\"]")); })[0]; if (!t) return false; t.value = "beta passes"; t.dispatchEvent(new Event("input", { bubbles: true })); return true; }())');
  if (!typed) return false;
  // Settled: no new ask for two seconds, up to 30.
  let n = -1;
  await until(async function () { const now = ((await c.evaluate('window.__asks')) || []).length; const still = now === n && now > 0; n = now; if (!still) await sleep(1750); return still; }, 30000);
  const asks = ((await c.evaluate('window.__asks')) || []).filter(function (a) { return a && a.text === 'beta passes'; });
  // One answer, never in parts (Andy: no paging; goal/G47.1, Q17): no ask carries from.
  return (asks.length > 0 && asks.every(function (a) { return a.result === 'green' && a.from === undefined; })) || false;
}, test.limit.slow);

test.run('destroy leaves its container empty', 0.2, async function () {
  if (!mounted()) return false;
  const after = await c.evaluate('(function () { window.__made.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : null; }())');
  return after === '' || false;
}, test.limit.quick);
