'use strict';

// spirit/run/spirit/app/agent/test/agent.js
// The tests of spirit/app/agent/agent.js, and of the Agent as Andy sees it (spec: ./agent.md; goal/G43.13). Andy: "Make
// spirit/app/agent/ work". A real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector,
// made as the shell app (spirit/app/shell/shell.js) makes it. Neither Andy's node nor an agent's is touched.

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

const MODULE = 'spirit.app.agent';
const ROWS = { provider: 'zzProvider', model: 'zzModel', persona: 'zzPersona', job: 'zzJob' };

function scratch() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agent-'));
  execSync('git ls-files -- spirit/run', { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean)
    .filter(function (f) { return fs.existsSync(path.join(REPO, f)); })
    .forEach(function (f) { const d = path.join(root, f); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(REPO, f), d); });
  return { root: root, run: path.join(root, 'spirit', 'run') };
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
async function liveJob(base) {
  const found = await call(base, 'jobs.search', { q: '' });
  const rows = await Promise.all(((found.body && found.body.items) || []).map(function (i) { return call(base, 'jobs.get', { key: i.key }); }));
  return rows.map(function (r) { return r.body && r.body.job; }).filter(function (j) { return !!j && j.kind === 'server' && j.module === MODULE && (j.status === 'running' || j.status === 'pending'); })[0] || null;
}
function answers(r) { return r.status === 200 && !!r.body && typeof r.body.debug === 'boolean'; }
// The server is up when appServer's DEBUG answers (its own debug verb went in goal/G43.15).
function serverUp(base) { return until(function () { return call(base, 'agent.DEBUG', {}).then(answers); }, 30000); }
// Every file under a folder.
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
  return out;
}

test.startTest('agent.js: the Agent in spirit/app/agent/, as Andy sees it (goal/G43.13)');

