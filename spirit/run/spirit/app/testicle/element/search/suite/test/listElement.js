'use strict';

// spirit/run/spirit/app/testicle/element/search/suite/test/listElement.js
// The tests of spirit/app/testicle/element/search/suite/listElement.js, and of no other module (spec: ./listElement.md). Its own test,
// owed since the rule "every production script has its own test" (goal/G47.1, box v72). The suite list: the suites of one
// production file, a view of testicle's suite rows, what testicle's file detail draws through the suite selector.
//
// The world of spirit/element/search/test/testicle.js, as it is: a real node on a scratch copy of the tracked files,
// testicle turned on there, the general suites stubbed, tests of planted scripts set through testicle.testicle.set (which
// makes their script and suite rows), and the list mounted alone in a real Chrome on /face.html. Neither Andy's node nor an
// agent's is touched.

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

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

const MODULE = path.join(RUN, 'spirit', 'app', 'testicle', 'element', 'search', 'suite', 'listElement.js');
// THE PLANTED SCRIPTS, under one folder of their own, each with its own test.
const Z = 'spirit/zzSuiteList/';
const A = Z + 'alpha.js';
const B = Z + 'beta.js';
const C = Z + 'gamma.js';
const AS = Z + 'test/alpha.js';
const BS = Z + 'test/beta.js';
const CS = Z + 'test/gamma.js';
const PLANT = {};
[A, B, C].forEach(function (f) { PLANT[f] = '\'use strict\';\n// ' + f + '\n'; });
[AS, BS, CS].forEach(function (f) { PLANT[f] = '\'use strict\';\n// the test of ' + f + '\n'; });

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

// What the tests share, made by the tests in order.
let s = null, N = null, c = null, made = '', planted = false, GEN = '';
const live = [];
// True when the world failed: no scratch node, no page, the list not mounted, or no tests set.
const notMounted = function () { return !N || !N.up || !c || !!c.error || !c.evaluate || made !== 'made' || !planted; };
// What a box shows: its headers, each row's key and cells, its text.
const view = function (id) {
  return c.evaluate('(function () { var b = document.getElementById(' + JSON.stringify(id) + '); if (!b) return null;' +
    ' function seen(e) { return !!e && e.getClientRects().length > 0; }' +
    ' return { text: String(b.innerText || ""), heads: Array.prototype.filter.call(b.querySelectorAll("th"), seen).map(function (h) { return { text: String(h.textContent || "").trim(), sort: h.getAttribute("data-sort") }; }),' +
    ' field: (b.querySelector("button[id$=\\"field\\"]") || {}).innerText || null,' +
    ' rows: Array.prototype.filter.call(b.querySelectorAll("tr[data-key]"), seen).map(function (r) { return { key: r.getAttribute("data-key"), cells: Array.prototype.map.call(r.querySelectorAll("td"), function (td) { return String(td.innerText || "").trim(); }) }; }) }; }())');
};
const mount = function (id, opts) {
  return c.evaluate('(function () { var E = ((((((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element || {}).search || {}).suite || {}).listElement); if (!E || typeof E.create !== "function") return false;' +
    ' var b = document.createElement("div"); b.id = ' + JSON.stringify(id) + '; b.style.cssText = "width:1200px;height:500px;display:flex;"; document.body.appendChild(b); window.__picked = window.__picked || [];' +
    ' var o = ' + JSON.stringify(opts) + '; o.pick = function (row, key) { window.__picked.push(key); };' +
    ' window[' + JSON.stringify(id) + '] = E.create(b, o); return window[' + JSON.stringify(id) + '] && typeof window[' + JSON.stringify(id) + '].destroy === "function" ? "made" : false; }())');
};
const keysOf = function (v) { return ((v && v.rows) || []).map(function (r) { return r.key; }); };

test.after(async function () {
  try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  for (const k of live) await stop(k);
  try { if (s) LABH.freeTree(s); } catch (e) { /* scratch */ }
});

