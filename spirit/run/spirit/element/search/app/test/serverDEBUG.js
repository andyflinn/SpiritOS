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
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

const NAME = 'zzdebug';
const LABEL = 'Zz Debug';

// A throwaway server app, in the box's shape, that answers its pid, so a restart can be told.
function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-debug-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  const run = path.join(root, 'spirit', 'run');
  const dir = path.join(run, 'spirit', 'app', NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, NAME + '.json'), JSON.stringify({ identity: { icon: '🐛', label: LABEL, intrinsic: false }, mount: { [NAME + '.js']: true }, shell: { true: false, mount: false, tile: false }, node: { mount: true } }));
  fs.writeFileSync(path.join(dir, NAME + '.js'), "'use strict';\nif (typeof window === 'undefined') {\n  require('../../spirit.js');\n  require('../../appServer.js').serve({ pid: { request: {}, reply: {}, handler: function () { return { pid: process.pid }; } } }, {});\n}\n");
  fs.writeFileSync(path.join(dir, 'api.js'), 'module.exports = { verbs: { pid: {} } };\n');
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
function alive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return false; } }
async function jobOf(base, module) {
  const found = await call(base, 'job.search', { q: '' });
  const rows = await Promise.all(((found.body && found.body.items) || []).map(function (i) { return call(base, 'job.get', { key: i.key }); }));
  return rows.map(function (r) { return r.body && r.body.job; }).filter(function (j) { return !!j && j.kind === 'server' && j.module === module && (j.status === 'running' || j.status === 'pending'); })[0] || null;
}

// One test.run per test (goal/G47.2). What the world and the tests make, for the tests after them.
let s, N, c, loaded, pid, v0, detail, gaps;
const live = [];
const NO_NODE = 'no scratch node: the world failed';
const NO_PAGE = 'no page with serverDEBUG.js on it: the world failed';
const nodeJson = function () { return readJson(path.join(s.run, 'spirit', 'state', NAME, 'node.json')) || {}; };
const open = async function () {
  await c.send('Page.navigate', { url: N.base + '/face.html' });
  return until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.event)'); }, 20000);
};
// One serverDEBUG per app, each in a box of its own.
const make = function (key) { return c.evaluate('(function () { var b = document.createElement("div"); b.id = "dbg-' + key + '"; document.body.appendChild(b); window["dbg_' + key + '"] = spirit.element.spirit.element.search.app.serverDEBUG.create(b, { key: ' + JSON.stringify(key) + ' }); return !!window["dbg_' + key + '"]; }())'); };
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
  try { if (s) fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* a door still closing; the temp folder keeps it */ }
});

test.run('the world: a scratch node comes up', 0.2, async function () {
  s = scratch();
  N = await boot(s.run); live.push(N.child);
  return N.up || 'the scratch node did not come up: nothing judged';
}, 4000);

// the box: a server app, activated, runs (the world for what follows)
test.run('the world: activated, the server answers', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  await call(N.base, 'app.active', { key: NAME, active: true });
  const up = await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200 && r.body && r.body.pid > 0; }); }, 30000);
  return up ? true : 'the server did not come up';
}, 2000);

// the box: "DEBUG puts its state on the server's own job, in the job's data, at start and on every change"
test.run('switched on, its job\'s data says debug true', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  await call(N.base, NAME + '.DEBUG', { on: true });
  const j1 = await jobOf(N.base, 'spirit.app.' + NAME);
  return !!j1 && j1.data && j1.data.debug === true ? true : 'its job: ' + short(j1 && j1.data);
}, 1000);
test.run('and its job\'s data says debug false', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  await call(N.base, NAME + '.DEBUG', { on: false });
  const j2 = await jobOf(N.base, 'spirit.app.' + NAME);
  return !!j2 && j2.data && j2.data.debug === false ? true : 'its job: ' + short(j2 && j2.data);
}, 1000);
test.run('the job\'s data keeps it past the server\'s next call', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  await call(N.base, NAME + '.pid', {});
  await sleep(500);
  const j3 = await jobOf(N.base, 'spirit.app.' + NAME);
  return !!j3 && j3.data && j3.data.debug === false ? true : 'its job: ' + short(j3 && j3.data);
}, 2000);

