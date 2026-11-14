'use strict';

// spirit/run/spirit/element/search/testicle/test/detailElement.js
// The tests of spirit/element/search/testicle/detailElement.js, and of no other module (spec: ./detailElement.md). Its own
// test, owed since the rule "every production script has its own test" (goal/G47.1, box v72). One test's detail: its
// history of flips, what testicle's face shows in a closable tab when a test row is clicked.
//
// The world of spirit/element/search/test/testicle.js, as it is: a real node on a scratch copy of the tracked files,
// testicle turned on there, the general suites stubbed, tests of planted scripts set through testicle.testicle.set, and
// the detail mounted alone in a real Chrome on /face.html. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

const MODULE = path.join(RUN, 'spirit', 'element', 'search', 'testicle', 'detailElement.js');
// THE PLANTED SCRIPTS, under one folder of their own, each with its own test.
const Z = 'spirit/zzTdetail/';
const A = Z + 'alpha.js';
const AS = Z + 'test/alpha.js';
const PLANT = {};
PLANT[A] = '\'use strict\';\n// alpha\n';
PLANT[AS] = '\'use strict\';\n// the test of alpha\n';
// The test whose history is shown, a long title, flipped three times; and another test of the same suite.
const FLIPS = 'alpha flips between passing and failing, and this long title of it is shown in full above its history';
const OTHER = 'alpha does something else';

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-testicle-detail-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  Object.keys(PLANT).forEach(function (f) { fs.mkdirSync(path.dirname(path.join(run, f)), { recursive: true }); fs.writeFileSync(path.join(run, f), PLANT[f]); });
  // testicle turned on there, as an owner turns a server on (spirit/test/headLessChrome.js scratchNode).
  const on = path.join(run, 'spirit', 'state', 'testicle');
  fs.mkdirSync(on, { recursive: true });
  fs.writeFileSync(path.join(on, 'node.json'), JSON.stringify({ active: true }));
  // THE GENERAL SUITES TAKEN AWAY, as spirit/element/search/test/testicle.js does: each keeps its name, so its reach, and
  // judges and reports nothing.
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return /(^|\/)test\/[^/]*-(sibling|child)-[^/]*\.js$/.test(f); })
    .forEach(function (f) { fs.writeFileSync(path.join(root, f), '\'use strict\';\n// a stub in this scratch tree: it judges nothing\n'); });
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
function base(p) { return p.slice(p.lastIndexOf('/') + 1); }

// What the tests share, made by the tests in order.
let s = null, N = null, c = null, made = '', planted = false;
const keys = [];
const live = [];
const NONODE = 'no scratch node: the world failed';
const mounted = function () { return !N || !N.up ? NONODE : (!c || c.error || !c.evaluate) ? 'no page: the world failed' : made !== 'made' ? 'the detail did not mount: the world failed' : !planted ? 'no tests were set: the world failed' : ''; };
// What the box shows: its title line, its headers, and each row's key and cells.
const view = function (id) {
  return c.evaluate('(function () { var b = document.getElementById(' + JSON.stringify(id) + '); if (!b) return null; var t = b.querySelector("[data-history=\\"title\\"]");' +
    ' return { html: b.innerHTML, title: t ? t.textContent : null, heads: Array.prototype.map.call(b.querySelectorAll("th"), function (h) { return String(h.textContent || "").trim(); }),' +
    ' rows: Array.prototype.map.call(b.querySelectorAll("tbody tr"), function (r) { return { key: r.getAttribute("data-key"), cells: Array.prototype.map.call(r.querySelectorAll("td"), function (td) { return String(td.innerText || "").trim(); }) }; }) }; }())');
};
const mount = function (id, opts) {
  return c.evaluate('(function () { var E = ((((((window.spirit.element || {}).spirit || {}).element || {}).search || {}).testicle || {}).detailElement); if (!E || typeof E.create !== "function") return "no create";' +
    ' var b = document.createElement("div"); b.id = ' + JSON.stringify(id) + '; document.body.appendChild(b); window[' + JSON.stringify(id) + '] = E.create(b, ' + JSON.stringify(opts) + ');' +
    ' return window[' + JSON.stringify(id) + '] && typeof window[' + JSON.stringify(id) + '].destroy === "function" ? "made" : "no destroy"; }())');
};

