'use strict';

// spirit/run/spirit/app/agent/test/agent.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md). The centreTabs and listBoxes
// parts judge what spirit/app/agent/element.js draws, so they are its test's: ./element.js (goal/G47.1).
// The tests of spirit/app/agent/agent.js, and of the Agent as Andy sees it (spec: ./agent.md; goal/G43.13). Andy: "Make
// spirit/app/agent/ work". A real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector,
// made as the shell app (spirit/element/script.js) makes it. Neither Andy's node nor an agent's is touched.

// One test.run per test (goal/G47.2): each part is a block of its own, its tests in order; a step that leaves nothing to
// judge sets the part's STOP, and every later test of that part fails saying so.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const RUN = path.resolve(__dirname, '../../../..');
const S = require(path.join(RUN, 'spirit', 'script.js'));
// Every node this test uses is one of lab's (goal/G47.3): its tree by scratchTree, its node by startNodeOn.
const LABH = S.requireScript('spirit/test/headLessChrome.js');
const REPO = path.resolve(RUN, '..', '..');
const test = S.requireScript('spirit/test/testReport.js');
const { freePort, until, sleep, chromePage, findChrome } = S.requireScript('spirit/test/headLessChrome.js');

function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } }

// The app is known by its id, its folder's path in dots (goal/G49.19): its job's module, its key, its calls and its data family.
const MODULE = 'spirit.app.agent';
const ROWS = { provider: 'zzProvider', model: 'zzModel', persona: 'zzPersona', job: 'zzJob' };

function scratch() {
  const root = LABH.scratchTree().root;
  return { root: root, run: path.join(root, 'spirit', 'run') };
}
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
async function liveJob(base) {
  const found = await call(base, 'spirit.job.search', { q: '' });
  const rows = await Promise.all(((found.body && found.body.items) || []).map(function (i) { return call(base, 'spirit.job.get', { key: i.key }); }));
  return rows.map(function (r) { return r.body && r.body.job; }).filter(function (j) { return !!j && j.kind === 'server' && j.module === MODULE && (j.status === 'running' || j.status === 'pending'); })[0] || null;
}
function answers(r) { return r.status === 200 && !!r.body && typeof r.body.debug === 'boolean'; }
// The server is up when appServer's DEBUG answers (its own debug verb went in goal/G43.15).
function serverUp(base) { return until(function () { return call(base, MODULE + '.DEBUG', {}).then(answers); }, 30000); }
// Every file under a folder.
function filesUnder(dir) {
  const out = [];
  (function walk(d) { (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []).forEach(function (e) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else out.push(p); }); }(dir));
  return out;
}