// Q2: "i think we should persist it, always": the node keeps it in spirit/state/<name>/node.json and hands it over at start
test.run('switched on, node.json says debug true', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  await call(N.base, NAME + '.DEBUG', { on: true });
  return (await until(function () { return Promise.resolve(nodeJson().debug === true); }, 8000)) ? true : 'node.json: ' + short(nodeJson());
}, 1000);
test.run('the world: killed, the server comes back', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  pid = Number(((await call(N.base, NAME + '.pid', {})).body || {}).pid);
  if (!(pid > 0)) return 'the server answered no pid';
  process.kill(pid, 'SIGKILL');
  await until(function () { return Promise.resolve(!alive(pid)); }, 5000);
  return (await until(function () { return call(N.base, NAME + '.pid', {}).then(function (r) { return r.status === 200 && r.body && r.body.pid > 0 && r.body.pid !== pid; }); }, 30000)) ? true : 'the server did not come back';
}, 4000);
test.run('and it starts with DEBUG on, as kept', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  return (((await call(N.base, NAME + '.DEBUG', {})).body) || {}).debug === true ? true : 'after the restart: ' + short((await call(N.base, NAME + '.DEBUG', {})).text);
}, 1000);
test.run('and after the node restarts too', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  await stop(N.child);
  N = await boot(s.run); live.push(N.child);
  if (!N.up) return 'the scratch node did not come up again';
  await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200; }); }, 30000);
  return (((await call(N.base, NAME + '.DEBUG', {})).body) || {}).debug === true ? true : 'after the node restarted: ' + short((await call(N.base, NAME + '.DEBUG', {})).text);
}, 3000);
test.run('switched off, node.json says debug false', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  await call(N.base, NAME + '.DEBUG', { on: false });
  return (await until(function () { return Promise.resolve(nodeJson().debug === false); }, 8000)) ? true : 'node.json: ' + short(nodeJson());
}, 1000);

test.run('the world: the face shell has its spirit', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  const where = findChrome();
  if (!where) return 'no Chrome here: nothing judged';
  c = await chromePage(where);
  if (c.error) return 'Chrome: ' + c.error;
  return (await open()) ? true : 'the page has no spirit: nothing judged';
}, 3000);
test.run('it loads through spirit.require and is spirit.element.spirit.element.search.app.serverDEBUG', 0.2, async function () {
  if (!c || c.error) return 'no Chrome: the world failed';
  loaded = await c.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/serverDEBUG.js"); }).then(function () { return !!(spirit.element.spirit.element.search.app.serverDEBUG && spirit.element.spirit.element.search.app.serverDEBUG.create); }, function (e) { return String(e); })');
  return loaded === true ? true : 'it did not load: ' + short(loaded);
}, 1000);

// the box: "when the app is NOT mountable by the node (node.mount==false) it hides itself"
test.run('for Contacts, which has no server, it shows nothing and takes no space', 0.2, async function () {
  if (loaded !== true) return NO_PAGE;
  await make('contact');
  await sleep(2000);
  return hidden(await view('contact')) ? true : 'for Contacts: ' + short(await view('contact'));
}, 7000);

// the box: "hides while its server is not running"
test.run('for Zz Debug, its server switched off, it shows nothing', 0.2, async function () {
  if (loaded !== true) return NO_PAGE;
  await call(N.base, 'app.active', { key: NAME, active: false });
  await until(function () { return jobOf(N.base, 'spirit.app.' + NAME).then(function (j) { return !j; }); }, 15000);
  await make(NAME);
  await sleep(2000);
  return hidden(await view(NAME)) ? true : 'not running: ' + short(await view(NAME));
}, 7000);
test.run('the world: activated again, the server answers', 0.2, async function () {
  if (!nodeUp()) return NO_NODE;
  await call(N.base, 'app.active', { key: NAME, active: true });
  return (await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200; }); }, 30000)) ? true : 'the server did not come back';
}, 1000);
// the box: "when the app is a server (node.mount==true), configured text: "turn on|off DEBUG <app-label>""
test.run('running, with DEBUG off, it says turn on DEBUG Zz Debug', 0.2, async function () {
  if (loaded !== true) return NO_PAGE;
  return (await until(function () { return view(NAME).then(function (v) { return !!v && /turn on DEBUG/i.test(v.text) && v.text.indexOf(LABEL) !== -1; }); }, 10000)) ? true : 'running: ' + short(await view(NAME));
}, 1000);
test.run('with one button to press', 0.2, async function () {
  if (loaded !== true) return NO_PAGE;
  v0 = await view(NAME);
  return !!v0 && v0.buttons === 1 ? true : 'buttons: ' + short(v0);
}, 1000);

