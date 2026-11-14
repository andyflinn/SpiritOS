'use strict';

// spirit/run/spirit/element/search/test/suite.js
// The tests of spirit/app/testicle/element/search/suite.js, and of no other module (spec: ./suite.md). Its own test, owed since the rule
// "every production script has its own test" (goal/G47.1, box v72). The suite selector: a thin element over its own list,
// ./suite/listElement.js, which it loads itself.
//
// The world of ./testicle.js, as it is: a real node on a scratch copy of the tracked files, testicle turned on there, the
// general suites stubbed, tests of planted scripts set through testicle.testicle.set (which makes their script and suite
// rows), and the selector mounted alone in a real Chrome on /face.html. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync, execFileSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../../../..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }

const MODULE = path.join(RUN, 'spirit', 'app', 'testicle', 'element', 'search', 'suite.js');
// THE PLANTED SCRIPTS, under one folder of their own, each with its own test.
const Z = 'spirit/zzSuiteSel/';
const A = Z + 'alpha.js';
const B = Z + 'beta.js';
const AS = Z + 'test/alpha.js';
const BS = Z + 'test/beta.js';
const PLANT = {};
[A, B].forEach(function (f) { PLANT[f] = '\'use strict\';\n// ' + f + '\n'; });
[AS, BS].forEach(function (f) { PLANT[f] = '\'use strict\';\n// the test of ' + f + '\n'; });

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-suite-selector-'));
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
  const child = spawn(process.execPath, ['spirit/server.js', '--port', String(port)], { cwd: run, stdio: 'ignore' });
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
let s = null, N = null, c = null, made = '', planted = false;
const live = [];
const NONODE = 'no scratch node: the world failed';
const mounted = function () { return !N || !N.up ? NONODE : (!c || c.error || !c.evaluate) ? 'no page: the world failed' : made !== 'made' ? 'the selector did not mount: the world failed' : !planted ? 'no tests were set: the world failed' : ''; };
// What a container holds: its children, the root's class, the dropdown's field, and each row's key, popup or not.
const view = function (id) {
  return c.evaluate('(function () { var b = document.getElementById(' + JSON.stringify(id) + '); if (!b) return null; var root = b.firstElementChild;' +
    ' return { children: b.children.length, isRoot: !!root && root === window[' + JSON.stringify(id) + '], className: root ? root.className : "",' +
    ' field: (b.querySelector("button[id$=\\"field\\"]") || {}).innerText || null,' +
    ' keys: Array.prototype.map.call(b.querySelectorAll("tr[data-key]"), function (r) { return r.getAttribute("data-key"); }) }; }())');
};
const mount = function (id, opts) {
  return c.evaluate('(function () { var E = (((((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element || {}).search || {}).suite); if (!E || typeof E.create !== "function") return "no create";' +
    ' var b = document.createElement("div"); b.id = ' + JSON.stringify(id) + '; b.style.cssText = "width:1200px;height:400px;display:flex;"; document.body.appendChild(b); window.__picked = window.__picked || [];' +
    ' var o = ' + JSON.stringify(opts) + '; o.pick = function (row, key) { window.__picked.push(key); };' +
    ' window[' + JSON.stringify(id) + '] = E.create(b, o); return window[' + JSON.stringify(id) + '] && typeof window[' + JSON.stringify(id) + '].destroy === "function" ? "made" : "no destroy"; }())');
};

