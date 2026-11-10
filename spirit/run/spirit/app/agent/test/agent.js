'use strict';

// spirit/run/spirit/app/agent/test/agent.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md): each part below is its own
// section at the end: centreTabs, listBoxes.
// The tests of spirit/app/agent/agent.js, and of the Agent as Andy sees it (spec: ./agent.md; goal/G43.13). Andy: "Make
// spirit/app/agent/ work". A real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector,
// made as the shell app (spirit/app/app/element.js) makes it. Neither Andy's node nor an agent's is touched.

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
      return c.evaluate('(function () { if (window.__sel) window.__sel.destroy(); var old = document.getElementById("zzBox"); if (old) old.remove(); var b = document.createElement("div"); b.id = "zzBox"; b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { window.__sel = spirit.element.spirit.app.app.element.create(b, { face: ' + JSON.stringify(face) + ' }); return "made"; }); }())');
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
}()).then(function () {}, function (e) { test.fail('the test threw ' + (e && e.stack || e)); }).then(async function () {
  // The parts below, each after the checks above, in order; one report for all.
  for (const part of [['centreTabs', centreTabsPart], ['listBoxes', listBoxesPart]]) {
    try { await part[1](); } catch (e) { test.fail('the ' + part[0] + ' part threw ' + (e && e.stack || e)); }
  }
  test.reportSuccessFailureCount();
  process.exit(0);
});