test.run('spirit/app/testicle/element/search/suite/listElement.js is there', 0.2, function () {
  return fs.existsSync(MODULE) || false;
}, test.limit.quick);
test.run('the world: a scratch node comes up, testicle on', 0.2, async function () {
  s = scratch();
  N = await boot(s.run); live.push(N.child);
  if (!N.up) return false;
  // Its testicle answers once its app server runs, a moment after the node.
  N.up = !!(await until(function () { return call(N.base, 'testicle.busy').then(function (r) { return r.status === 200; }); }, 30000));
  return N.up || false;
}, test.limit.long);
test.run('the world: tests of alpha and beta are set, each in its own suite and in one general suite', 0.2, async function () {
  if (!N || !N.up) return false;
  GEN = s.gen;
  if (!GEN) return false;
  const out = [];
  for (const a of [{ script: A, suite: AS }, { script: A, suite: GEN }, { script: B, suite: BS }, { script: B, suite: GEN }]) {
    out.push(await call(N.base, 'testicle.testicle.set', Object.assign({ test: 'a test of ' + a.script, verified: true, severity: 0.2 }, a)));
  }
  planted = out.every(function (r) { return r.status === 200; });
  return planted || false;
}, test.limit.slow);
test.run('the world: the face page has its spirit', 0.2, async function () {
  if (!N || !N.up) return false;
  const where = findChrome();
  if (!where) return false;
  c = await chromePage(where);
  if (c.error) return false;
  await c.send('Page.navigate', { url: N.base + '/face.html' });
  return !!(await until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000)) || false;
}, test.limit.long);
test.run('it loads alone through spirit.require and mounts with create(container, { script, pick }), answering destroy', 0.2, async function () {
  if (!N || !N.up) return false;
  if (!c || c.error || !c.evaluate) return false;
  const loaded = await c.evaluate('window.spirit.ready.then(function () { return window.spirit.require("spirit/app/testicle/element/search/suite/listElement.js"); }).then(function () { return "loaded"; }, function () { return false; })');
  if (loaded !== 'loaded') return false;
  made = await mount('zzBox', { script: A });
  return made === 'made' || false;
}, test.limit.slow);

// the box: "So suite.search takes the production file and answers that file's suite rows only, each suite once, with its
// filename and its status"
test.run('it lists the script\'s own suite rows: its own test and the general suite', 0.2, async function () {
  if (notMounted()) return false;
  const want = [A + '|' + AS, A + '|' + GEN];
  const ok = await until(function () { return view('zzBox').then(function (v) { const k = keysOf(v); return want.every(function (x) { return k.indexOf(x) !== -1; }); }); }, 15000);
  return !!ok || false;
}, test.limit.slow);
test.run('it lists no suite row of another script', 0.2, async function () {
  if (notMounted()) return false;
  const k = keysOf(await view('zzBox'));
  return (k.length > 0 && k.every(function (x) { return x.indexOf(A + '|') === 0; })) || false;
}, test.limit.quick);
test.run('each suite once', 0.2, async function () {
  if (notMounted()) return false;
  const k = keysOf(await view('zzBox'));
  return (k.length > 0 && new Set(k).size === k.length) || false;
}, test.limit.quick);
// goal/G47.1, the run cycle: "the 🏃‍♂️ column first, no sort"
test.run('its columns: 🏃‍♂️ first with no sort, then Suite and Status, each a sort trigger', 0.2, async function () {
  if (notMounted()) return false;
  const h = ((await view('zzBox')) || {}).heads || [];
  return (h.length === 3 && h[0].text === '🏃‍♂️' && !h[0].sort && /^Suite\b/.test(h[1].text) && h[1].sort === 'suite' && h[2].text === 'Status' && h[2].sort === 'status') || false;
}, test.limit.quick);
test.run('its rows are sorted by suite, ascending', 0.2, async function () {
  if (notMounted()) return false;
  const suites = (((await view('zzBox')) || {}).rows || []).map(function (r) { return r.cells[1]; });
  const sorted = suites.slice().sort(function (a, b) { return a.localeCompare(b); });
  return (suites.length > 1 && JSON.stringify(suites) === JSON.stringify(sorted)) || false;
}, test.limit.quick);
test.run('each row shows its suite\'s file and its status, the server\'s word', 0.2, async function () {
  if (notMounted()) return false;
  const row = (((await view('zzBox')) || {}).rows || []).filter(function (r) { return r.key === A + '|' + AS; })[0];
  return (!!row && row.cells[1] === AS && ['needs running', 'still red', 'green'].indexOf(row.cells[2]) !== -1) || false;
}, test.limit.quick);
test.run('a row pressed is handed to pick, by its key', 0.2, async function () {
  if (notMounted()) return false;
  const k = A + '|' + AS;
  const pressed = await c.evaluate('(function () { var r = Array.prototype.filter.call(document.querySelectorAll("#zzBox tr[data-key]"), function (r) { return r.getAttribute("data-key") === ' + JSON.stringify(k) + '; })[0]; if (!r) return false; var td = r.querySelectorAll("td")[1] || r; td.click(); return true; }())');
  if (!pressed) return false;
  await sleep(300);
  const got = await c.evaluate('window.__picked');
  return (Array.isArray(got) && got.indexOf(k) !== -1) || false;
}, test.limit.slow);