// the box: "it will use the OWNER-ONLYE VERB DEBUG in the appServer to do that."
test.run('pressed, the server\'s DEBUG {} says true', 0.2, async function () {
  if (loaded !== true) return NO_PAGE;
  await pressIn(NAME);
  return (await until(function () { return call(N.base, NAME + '.DEBUG', {}).then(function (r) { return !!r.body && r.body.debug === true; }); }, 8000)) ? true : NAME + '.DEBUG {}: ' + short((await call(N.base, NAME + '.DEBUG', {})).text);
}, 1000);
test.run('and it says turn off DEBUG Zz Debug', 0.2, async function () {
  if (loaded !== true) return NO_PAGE;
  return (await until(function () { return view(NAME).then(function (v) { return !!v && /turn off DEBUG/i.test(v.text); }); }, 8000)) ? true : 'after the press: ' + short(await view(NAME));
}, 1000);
test.run('switched off elsewhere, the page follows with no reload: turn on DEBUG again', 0.2, async function () {
  if (loaded !== true) return NO_PAGE;
  await call(N.base, NAME + '.DEBUG', { on: false });
  return (await until(function () { return view(NAME).then(function (v) { return !!v && /turn on DEBUG/i.test(v.text); }); }, 8000)) ? true : 'after DEBUG {on: false} from outside: ' + short(await view(NAME));
}, 1000);

// the box: "It sits in the appSelector's detail, under the Activate row"
test.run('the world: the page opens again', 0.2, async function () {
  if (!c || c.error) return 'no Chrome: the world failed';
  return (await open()) ? true : 'no page';
}, 1000);
test.run('the world: the detail of Zz Debug is made', 0.2, async function () {
  if (!c || c.error) return 'no Chrome: the world failed';
  detail = await c.evaluate('spirit.ready.then(function () { return spirit.require("spirit/element/search/app/detailElement.js"); }).then(function () { var b = document.createElement("div"); b.id = "zzDetail"; document.body.appendChild(b); window.__d = spirit.element.spirit.element.search.app.detailElement.create(b, { row: { key: ' + JSON.stringify(NAME) + ', label: ' + JSON.stringify(LABEL) + ', icon: "🐛" }, panel: true }); return true; })');
  return detail === true ? true : 'no detail: ' + short(detail);
}, 1000);
test.run('the detail loads changeAppIcon.js and changeAppLabel.js', 0.2, async function () {
  if (detail !== true) return 'no detail';
  return (await until(function () { return Promise.resolve(['changeAppIcon.js', 'changeAppLabel.js'].every(function (f) { return asked().some(function (u) { return u.indexOf('spirit/element/search/app/' + f) !== -1; }); })); }, 10000)) ? true : 'asked: ' + short(asked().filter(function (u) { return /appSelector/.test(u); }));
}, 1000);
test.run('the DEBUG row comes right after the Deactivate row', 0.2, async function () {
  if (detail !== true) return 'no detail';
  return (await until(function () { return order().then(function (o) { const a = o.findIndex(function (t) { return /Deactivate/.test(t); }); return a !== -1 && /DEBUG/.test(o[a + 1] || ''); }); }, 10000)) ? true : 'its rows: ' + short(await order());
}, 1000);

// the box: "A rowForm carries its own 1em above it, so when it is hidden its space goes with it"
test.run('every row of the detail carries 1em above it, its own', 0.2, async function () {
  if (detail !== true) return 'no detail';
  gaps = await c.evaluate('(function () { var b = document.getElementById("zzDetail"); var rows = Array.prototype.slice.call(b.querySelectorAll(".shell-row-form")).filter(function (r) { return r.getBoundingClientRect().height > 0; }); var em = parseFloat(getComputedStyle(b).fontSize); var out = []; for (var i = 1; i < rows.length; i++) out.push(Math.round(rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().bottom)); return { em: Math.round(em), gaps: out, margins: rows.map(function (r) { return Math.round(parseFloat(getComputedStyle(r).marginTop)); }) }; }())');
  return !!gaps && gaps.margins.length > 1 && gaps.margins.every(function (m) { return m === gaps.em; }) ? true : 'em ' + short(gaps && gaps.em) + ', margins ' + short(gaps && gaps.margins);
}, 1000);
test.run('and the gap between two rows is that 1em, not more', 0.2, function () {
  if (!gaps) return 'no detail measured';
  return gaps.gaps.length > 0 && gaps.gaps.every(function (g) { return Math.abs(g - gaps.em) <= 1; }) ? true : 'gaps ' + short(gaps.gaps) + ', em ' + short(gaps.em);
}, 1000);

// nothing threw on the page
test.run('no uncaught error on the page, all the way', 0.2, function () {
  if (!c || c.error) return 'no Chrome: the world failed';
  const thrown = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
  return !thrown.length ? true : 'thrown: ' + short(thrown);
}, 1000);