// ── THE Agent PART ────────────────────────────────────────
{
  let STOP = false;
  let s, live, c, N, where, open, selector, shown, shows, press, pressInstaller, tool, pressed, db, P, M, Pe, J, openTile, PROVIDER_ROW, MODEL_ROW, PERSONA_ROW, JOB_ROW, added, liveId, onPage, serverIcon, debugRow, panelRows, kept, page, closed, deact, sidecars, code, old, thrown;
  test.after(async function () {
    (live || []).forEach(function (x) { try { x.kill(); } catch (e) { /* gone */ } });
    if (c && c.kid) { try { c.kid.kill(); } catch (e) { /* gone */ } }
    await sleep(300);
    try { LABH.freeTree(s); } catch (e) { /* a door still closing; the temp folder keeps it */ }
  });
  test.run('a scratch node comes up', 0.2, async function () {
    if (STOP) return false;
      s = scratch();
      live = [];
      c = null;
    N = await boot(s.run); live.push(N.child);
    return (N.up) ? true : false;
  }, test.limit.slow);
  test.run('a Chrome page opens on the node and has its spirit', 0.2, async function () {
    if (STOP) return false;
    if (!N.up) { STOP = true; return false; }
    where = findChrome();
    if (!where) { STOP = true; return false; }
    c = await chromePage(where);
    if (c.error) { STOP = true; return false; }
    open = async function () {
      await c.send('Page.navigate', { url: N.base + '/' });
      return until(function () { return c.evaluate('!!(window.spirit && window.spirit.readyPromise)'); }, 20000);
    };
    return (await open()) ? true : false;
  }, test.limit.slow);
  // ── the box: active is its one switch; before it nothing runs ──
  test.run('before the agent is activated, no server job of it runs', 0.2, async function () {
    if (STOP) return false;
    // The appSelector, as the shell app makes it, over the page. A second call replaces the first.
    selector = function (face) {
      return c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.requireScript("spirit/element/script.js").then(function (E) { window.__sel = E.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
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

    return (!(await liveJob(N.base))) ? true : false;
  }, test.limit.quick);
  test.run('before the agent is activated, its verbs are not answered', 0.2, async function () {
    if (STOP) return false;
    return (!answers(await call(N.base, MODULE + '.DEBUG', {}))) ? true : false;
  }, test.limit.quick);
  test.run('the agent\'s row is in the appSelector\'s pane', 0.2, async function () {
    if (STOP) return false;
    await selector('pane');
    return (await shows('Agent')) ? true : false;
  }, test.limit.quick);
  test.run('the agent has no tile yet', 0.2, async function () {
    if (STOP) return false;
    await selector('tiles');
    await sleep(1500);
    return ((await shown()).indexOf('Agent') === -1) ? true : false;
  }, test.limit.slow);
  // ── the box: "Activate in the appSelector, and the server starts." ──
  test.run('the agent\'s row has an Activate button, and it is pressed', 0.2, async function () {
    if (STOP) return false;

    await selector('pane');
    await shows('Agent');
    pressed = await until(function () { return pressInstaller().then(function (t) { return t === 'Activate'; }); }, 10000);
    return (pressed) ? true : false;
  }, test.limit.quick);
  test.run('once Activate is pressed, the server answers its verbs', 0.2, async function () {
    if (STOP) return false;
    return (await serverUp(N.base)) ? true : false;
  }, test.limit.quick);
  test.run('its server runs as a live job under the agent app\'s id', 0.2, async function () {
    if (STOP) return false;
    if (!answers(await call(N.base, MODULE + '.DEBUG', {}))) { STOP = true; return false; }
    return (!!(await liveJob(N.base))) ? true : false;
  }, test.limit.quick);
  test.run('its rows are kept in spirit/state/app/agent/data/', 0.2, async function () {
    if (STOP) return false;
    db = path.join(s.run, 'spirit', 'state', 'app', 'agent', 'data', 'agent.db');
    return (fs.existsSync(db)) ? true : false;
  }, test.limit.quick);
  test.run('the server takes a provider, a model, a persona and a job', 0.2, async function () {
    if (STOP) return false;

    // Rows for the tables to show, made by the server's verbs as they ever were.
    P = await call(N.base, MODULE + '.provider', { op: 'add', icon: '🧪', label: ROWS.provider, url: 'http://192.0.2.1:9/' });
    M = await call(N.base, MODULE + '.model', { op: 'add', icon: '🧬', label: ROWS.model, providerId: P.body && P.body.id });
    Pe = await call(N.base, MODULE + '.persona', { op: 'add', icon: '🧙', label: ROWS.persona, persona: 'zz', bundle: 'zz', provider: P.body && P.body.id });
    J = await call(N.base, MODULE + '.job', { op: 'add', icon: '🧰', label: ROWS.job, job: 'zz', bundle: 'zz', provider: P.body && P.body.id, persona: Pe.body && Pe.body.id });
    return ([P, M, Pe, J].every(function (r) { return r.status === 200 && r.body && r.body.id; })) ? true : false;
  }, test.limit.quick);
  // ── the box: "The Agent's tile opens, its tables work, and its rows are there" ──
  test.run('its tile opens the app', 0.2, async function () {
    if (STOP) return false;

    openTile = async function () {
      await selector('tiles');
      await shows('Agent');
      await press('Agent');
      return until(function () { return c.evaluate('!!document.querySelector("#zzBox [data-tool=provider]")'); }, 15000);
    };
    return (await openTile()) ? true : false;
  }, test.limit.quick);
async function rowShows(name) { const hit = await tool(name); return !!(hit && await shows(ROWS[name])); }
  test.run('the provider table shows the provider row the test planted', 0.2, async function () {
    if (STOP) return false;
    // One table at a time, each check its own plain title (goal/G45.6: a title has no value built into it).
    PROVIDER_ROW = await rowShows('provider');
    return (PROVIDER_ROW) ? true : false;
  }, test.limit.quick);
  test.run('the model table shows the model row the test planted', 0.2, async function () {
    if (STOP) return false;
    MODEL_ROW = await rowShows('model');
    return (MODEL_ROW) ? true : false;
  }, test.limit.quick);
  test.run('the persona table shows the persona row the test planted', 0.2, async function () {
    if (STOP) return false;
    PERSONA_ROW = await rowShows('persona');
    return (PERSONA_ROW) ? true : false;
  }, test.limit.quick);
  test.run('the job table shows the job row the test planted', 0.2, async function () {
    if (STOP) return false;
    JOB_ROW = await rowShows('job');
    return (JOB_ROW) ? true : false;
  }, test.limit.quick);
  // ── the box: "data.js takes the id spirit.app.agent, not process/js/agent." ──
  test.run('the server adds one more provider', 0.2, async function () {
    if (STOP) return false;

    // The server publishes a row on its job, under its module id; the family's data.js on the page takes it into the store, read at spirit.app.agent.data (goal/G49.23).
    added = await call(N.base, MODULE + '.provider', { op: 'add', icon: '🧪', label: 'zzLive', url: 'http://192.0.2.2:9/' });
    liveId = added.body && added.body.id;
    return (!!liveId) ? true : false;
  }, test.limit.quick);
  test.run('it reaches the page\'s agent branch, its reads at spirit.app.agent.data, with no reload', 0.2, async function () {
    if (STOP) return false;
    // The branch's reads at its data.js's path (goal/G49.23: the store hands out no family by name).
    onPage = function () { return c.evaluate('(function () { var r = spirit.app && spirit.app.agent && spirit.app.agent.data && typeof spirit.app.agent.data.row === \"function\" && spirit.app.agent.data.row("provider", ' + JSON.stringify(String(liveId)) + '); return r ? r.label : ""; }())'); };
    return (!!liveId && await until(function () { return onPage().then(function (l) { return l === 'zzLive'; }); }, 8000)) ? true : false;
  }, test.limit.quick);
  // ── goal/G43.15, the box: "On the agent's right icon strip, the server's tool takes ⚙ instead of 🐞, and its panel shows serverDEBUG" ──
  test.run('the server\'s tool shows ⚙', 0.2, async function () {
    if (STOP) return false;

    // goal/G43.15: the agent's own switch went; its server tool shows serverDEBUG, which switches appServer's DEBUG, kept by the node.
    serverIcon = await c.evaluate('(function () { var b = document.querySelector("#zzBox [data-tool=server]"); return b ? String(b.textContent || "").trim() : null; }())');
    return (/⚙/.test(String(serverIcon)) && !/🐞/.test(String(serverIcon))) ? true : false;
  }, test.limit.quick);
  test.run('the server tool\'s panel shows serverDEBUG, saying turn on DEBUG Agent', 0.2, async function () {
    if (STOP) return false;
    await tool('server');
    debugRow = function () { return c.evaluate('(function () { var rows = Array.prototype.slice.call(document.querySelectorAll("#zzBox .shell-row-form")).filter(function (r) { return /DEBUG/.test(String(r.innerText || "")) && r.getBoundingClientRect().height > 0; }); return rows.length ? String(rows[0].innerText || "").replace(/\\s+/g, " ").trim() : ""; }())'); };
    return (await until(function () { return debugRow().then(function (t) { return /turn on DEBUG/i.test(t) && /Agent/.test(t); }); }, 10000)) ? true : false;
  }, test.limit.quick);
  test.run('above the DEBUG row, the panel shows the agent\'s icon, then its label', 0.2, async function () {
    if (STOP) return false;
    // goal/G43.15, the box: "the agent's ⚙ panel shows both above serverDEBUG": its visible rows, in order.
    panelRows = function () { return c.evaluate('(function () { var d = Array.prototype.filter.call(document.querySelectorAll("#zzBox .shell-row-form"), function (r) { return /DEBUG/.test(String(r.innerText || "")) && r.getBoundingClientRect().height > 0; })[0]; if (!d) return []; var p = d.parentElement; while (p && p.querySelectorAll(".shell-row-form").length < 3) p = p.parentElement; if (!p) return []; return Array.prototype.filter.call(p.querySelectorAll(".shell-row-form"), function (r) { return r.getBoundingClientRect().height > 0; }).map(function (r) { return String(r.innerText || "").replace(/\\s+/g, " ").trim(); }); }())'); };
    return (await until(function () { return panelRows().then(function (rows) { var i = rows.findIndex(function (t) { return /^✏️? ?Icon/.test(t) || /Icon/.test(t); }), l = rows.findIndex(function (t) { return /Label/.test(t); }), d = rows.findIndex(function (t) { return /DEBUG/.test(t); }); return i !== -1 && l !== -1 && d !== -1 && i < l && l < d; }); }, 10000)) ? true : false;
  }, test.limit.quick);
  test.run('pressing the DEBUG row turns the agent\'s DEBUG on', 0.2, async function () {
    if (STOP) return false;
    await c.evaluate('(function () { var rows = Array.prototype.slice.call(document.querySelectorAll("#zzBox .shell-row-form")).filter(function (r) { return /DEBUG/.test(String(r.innerText || "")); }); if (rows[0]) rows[0].querySelector("button").click(); return 1; }())');
    return (await until(function () { return call(N.base, MODULE + '.DEBUG', {}).then(function (r) { return !!r.body && r.body.debug === true; }); }, 8000)) ? true : false;
  }, test.limit.quick);
  test.run('the node keeps the agent\'s DEBUG in spirit/state/app/agent/node.json', 0.2, async function () {
    if (STOP) return false;
    kept = path.join(s.run, 'spirit', 'state', 'app', 'agent', 'node.json');
    return (await until(function () { return Promise.resolve((readJson(kept) || {}).debug === true); }, 8000)) ? true : false;
  }, test.limit.quick);
  test.run('no config.json of the agent\'s own is written', 0.2, async function () {
    if (STOP) return false;
    return (!fs.existsSync(path.join(s.run, 'spirit', 'state', 'app', 'agent', 'data', 'config.json'))) ? true : false;
  }, test.limit.quick);
  test.run('the panel then says turn off DEBUG', 0.2, async function () {
    if (STOP) return false;
    return (await until(function () { return debugRow().then(function (t) { return /turn off DEBUG/i.test(t); }); }, 8000)) ? true : false;
  }, test.limit.quick);
  // ── the box: "The tick box showDebug goes, with its use of relay-state/shell/agent/config.json" ──
  test.run('the tick box is not on the page', 0.2, async function () {
    if (STOP) return false;

    page = await c.evaluate('document.getElementById("zzBox").innerText').then(String);
    return (!/DEBUG state in the title bar/.test(page)) ? true : false;
  }, test.limit.quick);
  // ── the tile closes ──
  // OUT OF VIEW, NOT DESTROYED (spirit/element/panel/script.js, the box: "HIDDEN, NOT DESTROYED (the box): what it drew stays,
  // out of view, until the stack goes"): the ✕ hides the app's panel, so its tools stay in the page, none of them shown.
  test.run('the app\'s close button puts the app out of view', 0.2, async function () {
    if (STOP) return false;

    closed = await c.evaluate('(function () { var b = document.querySelector("#zzBox .app-container-close"); if (!b) return false; b.click(); return true; }())');
    return (closed && await until(function () { return c.evaluate('Array.prototype.every.call(document.querySelectorAll("#zzBox [data-tool=provider]"), function (e) { return !e.getClientRects().length; })'); }, 8000)) ? true : false;
  }, test.limit.long);
  test.run('the closed app opens again from its tile', 0.2, async function () {
    if (STOP) return false;
    return (await openTile()) ? true : false;
  }, test.limit.quick);
  // ── the box: "Deactivate, and the server stops and the tile goes." ──
  test.run('the agent\'s row has a Deactivate button, and it is pressed', 0.2, async function () {
    if (STOP) return false;

    await selector('pane');
    await shows('Agent');
    deact = await until(function () { return pressInstaller().then(function (t) { return t === 'Deactivate'; }); }, 10000);
    return (deact) ? true : false;
  }, test.limit.quick);
  test.run('once Deactivate is pressed, the server stops', 0.2, async function () {
    if (STOP) return false;
    return (await until(function () { return liveJob(N.base).then(function (j) { return !j; }); }, 15000)) ? true : false;
  }, test.limit.quick);
  test.run('once the agent is deactivated, its verbs are not answered', 0.2, async function () {
    if (STOP) return false;
    return (!answers(await call(N.base, MODULE + '.DEBUG', {}))) ? true : false;
  }, test.limit.quick);
  test.run('the deactivated agent\'s row stays in the pane', 0.2, async function () {
    if (STOP) return false;
    return (await shows('Agent')) ? true : false;
  }, test.limit.quick);
  test.run('the deactivated agent\'s tile goes', 0.2, async function () {
    if (STOP) return false;
    await selector('tiles');
    await sleep(1500);
    return ((await shown()).indexOf('Agent') === -1) ? true : false;
  }, test.limit.slow);
  // ── the box: "its rows are there, from the same spirit/state/app/agent/data/": through a restart, active again ──
  test.run('a restarted node starts the active agent\'s server', 0.2, async function () {
    if (STOP) return false;

    await call(N.base, 'spirit.app.active', { key: MODULE, active: true });
    await serverUp(N.base);
    if (N) await stop(N.child);
    N = await boot(s.run); live.push(N.child);
    return (N.up && await serverUp(N.base)) ? true : false;
  }, test.limit.slow);
  test.run('after the restart, the agent\'s tile opens the app', 0.2, async function () {
    if (STOP) return false;
    await open();
    return (await openTile()) ? true : false;
  }, test.limit.slow);
  test.run('the provider row made before the restart is there', 0.2, async function () {
    if (STOP) return false;
    await tool('provider');
    return (await shows(ROWS.provider)) ? true : false;
  }, test.limit.quick);
  // ── the box: "The agent has no sidecar. Nothing in this item reads, writes or tests one" ──
  test.run('after all that, no sidecar of the agent stands anywhere', 0.2, async function () {
    if (STOP) return false;

    sidecars = filesUnder(path.join(s.run, 'spirit', 'state')).concat(filesUnder(path.join(s.run, 'spirit', 'app', 'agent')))
      .filter(function (f) { return /agent[^/\\]*\.sidecar\.json$/.test(f) });
    return (!sidecars.length) ? true : false;
  }, test.limit.quick);
  test.run('no code or test of the agent names a sidecar', 0.2, async function () {
    if (STOP) return false;
    code = filesUnder(path.join(RUN, 'spirit', 'app', 'agent')).filter(function (f) { return /\.js$/.test(f); })
      .filter(function (f) { return /sidecar/i.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')); }).map(function (f) { return path.relative(RUN, f); })
      .filter(function (f) { return f !== path.relative(RUN, __filename); });
    return (!code.length) ? true : false;
  }, test.limit.quick);
  // ── the box: "The agent's files name their new paths." ──
  test.run('no code of the agent names its old folders', 0.2, async function () {
    if (STOP) return false;

    old = filesUnder(path.join(RUN, 'spirit', 'app', 'agent')).filter(function (f) { return /\.(js|html)$/.test(f) && f.split(path.sep).indexOf('test') === -1; })
      .filter(function (f) { return /process\/js\/agent|shell\/agent/.test(fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')); }).map(function (f) { return path.relative(RUN, f); })
      .filter(function (f) { return f !== path.relative(RUN, __filename); });
    return (!old.length) ? true : false;
  }, test.limit.quick);
  // ── nothing threw on the page ──
  test.run('no uncaught error was thrown on the page during the whole suite', 0.2, async function () {
    if (STOP) return false;

    thrown = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; });
    return (!thrown.length) ? true : false;
  }, test.limit.quick);
  // (left after the last check)
  test.after(async function () {
    if (N) await stop(N.child);
  });
}