// the box: "with the script selector blank (all scripts), the suite selector lists every suite, each once"
test.run('with no script, it lists every suite, each once: the general suite of both scripts once', 0.2, async function () {
  if (notMounted()) return false;
  const m = await mount('zzAll', { script: '' });
  if (m !== 'made') return false;
  // A node's every suite is more than one answer holds (a lab node is the whole tree; Andy: "I'll barely read through the
  // last 10"): what shows is each suite once, and words narrow to the planted ones ("the words narrow among them").
  await until(function () { return view('zzAll').then(function (v) { return keysOf(v).length > 0; }); }, 15000);
  const shown = keysOf(await view('zzAll'));
  const type = function (w) { return c.evaluate('(function () { var t = document.querySelector("#zzAll input[id$=\\"text\\"]"); if (!t) return false; t.value = ' + JSON.stringify(w) + '; t.dispatchEvent(new Event("input", { bubbles: true })); return true; }())'); };
  const shows = function (want) { return until(function () { return view('zzAll').then(function (v) { const k = keysOf(v); return want.every(function (x) { return k.indexOf(x) !== -1; }); }); }, 15000); };
  if ((await type('zzSuiteList')) !== true) return false;
  const own = await shows(['|' + AS, '|' + BS]);
  const k1 = keysOf(await view('zzAll'));
  await type(base(GEN));
  const gen = await shows(['|' + GEN]);
  const k2 = keysOf(await view('zzAll'));
  const gens = k2.filter(function (x) { return x === '|' + GEN; });
  return (shown.length > 0 && new Set(shown).size === shown.length && !!own && new Set(k1).size === k1.length && !!gen && gens.length === 1) || false;
}, test.limit.slow);

// "The server publishes every row it writes, so a suite written for the file shows by itself"
test.run('a script with no suite row yet says no suite concerns it', 0.2, async function () {
  if (notMounted()) return false;
  const m = await mount('zzGamma', { script: C });
  if (m !== 'made') return false;
  const ok = await until(function () { return view('zzGamma').then(function (v) { return !!v && /No suite concerns this file\./.test(v.text); }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
test.run('a suite row written for the script shows by itself', 0.2, async function () {
  if (notMounted()) return false;
  const r = await call(N.base, 'testicle.testicle.set', { script: C, suite: CS, test: 'gamma runs', verified: true, severity: 0.2 });
  if (r.status !== 200) return false;
  const ok = await until(function () { return view('zzGamma').then(function (v) { return keysOf(v).indexOf(C + '|' + CS) !== -1; }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
// box v143: "all of testicle's elements must subscribe to the data they display": a row already drawn follows its suite
// row as the server rewrites it, with no press and no new mount.
const statusIn = function (id, key) { return view(id).then(function (v) { const r = ((v && v.rows) || []).filter(function (x) { return x.key === key; })[0]; return r ? r.cells[2] : null; }); };
test.run('a drawn row follows its suite row: a success reported for it, the row shows "green" by itself', 0.4, async function () {
  if (notMounted()) return false;
  const r = await call(N.base, 'testicle.suite.success', { script: C, suite: CS, success: true });
  if (r.status !== 200) return false;
  const ok = await until(function () { return statusIn('zzGamma', C + '|' + CS).then(function (t) { return t === 'green'; }); }, 10000);
  return !!ok || false;
}, test.limit.slow);
test.run('and a failure reported after it, the same row shows "still red" by itself', 0.4, async function () {
  if (notMounted()) return false;
  const r = await call(N.base, 'testicle.suite.success', { script: C, suite: CS, success: false });
  if (r.status !== 200) return false;
  const ok = await until(function () { return statusIn('zzGamma', C + '|' + CS).then(function (t) { return t === 'still red'; }); }, 10000);
  const k = keysOf(await view('zzGamma')).filter(function (x) { return x === C + '|' + CS; });
  return (!!ok && k.length === 1) || false;
}, test.limit.slow);

// "face, placeholder, all, pick   handed to the search as they are"
test.run('as a dropdown, it shows its placeholder in its field', 0.2, async function () {
  if (notMounted()) return false;
  const m = await mount('zzDrop', { script: A, face: 'dropdown', placeholder: 'pick a suite' });
  if (m !== 'made') return false;
  const ok = await until(function () { return view('zzDrop').then(function (v) { return !!v && /pick a suite/.test(v.field || ''); }); }, 10000);
  return !!ok || false;
}, test.limit.slow);

test.run('destroy leaves its container empty', 0.2, async function () {
  if (notMounted()) return false;
  const after = await c.evaluate('(function () { window.zzBox.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : null; }())');
  return after === '' || false;
}, test.limit.quick);