// ── THE centreTabs PART ──────────────────────────────────────────────────────────────────────────────────────────
async function centreTabsPart() {
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

  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
  function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
  function parsed(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  const ICON = { provider: '🧪', model: '🧬', persona: '🧙', job: '🧰' };
  const CHAT = '💬';

  test.subHeading('centreTabs: the agent app\'s centre is closable tabs (goal/G41.31)');

  await (async function () {
    const N = await scratchNode();
    let c = null;
    try {
      if (!N.up) { test.fail('the scratch node did not come up: nothing judged'); return; }
      const home = async function (verb, args) {
        const r = await fetch(N.base + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ call: verb, args: args || {} }) });
        const text = await r.text();
        return { status: r.status, text: text, body: parsed(text) };
      };
      // active is its one switch (goal/G43.13).
      await home('app.active', { key: 'agent', active: true });
      let P = null;
      await until(function () { return home('agent.provider', { op: 'add', icon: ICON.provider, label: 'zzProvider', url: 'http://192.0.2.1:9/' }).then(function (a) { P = a; return a.status === 200 && !!(a.body && a.body.id); }); }, 20000);
      ok(!!(P && P.body && P.body.id), 'the agent server answers, and a provider stands', 'nothing judged: ' + short(P && P.text));
      if (!(P && P.body && P.body.id)) return;
      const M = await home('agent.model', { op: 'add', icon: ICON.model, label: 'zzModel', providerId: P.body.id });
      const Pe = await home('agent.persona', { op: 'add', icon: ICON.persona, label: 'zzPersona', persona: 'zz', bundle: 'zz', provider: P.body.id });
      const J = await home('agent.job', { op: 'add', icon: ICON.job, label: 'zzJob', job: 'zz', bundle: 'zz', provider: P.body.id, persona: Pe.body && Pe.body.id });
      ok(M.status === 200 && Pe.status === 200 && J.status === 200, 'and a model, a persona and a job', 'nothing judged: ' + short([M.text, Pe.text, J.text]));
      const B = await home('auth.bundle', { op: 'add', label: 'zzNodeBundle' });
      ok(B.status === 200, 'and a bundle of the node\'s', 'auth.bundle: ' + short(B.text));
      const where = findChrome();
      if (!where) { test.fail('no Chrome here: nothing judged'); return; }
      c = await chromePage(where);
      if (c.error) { test.fail('Chrome: ' + c.error); return; }
      await c.send('Page.navigate', { url: N.base + '/face.html' });
      await until(function () { return c.evaluate('!!(window.spirit && window.spirit.event)'); }, 20000);
      const LEAF = 'function leaf(w, within) { var root = within ? document.querySelector(within) : document; if (!root) return null; return Array.prototype.slice.call(root.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && e.textContent.trim() === w && !Array.prototype.some.call(e.children, function (k) { return k.textContent.trim() === w; }); })[0] || null; }';
      const press = function (words, within) { return c.evaluate('(function () { ' + LEAF + ' var e = leaf(' + JSON.stringify(words) + ', ' + JSON.stringify(within || '') + '); if (!e) return false; e.click(); return true; }())'); };
      // The Agent opens from the appSelector's tiles, as the shell app makes them (goal/G43.13).
      await c.evaluate('(function () { var b = document.createElement("div"); b.className = "fill"; b.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;background:#fff;z-index:9999"; document.body.appendChild(b); return spirit.require("spirit/app/app/element.js").then(function () { spirit.element.spirit.app.app.element.create(b, { face: "tiles" }); return 1; }); }())');
      await until(function () { return press('Agent'); }, 20000);
      await until(function () { return c.evaluate('!!document.querySelector("[data-tool=provider]")'); }, 10000);
      const appOpen = await c.evaluate('!!document.querySelector("[data-tool=provider]")');
      ok(appOpen, 'the Agent app opens', 'no Agent app, nothing judged: ' + short(await c.evaluate('document.body.innerText')));
      if (!appOpen) return;
      const CENTRE = '[id$="center"]';
      const tabs = function () { return c.evaluate('JSON.stringify(Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).map(function (b) { return { text: b.textContent.replace(/✕/g, "").replace(/\\s+/g, " ").trim(), on: b.getAttribute("aria-selected") === "true", close: !!b.querySelector("[data-tab-close]") }; }))').then(function (t) { return parsed(t) || []; }); };
      const tabOf = async function (words) { return (await tabs()).filter(function (t) { return t.text === words; }); };
      // A tool is opened, never toggled: a press on the one already shown collapses it (workBench.js, data-current).
      const tool = function (name) { return c.evaluate('(function () { var b = document.querySelector("[data-tool=' + name + ']"); if (!b) return false; if (!b.hasAttribute("data-current")) b.click(); return true; }())'); };
      // A row of a tool's list, by its label, outside the centre.
      const pressRow = function (label) { return c.evaluate('(function () { var all = Array.prototype.slice.call(document.querySelectorAll("*")).filter(function (e) { return e.offsetParent !== null && !e.closest(' + JSON.stringify(CENTRE) + ') && e.textContent.trim() === ' + JSON.stringify(label) + ' && !Array.prototype.some.call(e.children, function (k) { return k.textContent.trim() === ' + JSON.stringify(label) + '; }); }); if (!all[0]) return false; all[0].click(); return true; }())'); };
      const waitTab = function (words) { return until(function () { return tabOf(words).then(function (t) { return t.length > 0; }); }, 6000); };

      test.subHeading('a tabContainer stands in the centre, from the start');
      ok(await c.evaluate('!!document.querySelector(' + JSON.stringify(CENTRE + ' .tab-content') + ')'), 'with nothing opened, it is there', 'no tabContainer in the centre');
      ok((await tabs()).length === 0, 'with no tabs yet', 'tabs before anything was opened: ' + short(await tabs()));

      test.subHeading('each kind of row opens a closable tab, named by the box');
      for (const k of [['provider', 'zzProvider'], ['model', 'zzModel'], ['persona', 'zzPersona'], ['job', 'zzJob']]) {
        const words = ICON[k[0]] + ' ' + k[1];
        const shown = await tool(k[0]);
        await until(function () { return pressRow(k[1]); }, 6000);
        await waitTab(words);
        const t = await tabOf(words);
        ok(shown && t.length === 1 && t[0].on, k[0] + ': a tab reading "' + words + '" opens, and is active', k[0] + ': tabs ' + short(await tabs()));
        ok(t.length === 1 && t[0].close, 'and it has a close button', k[0] + ': no close button: ' + short(t));
      }

      test.subHeading('a row already open: its tab is made active, no second one');
      await tool('provider');
      await until(function () { return pressRow('zzProvider'); }, 6000);
      await sleep(500);
      const again = await tabOf(ICON.provider + ' zzProvider');
      ok(again.length === 1 && again[0].on, 'the provider\'s tab is active again, and alone', 'tabs ' + short(await tabs()));

      // Who listens, listens once: a press on a row that has its tab adds no second listener, and closing a tab lets go of its own.
      test.subHeading('a tab has one listener on its row, and lets go of it when it closes');
      // A row's listeners are counted where the tab and its editor ask for them: the agent family's cache, its table's watch(id, fn) (goal/G43.32:
      // a reader asks its family's cache, which alone names its addresses).
      await c.evaluate('(function () { var A = window.spirit.data.agent.data; window.__live = 0; window.__rowPath = ' + JSON.stringify('/' + P.body.id) + '; A.tables.forEach(function (t) { var B = A[t]; var made = B.watch; B.watch = function (id, fn) { var mine = typeof id === "string" && "/" + id === window.__rowPath; var off = made.call(B, id, fn); if (!mine) return off; window.__live++; var done = false; return function () { if (!done) { done = true; window.__live--; } return off(); }; }; }); return true; }())');
      for (let i = 0; i < 3; i++) { await pressRow('zzProvider'); await sleep(250); }
      const stacked = await c.evaluate('window.__live');
      ok(stacked === 0, 'three more presses on an open row add no listener', stacked + ' more listeners on that row after three presses');

      test.subHeading('the tabs stay when the left tool changes');
      const before = (await tabs()).length;
      await tool('job');
      await sleep(500);
      ok(before >= 4 && (await tabs()).length === before, 'all ' + before + ' are still there', 'before ' + before + ', after ' + short(await tabs()));

      test.subHeading('a chat is a tab of its own beside its persona\'s');
      await tool('chat');
      await until(function () { return pressRow('zzPersona'); }, 6000);
      const chatWords = CHAT + ' zzPersona';
      await waitTab(chatWords);
      const chat = await tabOf(chatWords);
      ok(chat.length === 1 && chat[0].on, 'a tab reading "' + chatWords + '" opens, and is active', 'tabs ' + short(await tabs()));
      ok((await tabOf(ICON.persona + ' zzPersona')).length === 1, 'and the persona\'s own tab is still there', 'tabs ' + short(await tabs()));

      test.subHeading('a bundle\'s tab: its name; not the node\'s: in brackets and italic');
      await tool('bundles');
      await until(function () { return pressRow('zzNodeBundle'); }, 6000);
      await waitTab('zzNodeBundle');
      ok((await tabOf('zzNodeBundle')).length === 1, 'a node\'s bundle: "zzNodeBundle" alone', 'tabs ' + short(await tabs()));
      const styleOf = function (words) { return c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(words) + ') !== -1; })[0]; if (!b) return null; var all = [b].concat(Array.prototype.slice.call(b.querySelectorAll("*"))); return all.some(function (e) { return e.textContent.indexOf(' + JSON.stringify(words) + ') !== -1 && getComputedStyle(e).fontStyle === "italic"; }); }())'); };
      ok((await styleOf('zzNodeBundle')) === false, 'in plain print', 'a node\'s bundle: italic ' + (await styleOf('zzNodeBundle')));

      test.subHeading('a label changed anywhere: its tab says so');
      await home('agent.model', { op: 'set', id: M.body.id, label: 'zzModelTwo' });
      await waitTab(ICON.model + ' zzModelTwo');
      ok((await tabOf(ICON.model + ' zzModelTwo')).length === 1 && (await tabOf(ICON.model + ' zzModel')).length === 0, 'the model\'s header follows its row', 'tabs ' + short(await tabs()));

      test.subHeading('the close button takes a tab away, and the row stays');
      const closed = await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf("zzModelTwo") !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (!k) return false; k.click(); return true; }())');
      await until(function () { return tabOf(ICON.model + ' zzModelTwo').then(function (t) { return !t.length; }); }, 4000);
      ok(closed === true && (await tabOf(ICON.model + ' zzModelTwo')).length === 0, 'its tab is gone', 'tabs ' + short(await tabs()));
      ok((await home('agent.model', { op: 'get', id: M.body.id })).status === 200, 'the model is still there', 'closing its tab deleted the model');

      test.subHeading('a closed tab listens no more');
      await c.evaluate('window.__rowPath = ' + JSON.stringify('/' + Pe.body.id) + '; window.__live = 0; 1');
      await tool('persona');
      const hadPersona = (await tabOf(ICON.persona + ' zzPersona')).length === 1;
      await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(ICON.persona + ' zzPersona') + ') !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (k) k.click(); }())');
      await until(function () { return tabOf(ICON.persona + ' zzPersona').then(function (t) { return !t.length; }); }, 4000);
      await until(function () { return pressRow('zzPersona'); }, 6000);
      await waitTab(ICON.persona + ' zzPersona');
      const opened = await c.evaluate('window.__live');
      await c.evaluate('(function () { var b = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-button') + ')).filter(function (x) { return x.textContent.indexOf(' + JSON.stringify(ICON.persona + ' zzPersona') + ') !== -1; })[0]; var k = b && b.querySelector("[data-tab-close]"); if (k) k.click(); }())');
      await until(function () { return tabOf(ICON.persona + ' zzPersona').then(function (t) { return !t.length; }); }, 4000);
      const afterClose = await c.evaluate('window.__live');
      // Two, each once: the tab follows its row, and the row's own editor (agentRow) watches the same path to repaint itself.
      ok(hadPersona && opened === 2, "opened again, the listeners of the tab and of its editor, one each", 'it had a tab ' + hadPersona + ', then ' + opened + ' listeners');
      ok(afterClose === 0, 'closed, none', afterClose + ' listeners after its tab closed');

      test.subHeading('a row deleted elsewhere closes its tab');
      const hadJob = (await tabOf(ICON.job + ' zzJob')).length === 1;
      await home('agent.job', { op: 'delete', id: J.body.id });
      await until(function () { return tabOf(ICON.job + ' zzJob').then(function (t) { return !t.length; }); }, 5000);
      ok(hadJob && (await tabOf(ICON.job + ' zzJob')).length === 0, 'the job\'s tab closes itself', hadJob ? 'the tab stayed: ' + short(await tabs()) : 'it never had a tab: nothing judged');
      const hadBundle = (await tabOf('zzNodeBundle')).length === 1;
      await home('auth.bundle', { op: 'delete', id: B.body.id });
      await until(function () { return tabOf('zzNodeBundle').then(function (t) { return !t.length; }); }, 5000);
      ok(hadBundle && (await tabOf('zzNodeBundle')).length === 0, 'the bundle\'s too', hadBundle ? 'the tab stayed: ' + short(await tabs()) : 'it never had a tab: nothing judged');

      test.subHeading('Add: "new <row-type>*", until it is saved; then it is that row\'s tab');
      await tool('provider');
      await until(function () { return press('Add a provider'); }, 6000);
      await waitTab('new provider*');
      const fresh = await tabOf('new provider*');
      ok(fresh.length === 1 && fresh[0].on, 'a tab reading "new provider*" opens, and is active', 'tabs ' + short(await tabs()));
      const filled = await c.evaluate('(function () { var box = Array.prototype.slice.call(document.querySelectorAll(' + JSON.stringify(CENTRE + ' .tab-content > *') + ')).filter(function (x) { return !x.hidden; })[0]; if (!box) return "no box"; var inputs = Array.prototype.slice.call(box.querySelectorAll("input")); var set = function (word, v) { var i = inputs.filter(function (x) { return x.id.slice(-word.length - 1) === "-" + word.toLowerCase(); })[0]; if (!i) return false; i.value = v; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); return true; }; return set("Label", "zzSaved") && set("URL", "http://192.0.2.2:9/") ? "ok" : "fields: " + box.textContent.slice(0, 200); }())');
      ok(filled === 'ok', 'its fields are filled', 'the form: ' + short(filled));
      await press('Add new Provider');
      await until(function () { return tabs().then(function (ts) { return ts.some(function (t) { return t.text.indexOf('zzSaved') !== -1; }); }); }, 6000);
      const saved = (await tabs()).filter(function (t) { return t.text.indexOf('zzSaved') !== -1; });
      ok(saved.length === 1 && saved[0].on, 'saved: its header is the row\'s', 'tabs ' + short(await tabs()));
      ok((await tabOf('new provider*')).length === 0, 'and "new provider*" is gone', 'tabs ' + short(await tabs()));
      await until(function () { return pressRow('zzSaved'); }, 6000);
      await sleep(600);
      const onlyOne = (await tabs()).filter(function (t) { return t.text.indexOf('zzSaved') !== -1; });
      ok(onlyOne.length === 1 && onlyOne[0].on, 'pressing that row in the list activates it: no second tab', 'tabs ' + short(await tabs()));
      const threw = c.heard.filter(function (m) { return m.method === 'Runtime.exceptionThrown'; }).map(function (m) { return m.params.exceptionDetails.text + ' ' + short((m.params.exceptionDetails.exception || {}).description || ''); });
      ok(!threw.length, 'nothing threw in the page', 'the page threw: ' + threw.slice(0, 2).join(' | '));
    } finally {
      try { if (c && c.sock) c.sock.close(); if (c && c.kid) c.kid.kill(); } catch (e) { /* gone */ }
      try { if (c && c.profile) fs.rmSync(c.profile, { recursive: true, force: true }); } catch (e) { /* scratch */ }
      try { if (N.child) N.child.kill(); } catch (e) { /* gone */ }
      try { if (N.root) fs.rmSync(N.root, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    }
  }());
}