(async function () {
  const s = scratch();
  const live = [];
  let c = null;
  try {
    let N = await boot(s.run); live.push(N.child);
    ok(N.up, 'the world: a scratch node comes up', 'the scratch node did not come up: nothing judged');
    if (!N.up) return;
    const where = findChrome();
    if (!where) { test.fail('no Chrome here: nothing judged'); return; }
    c = await chromePage(where);
    if (c.error) { test.fail('Chrome: ' + c.error); return; }
    const open = async function () {
      await c.send('Page.navigate', { url: N.base + '/' });
      return until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    };
    ok(await open(), 'the world: the page has its spirit', 'the page has no spirit: nothing judged');
    // The appSelector, as the shell app makes it, over the page. A second call replaces the first.
    const selector = function (face) {
      return c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.require("spirit/app/appSelector.js").then(function () { window.__sel = spirit.elements.appSelector.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
    };
    // The box's text on one line, so a failure says what was on the page.
    const shown = function () { return c.evaluate('(document.getElementById("zzBox") || {}).innerText || ""').then(function (t) { return String(t).replace(/\s+/g, ' '); }); };
    const shows = function (words) { return until(function () { return shown().then(function (t) { return t.indexOf(words) !== -1; }); }, 8000); };
    // The innermost visible thing in the box that says these words, clicked.
    const press = function (words) {
      return c.evaluate('(function () { var box = document.getElementById("zzBox"); var all = Array.prototype.slice.call(box.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && String(e.innerText || "").trim().indexOf(' + JSON.stringify(words) + ') !== -1 && !Array.prototype.some.call(e.children, function (k) { return String(k.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }); }); if (!all.length) return false; all[0].click(); return true; }())');
    };
    // The switch on the row that names the Agent: rowFormAppActive since goal/G43.15, its words beside its button. Pressed, it
    // answers the word its words began with, Activate or Deactivate.
    const pressInstaller = function () {
      return c.evaluate('(function () { var fs = Array.prototype.slice.call(document.querySelectorAll("#zzBox .shell-row-form")); for (var i = 0; i < fs.length; i++) { var w = fs[i].querySelector(".shell-row-form-span"); var t = w ? String(w.textContent || "").trim() : ""; if (/^(Activate|Deactivate) Agent\\b/.test(t)) { fs[i].querySelector("button").click(); return t.split(" ")[0]; } } return ""; }())');
    };
    const tool = function (name) { return c.evaluate('(function () { var b = document.querySelector("#zzBox [data-tool=' + name + ']"); if (!b) return false; if (!b.hasAttribute("data-current")) b.click(); return true; }())'); };

    test.subHeading('the box: active is its one switch; before it nothing runs');
    ok(!(await liveJob(N.base)), 'not active: no server job', 'a server job before Activate');
    ok(!answers(await call(N.base, 'agent.DEBUG', {})), 'not active: its verbs are not answered', 'its verb answered before Activate');
    await selector('pane');
    ok(await shows('Agent'), 'its row is in the appSelector\'s pane', 'the pane: ' + short(await shown()));
    await selector('tiles');
    await sleep(1500);
    ok((await shown()).indexOf('Agent') === -1, 'and no tile yet', 'tiles: ' + short(await shown()));

    test.subHeading('the box: "Activate in the appSelector, and the server starts."');
    await selector('pane');
    await shows('Agent');
    const pressed = await until(function () { return pressInstaller().then(function (t) { return t === 'Activate'; }); }, 10000);
    ok(pressed, 'the world: its row has an Activate button, and it is pressed', 'no Activate on the Agent\'s row: ' + short(await shown()));
    ok(await serverUp(N.base), 'pressed, the server answers its verbs', 'pressed, agent.debug: ' + short((await call(N.base, 'agent.DEBUG', {})).text));
    if (!answers(await call(N.base, 'agent.DEBUG', {}))) { test.fail('no server, so nothing further is judged'); return; }
    ok(!!(await liveJob(N.base)), 'its job has the id ' + MODULE, 'no live job with that id');
    const db = path.join(s.run, 'spirit', 'state', 'agent', 'data', 'agent.db');
    ok(fs.existsSync(db), 'its rows are kept in spirit/state/agent/data/', 'no agent.db in spirit/state/agent/data/');

    // Rows for the tables to show, made by the server's verbs as they ever were.
    const P = await call(N.base, 'agent.provider', { op: 'add', icon: '🧪', label: ROWS.provider, url: 'http://192.0.2.1:9/' });
    const M = await call(N.base, 'agent.model', { op: 'add', icon: '🧬', label: ROWS.model, providerId: P.body && P.body.id });
    const Pe = await call(N.base, 'agent.persona', { op: 'add', icon: '🧙', label: ROWS.persona, persona: 'zz', bundle: 'zz', provider: P.body && P.body.id });
    const J = await call(N.base, 'agent.job', { op: 'add', icon: '🧰', label: ROWS.job, job: 'zz', bundle: 'zz', provider: P.body && P.body.id, persona: Pe.body && Pe.body.id });
    ok([P, M, Pe, J].every(function (r) { return r.status === 200 && r.body && r.body.id; }), 'the world: the server takes a provider, a model, a persona and a job', 'rows: ' + short([P.text, M.text, Pe.text, J.text]));

    const openTile = async function () {
      await selector('tiles');
      await shows('Agent');
      await press('Agent');
      return until(function () { return c.evaluate('!!document.querySelector("#zzBox [data-tool=provider]")'); }, 15000);
    };
    test.subHeading('the box: "The Agent\'s tile opens, its tables work, and its rows are there"');
    ok(await openTile(), 'its tile opens the app', 'the tile opened nothing: ' + short(await shown()));
    for (const name of Object.keys(ROWS)) {
      const hit = await tool(name);
      ok(hit && await shows(ROWS[name]), 'the ' + name + ' table shows its row, ' + ROWS[name], 'the ' + name + ' tool: ' + short(await shown()));
    }

    test.subHeading('the box: "data.js takes the id spirit.app.agent, not process/js/agent."');
    // The server publishes a row on its job, under its module id; the family's data.js on the page takes it into spirit.data.
    const added = await call(N.base, 'agent.provider', { op: 'add', icon: '🧪', label: 'zzLive', url: 'http://192.0.2.2:9/' });
    const liveId = added.body && added.body.id;
    ok(!!liveId, 'the world: the server adds a provider', 'agent.provider add: ' + short(added.text));
    const onPage = function () { return c.evaluate('(function () { var r = spirit.data.agent && spirit.data.agent.data && spirit.data.agent.data.row("provider", ' + JSON.stringify(String(liveId)) + '); return r ? r.label : ""; }())'); };
    ok(!!liveId && await until(function () { return onPage().then(function (l) { return l === 'zzLive'; }); }, 8000), 'it reaches the page\'s spirit.data.agent with no reload', 'on the page: ' + short(await onPage()));

    // goal/G43.15: the agent's own switch went; its server tool shows serverDEBUG, which switches appServer's DEBUG, kept by the node.
    test.subHeading('goal/G43.15, the box: "On the agent\'s right icon strip, the server\'s tool takes ⚙ instead of 🐞, and its panel shows serverDEBUG"');
    const serverIcon = await c.evaluate('(function () { var b = document.querySelector("#zzBox [data-tool=server]"); return b ? String(b.textContent || "").trim() : null; }())');
    ok(/⚙/.test(String(serverIcon)) && !/🐞/.test(String(serverIcon)), 'the server\'s tool shows ⚙', 'its icon: ' + short(serverIcon));
    await tool('server');
    const debugRow = function () { return c.evaluate('(function () { var rows = Array.prototype.slice.call(document.querySelectorAll("#zzBox .shell-row-form")).filter(function (r) { return /DEBUG/.test(String(r.innerText || "")) && r.getBoundingClientRect().height > 0; }); return rows.length ? String(rows[0].innerText || "").replace(/\\s+/g, " ").trim() : ""; }())'); };
    ok(await until(function () { return debugRow().then(function (t) { return /turn on DEBUG/i.test(t) && /Agent/.test(t); }); }, 10000), 'its panel shows serverDEBUG: turn on DEBUG Agent', 'its panel: ' + short(await debugRow()));
    // goal/G43.15, the box: "the agent's ⚙ panel shows both above serverDEBUG": its visible rows, in order.
    const panelRows = function () { return c.evaluate('(function () { var d = Array.prototype.filter.call(document.querySelectorAll("#zzBox .shell-row-form"), function (r) { return /DEBUG/.test(String(r.innerText || "")) && r.getBoundingClientRect().height > 0; })[0]; if (!d) return []; var p = d.parentElement; while (p && p.querySelectorAll(".shell-row-form").length < 3) p = p.parentElement; if (!p) return []; return Array.prototype.filter.call(p.querySelectorAll(".shell-row-form"), function (r) { return r.getBoundingClientRect().height > 0; }).map(function (r) { return String(r.innerText || "").replace(/\\s+/g, " ").trim(); }); }())'); };
    ok(await until(function () { return panelRows().then(function (rows) { var i = rows.findIndex(function (t) { return /^✏️? ?Icon/.test(t) || /Icon/.test(t); }), l = rows.findIndex(function (t) { return /Label/.test(t); }), d = rows.findIndex(function (t) { return /DEBUG/.test(t); }); return i !== -1 && l !== -1 && d !== -1 && i < l && l < d; }); }, 10000), 'above it, the agent\'s icon, then its label', 'its panel: ' + short(await panelRows()));
    await c.evaluate('(function () { var rows = Array.prototype.slice.call(document.querySelectorAll("#zzBox .shell-row-form")).filter(function (r) { return /DEBUG/.test(String(r.innerText || "")); }); if (rows[0]) rows[0].querySelector("button").click(); return 1; }())');
    ok(await until(function () { return call(N.base, 'agent.DEBUG', {}).then(function (r) { return !!r.body && r.body.debug === true; }); }, 8000), 'pressed, the agent\'s DEBUG is on', 'agent.DEBUG {}: ' + short((await call(N.base, 'agent.DEBUG', {})).text));
    const kept = path.join(s.run, 'spirit', 'state', 'agent', 'node.json');
    ok(await until(function () { return Promise.resolve((readJson(kept) || {}).debug === true); }, 8000), 'and the node keeps it in spirit/state/agent/node.json', 'node.json: ' + short(readJson(kept)));
    ok(!fs.existsSync(path.join(s.run, 'spirit', 'state', 'agent', 'data', 'config.json')), 'no config.json of the agent\'s own is written', 'spirit/state/agent/data/config.json is there');
    ok(await until(function () { return debugRow().then(function (t) { return /turn off DEBUG/i.test(t); }); }, 8000), 'and its panel says turn off DEBUG', 'its panel: ' + short(await debugRow()));

    test.subHeading('the box: "The tick box showDebug goes, with its use of relay-state/shell/agent/config.json"');
    const page = await c.evaluate('document.getElementById("zzBox").innerText').then(String);
    ok(!/DEBUG state in the title bar/.test(page), 'the tick box is not on the page', 'the page still says it');

    test.subHeading('the tile closes');
    const closed = await c.evaluate('(function () { var b = document.querySelector("#zzBox .app-container-close"); if (!b) return false; b.click(); return true; }())');
    ok(closed && await until(function () { return c.evaluate('!document.querySelector("#zzBox [data-tool=provider]")'); }, 8000), 'closed, the app is gone from the page', 'closing: ' + closed);
    ok(await openTile(), 'and it opens again', 'it did not open again: ' + short(await shown()));

    test.subHeading('the box: "Deactivate, and the server stops and the tile goes."');
    await selector('pane');
    await shows('Agent');
    const deact = await until(function () { return pressInstaller().then(function (t) { return t === 'Deactivate'; }); }, 10000);
    ok(deact, 'the world: its row has a Deactivate button, and it is pressed', 'no Deactivate on the Agent\'s row: ' + short(await shown()));
    ok(await until(function () { return liveJob(N.base).then(function (j) { return !j; }); }, 15000), 'pressed, the server stops', 'a live server job stayed');
    ok(!answers(await call(N.base, 'agent.DEBUG', {})), 'and its verbs are not answered', 'its verb answered after Deactivate');
    ok(await shows('Agent'), 'its row stays in the pane', 'the pane: ' + short(await shown()));
    await selector('tiles');
    await sleep(1500);
    ok((await shown()).indexOf('Agent') === -1, 'and its tile goes', 'tiles: ' + short(await shown()));

    test.subHeading('the box: "its rows are there, from the same spirit/state/agent/data/": through a restart, active again');
    await call(N.base, 'app.active', { key: 'agent', active: true });
    await serverUp(N.base);
    await stop(N.child);
    N = await boot(s.run); live.push(N.child);
    ok(N.up && await serverUp(N.base), 'a restarted node starts it', 'a restarted node did not start it');
    await open();
    ok(await openTile(), 'its tile opens', 'its tile did not open: ' + short(await shown()));
    await tool('provider');
    ok(await shows(ROWS.provider), 'and the row made before is there', 'the provider tool: ' + short(await shown()));

    test.subHeading('the box: "The agent has no sidecar. Nothing in this item reads, writes or tests one"');
    const sidecars = filesUnder(path.join(s.run, 'spirit', 'state')).concat(filesUnder(path.join(s.run, 'spirit', 'app', 'agent')))
      .filter(function (f) { return /agent[^/\\]*\.sidecar\.json$/.test(f) });
    ok(!sidecars.length, 'after all that, no sidecar of the agent stands anywhere', 'sidecars: ' + short(sidecars));
    const code = filesUnder(path.join(RUN, 'spirit', 'app', 'agent')).filter(function (f) { return /\.js$/.test(f); })
      .filter(function (f) { return /sidecar/i.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')); }).map(function (f) { return path.relative(RUN, f); })
      .filter(function (f) { return f !== path.relative(RUN, __filename); });
    ok(!code.length, 'and no code or test of the agent names one', 'naming one: ' + short(code));

    test.subHeading('the box: "The agent\'s files name their new paths."');
    const old = filesUnder(path.join(RUN, 'spirit', 'app', 'agent')).filter(function (f) { return /\.(js|html)$/.test(f) && f.split(path.sep).indexOf('test') === -1; })
      .filter(function (f) { return /process\/js\/agent|shell\/agent/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')); }).map(function (f) { return path.relative(RUN, f); })
      .filter(function (f) { return f !== path.relative(RUN, __filename); });
    ok(!old.length, 'no code of the agent names its old folders', 'naming them: ' + short(old));

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
