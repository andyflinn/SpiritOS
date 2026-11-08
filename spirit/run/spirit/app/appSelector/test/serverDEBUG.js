'use strict';

// spirit/run/spirit/app/appSelector/test/serverDEBUG.js
// The tests of spirit/app/appSelector/serverDEBUG.js, and of the DEBUG it switches (spec: ./serverDEBUG.md; goal/G43.15). A real
// node on a scratch copy of the tracked files, with a throwaway server app planted before it boots, and a real Chrome on its face
// page. Neither Andy's node nor an agent's is touched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'test', 'headLessChrome.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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
  fs.writeFileSync(path.join(dir, NAME + '.js'), "'use strict';\nif (typeof window === 'undefined') {\n  require('../../../spirit.js');\n  require('../../appServer.js').serve({ pid: { request: {}, reply: {}, handler: function () { return { pid: process.pid }; } } }, {});\n}\n");
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
  const found = await call(base, 'jobs.search', { q: '' });
  const rows = await Promise.all(((found.body && found.body.items) || []).map(function (i) { return call(base, 'jobs.get', { key: i.key }); }));
  return rows.map(function (r) { return r.body && r.body.job; }).filter(function (j) { return !!j && j.kind === 'server' && j.module === module && (j.status === 'running' || j.status === 'pending'); })[0] || null;
}

test.startTest('serverDEBUG.js: a server\'s DEBUG, switched and streamed (goal/G43.15)');