// ── THE listBoxes PART ───────────────────────────────────────────────────────────────────────────────────────────
async function listBoxesPart() {
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
  function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
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

  test.subHeading('listBoxes: agent.js, as one app: every list in a box of a stated size (rule/16)');
  process.on('unhandledRejection', function (e) { test.fail('it threw where nothing caught it: ' + (e && e.message || e)); });

  await (async function () {
    if (!fs.existsSync(FILE)) { test.fail('spirit/app/agent/element.js is not there'); return; }
    // Andy, on G41.18: "the lists violate: rule/16 — A list gets a box of a stated size. Files and contacts do it right,
    // agents must as well."; "ALL lists, otherwise my took bars at the top of a container keep scrolling away...."; "when a
    // probabilitySearch is in pane-mode it must display 1) filters 2) search input row 3) a pane that uses the rest of the
    // vertical space, all box elements really have to follow to follow that rule", "the agent app must also constrain all
    // it's probability-panes". rule/16: every probabilitySearch in a box of class fill, inside a pane that fills its app.
    // A list drawn as a dropdown stands inline, as every picker in the tree does, and is not asked here.
    const w = world();
    const app = w.document.body.appendChild(w.document.createElement('div'));
    app.className = 'fill';
    // A tile hands it only its container (goal/G43.13).
    w.win.spirit.element.spirit.app.agent.element.create(app);
    await settle();
    let modelOrder = null;
    // Where, in the app's order of elements, the Models title rows, the Ask row (its providerSelector:dropdown, since
    // goal/G41.27 drops the word from), and the model list stand.
    const order = function (root, host, askRow) {
      const seq = [];
      (function walk(n) { n.children.forEach(function (c) { seq.push(c); walk(c); }); }(root));
      const titles = seq.filter(function (n) { return n.classList && n.classList.contains('agent-title') && /Models/.test(n.textContent); });
      return { titles: titles.length, title: titles.length ? seq.indexOf(titles[0]) : -1, from: askRow ? seq.indexOf(askRow) : -1, list: seq.indexOf(host) };
    };
    const strip = function (name) { return w.document.querySelectorAll('[data-tool]').filter(function (b) { return b.getAttribute('data-tool') === name; })[0]; };

    test.subHeading('each tool\'s list pane');
    // goal/G41.21: the grant tool went with agent.grant.
    const want = [['provider', 'provider'], ['model', 'model'], ['persona', 'persona'], ['job', 'job']];
    for (const t of want) {
      const b = strip(t[0]);
      if (!b) { test.fail('no strip button for the ' + t[0] + ' tool'); continue; }
      w.document.click(b);
      await settle();
      const made = w.panes.filter(function (p) { return p.o.face !== 'dropdown' && p.o.verb === t[1] && under(p.host, app); });
      if (!made.length) { test.fail('the ' + t[0] + ' tool drew no list pane'); continue; }
      const g = gaps(made[made.length - 1].host, app);
      ok(!g.length, 'the ' + t[0] + ' tool\'s list stands in a fill box, and every box up to the app is fill too', t[0] + ': not fill: ' + g.join(' < '));
      if (t[0] === 'model') {
        const drop = w.panes.filter(function (p) { return p.o.face === 'dropdown' && p.o.verb === 'provider' && under(p.host, app); }).pop();
        modelOrder = order(app, made[made.length - 1].host, drop ? drop.host : null);
      }
    }

    test.subHeading('the 🧠 Models pane: its title row first (goal/G41.26)');
    // Andy, on G41.26: "i the left side models panel: the title row \"🧠Models\" must come before the \"from [🛖 Unsloth
    // Studio ▾] [Ask] row."
    const mo = modelOrder || {};
    ok(mo.titles === 1, 'the pane draws one 🧠 Models title row', 'title rows saying Models: ' + mo.titles);
    ok(mo.title !== -1 && mo.from !== -1 && mo.title < mo.from, 'the title row comes before the Ask row, its providerSelector:dropdown', 'title at ' + mo.title + ', from at ' + mo.from);
    ok(mo.from !== -1 && mo.list !== -1 && mo.from < mo.list, 'and the model list after it', 'from at ' + mo.from + ', list at ' + mo.list);

    test.subHeading('every list pane the app drew');
    const all = w.panes.filter(function (p) { return p.o.face !== 'dropdown' && under(p.host, app); });
    const bad = all.map(function (p) { return { verb: p.o.verb, gaps: gaps(p.host, app) }; }).filter(function (x) { return x.gaps.length; });
    ok(all.length >= 4 && !bad.length, 'all ' + all.length + ' list panes drawn, none in a box only as tall as its content', 'not fill: ' + short(bad));

    test.subHeading('each list pane is a view of its table in the agent family\'s cache (goal/G41.28)');
    const AD = ((w.win.spirit.data || {}).agent || {}).data;
    const off = all.filter(function (p) { return !AD || !p.o.data || p.o.data !== AD.branch(p.o.verb); }).map(function (p) { return { verb: p.o.verb, data: p.o.data }; });
    ok(!!AD && all.length >= 4 && !off.length, 'every list pane is handed its table\'s branch, spirit.data.agent.data.branch(table)', 'agentReads ' + !!AD + ', not its branch: ' + short(off));
  }());

  // THE ELEMENT NAMES SINCE goal/G43.18: a stand-in keyed by its place, 'search.contact' and so on, nested where the page has it.
  function nestSearch(o) { Object.keys(o).forEach(function (k) { if (k !== 'search' && k.indexOf('search.') !== 0) return; var v = o[k]; delete o[k]; var ks = k.split('.'); var at = o; ks.slice(0, -1).forEach(function (p) { at = at[p] = at[p] || {}; }); var last = ks[ks.length - 1]; at[last] = Object.assign(at[last] || {}, v); }); return o; }
}
