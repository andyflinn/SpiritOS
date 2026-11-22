'use strict';

// spirit/run/spirit/element/search/app/test/serverDEBUG.js
// The tests of spirit/element/search/app/serverDEBUG.js, and of the DEBUG it switches (spec: ./serverDEBUG.md; goal/G43.15). A real
// node on a scratch copy of the tracked files, with a throwaway server app planted before it boots, and a real Chrome on its face
// page. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..', '..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

const NAME = 'zzdebug';
const LABEL = 'Zz Debug';

// A throwaway server app, in the box's shape, that answers its pid, so a restart can be told.
function scratch() {
  const root = LABH.scratchTree().root;
  const run = path.join(root, 'spirit', 'run');
  const dir = path.join(run, 'spirit', 'app', NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, NAME + '.json'), JSON.stringify({ identity: { icon: '🐛', label: LABEL, intrinsic: false }, mount: { [NAME + '.js']: true }, shell: { true: false, mount: false, tile: false }, node: { mount: true } }));
  fs.writeFileSync(path.join(dir, NAME + '.js'), "'use strict';\nif (typeof window === 'undefined') {\n  require('../../spirit.js');\n  require('../../server/app.js').serve({ pid: { request: {}, reply: {}, handler: function () { return { pid: process.pid }; } } }, {});\n}\n");
  fs.writeFileSync(path.join(dir, 'api.js'), 'module.exports = { verbs: { pid: {} } };\n');
  return { root: root, run: run };
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
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return false; } }
async function jobOf(base, module) {
  const found = await call(base, 'job.search', { q: '' });
  const rows = await Promise.all(((found.body && found.body.items) || []).map(function (i) { return call(base, 'job.get', { key: i.key }); }));
  return rows.map(function (r) { return r.body && r.body.job; }).filter(function (j) { return !!j && j.kind === 'server' && j.module === module && (j.status === 'running' || j.status === 'pending'); })[0] || null;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let s, N, c, loaded, pid, v0, detail, gaps;
const live = [];
const nodeJson = function () { return readJson(path.join(s.run, 'spirit', 'state', NAME, 'node.json')) || {}; };
const open = async function () {
  await c.send('Page.navigate', { url: N.base + '/face.html' });
  return until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000);
};
// One serverDEBUG per app, each in a box of its own.
const make = function (key) { return c.evaluate('(function () { var b = document.createElement("div"); b.id = "dbg-' + key + '"; document.body.appendChild(b); window["dbg_' + key + '"] = spirit.required.spirit.element.search.app.serverDEBUG.create(b, { key: ' + JSON.stringify(key) + ' }); return !!window["dbg_' + key + '"]; }())'); };
const view = function (key) { return c.evaluate('(function () { var b = document.getElementById("dbg-' + key + '"); if (!b) return null; var r = b.getBoundingClientRect(); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), height: r.height, buttons: b.querySelectorAll("button").length }; }())'); };
const pressIn = function (key) { return c.evaluate('(function () { var b = document.querySelector("#dbg-' + key + ' button"); if (!b) return false; b.click(); return true; }())'); };
const hidden = function (v) { return !!v && v.height === 0 && v.text === ''; };
// The box: "changeAppIcon and changeAppLabel ... The appSelector's detail uses them": the page asks for both files.
const asked = function () { return c.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent'; }).map(function (m) { return String(m.params.request.url); }); };
const order = function () { return c.evaluate('(function () { var b = document.getElementById("zzDetail"); var rows = Array.prototype.slice.call(b.querySelectorAll(".shell-row-form")).filter(function (r) { return r.getBoundingClientRect().height > 0; }); return rows.map(function (r) { return String(r.innerText || "").replace(/\\s+/g, " ").trim(); }); }())'); };
const nodeUp = function () { return !!(N && N.up); };

test.after(async function () {
  if (N) await stop(N.child);
  live.forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
  if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
  await sleep(300);
  try { if (s) LABH.freeTree(s); } catch (e) { /* a door still closing; the temp folder keeps it */ }
});

test.run('a scratch node comes up', 0.2, async function () {
  s = scratch();
  N = await boot(s.run); live.push(N.child);
  return N.up || false;
}, test.limit.slow);

// the box: a server app, activated, runs (the world for what follows)
test.run('once its app is activated, the server answers', 0.2, async function () {
  if (!nodeUp()) return false;
  await call(N.base, 'app.active', { key: NAME, active: true });
  const up = await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200 && r.body && r.body.pid > 0; }); }, 30000);
  return up ? true : false;
}, test.limit.quick);