(async function () {
  const s = scratch();
  const live = [];
  let c = null;
  try {
    let N = await boot(s.run); live.push(N.child);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;

    test.subHeading('the box: a server app, activated, runs (the world for what follows)');
    await call(N.base, 'app.active', { key: NAME, active: true });
    const up = await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200 && r.body && r.body.pid > 0; }); }, 30000);
    ok(up, 'the world: activated, the server answers', 'the server did not come up');


    test.subHeading('the box: "DEBUG puts its state on the server\'s own job, in the job\'s data, at start and on every change"');
    await call(N.base, NAME + '.DEBUG', { on: true });
    const j1 = await jobOf(N.base, 'spirit.app.' + NAME);
    ok(!!j1 && j1.data && j1.data.debug === true, 'switched on, its job\'s data says debug true', 'its job: ' + short(j1 && j1.data));
    await call(N.base, NAME + '.DEBUG', { on: false });
    const j2 = await jobOf(N.base, 'spirit.app.' + NAME);
    ok(!!j2 && j2.data && j2.data.debug === false, 'and its job\'s data says debug false', 'its job: ' + short(j2 && j2.data));
    await call(N.base, NAME + '.pid', {});
    await sleep(500);
    const j3 = await jobOf(N.base, 'spirit.app.' + NAME);
    ok(!!j3 && j3.data && j3.data.debug === false, 'the job\'s data keeps it past the server\'s next call', 'its job: ' + short(j3 && j3.data));

    test.subHeading('Q2: "i think we should persist it, always": the node keeps it in spirit/state/<name>/node.json and hands it over at start');
    const nodeJson = function () { return readJson(path.join(s.run, 'spirit', 'state', NAME, 'node.json')) || {}; };
    await call(N.base, NAME + '.DEBUG', { on: true });
    ok(await until(function () { return Promise.resolve(nodeJson().debug === true); }, 8000), 'switched on, node.json says debug true', 'node.json: ' + short(nodeJson()));
    const pid = Number(((await call(N.base, NAME + '.pid', {})).body || {}).pid);
    process.kill(pid, 'SIGKILL');
    await until(function () { return Promise.resolve(!alive(pid)); }, 5000);
    ok(await until(function () { return call(N.base, NAME + '.pid', {}).then(function (r) { return r.status === 200 && r.body && r.body.pid > 0 && r.body.pid !== pid; }); }, 30000), 'the world: killed, the server comes back', 'the server did not come back');
    ok((((await call(N.base, NAME + '.DEBUG', {})).body) || {}).debug === true, 'and it starts with DEBUG on, as kept', 'after the restart: ' + short((await call(N.base, NAME + '.DEBUG', {})).text));
    await stop(N.child);
    N = await boot(s.run); live.push(N.child);
    await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200; }); }, 30000);
    ok((((await call(N.base, NAME + '.DEBUG', {})).body) || {}).debug === true, 'and after the node restarts too', 'after the node restarted: ' + short((await call(N.base, NAME + '.DEBUG', {})).text));
    await call(N.base, NAME + '.DEBUG', { on: false });
    ok(await until(function () { return Promise.resolve(nodeJson().debug === false); }, 8000), 'switched off, node.json says debug false', 'node.json: ' + short(nodeJson()));

    test.subHeading('Q3: "only the new ones": an old process/js server\'s DEBUG gets no node.json');
    const fsDebug = await call(N.base, 'fileServer.DEBUG', { on: true });
    ok(fsDebug.status === 200 && fsDebug.body && fsDebug.body.debug === true, 'the world: fileServer\'s DEBUG switches', 'fileServer.DEBUG: ' + short(fsDebug.text));
    await sleep(2000);
    ok(!fs.existsSync(path.join(s.run, 'spirit', 'state', 'fileServer', 'node.json')), 'and nothing is written to spirit/state/fileServer/node.json', 'spirit/state/fileServer/node.json: ' + short(readJson(path.join(s.run, 'spirit', 'state', 'fileServer', 'node.json'))));
    await call(N.base, 'fileServer.DEBUG', { on: false });

    const where = findChrome();
    if (!where) { test.fail('no Chrome here: nothing judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    const open = async function () {
      await c.send('Page.navigate', { url: N.base + '/face.html' });
      return until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready && window.spirit.events)'); }, 20000);
    };
    ok(await open(), 'the world: the face shell has its spirit', 'the page has no spirit: nothing judged');
    const loaded = await c.evaluate('spirit.ready.then(function () { return spirit.require("spirit/app/appSelector/serverDEBUG.js"); }).then(function () { return !!(spirit.elements.serverDEBUG && spirit.elements.serverDEBUG.create); }, function (e) { return String(e); })');
    ok(loaded === true, 'it loads through spirit.require and is spirit.elements.serverDEBUG', 'it did not load: ' + short(loaded));
    if (loaded !== true) return;
    // One serverDEBUG per app, each in a box of its own.
    const make = function (key) { return c.evaluate('(function () { var b = document.createElement("div"); b.id = "dbg-' + key + '"; document.body.appendChild(b); window["dbg_' + key + '"] = spirit.elements.serverDEBUG.create(b, { key: ' + JSON.stringify(key) + ' }); return !!window["dbg_' + key + '"]; }())'); };
    const view = function (key) { return c.evaluate('(function () { var b = document.getElementById("dbg-' + key + '"); if (!b) return null; var r = b.getBoundingClientRect(); return { text: String(b.innerText || "").replace(/\\s+/g, " ").trim(), height: r.height, buttons: b.querySelectorAll("button").length }; }())'); };
    const pressIn = function (key) { return c.evaluate('(function () { var b = document.querySelector("#dbg-' + key + ' button"); if (!b) return false; b.click(); return true; }())'); };
    const hidden = function (v) { return !!v && v.height === 0 && v.text === ''; };

    test.subHeading('the box: "when the app is NOT mountable by the node (node.mount==false) it hides itself"');
    await make('contact');
    await sleep(2000);
    ok(hidden(await view('contact')), 'for Contacts, which has no server, it shows nothing and takes no space', 'for Contacts: ' + short(await view('contact')));

    test.subHeading('the box: "hides while its server is not running"');
    await call(N.base, 'app.active', { key: NAME, active: false });
    await until(function () { return jobOf(N.base, 'spirit.app.' + NAME).then(function (j) { return !j; }); }, 15000);
    await make(NAME);
    await sleep(2000);
    ok(hidden(await view(NAME)), 'for ' + LABEL + ', its server switched off, it shows nothing', 'not running: ' + short(await view(NAME)));
    await call(N.base, 'app.active', { key: NAME, active: true });
    ok(await until(function () { return call(N.base, NAME + '.pid').then(function (r) { return r.status === 200; }); }, 30000), 'the world: activated again, the server answers', 'the server did not come back');
    test.subHeading('the box: "when the app is a server (node.mount==true), configured text: "turn on|off DEBUG <app-label>""');
    ok(await until(function () { return view(NAME).then(function (v) { return !!v && /turn on DEBUG/i.test(v.text) && v.text.indexOf(LABEL) !== -1; }); }, 10000), 'running, with DEBUG off, it says turn on DEBUG ' + LABEL, 'running: ' + short(await view(NAME)));
    const v0 = await view(NAME);
    ok(!!v0 && v0.buttons === 1, 'with one button to press', 'buttons: ' + short(v0));

    test.subHeading('the box: "it will use the OWNER-ONLYE VERB DEBUG in the appServer to do that."');
    await pressIn(NAME);
    ok(await until(function () { return call(N.base, NAME + '.DEBUG', {}).then(function (r) { return !!r.body && r.body.debug === true; }); }, 8000), 'pressed, the server\'s DEBUG {} says true', NAME + '.DEBUG {}: ' + short((await call(N.base, NAME + '.DEBUG', {})).text));
    ok(await until(function () { return view(NAME).then(function (v) { return !!v && /turn off DEBUG/i.test(v.text); }); }, 8000), 'and it says turn off DEBUG ' + LABEL, 'after the press: ' + short(await view(NAME)));
    await call(N.base, NAME + '.DEBUG', { on: false });
    ok(await until(function () { return view(NAME).then(function (v) { return !!v && /turn on DEBUG/i.test(v.text); }); }, 8000), 'switched off elsewhere, the page follows with no reload: turn on DEBUG again', 'after DEBUG {on: false} from outside: ' + short(await view(NAME)));

    test.subHeading('the box: "It sits in the appSelector\'s detail, under the Activate row"');
    ok(await open(), 'the world: the page opens again', 'no page');
    const detail = await c.evaluate('spirit.ready.then(function () { return spirit.require("spirit/app/appSelector/detailElement.js"); }).then(function () { var b = document.createElement("div"); b.id = "zzDetail"; document.body.appendChild(b); window.__d = spirit.elements.appDetail.create(b, { row: { key: ' + JSON.stringify(NAME) + ', label: ' + JSON.stringify(LABEL) + ', icon: "🐛" }, panel: true }); return true; })');
    ok(detail === true, 'the world: the detail of ' + LABEL + ' is made', 'no detail: ' + short(detail));
    // The box: "changeAppIcon and changeAppLabel ... The appSelector's detail uses them": the page asks for both files.
    const asked = function () { return c.heard.filter(function (m) { return m.method === 'Network.requestWillBeSent'; }).map(function (m) { return String(m.params.request.url); }); };
    ok(await until(function () { return Promise.resolve(['changeAppIcon.js', 'changeAppLabel.js'].every(function (f) { return asked().some(function (u) { return u.indexOf('spirit/app/appSelector/' + f) !== -1; }); })); }, 10000), 'the detail loads changeAppIcon.js and changeAppLabel.js', 'asked: ' + short(asked().filter(function (u) { return /appSelector/.test(u); })));
    const order = function () { return c.evaluate('(function () { var b = document.getElementById("zzDetail"); var rows = Array.prototype.slice.call(b.querySelectorAll(".shell-row-form")).filter(function (r) { return r.getBoundingClientRect().height > 0; }); return rows.map(function (r) { return String(r.innerText || "").replace(/\\s+/g, " ").trim(); }); }())'); };
    ok(await until(function () { return order().then(function (o) { const a = o.findIndex(function (t) { return /Deactivate/.test(t); }); return a !== -1 && /DEBUG/.test(o[a + 1] || ''); }); }, 10000), 'the DEBUG row comes right after the Deactivate row', 'its rows: ' + short(await order()));

    test.subHeading('the box: "A rowForm carries its own 1em above it, so when it is hidden its space goes with it"');
    const gaps = await c.evaluate('(function () { var b = document.getElementById("zzDetail"); var rows = Array.prototype.slice.call(b.querySelectorAll(".shell-row-form")).filter(function (r) { return r.getBoundingClientRect().height > 0; }); var em = parseFloat(getComputedStyle(b).fontSize); var out = []; for (var i = 1; i < rows.length; i++) out.push(Math.round(rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().bottom)); return { em: Math.round(em), gaps: out, margins: rows.map(function (r) { return Math.round(parseFloat(getComputedStyle(r).marginTop)); }) }; }())');
    ok(!!gaps && gaps.margins.length > 1 && gaps.margins.every(function (m) { return m === gaps.em; }), 'every row of the detail carries 1em above it, its own', 'em ' + short(gaps && gaps.em) + ', margins ' + short(gaps && gaps.margins));
    ok(!!gaps && gaps.gaps.length > 0 && gaps.gaps.every(function (g) { return Math.abs(g - gaps.em) <= 1; }), 'and the gap between two rows is that 1em, not more', 'gaps ' + short(gaps && gaps.gaps) + ', em ' + short(gaps && gaps.em));

    test.subHeading('nothing threw on the page');
    const thrown = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
    ok(!thrown.length, 'no uncaught error on the page, all the way', 'thrown: ' + short(thrown));
    await stop(N.child);
  } finally {
    live.forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
    if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
    await sleep(300);
    try { fs.rmSync(s.root, { recursive: true, force: true }); } catch (e) { /* a door still closing; the temp folder keeps it */ }
  }
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
