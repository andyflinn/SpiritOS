'use strict';

// spirit/run/spirit/app/agent/test/agent.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md): each part below is its own
// section at the end: centreTabs, listBoxes.
// The tests of spirit/app/agent/agent.js, and of the Agent as Andy sees it (spec: ./agent.md; goal/G43.13). Andy: "Make
// spirit/app/agent/ work". A real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector,
// made as the shell app (spirit/app/app/element.js) makes it. Neither Andy's node nor an agent's is touched.

// One test.run per test (goal/G47.2): each part is a block of its own, its tests in order; a step that leaves nothing to
// judge sets the part's STOP, and every later test of that part fails saying so.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const { freePort, until, sleep, chromePage, findChrome } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

const MODULE = 'spirit.app.agent';
const ROWS = { provider: 'zzProvider', model: 'zzModel', persona: 'zzPersona', job: 'zzJob' };

function scratch() {
  const root = LABH.scratchTree().root;
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
  const child = LABH.startNodeOn(run, port);
  const base = 'http://127.0.0.1:' + port;
  const up = await until(function () { return call(base, 'api').then(function (r) { return r.status === 200; }); }, 60000);
  return { child: child, base: base, up: !!up };
}
function stop(c) { return new Promise(function (r) { if (!c || c.exitCode !== null) return r(); c.once('exit', function () { r(); }); c.kill(); setTimeout(r, 6000); }); }
async function liveJob(base) {
  const found = await call(base, 'job.search', { q: '' });
  const rows = await Promise.all(((found.body && found.body.items) || []).map(function (i) { return call(base, 'job.get', { key: i.key }); }));
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

// ── THE Agent PART ────────────────────────────────────────
{
  let STOP = '';
  let s, live, c, N, where, open, selector, shown, shows, press, pressInstaller, tool, pressed, db, P, M, Pe, J, openTile, PROVIDER_ROW, MODEL_ROW, PERSONA_ROW, JOB_ROW, added, liveId, onPage, serverIcon, debugRow, panelRows, kept, page, closed, deact, sidecars, code, old, thrown;
  test.after(async function () {
    (live || []).forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
    if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
    await sleep(300);
    try { LABH.freeTree(s); } catch (e) { /* a door still closing; the temp folder keeps it */ }
  });
  test.run('the world: a scratch node comes up', 0.2, async function () {
    if (STOP) return STOP;
      s = scratch();
      live = [];
      c = null;
    N = await boot(s.run); live.push(N.child);
    return (N.up) ? true : 'the scratch node did not come up: nothing judged';
  }, test.limit.slow);
  test.run('the world: the page has its spirit', 0.2, async function () {
    if (STOP) return STOP;
    if (!N.up) { STOP = 'nothing judged: an earlier test of this part failed'; return STOP; }
    where = findChrome();
    if (!where) { STOP = 'no Chrome here: nothing judged'; return STOP; }
    c = await chromePage(where);
    if (c.error) { STOP = 'Chrome: ' + c.error; return STOP; }
    open = async function () {
      await c.send('Page.navigate', { url: N.base + '/' });
      return until(function () { return c.evaluate('!!(window.spirit && window.spirit.ready)'); }, 20000);
    };
    return (await open()) ? true : 'the page has no spirit: nothing judged';
  }, test.limit.slow);
  // ── the box: active is its one switch; before it nothing runs ──
  test.run('not active: no server job', 0.2, async function () {
    if (STOP) return STOP;
    // The appSelector, as the shell app makes it, over the page. A second call replaces the first.
    selector = function (face) {
      return c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__sel = spirit.element.spirit.app.app.element.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
    };
    // The box's text on one line, so a failure says what was on the page.
    shown = function () { return c.evaluate('(document.getElementById("zzBox") || {}).innerText || ""').then(function (t) { return String(t).replace(/\s+/g, ' '); }); };
    shows = function (words) { return until(function () { return shown().then(function (t) { return t.indexOf(words) !== -1; }); }, 8000); };
    // The innermost visible thing in the box that says these words, clicked.
    press = function (words) {
      return c.evaluate('(function () { var box = document.getElementById("zzBox"); var all = Array.prototype.slice.call(box.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && String(e.innerText || "").trim().indexOf(' + JSON.stringify(words) + ') !== -1 && !Array.prototype.some.call(e.children, function (k) { return String(k.innerText || "").indexOf(' + JSON.stringify(words) + ') !== -1; }); }); if (!all.length) return false; all[0].click(); return true; }())');
    };
    // The switch on the row that names the Agent: rowFormAppActive since goal/G43.15, its words beside its button. Pressed, it
    // answers the word its words began with, Activate or Deactivate.
    pressInstaller = function () {
      return c.evaluate('(function () { var fs = Array.prototype.slice.call(document.querySelectorAll("#zzBox .shell-row-form")); for (var i = 0; i < fs.length; i++) { var w = fs[i].querySelector(".shell-row-form-span"); var t = w ? String(w.textContent || "").trim() : ""; if (/^(Activate|Deactivate) Agent\\b/.test(t)) { fs[i].querySelector("button").click(); return t.split(" ")[0]; } } return ""; }())');
    };
    tool = function (name) { return c.evaluate('(function () { var b = document.querySelector("#zzBox [data-tool=' + name + ']"); if (!b) return false; if (!b.hasAttribute("data-current")) b.click(); return true; }())'); };

    return (!(await liveJob(N.base))) ? true : 'a server job before Activate';
  }, test.limit.quick);
  test.run('not active: its verbs are not answered', 0.2, async function () {
    if (STOP) return STOP;
    return (!answers(await call(N.base, 'agent.DEBUG', {}))) ? true : 'its verb answered before Activate';
  }, test.limit.quick);
  test.run('its row is in the appSelector\'s pane', 0.2, async function () {
    if (STOP) return STOP;
    await selector('pane');
    return (await shows('Agent')) ? true : 'the pane: ' + short(await shown());
  }, test.limit.quick);
  test.run('and no tile yet', 0.2, async function () {
    if (STOP) return STOP;
    await selector('tiles');
    await sleep(1500);
    return ((await shown()).indexOf('Agent') === -1) ? true : 'tiles: ' + short(await shown());
  }, test.limit.slow);
  // ── the box: "Activate in the appSelector, and the server starts." ──
  test.run('the world: its row has an Activate button, and it is pressed', 0.2, async function () {
    if (STOP) return STOP;

    await selector('pane');
    await shows('Agent');
    pressed = await until(function () { return pressInstaller().then(function (t) { return t === 'Activate'; }); }, 10000);
    return (pressed) ? true : 'no Activate on the Agent\'s row: ' + short(await shown());
  }, test.limit.quick);
  test.run('pressed, the server answers its verbs', 0.2, async function () {
    if (STOP) return STOP;
    return (await serverUp(N.base)) ? true : 'pressed, agent.debug: ' + short((await call(N.base, 'agent.DEBUG', {})).text);
  }, test.limit.quick);
  test.run('its server runs as a live job under the agent app\'s id', 0.2, async function () {
    if (STOP) return STOP;
    if (!answers(await call(N.base, 'agent.DEBUG', {}))) { STOP = 'no server, so nothing further is judged'; return STOP; }
    return (!!(await liveJob(N.base))) ? true : 'no live job with the id ' + MODULE;
  }, test.limit.quick);
  test.run('its rows are kept in spirit/state/agent/data/', 0.2, async function () {
    if (STOP) return STOP;
    db = path.join(s.run, 'spirit', 'state', 'agent', 'data', 'agent.db');
    return (fs.existsSync(db)) ? true : 'no agent.db in spirit/state/agent/data/';
  }, test.limit.quick);
  test.run('the world: the server takes a provider, a model, a persona and a job', 0.2, async function () {
    if (STOP) return STOP;

    // Rows for the tables to show, made by the server's verbs as they ever were.
    P = await call(N.base, 'agent.provider', { op: 'add', icon: '🧪', label: ROWS.provider, url: 'http://192.0.2.1:9/' });
    M = await call(N.base, 'agent.model', { op: 'add', icon: '🧬', label: ROWS.model, providerId: P.body && P.body.id });
    Pe = await call(N.base, 'agent.persona', { op: 'add', icon: '🧙', label: ROWS.persona, persona: 'zz', bundle: 'zz', provider: P.body && P.body.id });
    J = await call(N.base, 'agent.job', { op: 'add', icon: '🧰', label: ROWS.job, job: 'zz', bundle: 'zz', provider: P.body && P.body.id, persona: Pe.body && Pe.body.id });
    return ([P, M, Pe, J].every(function (r) { return r.status === 200 && r.body && r.body.id; })) ? true : 'rows: ' + short([P.text, M.text, Pe.text, J.text]);
  }, test.limit.quick);
  // ── the box: "The Agent's tile opens, its tables work, and its rows are there" ──
  test.run('its tile opens the app', 0.2, async function () {
    if (STOP) return STOP;

    openTile = async function () {
      await selector('tiles');
      await shows('Agent');
      await press('Agent');
      return until(function () { return c.evaluate('!!document.querySelector("#zzBox [data-tool=provider]")'); }, 15000);
    };
    return (await openTile()) ? true : 'the tile opened nothing: ' + short(await shown());
  }, test.limit.quick);
async function rowShows(name) { const hit = await tool(name); return { ok: !!(hit && await shows(ROWS[name])), says: 'the ' + name + ' tool: ' + short(await shown()) }; }
  test.run('the provider table shows the provider row the test planted', 0.2, async function () {
    if (STOP) return STOP;
    // One table at a time, each check its own plain title (goal/G45.6: a title has no value built into it).
    PROVIDER_ROW = await rowShows('provider');
    return (PROVIDER_ROW.ok) ? true : PROVIDER_ROW.says;
  }, test.limit.quick);
  test.run('the model table shows the model row the test planted', 0.2, async function () {
    if (STOP) return STOP;
    MODEL_ROW = await rowShows('model');
    return (MODEL_ROW.ok) ? true : MODEL_ROW.says;
  }, test.limit.quick);
  test.run('the persona table shows the persona row the test planted', 0.2, async function () {
    if (STOP) return STOP;
    PERSONA_ROW = await rowShows('persona');
    return (PERSONA_ROW.ok) ? true : PERSONA_ROW.says;
  }, test.limit.quick);
  test.run('the job table shows the job row the test planted', 0.2, async function () {
    if (STOP) return STOP;
    JOB_ROW = await rowShows('job');
    return (JOB_ROW.ok) ? true : JOB_ROW.says;
  }, test.limit.quick);
  // ── the box: "data.js takes the id spirit.app.agent, not process/js/agent." ──
  test.run('the world: the server adds a provider', 0.2, async function () {
    if (STOP) return STOP;

    // The server publishes a row on its job, under its module id; the family's data.js on the page takes it into spirit.data.
    added = await call(N.base, 'agent.provider', { op: 'add', icon: '🧪', label: 'zzLive', url: 'http://192.0.2.2:9/' });
    liveId = added.body && added.body.id;
    return (!!liveId) ? true : 'agent.provider add: ' + short(added.text);
  }, test.limit.quick);
  test.run('it reaches the page\'s spirit.data.agent with no reload', 0.2, async function () {
    if (STOP) return STOP;
    onPage = function () { return c.evaluate('(function () { var r = spirit.data.agent && spirit.data.agent.data && spirit.data.agent.data.row("provider", ' + JSON.stringify(String(liveId)) + '); return r ? r.label : ""; }())'); };
    return (!!liveId && await until(function () { return onPage().then(function (l) { return l === 'zzLive'; }); }, 8000)) ? true : 'on the page: ' + short(await onPage());
  }, test.limit.quick);
  // ── goal/G43.15, the box: "On the agent's right icon strip, the server's tool takes ⚙ instead of 🐞, and its panel shows serverDEBUG" ──
  test.run('the server\'s tool shows ⚙', 0.2, async function () {
    if (STOP) return STOP;

    // goal/G43.15: the agent's own switch went; its server tool shows serverDEBUG, which switches appServer's DEBUG, kept by the node.
    serverIcon = await c.evaluate('(function () { var b = document.querySelector("#zzBox [data-tool=server]"); return b ? String(b.textContent || "").trim() : null; }())');
    return (/⚙/.test(String(serverIcon)) && !/🐞/.test(String(serverIcon))) ? true : 'its icon: ' + short(serverIcon);
  }, test.limit.quick);
  test.run('its panel shows serverDEBUG: turn on DEBUG Agent', 0.2, async function () {
    if (STOP) return STOP;
    await tool('server');
    debugRow = function () { return c.evaluate('(function () { var rows = Array.prototype.slice.call(document.querySelectorAll("#zzBox .shell-row-form")).filter(function (r) { return /DEBUG/.test(String(r.innerText || "")) && r.getBoundingClientRect().height > 0; }); return rows.length ? String(rows[0].innerText || "").replace(/\\s+/g, " ").trim() : ""; }())'); };
    return (await until(function () { return debugRow().then(function (t) { return /turn on DEBUG/i.test(t) && /Agent/.test(t); }); }, 10000)) ? true : 'its panel: ' + short(await debugRow());
  }, test.limit.quick);
  test.run('above it, the agent\'s icon, then its label', 0.2, async function () {
    if (STOP) return STOP;
    // goal/G43.15, the box: "the agent's ⚙ panel shows both above serverDEBUG": its visible rows, in order.
    panelRows = function () { return c.evaluate('(function () { var d = Array.prototype.filter.call(document.querySelectorAll("#zzBox .shell-row-form"), function (r) { return /DEBUG/.test(String(r.innerText || "")) && r.getBoundingClientRect().height > 0; })[0]; if (!d) return []; var p = d.parentElement; while (p && p.querySelectorAll(".shell-row-form").length < 3) p = p.parentElement; if (!p) return []; return Array.prototype.filter.call(p.querySelectorAll(".shell-row-form"), function (r) { return r.getBoundingClientRect().height > 0; }).map(function (r) { return String(r.innerText || "").replace(/\\s+/g, " ").trim(); }); }())'); };
    return (await until(function () { return panelRows().then(function (rows) { var i = rows.findIndex(function (t) { return /^✏️? ?Icon/.test(t) || /Icon/.test(t); }), l = rows.findIndex(function (t) { return /Label/.test(t); }), d = rows.findIndex(function (t) { return /DEBUG/.test(t); }); return i !== -1 && l !== -1 && d !== -1 && i < l && l < d; }); }, 10000)) ? true : 'its panel: ' + short(await panelRows());
  }, test.limit.quick);
  test.run('pressed, the agent\'s DEBUG is on', 0.2, async function () {
    if (STOP) return STOP;
    await c.evaluate('(function () { var rows = Array.prototype.slice.call(document.querySelectorAll("#zzBox .shell-row-form")).filter(function (r) { return /DEBUG/.test(String(r.innerText || "")); }); if (rows[0]) rows[0].querySelector("button").click(); return 1; }())');
    return (await until(function () { return call(N.base, 'agent.DEBUG', {}).then(function (r) { return !!r.body && r.body.debug === true; }); }, 8000)) ? true : 'agent.DEBUG {}: ' + short((await call(N.base, 'agent.DEBUG', {})).text);
  }, test.limit.quick);
  test.run('and the node keeps it in spirit/state/agent/node.json', 0.2, async function () {
    if (STOP) return STOP;
    kept = path.join(s.run, 'spirit', 'state', 'agent', 'node.json');
    return (await until(function () { return Promise.resolve((readJson(kept) || {}).debug === true); }, 8000)) ? true : 'node.json: ' + short(readJson(kept));
  }, test.limit.quick);
  test.run('no config.json of the agent\'s own is written', 0.2, async function () {
    if (STOP) return STOP;
    return (!fs.existsSync(path.join(s.run, 'spirit', 'state', 'agent', 'data', 'config.json'))) ? true : 'spirit/state/agent/data/config.json is there';
  }, test.limit.quick);
  test.run('and its panel says turn off DEBUG', 0.2, async function () {
    if (STOP) return STOP;
    return (await until(function () { return debugRow().then(function (t) { return /turn off DEBUG/i.test(t); }); }, 8000)) ? true : 'its panel: ' + short(await debugRow());
  }, test.limit.quick);
  // ── the box: "The tick box showDebug goes, with its use of relay-state/shell/agent/config.json" ──
  test.run('the tick box is not on the page', 0.2, async function () {
    if (STOP) return STOP;

    page = await c.evaluate('document.getElementById("zzBox").innerText').then(String);
    return (!/DEBUG state in the title bar/.test(page)) ? true : 'the page still says it';
  }, test.limit.quick);
  // ── the tile closes ──
  // OUT OF VIEW, NOT DESTROYED (spirit/element/panel.js, the box: "HIDDEN, NOT DESTROYED (the box): what it drew stays,
  // out of view, until the stack goes"): the ✕ hides the app's panel, so its tools stay in the page, none of them shown.
  test.run('closed, the app is out of view', 0.2, async function () {
    if (STOP) return STOP;

    closed = await c.evaluate('(function () { var b = document.querySelector("#zzBox .app-container-close"); if (!b) return false; b.click(); return true; }())');
    return (closed && await until(function () { return c.evaluate('Array.prototype.every.call(document.querySelectorAll("#zzBox [data-tool=provider]"), function (e) { return !e.getClientRects().length; })'); }, 8000)) ? true : 'closing: ' + closed;
  }, test.limit.long);
  test.run('and it opens again', 0.2, async function () {
    if (STOP) return STOP;
    return (await openTile()) ? true : 'it did not open again: ' + short(await shown());
  }, test.limit.quick);
  // ── the box: "Deactivate, and the server stops and the tile goes." ──
  test.run('the world: its row has a Deactivate button, and it is pressed', 0.2, async function () {
    if (STOP) return STOP;

    await selector('pane');
    await shows('Agent');
    deact = await until(function () { return pressInstaller().then(function (t) { return t === 'Deactivate'; }); }, 10000);
    return (deact) ? true : 'no Deactivate on the Agent\'s row: ' + short(await shown());
  }, test.limit.quick);
  test.run('pressed, the server stops', 0.2, async function () {
    if (STOP) return STOP;
    return (await until(function () { return liveJob(N.base).then(function (j) { return !j; }); }, 15000)) ? true : 'a live server job stayed';
  }, test.limit.quick);
  test.run('and its verbs are not answered', 0.2, async function () {
    if (STOP) return STOP;
    return (!answers(await call(N.base, 'agent.DEBUG', {}))) ? true : 'its verb answered after Deactivate';
  }, test.limit.quick);
  test.run('its row stays in the pane', 0.2, async function () {
    if (STOP) return STOP;
    return (await shows('Agent')) ? true : 'the pane: ' + short(await shown());
  }, test.limit.quick);
  test.run('and its tile goes', 0.2, async function () {
    if (STOP) return STOP;
    await selector('tiles');
    await sleep(1500);
    return ((await shown()).indexOf('Agent') === -1) ? true : 'tiles: ' + short(await shown());
  }, test.limit.slow);
  // ── the box: "its rows are there, from the same spirit/state/agent/data/": through a restart, active again ──
  test.run('a restarted node starts it', 0.2, async function () {
    if (STOP) return STOP;

    await call(N.base, 'app.active', { key: 'agent', active: true });
    await serverUp(N.base);
    if (N) await stop(N.child);
    N = await boot(s.run); live.push(N.child);
    return (N.up && await serverUp(N.base)) ? true : 'a restarted node did not start it';
  }, test.limit.slow);
  test.run('its tile opens', 0.2, async function () {
    if (STOP) return STOP;
    await open();
    return (await openTile()) ? true : 'its tile did not open: ' + short(await shown());
  }, test.limit.slow);
  test.run('and the row made before is there', 0.2, async function () {
    if (STOP) return STOP;
    await tool('provider');
    return (await shows(ROWS.provider)) ? true : 'the provider tool: ' + short(await shown());
  }, test.limit.quick);
  // ── the box: "The agent has no sidecar. Nothing in this item reads, writes or tests one" ──
  test.run('after all that, no sidecar of the agent stands anywhere', 0.2, async function () {
    if (STOP) return STOP;

    sidecars = filesUnder(path.join(s.run, 'spirit', 'state')).concat(filesUnder(path.join(s.run, 'spirit', 'app', 'agent')))
      .filter(function (f) { return /agent[^/\\]*\.sidecar\.json$/.test(f) });
    return (!sidecars.length) ? true : 'sidecars: ' + short(sidecars);
  }, test.limit.quick);
  test.run('and no code or test of the agent names one', 0.2, async function () {
    if (STOP) return STOP;
    code = filesUnder(path.join(RUN, 'spirit', 'app', 'agent')).filter(function (f) { return /\.js$/.test(f); })
      .filter(function (f) { return /sidecar/i.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')); }).map(function (f) { return path.relative(RUN, f); })
      .filter(function (f) { return f !== path.relative(RUN, __filename); });
    return (!code.length) ? true : 'naming one: ' + short(code);
  }, test.limit.quick);
  // ── the box: "The agent's files name their new paths." ──
  test.run('no code of the agent names its old folders', 0.2, async function () {
    if (STOP) return STOP;

    old = filesUnder(path.join(RUN, 'spirit', 'app', 'agent')).filter(function (f) { return /\.(js|html)$/.test(f) && f.split(path.sep).indexOf('test') === -1; })
      .filter(function (f) { return /process\/js\/agent|shell\/agent/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')); }).map(function (f) { return path.relative(RUN, f); })
      .filter(function (f) { return f !== path.relative(RUN, __filename); });
    return (!old.length) ? true : 'naming them: ' + short(old);
  }, test.limit.quick);
  // ── nothing threw on the page ──
  test.run('no uncaught error on the page, all the way', 0.2, async function () {
    if (STOP) return STOP;

    thrown = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return (m.params.exceptionDetails.exception && m.params.exceptionDetails.exception.description) || m.params.exceptionDetails.text; });
    return (!thrown.length) ? true : 'thrown: ' + short(thrown);
  }, test.limit.quick);
  // (left after the last check)
  test.after(async function () {
    if (N) await stop(N.child);
  });
}

// ── THE centreTabs PART ────────────────────────────────────────
{
  // The centreTabs part of ./agent.js.
  // THE AGENT APP'S CENTRE IS TABS (goal/G41.31; Andy, the box: "i need a tabContainer permanently situated in the center pane of
  // the workBench."; "each panel, that the agent app placed into the center panel now becomes a closable tab in the
  // tabContainer, activated if it already exists, created if it doesn't have a tab yet."; each tab's header, by kind; "any tab
  // that hears (by listening) of it's own rows deletion will close itself."; "an unsaved add-tab will say: "new <row-type>*"";
  // and Q1, the tabs stay open when the left tool changes). What a person sees is judged, by real clicks in a real Chrome on a
  // scratch node, on the shell Andy uses, /face.html.

  const fs = require('fs');
  const path = require('path');
  const RUN = path.resolve(__dirname, '..','..','..','..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const { scratchNode, chromePage, findChrome, sleep, until } = require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js'));

  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  const ICON = { provider: '🧪', model: '🧬', persona: '🧙', job: '🧰' };
  const CHAT = '💬';

  // ── centreTabs: the agent app's centre is closable tabs (goal/G41.31) ──

  let STOP = '';
  let N, c, home, P, M, Pe, J, B, where, LEAF, press, appOpen, CENTRE, tabs, tabOf, tool, pressRow, waitTab, PROVIDER_TAB, MODEL_TAB, PERSONA_TAB, JOB_TAB, again, stacked, before, chatWords, chat, styleOf, closed, hadPersona, opened, afterClose, hadJob, hadBundle, fresh, filled, saved, onlyOne, threw;
  test.after(async function () {
    try { if (c && c.sock) c.sock.close(); if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
    try { if (c && c.profile) fs.rmSync(c.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    try { if (N && N.child) N.child.kill(); } catch (e) { /* gone */ }
    try { if (N && N.root) LABH.freeTree(N); } catch (e) { /* scratch */ }
  });
  test.run('the agent server answers, and a provider stands', 0.2, async function () {
    if (STOP) return STOP;
      N = await scratchNode();
      c = null;
    if (!N.up) { STOP = 'the scratch node did not come up: nothing judged'; return STOP; }
    home = async function (verb, args) {
      const r = await fetch(N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
      const text = await r.text();
      return { status: r.status, text: text, body: parsed(text) };
    };
    // active is its one switch (goal/G43.13).
    await home('app.active', { key: 'agent', active: true });
    P = null;
    await until(function () { return home('agent.provider', { op: 'add', icon: ICON.provider, label: 'zzProvider', url: 'http://192.0.2.1:9/' }).then(function (a) { P = a; return a.status === 200 && !!(a.body && a.body.id); }); }, 20000);
    return (!!(P && P.body && P.body.id)) ? true : 'nothing judged: ' + short(P && P.text);
  }, test.limit.slow);
  test.run('and a model, a persona and a job', 0.2, async function () {
    if (STOP) return STOP;
    if (!(P && P.body && P.body.id)) { STOP = 'nothing judged: an earlier test of this part failed'; return STOP; }
    M = await home('agent.model', { op: 'add', icon: ICON.model, label: 'zzModel', providerId: P.body.id });
    Pe = await home('agent.persona', { op: 'add', icon: ICON.persona, label: 'zzPersona', persona: 'zz', bundle: 'zz', provider: P.body.id });
    J = await home('agent.job', { op: 'add', icon: ICON.job, label: 'zzJob', job: 'zz', bundle: 'zz', provider: P.body.id, persona: Pe.body && Pe.body.id });
    return (M.status === 200 && Pe.status === 200 && J.status === 200) ? true : 'nothing judged: ' + short([M.text, Pe.text, J.text]);
  }, test.limit.quick);
  test.run('and a bundle of the node\'s', 0.2, async function () {
    if (STOP) return STOP;
    B = await home('auth.bundle', { op: 'add', label: 'zzNodeBundle' });
    return (B.status === 200) ? true : 'auth.bundle: ' + short(B.text);
  }, test.limit.quick);
  test.run('the Agent app opens', 0.2, async function () {
    if (STOP) return STOP;
    where = findChrome();
    if (!where) { STOP = 'no Chrome here: nothing judged'; return STOP; }
    c = await chromePage(where);
    if (c.error) { STOP = 'Chrome: ' + c.error; return STOP; }
    await c.send('Page.navigate', { url: N.base + '/face.html' });
    await until(function () { return c.evaluate('!!(window.spirit && window.spirit.event)'); }, 20000);
    LEAF = 'function leaf(w, within) { var root = within ? document.querySelector(within) : document; if (!root) return null; return Array.prototype.slice.call(root.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && e.textContent.trim() === w && !Array.prototype.some.call(e.children, function (k) { return k.textContent.trim() === w; }); })[0] || null; }';
    press = function (words, within) { return c.evaluate('(function () { ' + LEAF + ' var e = leaf(' + JSON.stringify(words) + ', ' + JSON.stringify(within || '') + '); if (!e) return false; e.click(); return true; }())'); };
    // The Agent opens from the appSelector's tiles, as the shell app makes them (goal/G43.13).
    await c.evaluate('(function () { var b = document.createElement("div"); b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { spirit.element.spirit.app.app.element.create(b, { face: "tiles" }); return 1; }); }())');
    await until(function () { return press('Agent'); }, 20000);
    await until(function () { return c.evaluate('!!document.querySelector("[data-tool=provider]")'); }, 10000);
    appOpen = await c.evaluate('!!document.querySelector("[data-tool=provider]")');
    return (appOpen) ? true : 'no Agent app, nothing judged: ' + short(await c.evaluate('document.body.innerText'));
  }, test.limit.slow);
  // ── a tabContainer stands in the centre, from the start ──
  test.run('with nothing opened, it is there', 0.2, async function () {
    if (STOP) return STOP;
    if (!appOpen) { STOP = 'nothing judged: an earlier test of this part failed'; return STOP; }
    CENTRE = '[id$="center"]';
    tabs = function () { return c.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).map(function (b) { return { text: b.textContent.replace(/✕/g, "").replace(/\\s+/g, " ").trim(), on: b.getAttribute("aria-selected") === "true", close: !!b.querySelector("[data-tab-close]") }; }))').then(function (t) { return parsed(t) || []; }); };
    tabOf = async function (words) { return (await tabs()).filter(function (t) { return t.text === words; }); };
    // A tool is opened, never toggled: a press on the one already shown collapses it (workBench.js, data-current).
    tool = function (name) { return c.evaluate('(function () { var b = document.querySelector("[data-tool=' + name + ']"); if (!b) return false; if (!b.hasAttribute("data-current")) b.click(); return true; }())'); };
    // A row of a tool's list, by its label, outside the centre.
    pressRow = function (label) { return c.evaluate('(function () { var all = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && !e.closest(' + JSON.stringify(CENTRE) + ') && e.textContent.trim() === ' + JSON.stringify(label) + ' && !Array.prototype.some.call(e.children, function (k) { return k.textContent.trim() === ' + JSON.stringify(label) + '; }); }); if (!all[0]) return false; all[0].click(); return true; }())'); };
    waitTab = function (words) { return until(function () { return tabOf(words).then(function (t) { return t.length > 0; }); }, 6000); };

    return (await c.evaluate('!!document.querySelector(' + JSON.stringify(CENTRE + ' .tab-content') + ')')) ? true : 'no tabContainer in the centre';
  }, test.limit.quick);
  test.run('with no tabs yet', 0.2, async function () {
    if (STOP) return STOP;
    return ((await tabs()).length === 0) ? true : 'tabs before anything was opened: ' + short(await tabs());
  }, test.limit.quick);
  // ── each kind of row opens a closable tab, named by the box ──
async function tabOpens(kind, row) {
  const words = ICON[kind] + ' ' + row;
  const shown = await tool(kind);
  await until(function () { return pressRow(row); }, 6000);
  await waitTab(words);
  const t = await tabOf(words);
  return { opens: !!(shown && t.length === 1 && t[0].on), opensSays: kind + ': tabs ' + short(await tabs()), closable: !!(t.length === 1 && t[0].close), closableSays: kind + ': no close button: ' + short(t) };
}
  test.run('a provider row opens a tab named by its icon and label, and it is active', 0.2, async function () {
    if (STOP) return STOP;

    // One kind of row at a time, each check its own plain title (goal/G45.6): its tab reads its table's icon and the row's label.
    PROVIDER_TAB = await tabOpens('provider', 'zzProvider');
    return (PROVIDER_TAB.opens) ? true : PROVIDER_TAB.opensSays;
  }, test.limit.quick);
  test.run('the provider row\'s tab has a close button', 0.2, async function () {
    if (STOP) return STOP;
    return (PROVIDER_TAB.closable) ? true : PROVIDER_TAB.closableSays;
  }, test.limit.quick);
  test.run('a model row opens a tab named by its icon and label, and it is active', 0.2, async function () {
    if (STOP) return STOP;
    MODEL_TAB = await tabOpens('model', 'zzModel');
    return (MODEL_TAB.opens) ? true : MODEL_TAB.opensSays;
  }, test.limit.quick);
  test.run('the model row\'s tab has a close button', 0.2, async function () {
    if (STOP) return STOP;
    return (MODEL_TAB.closable) ? true : MODEL_TAB.closableSays;
  }, test.limit.quick);
  test.run('a persona row opens a tab named by its icon and label, and it is active', 0.2, async function () {
    if (STOP) return STOP;
    PERSONA_TAB = await tabOpens('persona', 'zzPersona');
    return (PERSONA_TAB.opens) ? true : PERSONA_TAB.opensSays;
  }, test.limit.quick);
  test.run('the persona row\'s tab has a close button', 0.2, async function () {
    if (STOP) return STOP;
    return (PERSONA_TAB.closable) ? true : PERSONA_TAB.closableSays;
  }, test.limit.quick);
  test.run('a job row opens a tab named by its icon and label, and it is active', 0.2, async function () {
    if (STOP) return STOP;
    JOB_TAB = await tabOpens('job', 'zzJob');
    return (JOB_TAB.opens) ? true : JOB_TAB.opensSays;
  }, test.limit.quick);
  test.run('the job row\'s tab has a close button', 0.2, async function () {
    if (STOP) return STOP;
    return (JOB_TAB.closable) ? true : JOB_TAB.closableSays;
  }, test.limit.quick);
  // ── a row already open: its tab is made active, no second one ──
  test.run('the provider\'s tab is active again, and alone', 0.2, async function () {
    if (STOP) return STOP;

    await tool('provider');
    await until(function () { return pressRow('zzProvider'); }, 6000);
    await sleep(500);
    again = await tabOf(ICON.provider + ' zzProvider');
    return (again.length === 1 && again[0].on) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  // ── a tab has one listener on its row, and lets go of it when it closes ──
  test.run('three more presses on an open row add no listener', 0.2, async function () {
    if (STOP) return STOP;

    // Who listens, listens once: a press on a row that has its tab adds no second listener, and closing a tab lets go of its own.
    // A row's listeners are counted where the tab and its editor ask for them: the agent family's cache, its table's watch(id, fn) (goal/G43.32:
    // a reader asks its family's cache, which alone names its addresses).
    await c.evaluate('(function () { var A = window.spirit.data.agent.data; window.__live = 0; window.__rowPath = ' + JSON.stringify('/' + P.body.id) + '; A.tables.forEach(function (t) { var B = A[t]; var made = B.watch; B.watch = function (id, fn) { var mine = typeof id === "string" && "/" + id === window.__rowPath; var off = made.call(B, id, fn); if (!mine) return off; window.__live++; var done = false; return function () { if (!done) { done = true; window.__live--; } return off(); }; }; }); return true; }())');
    for (let i = 0; i < 3; i++) { await pressRow('zzProvider'); await sleep(250); }
    stacked = await c.evaluate('window.__live');
    return (stacked === 0) ? true : stacked + ' more listeners on that row after three presses';
  }, test.limit.slow);
  // ── the tabs stay when the left tool changes ──
  test.run('showing another tool closes none of the open tabs', 0.2, async function () {
    if (STOP) return STOP;

    before = (await tabs()).length;
    await tool('job');
    await sleep(500);
    return (before >= 4 && (await tabs()).length === before) ? true : 'before ' + before + ', after ' + short(await tabs());
  }, test.limit.quick);
  // ── a chat is a tab of its own beside its persona's ──
  test.run('a persona picked opens its chat as a tab named by the chat icon and the persona, and it is active', 0.2, async function () {
    if (STOP) return STOP;

    await tool('chat');
    await until(function () { return pressRow('zzPersona'); }, 6000);
    chatWords = CHAT + ' zzPersona';
    await waitTab(chatWords);
    chat = await tabOf(chatWords);
    return (chat.length === 1 && chat[0].on) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  test.run('and the persona\'s own tab is still there', 0.2, async function () {
    if (STOP) return STOP;
    return ((await tabOf(ICON.persona + ' zzPersona')).length === 1) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  // ── a bundle's tab: its name; not the node's: in brackets and italic ──
  test.run('a node\'s bundle: "zzNodeBundle" alone', 0.2, async function () {
    if (STOP) return STOP;

    await tool('bundles');
    await until(function () { return pressRow('zzNodeBundle'); }, 6000);
    await waitTab('zzNodeBundle');
    return ((await tabOf('zzNodeBundle')).length === 1) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  test.run('in plain print', 0.2, async function () {
    if (STOP) return STOP;
    styleOf = function (words) { return c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(words) + ') !== -1; })[0]; if (!b) return null; var all = [b].concat(Array.prototype.slice.call(b.querySelectorAll("*"))); return all.some(function (e) { return e.textContent.indexOf(' + JSON.stringify(words) + ') !== -1 && getComputedStyle(e).fontStyle === "italic"; }); }())'); };
    return ((await styleOf('zzNodeBundle')) === false) ? true : 'a node\'s bundle: italic ' + (await styleOf('zzNodeBundle'));
  }, test.limit.quick);
  // ── a label changed anywhere: its tab says so ──
  test.run('the model\'s header follows its row', 0.2, async function () {
    if (STOP) return STOP;

    await home('agent.model', { op: 'set', id: M.body.id, label: 'zzModelTwo' });
    await waitTab(ICON.model + ' zzModelTwo');
    return ((await tabOf(ICON.model + ' zzModelTwo')).length === 1 && (await tabOf(ICON.model + ' zzModel')).length === 0) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  // ── the close button takes a tab away, and the row stays ──
  test.run('its tab is gone', 0.2, async function () {
    if (STOP) return STOP;

    closed = await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf("zzModelTwo") !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (!k) return false; k.click(); return true; }())');
    await until(function () { return tabOf(ICON.model + ' zzModelTwo').then(function (t) { return !t.length; }); }, 4000);
    return (closed === true && (await tabOf(ICON.model + ' zzModelTwo')).length === 0) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  test.run('the model is still there', 0.2, async function () {
    if (STOP) return STOP;
    return ((await home('agent.model', { op: 'get', id: M.body.id })).status === 200) ? true : 'closing its tab deleted the model';
  }, test.limit.quick);
  // ── a closed tab listens no more ──
  test.run("opened again, the listeners of the tab and of its editor, one each", 0.2, async function () {
    if (STOP) return STOP;

    await c.evaluate('window.__rowPath = ' + JSON.stringify('/' + Pe.body.id) + '; window.__live = 0; 1');
    await tool('persona');
    hadPersona = (await tabOf(ICON.persona + ' zzPersona')).length === 1;
    await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(ICON.persona + ' zzPersona') + ') !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (k) k.click(); }())');
    await until(function () { return tabOf(ICON.persona + ' zzPersona').then(function (t) { return !t.length; }); }, 4000);
    await until(function () { return pressRow('zzPersona'); }, 6000);
    await waitTab(ICON.persona + ' zzPersona');
    opened = await c.evaluate('window.__live');
    await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(ICON.persona + ' zzPersona') + ') !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (k) k.click(); }())');
    await until(function () { return tabOf(ICON.persona + ' zzPersona').then(function (t) { return !t.length; }); }, 4000);
    afterClose = await c.evaluate('window.__live');
    // Two, each once: the tab follows its row, and the row's own editor (agentRow) watches the same path to repaint itself.
    return (hadPersona && opened === 2) ? true : 'it had a tab ' + hadPersona + ', then ' + opened + ' listeners';
  }, test.limit.quick);
  test.run('closed, none', 0.2, async function () {
    if (STOP) return STOP;
    return (afterClose === 0) ? true : afterClose + ' listeners after its tab closed';
  }, test.limit.quick);
  // ── a row deleted elsewhere closes its tab ──
  test.run('the job\'s tab closes itself', 0.2, async function () {
    if (STOP) return STOP;

    hadJob = (await tabOf(ICON.job + ' zzJob')).length === 1;
    await home('agent.job', { op: 'delete', id: J.body.id });
    await until(function () { return tabOf(ICON.job + ' zzJob').then(function (t) { return !t.length; }); }, 5000);
    return (hadJob && (await tabOf(ICON.job + ' zzJob')).length === 0) ? true : hadJob ? 'the tab stayed: ' + short(await tabs()) : 'it never had a tab: nothing judged';
  }, test.limit.quick);
  test.run('the bundle\'s too', 0.2, async function () {
    if (STOP) return STOP;
    hadBundle = (await tabOf('zzNodeBundle')).length === 1;
    await home('auth.bundle', { op: 'delete', id: B.body.id });
    await until(function () { return tabOf('zzNodeBundle').then(function (t) { return !t.length; }); }, 5000);
    return (hadBundle && (await tabOf('zzNodeBundle')).length === 0) ? true : hadBundle ? 'the tab stayed: ' + short(await tabs()) : 'it never had a tab: nothing judged';
  }, test.limit.quick);
  // ── Add: "new <row-type>*", until it is saved; then it is that row's tab ──
  test.run('a tab reading "new provider*" opens, and is active', 0.2, async function () {
    if (STOP) return STOP;

    await tool('provider');
    await until(function () { return press('Add a provider'); }, 6000);
    await waitTab('new provider*');
    fresh = await tabOf('new provider*');
    return (fresh.length === 1 && fresh[0].on) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  test.run('its fields are filled', 0.2, async function () {
    if (STOP) return STOP;
    filled = await c.evaluate('(function () { var box = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-content > *') + ')).filter(function (x) { return !x.hidden; })[0]; if (!box) return "no box"; var inputs = Array.prototype.slice.call(box.querySelectorAll("input")); var set = function (word, v) { var i = inputs.filter(function (x) { return x.id.slice(-word.length - 1) === "-" + word.toLowerCase(); })[0]; if (!i) return false; i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); return true; }; return set("Label", "zzSaved") && set("URL", "http://192.0.2.2:9/") ? "ok" : "fields: " + box.textContent.slice(0, 200); }())');
    return (filled === 'ok') ? true : 'the form: ' + short(filled);
  }, test.limit.quick);
  test.run('saved: its header is the row\'s', 0.2, async function () {
    if (STOP) return STOP;
    await press('Add new Provider');
    await until(function () { return tabs().then(function (ts) { return ts.some(function (t) { return t.text.indexOf('zzSaved') !== -1; }); }); }, 6000);
    saved = (await tabs()).filter(function (t) { return t.text.indexOf('zzSaved') !== -1; });
    return (saved.length === 1 && saved[0].on) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  test.run('and "new provider*" is gone', 0.2, async function () {
    if (STOP) return STOP;
    return ((await tabOf('new provider*')).length === 0) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  test.run('pressing that row in the list activates it: no second tab', 0.2, async function () {
    if (STOP) return STOP;
    await until(function () { return pressRow('zzSaved'); }, 6000);
    await sleep(600);
    onlyOne = (await tabs()).filter(function (t) { return t.text.indexOf('zzSaved') !== -1; });
    return (onlyOne.length === 1 && onlyOne[0].on) ? true : 'tabs ' + short(await tabs());
  }, test.limit.quick);
  test.run('nothing threw in the page', 0.2, async function () {
    if (STOP) return STOP;
    threw = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text + ' ' + short((m.params.exceptionDetails.exception || {}).description || ''); });
    return (!threw.length) ? true : 'the page threw: ' + threw.slice(0, 2).join(' | ');
  }, test.limit.quick);
}

// ── THE listBoxes PART ────────────────────────────────────────
{
  // The listBoxes part of ./agent.js.
  // The tests of spirit/app/agent/agent.js as one app, and of no other module (spec: ./agent.md, its listBoxes section; goal/G41.18): every list
  // pane it draws stands in a box of a stated size, each box above it up to the app too (rule/16). The app runs on a small
  // page, with the real workBench, the real table elements in it; the search element is a
  // recorder that keeps the box each list was made in, and the selectors and the agent server are stand-ins.

  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const RUN = path.resolve(__dirname, '../../../..');
  const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
  const familyPath = require(path.join(RUN, 'spirit', 'spirit.js')).familyPath;

  const FILE = path.join(__dirname, '..', 'element.js');
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  const settle = async function () { for (let i = 0; i < 30; i++) await new Promise(function (r) { setImmediate(r); }); };

  // ── THE PAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  // The small forgiving page Desk's suite drives (spirit/app/desk/element/desk/test/desk.js), copied as it is: markup parsed into elements,
  // with ids, attributes, parents, closest and simple selectors, and a click that reaches every listener above its
  // target. Desk keeps its own while it lives (Andy: "do all but desk").
  const VOID = { input: 1, br: 1, img: 1, hr: 1, meta: 1, link: 1 };
  function makeDom() {
    const doc = {};
    function el(tag) {
      const attrs = {}; const heard = {};
      const e = { tagName: String(tag || 'div').toUpperCase(), children: [], parentNode: null, style: {}, value: '', hidden: false, disabled: false, type: '', title: '', _text: '',
        get id() { return attrs.id || ''; }, set id(v) { attrs.id = String(v); },
        get className() { return attrs.class || ''; }, set className(v) { attrs.class = String(v); },
        get firstChild() { return e.children[0] || null; },
        get nextSibling() { const k = e.parentNode ? e.parentNode.children : []; return k[k.indexOf(e) + 1] || null; },
        get isConnected() { let p = e; while (p.parentNode) p = p.parentNode; return p === doc.root; },
        get textContent() { return e.children.length ? e.children.map(function (c) { return c.textContent; }).join('') : e._text; },
        set textContent(v) { e.children = []; e._text = String(v == null ? '' : v); },
        get innerHTML() { return e._html || ''; },
        set innerHTML(v) { e._html = String(v); e.children = []; e._text = ''; parseInto(e, String(v)); },
        getAttribute: function (k) { if (k === 'id') return attrs.id || null; return k in attrs ? attrs[k] : null; },
        setAttribute: function (k, v) { attrs[k] = String(v); },
        removeAttribute: function (k) { delete attrs[k]; },
        hasAttribute: function (k) { return k in attrs; },
        classList: { add: function (c) { const l = (attrs.class || '').split(/\s+/).filter(Boolean); if (l.indexOf(c) === -1) l.push(c); attrs.class = l.join(' '); },
          remove: function (c) { attrs.class = (attrs.class || '').split(/\s+/).filter(function (x) { return x && x !== c; }).join(' '); },
          contains: function (c) { return (attrs.class || '').split(/\s+/).indexOf(c) !== -1; },
          toggle: function (c, on) { if (on === undefined ? !e.classList.contains(c) : on) e.classList.add(c); else e.classList.remove(c); } },
        appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; e.children.push(c); return c; },
        insertBefore: function (c, ref) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = e; const i = e.children.indexOf(ref); if (i === -1) e.children.push(c); else e.children.splice(i, 0, c); return c; },
        removeChild: function (c) { const i = e.children.indexOf(c); if (i !== -1) e.children.splice(i, 1); c.parentNode = null; return c; },
        replaceChild: function (n, o) { const i = e.children.indexOf(o); if (n.parentNode) n.parentNode.removeChild(n); n.parentNode = e; if (i !== -1) e.children[i] = n; o.parentNode = null; return o; },
        remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
        addEventListener: function (t, fn) { (heard[t] = heard[t] || []).push(fn); },
        removeEventListener: function (t, fn) { heard[t] = (heard[t] || []).filter(function (f) { return f !== fn; }); },
        dispatch: function (t, ev) { (heard[t] || []).slice().forEach(function (fn) { fn(ev); }); },
        closest: function (sel) { let p = e; while (p && p.tagName) { if (matches(p, sel)) return p; p = p.parentNode; } return null; },
        matches: function (sel) { return matches(e, sel); },
        querySelectorAll: function (sel) { const out = []; (function walk(n) { n.children.forEach(function (c) { if (matches(c, sel)) out.push(c); walk(c); }); }(e)); return out; },
        querySelector: function (sel) { return e.querySelectorAll(sel)[0] || null; },
        focus: function () {}, blur: function () {}, scrollIntoView: function () {}, getBoundingClientRect: function () { return { top: 0, left: 0, width: 0, height: 0 }; },
        attrs: attrs,
      };
      return e;
    }
    function one(n, sel) {
      sel = sel.trim();
      const m = /^([a-z]*)((?:#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\])*)$/i.exec(sel);
      if (!m) return false;
      if (m[1] && n.tagName !== m[1].toUpperCase()) return false;
      const parts = m[2].match(/#[\w-]+|\.[\w-]+|\[[\w-]+(?:="[^"]*")?\]/g) || [];
      return parts.every(function (p) {
        if (p[0] === '#') return n.getAttribute('id') === p.slice(1);
        if (p[0] === '.') return n.classList.contains(p.slice(1));
        const a = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(p);
        return a[2] === undefined ? n.hasAttribute(a[1]) : n.getAttribute(a[1]) === a[2];
      });
    }
    // A descendant selector, "a b": the last part on the element, each part before it on an element above it.
    function chain(n, s) {
      const parts = s.trim().split(/\s+/);
      if (!one(n, parts[parts.length - 1])) return false;
      let p = n.parentNode;
      for (let i = parts.length - 2; i >= 0; i--) { while (p && !(p.tagName && one(p, parts[i]))) p = p.parentNode; if (!p) return false; p = p.parentNode; }
      return true;
    }
    function matches(n, sel) { return String(sel).split(',').some(function (s) { return chain(n, s); }); }
    function unesc(s) { return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&amp;/g, '&'); }
    function parseInto(root, html) {
      const stack = [root];
      const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>|([^<]+)/g; let m;
      let raw = null;
      while ((m = re.exec(html))) {
        const top = stack[stack.length - 1];
        if (raw) { if (m[1] === '/' && m[2] && m[2].toLowerCase() === raw) { stack.pop(); raw = null; } continue; }
        if (m[5] !== undefined) { if (m[5].trim() || top.children.length === 0) { const t = el('#text'); t._text = unesc(m[5]); t.tagName = '#TEXT'; top.children.push(t); t.parentNode = top; } continue; }
        if (!m[2]) continue;
        const tag = m[2].toLowerCase();
        if (m[1] === '/') { for (let i = stack.length - 1; i > 0; i--) { if (stack[i].tagName === tag.toUpperCase()) { stack.length = i; break; } } continue; }
        const n = el(tag);
        const ar = /([\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g; let a;
        while ((a = ar.exec(m[3]))) n.attrs[a[1]] = unesc(a[3] !== undefined ? a[3] : a[4] !== undefined ? a[4] : a[5] !== undefined ? a[5] : '');
        if ('hidden' in n.attrs) n.hidden = true;
        if ('disabled' in n.attrs) n.disabled = true;
        if (n.attrs.type) n.type = n.attrs.type;
        if (n.attrs.title) n.title = n.attrs.title;
        if (n.attrs.value) n.value = n.attrs.value;
        n.parentNode = top; top.children.push(n);
        if (!VOID[tag] && !m[4]) { stack.push(n); if (tag === 'style' || tag === 'script') raw = tag; }
      }
    }
    doc.root = el('html');
    doc.body = doc.root.appendChild(el('body'));
    doc.head = doc.root.appendChild(el('head'));
    doc.documentElement = doc.root;
    doc.readyState = 'complete';
    doc.createElement = function (t) { return el(t); };
    doc.createTextNode = function (t) { const n = el('#text'); n._text = String(t); return n; };
    doc.getElementById = function (id) { return doc.root.querySelector('#' + id); };
    doc.querySelector = function (s) { return doc.root.querySelector(s); };
    doc.querySelectorAll = function (s) { return doc.root.querySelectorAll(s); };
    doc.addEventListener = function () {};
    doc.removeEventListener = function () {};
    // A click on an element, bubbling to every listener above it.
    doc.click = function (t) {
      const ev = { type: 'click', target: t, preventDefault: function () {}, stopPropagation: function () {} };
      let p = t; while (p) { if (p.dispatch) p.dispatch('click', ev); p = p.parentNode; }
    };
    return doc;
  }

  // The real files the app and its elements load, run on the page when they are required; anything else is answered and
  // not run.
  const REAL = [
    'spirit/data.js', 'spirit/element/workBench.js', 'spirit/element/tabContainer.js', 'spirit/app/agent/element/table/tableElement.js', 'spirit/app/agent/element/table/rowElement.js',
    'spirit/app/agent/element/table/provider/elementTable.js', 'spirit/app/agent/element/table/provider/elementRow.js',
    'spirit/app/agent/element/table/model/elementTable.js', 'spirit/app/agent/element/table/model/elementRow.js', 'spirit/element/busyButton.js',
    // The one-row form and the icon it draws with (goal/G41.27): the model table's Ask form is one.
    'spirit/element/rowForm.js', 'spirit/element/icon.js',
    'spirit/app/agent/element/table/persona/elementTable.js', 'spirit/app/agent/element/table/persona/elementRow.js',
    'spirit/app/agent/element/table/job/elementTable.js', 'spirit/app/agent/element/table/job/elementRow.js',
  ];

  function world() {
    const document = makeDom();
    const panes = [];
    const loaded = {};
    const win = { document: document, setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () { return 0; }, clearInterval: function () {},
      Promise: Promise, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Date: Date, Math: Math, RegExp: RegExp, Error: Error, Proxy: Proxy,
      console: { log: function () {}, error: function () {}, warn: function () {} }, localStorage: { getItem: function () { return null; }, setItem: function () {} },
      location: { hash: '', hostname: '127.0.0.1' }, addEventListener: function () {} };
    win.window = win;
    // The agent server: every verb answers an empty table.
    const family = new Proxy({}, { get: function (o, verb) { if (verb === 'then') return undefined; return function () { return Promise.resolve({ items: [], more: false }); }; } });
    // A selector stand-in in the shell's element shape (goal/G41.19): create(container, options) appends it and answers it.
    const selector = { create: function (c) { const s = document.createElement('span'); c.appendChild(s); return s; } };
    win.spirit = {
      escapeHtml: function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); },
      familyPath: familyPath, isBrowser: function () { return true; },
      fs: { loadFile: function () { return Promise.reject(new Error('none')); }, saveFile: function () { return Promise.resolve(); } },
      tree: function () { return Promise.resolve({}); },
      // goal/G43.32: the stand-ins stand where the elements read them, at spirit.element.<their path>.
      element: { spirit: { app: {}, element: nestSearch({
        // The recorder: the box each list is made in, and whether it is a dropdown.
        'search': { create: function (host, o) { panes.push({ host: host, o: o || {} }); return { refresh: function () {}, redraw: function () {}, destroy: function () {}, value: '' }; } },
        'search.contact': selector, 'search.bundle': selector, 'search.api': selector,
        // The server tool's three (goal/G43.15): the app's icon and label and its DEBUG switch, each a rowForm on the page.
        // A stand-in that draws a span and answers destroy, as the server panel asks of them.
        'search.app.changeAppIcon': { create: function (c) { c.appendChild(document.createElement('span')); return { destroy: function () {} }; } },
        'search.app.changeAppLabel': { create: function (c) { c.appendChild(document.createElement('span')); return { destroy: function () {} }; } },
        'search.app.serverDEBUG': { create: function (c) { c.appendChild(document.createElement('span')); return { destroy: function () {} }; } },
      }) } },
      require: function (p) {
        const rel = String(p).replace(/^\/+/, '');
        if (rel === familyPath('agent')) return Promise.resolve(family);
        if (REAL.indexOf(rel) !== -1 && !loaded[rel]) { loaded[rel] = true; vm.runInContext(fs.readFileSync(path.join(RUN, rel), 'utf8'), win, { filename: rel }); }
        return Promise.resolve({});
      },
      // A family's cache (goal/G41.28): the family's own manager, a node family's or its server's, run on this page over
      // the real data set.
      cacheManager: function (name) {
        const at = ['spirit/' + name + '/data.js', 'spirit/app/' + name + '/data.js'].filter(function (p) { return fs.existsSync(path.join(RUN, p)); })[0];
        if (!at) return Promise.reject(new Error('the family ' + name + ' has no data.js'));
        if (!loaded[at]) { loaded[at] = true; vm.runInContext(fs.readFileSync(path.join(RUN, at), 'utf8'), win, { filename: at }); }
        return Promise.resolve(true);
      },
    };
    win.spirit.ready = Promise.resolve(win.spirit);
    // A page's spirit (spirit/test/headLessChrome.js pageSpirit), so each file places itself by installSpiritElement as it runs.
    require(path.join(RUN, 'spirit', 'test', 'headLessChrome.js')).pageSpirit(win.spirit);
    vm.createContext(win);
    win.spirit.require('spirit/data.js');
    // Its node known (goal/G41.28, Q10), as spirit.start leaves it before any app runs.
    win.spirit.node = { key: 'KEY+AGENT/BOXES==' };
    win.spirit.data.homeNode(win.spirit.node.key);
    vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
    return { document: document, win: win, panes: panes };
  }

  const isFill = function (n) { return (' ' + String(n.className || '') + ' ').indexOf(' fill ') !== -1; };
  // Every box from a list's own up to the app's that is not a fill box.
  function gaps(host, app) {
    const out = [];
    for (let n = host; n && n !== app; n = n.parentNode) if (!isFill(n)) out.push((n.tagName || '?').toLowerCase() + (n.id ? '#' + n.id : '') + (n.className ? '.' + n.className : ''));
    return out;
  }
  const under = function (n, app) { for (let p = n; p; p = p.parentNode) if (p === app) return true; return false; };

  // ── listBoxes: agent.js, as one app: every list in a box of a stated size (rule/16) ──

  // THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
  function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
  let STOP = '';
  let w, app, modelOrder, order, strip, want, PROVIDER_PANE, MODEL_PANE, PERSONA_PANE, JOB_PANE, mo, all, bad, AD, off;
  // ── each tool's list pane ──
async function paneFills(t) {
  const b = strip(t[0]);
  if (!b) return { ok: false, says: 'no strip button for the ' + t[0] + ' tool' };
  w.document.click(b);
  await settle();
  const made = w.panes.filter(function (p) { return p.o.face !== 'dropdown' && p.o.verb === t[1] && under(p.host, app); });
  if (!made.length) return { ok: false, says: 'the ' + t[0] + ' tool drew no list pane' };
  const g = gaps(made[made.length - 1].host, app);
  if (t[0] === 'model') {
    const drop = w.panes.filter(function (p) { return p.o.face === 'dropdown' && p.o.verb === 'provider' && under(p.host, app); }).pop();
    modelOrder = order(app, made[made.length - 1].host, drop ? drop.host : null);
  }
  return { ok: !g.length, says: t[0] + ': not fill: ' + g.join(' < ') };
}
  let READY = null;
  // The app mounted once, its tools then shown one at a time; what it throws where nothing catches it lands on this test.
  test.run('the world: the app on a small page, the real workBench and table elements in it', 0.2, function () {
    if (STOP) return STOP;
    if (!fs.existsSync(FILE)) { STOP = 'spirit/app/agent/element.js is not there'; return STOP; }
    READY = (async function () {
      // Andy, on G41.18: "the lists violate: rule/16 — A list gets a box of a stated size. Files and contacts do it right,
      // agents must as well."; "ALL lists, otherwise my took bars at the top of a container keep scrolling away...."; "when a
      // probabilitySearch is in pane-mode it must display 1) filters 2) search input row 3) a pane that uses the rest of the
      // vertical space, all box elements really have to follow to follow that rule", "the agent app must also constrain all
      // it's probability-panes". rule/16: every probabilitySearch in a box of class fill, inside a pane that fills its app.
      // A list drawn as a dropdown stands inline, as every picker in the tree does, and is not asked here.
      w = world();
      app = w.document.body.appendChild(w.document.createElement('div'));
      app.className = 'fill';
      // A tile hands it only its container (goal/G43.13).
      w.win.spirit.element.spirit.app.agent.element.create(app);
      await settle();
      modelOrder = null;
      // Where, in the app's order of elements, the Models title rows, the Ask row (its providerSelector:dropdown, since
      // goal/G41.27 drops the word from), and the model list stand.
      order = function (root, host, askRow) {
        const seq = [];
        (function walk(n) { n.children.forEach(function (c) { seq.push(c); walk(c); }); }(root));
        const titles = seq.filter(function (n) { return n.classList && n.classList.contains('agent-title') && /Models/.test(n.textContent); });
        return { titles: titles.length, title: titles.length ? seq.indexOf(titles[0]) : -1, from: askRow ? seq.indexOf(askRow) : -1, list: seq.indexOf(host) };
      };
      strip = function (name) { return w.document.querySelectorAll('[data-tool]').filter(function (b) { return b.getAttribute('data-tool') === name; })[0]; };

      // goal/G41.21: the grant tool went with agent.grant.
      want = [['provider', 'provider'], ['model', 'model'], ['persona', 'persona'], ['job', 'job']];
      // One tool at a time, each check its own plain title (goal/G45.6: a title has no value built into it).

    }());
    return READY.then(function () { return true; });
  }, test.limit.quick);
  test.run('the provider tool\'s list stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
    if (STOP) return STOP;
    if (!READY) return 'no app: the world failed';
    await READY;
    PROVIDER_PANE = await paneFills(want[0]);
    return (PROVIDER_PANE.ok) ? true : PROVIDER_PANE.says;
  }, test.limit.quick);
  test.run('the model tool\'s list stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
    if (STOP) return STOP;
    MODEL_PANE = await paneFills(want[1]);
    return (MODEL_PANE.ok) ? true : MODEL_PANE.says;
  }, test.limit.quick);
  test.run('the persona tool\'s list stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
    if (STOP) return STOP;
    PERSONA_PANE = await paneFills(want[2]);
    return (PERSONA_PANE.ok) ? true : PERSONA_PANE.says;
  }, test.limit.quick);
  test.run('the job tool\'s list stands in a fill box, and every box up to the app is fill too', 0.2, async function () {
    if (STOP) return STOP;
    JOB_PANE = await paneFills(want[3]);
    return (JOB_PANE.ok) ? true : JOB_PANE.says;
  }, test.limit.quick);
  // ── the 🧠 Models pane: its title row first (goal/G41.26) ──
  test.run('the pane draws one 🧠 Models title row', 0.2, async function () {
    if (STOP) return STOP;

    // Andy, on G41.26: "i the left side models panel: the title row \"🧠Models\" must come before the \"from [🛖 Unsloth
    // Studio ▾] [Ask] row."
    mo = modelOrder || {};
    return (mo.titles === 1) ? true : 'title rows saying Models: ' + mo.titles;
  }, test.limit.quick);
  test.run('the title row comes before the Ask row, its providerSelector:dropdown', 0.2, async function () {
    if (STOP) return STOP;
    return (mo.title !== -1 && mo.from !== -1 && mo.title < mo.from) ? true : 'title at ' + mo.title + ', from at ' + mo.from;
  }, test.limit.quick);
  test.run('and the model list after it', 0.2, async function () {
    if (STOP) return STOP;
    return (mo.from !== -1 && mo.list !== -1 && mo.from < mo.list) ? true : 'from at ' + mo.from + ', list at ' + mo.list;
  }, test.limit.quick);
  // ── every list pane the app drew ──
  test.run('every list pane the app draws stands in a fill box, none only as tall as its content', 0.2, async function () {
    if (STOP) return STOP;

    all = w.panes.filter(function (p) { return p.o.face !== 'dropdown' && under(p.host, app); });
    bad = all.map(function (p) { return { verb: p.o.verb, gaps: gaps(p.host, app) }; }).filter(function (x) { return x.gaps.length; });
    return (all.length >= 4 && !bad.length) ? true : all.length + ' panes; not fill: ' + short(bad);
  }, test.limit.quick);
  // ── each list pane is a view of its table in the agent family's cache (goal/G41.28) ──
  test.run('every list pane is handed its table\'s branch, spirit.data.agent.data.branch(table)', 0.2, async function () {
    if (STOP) return STOP;

    AD = ((w.win.spirit.data || {}).agent || {}).data;
    off = all.filter(function (p) { return !AD || !p.o.data || p.o.data !== AD.branch(p.o.verb); }).map(function (p) { return { verb: p.o.verb, data: p.o.data }; });
    return (!!AD && all.length >= 4 && !off.length) ? true : 'agentReads ' + !!AD + ', not its branch: ' + short(off);
  }, test.limit.quick);
}