// the box: "DEBUG puts its state on the server's own job, in the job's data, at start and on every change"
test.run('with DEBUG switched on, the server\'s job data says debug true', 0.2, async function () {
  if (!nodeUp()) return false;
  await call(N.base, NAME + '.DEBUG', { on: true });
  const j1 = await jobOf(N.base, 'spirit.app.' + NAME);
  return !!j1 && j1.data && j1.data.debug === true ? true : false;
}, test.limit.quick);
test.run('with DEBUG switched off, the server\'s job data says debug false', 0.2, async function () {
  if (!nodeUp()) return false;
  await call(N.base, NAME + '.DEBUG', { on: false });
  const j2 = await jobOf(N.base, 'spirit.app.' + NAME);
  return !!j2 && j2.data && j2.data.debug === false ? true : false;
}, test.limit.quick);
test.run('the job\'s data keeps debug false past the server\'s next call', 0.2, async function () {
  if (!nodeUp()) return false;
  await call(N.base, NAME + '.pid', {});
  await sleep(500);
  const j3 = await jobOf(N.base, 'spirit.app.' + NAME);
  return !!j3 && j3.data && j3.data.debug === false ? true : false;
}, test.limit.quick);

// Q2: "i think we should persist it, always": the node keeps it in spirit/state/<name>/node.json and hands it over at start
test.run('with DEBUG switched on, node.json says debug true', 0.2, async function () {
  if (!nodeUp()) return false;
  await call(N.base, NAME + '.DEBUG', { on: true });
  return (await until(function () { return Promise.resolve(nodeJson().debug === true); }, 8000)) ? true : false;
}, test.limit.quick);
test.run('the server, killed, comes back', 0.2, async function () {
  if (!nodeUp()) return false;
  pid = Number(((await call(N.base, NAME + '.pid', {})).body || {}).pid);
  if (!(pid > 0)) return false;
  process.kill(pid, 'SIGKILL');
  await until(function () { return Promise.resolve(!alive(pid)); }, 5000);
  return (await until(function () { return call(N.base, NAME + '.pid', {}).then(function (r) { return r.status === 200 && r.body && r.body.pid > 0 && r.body.pid !== pid; }); }, 30000)) ? true : false;
}, test.limit.slow);
test.run('the server comes back with DEBUG on, as kept', 0.2, async function () {
  if (!nodeUp()) return false;
  return (((await call(N.base, NAME + '.DEBUG', {})).body) || {}).debug === true ? true : false;
}, test.limit.quick);
test.run('the server starts with DEBUG on after the node restarts too', 0.2, async function () {
  if (!nodeUp()) return false;
  await stop(N.child);
  N = await boot(s.run); live.push(N.child);
  if (!N.up) return false;
  await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200; }); }, 30000);
  return (((await call(N.base, NAME + '.DEBUG', {})).body) || {}).debug === true ? true : false;
}, test.limit.slow);
test.run('with DEBUG switched off, node.json says debug false', 0.2, async function () {
  if (!nodeUp()) return false;
  await call(N.base, NAME + '.DEBUG', { on: false });
  return (await until(function () { return Promise.resolve(nodeJson().debug === false); }, 8000)) ? true : false;
}, test.limit.quick);

test.run('a Chrome page opens the face shell, and it has its spirit', 0.2, async function () {
  if (!nodeUp()) return false;
  const where = findChrome();
  if (!where) return false;
  c = await chromePage(where);
  if (c.error) return false;
  return (await open()) ? true : false;
}, test.limit.slow);
test.run('serverDEBUG.js loads through spirit.require and puts its create on spirit.required', 0.2, async function () {
  if (!c || c.error) return false;
  loaded = await c.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/serverDEBUG.js"); }).then(function () { return !!(spirit.required.spirit.element.search.app.serverDEBUG && spirit.required.spirit.element.search.app.serverDEBUG.create); }, function () { return false; })');
  return loaded === true ? true : false;
}, test.limit.quick);

// the box: "when the app is NOT mountable by the node (node.mount==false) it hides itself"
test.run('for Contacts, which has no server, the DEBUG row shows nothing and takes no space', 0.2, async function () {
  if (loaded !== true) return false;
  await make('contact');
  await sleep(2000);
  return hidden(await view('contact')) ? true : false;
}, test.limit.slow);