test.after(async function () {
  try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  for (const k of live) await stop(k);
  try { if (s) fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

test.run('spirit/element/search/testicle/detailElement.js is there', 0.2, function () {
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
test.run('the world: the test flips three times, passing, failing, passing, and another test of its suite is set', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  const out = [];
  for (const v of [true, false, true]) { out.push(await call(N.base, 'testicle.testicle.set', { script: A, suite: AS, test: FLIPS, verified: v, severity: 0.3 })); await sleep(1100); }
  out.push(await call(N.base, 'testicle.testicle.set', { script: A, suite: AS, test: OTHER, verified: false, severity: 0.5 }));
  planted = out.every(function (r) { return r.status === 200; });
  out.slice(0, 3).forEach(function (r) { if (r.body && r.body.key) keys.push(r.body.key); });
  return (planted && keys.length === 3 && new Set(keys).size === 3) || 'testicle.testicle.set: ' + short(out.map(function (r) { return r.status + ' ' + r.text; }));
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
test.run('it loads alone through spirit.require and mounts with create(container, { script, suite, test }), answering destroy', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  if (!c || c.error || !c.evaluate) return 'no page: the world failed';
  const loaded = await c.evaluate('window.spirit.ready.then(function () { return window.spirit.require("spirit/element/search/testicle/detailElement.js"); }).then(function () { return "loaded"; }, function (e) { return "refused: " + (e && e.message || e); })');
  if (loaded !== 'loaded') return 'it did not load: ' + short(loaded);
  made = await mount('zzBox', { script: A, suite: AS, test: FLIPS });
  return made === 'made' || 'it did not mount: ' + short(made);
}, test.limit.slow);

// the box: "The title line is the test's title in full"
test.run('its title line is the test\'s title in full', 0.2, async function () {
  if (mounted()) return mounted();
  const v = await view('zzBox');
  return (!!v && v.title === FLIPS) || 'the title line: ' + short(v && v.title);
}, test.limit.quick);
test.run('its columns: Flipped, then the test row\'s Result, Severity, Title, Script, Suite', 0.2, async function () {
  if (mounted()) return mounted();
  const v = await view('zzBox');
  return (!!v && JSON.stringify(v.heads) === JSON.stringify(['Flipped', 'Result', 'Severity', 'Title', 'Script', 'Suite'])) || 'headers: ' + short(v && v.heads);
}, test.limit.quick);
// the box: "given a valid test title ... it answers every row matching that script, suite and title, current or not, newest
// first. A test's history in its detail comes from that, no new verb."
test.run('below it every row of the test, current or not, the newest flip first', 0.2, async function () {
  if (mounted()) return mounted();
  const want = keys.slice().reverse();
  const ok = await until(function () { return view('zzBox').then(function (v) { return !!v && JSON.stringify(v.rows.map(function (r) { return r.key; })) === JSON.stringify(want); }); }, 10000);
  return !!ok || 'rows ' + short(((await view('zzBox')) || {}).rows) + ', the flips newest first ' + short(want);
}, test.limit.slow);
test.run('no row of another test of the same suite shows', 0.2, async function () {
  if (mounted()) return mounted();
  const v = await view('zzBox');
  return (!!v && v.rows.length > 0 && !v.rows.some(function (r) { return r.cells.indexOf(OTHER) !== -1; })) || 'rows ' + short(v && v.rows);
}, test.limit.quick);
test.run('each row is drawn by the test row: its result as an icon, its severity, title and file names', 0.2, async function () {
  if (mounted()) return mounted();
  const v = await view('zzBox');
  const tail = (v && v.rows || []).map(function (r) { return r.cells.slice(1).join(' | '); });
  const want = ['✅', '❌', '✅'].map(function (i) { return [i, '0.30', FLIPS, base(A), base(AS)].join(' | '); });
  return JSON.stringify(tail) === JSON.stringify(want) || 'rows ' + short(tail);
}, test.limit.quick);
test.run('each row shows the date it flipped', 0.2, async function () {
  if (mounted()) return mounted();
  const v = await view('zzBox');
  const bad = (v && v.rows || []).filter(function (r) { const f = Number(String(r.key).split('|').pop()); return r.cells[0] !== new Date(f).toISOString().replace('T', ' ').slice(0, 19); });
  return (!!v && v.rows.length === 3 && !bad.length) || 'rows ' + short(bad);
}, test.limit.quick);
// "It asks again whenever testicle publishes a row of this test."
test.run('a flip set on the node shows at the top with no press', 0.2, async function () {
  if (mounted()) return mounted();
  const r = await call(N.base, 'testicle.testicle.set', { script: A, suite: AS, test: FLIPS, verified: false, severity: 0.3 });
  if (r.status !== 200 || !r.body || !r.body.key) return 'testicle.testicle.set: ' + r.status + ' ' + short(r.text);
  const ok = await until(function () { return view('zzBox').then(function (v) { return !!v && v.rows.length === 4 && v.rows[0].key === r.body.key && v.rows[0].cells[1] === '❌'; }); }, 10000);
  return !!ok || 'rows after the set ' + short(((await view('zzBox')) || {}).rows);
}, test.limit.slow);
// goal/G47.1, box v130: "the testicle detail has a 🏃 run button for its script and suite; a press stops the running suite
// and runs it first, as a top-10 fix does; the detail shows its full script and suite path" (Andy: "the testicle detail
// doesn't show the full script name"; "give me a run button on the testicle detail"). What the press does on the server is
// testicle's own test's; here, that it asks testicle.run for this script and suite.
test.run('it shows its full script path and its full suite path', 0.4, async function () {
  if (mounted()) return mounted();
  const text = await c.evaluate('String((document.getElementById("zzBox") || {}).innerText || "")');
  return (text.indexOf(A) !== -1 && text.indexOf(AS) !== -1) || 'it shows ' + short(text).slice(0, 300) + '; wanted ' + A + ' and ' + AS;
}, test.limit.quick);
test.run('it has a 🏃 run button for its script and suite', 0.4, async function () {
  if (mounted()) return mounted();
  const n = await c.evaluate('Array.prototype.filter.call(document.getElementById("zzBox").querySelectorAll("button"), function (b) { return /🏃/.test(b.textContent || ""); }).length');
  return n === 1 || n + ' buttons with 🏃 in it';
}, test.limit.quick);
test.run('a press of its 🏃 asks testicle.run for its script and suite', 0.4, async function () {
  if (mounted()) return mounted();
  await c.evaluate('(function () { window.zzAsked = []; var f = window.fetch; window.fetch = function (u, o) { try { window.zzAsked.push(String(o && o.body || "")); } catch (e) {} return f.apply(this, arguments); };' +
    ' var s = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function (b) { try { window.zzAsked.push(String(b || "")); } catch (e) {} return s.apply(this, arguments); };' +
    ' var b = Array.prototype.filter.call(document.getElementById("zzBox").querySelectorAll("button"), function (x) { return /🏃/.test(x.textContent || ""); })[0]; if (b) b.click(); }())');
  const ok = await until(function () { return c.evaluate('window.zzAsked.some(function (x) { return /"testicle\\.run"/.test(x); })'); }, 5000);
  const asked = await c.evaluate('JSON.stringify(window.zzAsked.filter(function (x) { return /testicle\\.run/.test(x); }))');
  let body = null; try { body = JSON.parse(JSON.parse(asked)[0]); } catch (e) { body = null; }
  return (!!ok && !!body && body.args && body.args.script === A && body.args.suite === AS) || 'asked: ' + short(asked);
}, test.limit.slow);
test.run('a test with no row says so', 0.2, async function () {
  if (mounted()) return mounted();
  const m = await mount('zzNone', { script: A, suite: AS, test: 'alpha never ran this' });
  if (m !== 'made') return 'it did not mount: ' + short(m);
  const ok = await until(function () { return view('zzNone').then(function (v) { return !!v && /No row of this test\./.test(v.html); }); }, 10000);
  return !!ok || 'it shows ' + short(((await view('zzNone')) || {}).rows);
}, test.limit.slow);
test.run('destroy leaves its container empty', 0.2, async function () {
  if (mounted()) return mounted();
  const after = await c.evaluate('(function () { window.zzBox.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
  return after === '' || 'after destroy: ' + short(after).slice(0, 200);
}, test.limit.quick);
test.run('destroyed, a flip set on the node draws nothing in its container', 0.2, async function () {
  if (mounted()) return mounted();
  const r = await call(N.base, 'testicle.testicle.set', { script: A, suite: AS, test: FLIPS, verified: true, severity: 0.3 });
  if (r.status !== 200) return 'testicle.testicle.set: ' + r.status + ' ' + short(r.text);
  await sleep(2000);
  const after = await c.evaluate('(function () { var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
  return after === '' || 'after the set: ' + short(after).slice(0, 200);
}, test.limit.slow);