test.after(async function () {
  try { if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
  for (const k of live) await stop(k);
  try { if (s) fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
});

test.run('spirit/app/testicle/element/search/suite.js is there', 0.2, function () {
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
test.run('the world: tests of alpha and beta are set, each in its own suite', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  const out = [];
  for (const a of [{ script: A, suite: AS }, { script: B, suite: BS }]) {
    out.push(await call(N.base, 'testicle.testicle.set', Object.assign({ test: 'a test of ' + a.script, verified: true, severity: 0.2 }, a)));
  }
  planted = out.every(function (r) { return r.status === 200; });
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
test.run('it loads alone through spirit.require and mounts with create(container, { script, pick }), answering destroy', 0.2, async function () {
  if (!N || !N.up) return NONODE;
  if (!c || c.error || !c.evaluate) return 'no page: the world failed';
  const loaded = await c.evaluate('window.spirit.ready.then(function () { return window.spirit.require("spirit/app/testicle/element/search/suite.js"); }).then(function () { return "loaded"; }, function (e) { return "refused: " + (e && e.message || e); })');
  if (loaded !== 'loaded') return 'it did not load: ' + short(loaded);
  made = await mount('zzBox', { script: A });
  return made === 'made' || 'it did not mount: ' + short(made);
}, test.limit.slow);

// goal/G41.19, box v23: "every element gets a container and appends itself"
test.run('create appends its own root to the container and answers it', 0.2, async function () {
  if (mounted()) return mounted();
  const v = await view('zzBox');
  return (!!v && v.children === 1 && v.isRoot && /\bsuite-selector\b/.test(v.className)) || 'the container: ' + short(v);
}, test.limit.quick);
// "A THIN ELEMENT OVER ITS OWN LIST, ./suite/listElement.js, WHICH IT LOADS ITSELF (rule/26)"
test.run('it loads its own list, spirit/app/testicle/element/search/suite/listElement.js', 0.2, async function () {
  if (mounted()) return mounted();
  const ok = await until(function () { return c.evaluate('!!(((((((((window.spirit.element || {}).spirit || {}).app || {}).testicle || {}).element || {}).search || {}).suite || {}).listElement || {}).create)'); }, 10000);
  return !!ok || 'no spirit.element.spirit.app.testicle.element.search.suite.listElement after the selector was made';
}, test.limit.slow);
test.run('its list in its root shows the suites of the script it is given, and of no other', 0.2, async function () {
  if (mounted()) return mounted();
  const ok = await until(function () { return view('zzBox').then(function (v) { return !!v && v.keys.indexOf(A + '|' + AS) !== -1; }); }, 15000);
  const k = ((await view('zzBox')) || {}).keys || [];
  return (!!ok && k.every(function (x) { return x.indexOf(A + '|') === 0; })) || 'rows ' + short(k);
}, test.limit.slow);
// "face, placeholder, all, pick   handed to its list as they are"
test.run('as a dropdown, its placeholder is handed on: the field shows it', 0.2, async function () {
  if (mounted()) return mounted();
  const m = await mount('zzDrop', { script: A, face: 'dropdown', placeholder: 'pick a suite' });
  if (m !== 'made') return 'it did not mount: ' + short(m);
  const ok = await until(function () { return view('zzDrop').then(function (v) { return !!v && /pick a suite/.test(v.field || ''); }); }, 10000);
  return !!ok || 'its field: ' + short(((await view('zzDrop')) || {}).field);
}, test.limit.slow);
test.run('as a dropdown, its all words are handed on: the field shows them', 0.2, async function () {
  if (mounted()) return mounted();
  const m = await mount('zzAll', { script: A, face: 'dropdown', placeholder: 'pick a suite', all: 'every suite there is' });
  if (m !== 'made') return 'it did not mount: ' + short(m);
  const ok = await until(function () { return view('zzAll').then(function (v) { return !!v && /every suite there is/.test(v.field || ''); }); }, 10000);
  return !!ok || 'its field: ' + short(((await view('zzAll')) || {}).field);
}, test.limit.slow);
test.run('its pick is handed on: a row chosen in the dropdown is handed to it, by its key', 0.2, async function () {
  if (mounted()) return mounted();
  const k = A + '|' + AS;
  await c.evaluate('(function () { var f = document.querySelector("#zzDrop button[id$=\\"field\\"]"); if (f) f.click(); }())');
  await until(function () { return view('zzDrop').then(function (v) { return !!v && v.keys.indexOf(k) !== -1; }); }, 10000);
  const pressed = await c.evaluate('(function () { var r = Array.prototype.filter.call(document.querySelectorAll("#zzDrop [id$=\\"popup\\"] tr[data-key]"), function (r) { return r.getAttribute("data-key") === ' + JSON.stringify(k) + '; })[0]; if (!r) return false; r.click(); return true; }())');
  if (!pressed) return 'no row of ' + AS + ' in the dropdown: ' + short(((await view('zzDrop')) || {}).keys);
  await sleep(300);
  const got = await c.evaluate('window.__picked');
  return (Array.isArray(got) && got.indexOf(k) !== -1) || 'pick was handed ' + short(got);
}, test.limit.slow);

test.run('destroy takes its root out of the container', 0.2, async function () {
  if (mounted()) return mounted();
  const after = await c.evaluate('(function () { window.zzBox.destroy(); var b = document.getElementById("zzBox"); return b ? b.innerHTML : "gone"; }())');
  return after === '' || 'after destroy: ' + short(after).slice(0, 200);
}, test.limit.quick);
test.run('destroy lets its list go: a suite row written after draws nothing', 0.2, async function () {
  if (mounted()) return mounted();
  const before = await c.evaluate('(function () { var r = window.zzBox; return r.innerHTML; }())');
  const r = await call(N.base, 'testicle.testicle.set', { script: A, suite: AS, test: 'alpha later', verified: false, severity: 0.2 });
  if (r.status !== 200) return 'testicle.testicle.set: ' + r.status + ' ' + short(r.text);
  await sleep(1500);
  const after = await c.evaluate('(function () { var r = window.zzBox; return r.innerHTML; }())');
  return (before === '' && after === '') || 'the root after destroy: ' + short(before).slice(0, 120) + ', after the set: ' + short(after).slice(0, 120);
}, test.limit.slow);