// the box: "hides while its server is not running"
test.run('for Zz Debug with its server switched off, the DEBUG row shows nothing', 0.2, async function () {
  if (loaded !== true) return false;
  await call(N.base, 'app.active', { key: NAME, active: false });
  await until(function () { return jobOf(N.base, 'spirit.app.' + NAME).then(function (j) { return !j; }); }, 15000);
  await make(NAME);
  await sleep(2000);
  return hidden(await view(NAME)) ? true : false;
}, test.limit.slow);
test.run('once its app is activated again, the server answers', 0.2, async function () {
  if (!nodeUp()) return false;
  await call(N.base, 'app.active', { key: NAME, active: true });
  return (await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200; }); }, 30000)) ? true : false;
}, test.limit.quick);
// the box: "when the app is a server (node.mount==true), configured text: "turn on|off DEBUG <app-label>""
test.run('with the server running and DEBUG off, the row says turn on DEBUG Zz Debug', 0.2, async function () {
  if (loaded !== true) return false;
  return (await until(function () { return view(NAME).then(function (v) { return !!v && /turn on DEBUG/i.test(v.text) && v.text.indexOf(LABEL) !== -1; }); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('the row has one button to press', 0.2, async function () {
  if (loaded !== true) return false;
  v0 = await view(NAME);
  return !!v0 && v0.buttons === 1 ? true : false;
}, test.limit.quick);

// the box: "it will use the OWNER-ONLYE VERB DEBUG in the appServer to do that."
test.run('once the button is pressed, the server\'s DEBUG verb says true', 0.2, async function () {
  if (loaded !== true) return false;
  await pressIn(NAME);
  return (await until(function () { return call(N.base, NAME + '.DEBUG', {}).then(function (r) { return !!r.body && r.body.debug === true; }); }, 8000)) ? true : false;
}, test.limit.quick);
test.run('the row then says turn off DEBUG Zz Debug', 0.2, async function () {
  if (loaded !== true) return false;
  return (await until(function () { return view(NAME).then(function (v) { return !!v && /turn off DEBUG/i.test(v.text); }); }, 8000)) ? true : false;
}, test.limit.quick);
test.run('with DEBUG switched off elsewhere, the page follows with no reload and says turn on DEBUG again', 0.2, async function () {
  if (loaded !== true) return false;
  await call(N.base, NAME + '.DEBUG', { on: false });
  return (await until(function () { return view(NAME).then(function (v) { return !!v && /turn on DEBUG/i.test(v.text); }); }, 8000)) ? true : false;
}, test.limit.quick);

// the box: "It sits in the appSelector's detail, under the Activate row"
test.run('the page opens again', 0.2, async function () {
  if (!c || c.error) return false;
  return (await open()) ? true : false;
}, test.limit.quick);
test.run('the detail of Zz Debug is made', 0.2, async function () {
  if (!c || c.error) return false;
  detail = await c.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/detail.js"); }).then(function () { var b = document.createElement("div"); b.id = "zzDetail"; document.body.appendChild(b); window.__d = spirit.required.spirit.element.search.app.detail.create(b, { row: { key: ' + JSON.stringify(NAME) + ', label: ' + JSON.stringify(LABEL) + ', icon: "🐛" }, panel: true }); return true; })');
  return detail === true ? true : false;
}, test.limit.quick);
test.run('the detail loads changeAppIcon.js and changeAppLabel.js', 0.2, async function () {
  if (detail !== true) return false;
  return (await until(function () { return Promise.resolve(['changeAppIcon.js', 'changeAppLabel.js'].every(function (f) { return asked().some(function (u) { return u.indexOf('spirit/element/search/app/' + f) !== -1; }); })); }, 10000)) ? true : false;
}, test.limit.quick);
test.run('the DEBUG row comes right after the Deactivate row', 0.2, async function () {
  if (detail !== true) return false;
  return (await until(function () { return order().then(function (o) { const a = o.findIndex(function (t) { return /Deactivate/.test(t); }); return a !== -1 && /DEBUG/.test(o[a + 1] || ''); }); }, 10000)) ? true : false;
}, test.limit.quick);

// the box: "A rowForm carries its own 1em above it, so when it is hidden its space goes with it"
test.run('every row of the detail carries its own 1em above it', 0.2, async function () {
  if (detail !== true) return false;
  gaps = await c.evaluate('(function () { var b = document.getElementById("zzDetail"); var rows = Array.prototype.slice.call(b.querySelectorAll(".shell-row-form")).filter(function (r) { return r.getBoundingClientRect().height > 0; }); var em = parseFloat(getComputedStyle(b).fontSize); var out = []; for (var i = 1; i < rows.length; i++) out.push(Math.round(rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().bottom)); return { em: Math.round(em), gaps: out, margins: rows.map(function (r) { return Math.round(parseFloat(getComputedStyle(r).marginTop)); }) }; }())');
  return !!gaps && gaps.margins.length > 1 && gaps.margins.every(function (m) { return m === gaps.em; }) ? true : false;
}, test.limit.quick);
test.run('the gap between two rows of the detail is that 1em, not more', 0.2, function () {
  if (!gaps) return false;
  return gaps.gaps.length > 0 && gaps.gaps.every(function (g) { return Math.abs(g - gaps.em) <= 1; }) ? true : false;
}, test.limit.quick);

// nothing threw on the page
test.run('no uncaught error was thrown on the page during the whole suite', 0.2, function () {
  if (!c || c.error) return false;
  const thrown = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; });
  return !thrown.length ? true : false;
}, test.limit.quick);
