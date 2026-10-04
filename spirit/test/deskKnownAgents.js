'use strict';

// goal/G4.29: the agent pane opens for every agent the desk knows, not only the live ones, so an agent without a
// listener stays within reach. Red on today's tree; wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-04, desk/G0.0, after gemma's bubble went 10 minutes after its last line: "can't reach it because
//   ollama is gone"; to "Let the agent pane open for every agent the desk knows, not only the live ones, as a new
//   item? Today gemma drops out of reach 10 minutes after its last line.": "yes"; then his Go on goal/G4.29.
//   In the tree: the goal row's agents map holds only the live agents' keys (desk.js facts, f.agents from f.live,
//   LIVE_MS 10 minutes), the page draws a bubble per live agent (shell/desk/desk.js deskBubblesHtml) and its pane finds
//   the key only in that map (deskAgentKey).
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  THE GOAL ROW: agents maps every agent the desk has seen write (label to key), live or not; live stays as it is.
//      Its other user, onboard.js, then blocks every known agent, not only the live ones, which closes the gap it
//      left to the listener.
//   2  THE PAGE: a bubble, and so a tab, for every agent in agents; one not in live carries data-away="1" and is not
//      marked working. Opening it asks scope.get with its key, as for a live one.
//
// THE WORLD: a real desk server with its own state; an agent that last wrote 20 minutes ago is made by rewriting the
// at of its records in desk.db while the server is down (there is no clock to turn); then the page, fed that row.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.29: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const PAGE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskKnownAgentsTestCWAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const GEMMA = { key: 'MCowBQYDK2VwAyEAdeskKnownAgentsTestGemmaAAAAAAAAAAAAAAA=', label: 'gemma' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskKnownAgentsTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 260); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

test.startTest('goal/G4.29: the agent pane reaches every agent the desk knows');

(async function () {
  const row = await theServer();
  await thePage(row);
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});

async function theServer() {
  test.subHeading('1. the goal row maps every agent the desk has seen, live or not');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskknown-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const start = async function () {
    const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    return kid;
  };
  const stop = function (kid) { return new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); };
  let row = null;
  let kid = await start();
  try {
    await call('session.set', { json: JSON.stringify({ goal: { id: 'k/G1', title: 'Known' }, items: [{ id: 'k/G1.1', title: 'Talk', blocks: ['k/G1'] }] }) }, CW);
    await call('chat.add', { id: 'k/G1.1', text: 'gemma here, then gone' }, GEMMA);
    await stop(kid);
    // TWENTY MINUTES AGO for every record of gemma's: past LIVE_MS (desk.js, 10 minutes).
    const db = new DatabaseSync(path.join(state, 'desk.db'));
    db.prepare('UPDATE records SET at = ? WHERE by = ?').run(new Date(Date.now() - 20 * 60 * 1000).toISOString(), GEMMA.label);
    db.close();
    kid = await start();
    await call('chat.add', { id: 'k/G1.1', text: 'claude-windows, live' }, CW);
    const r = await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: true, includeClosed: false }, ANDY);
    try { row = JSON.parse((((r.body || {}).items) || [])[0].label); } catch (e) { row = null; }
    const live = (row && row.live) || [];
    if (live.indexOf(CW.label) !== -1 && live.indexOf(GEMMA.label) === -1) test.check('the world: claude-windows is live, gemma (last wrote 20 minutes ago) is not');
    else { test.fail('the world: live is ' + short(live)); return row; }
    const agents = (row && row.agents) || {};
    if (agents[GEMMA.label] === GEMMA.key) test.check('the goal row\'s agents still maps gemma to its key');
    else test.fail(OWED + 'the goal row\'s agents is ' + short(agents));
    if (agents[CW.label] === CW.key) test.check('and claude-windows, live, as before');
    else test.fail('claude-windows is missing from agents: ' + short(agents));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ } }, 500);
  }
  return row;
}

// A small DOM of created nodes, as deskScopePane.js has one.
function node(tag) {
  let html = '';
  const e = { tagName: String(tag || 'div').toUpperCase(), value: '', textContent: '', className: '', style: {}, dataset: {}, children: [], listeners: {}, parentNode: null, hidden: false, attrs: {}, id: '',
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); e.children.push(c); c.parentNode = e; return c; },
    insertBefore: function (c) { return e.appendChild(c); },
    removeChild: function (c) { e.children = e.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; },
    replaceChildren: function () { e.children.forEach(function (c) { c.parentNode = null; }); e.children = []; Array.from(arguments).forEach(function (c) { e.appendChild(c); }); },
    remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
    addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { e.listeners[t] = (e.listeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { bubble(e, ev); return true; },
    setAttribute: function (k, v) { e.attrs[k] = String(v); if (k.indexOf('data-') === 0) e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })] = String(v); if (k === 'class') e.className = String(v); if (k === 'hidden') e.hidden = true; },
    getAttribute: function (k) { if (k.indexOf('data-') === 0) { const d = e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })]; return d === undefined ? null : d; } return e.attrs[k] === undefined ? null : e.attrs[k]; },
    removeAttribute: function (k) { delete e.attrs[k]; if (k === 'hidden') e.hidden = false; },
    closest: function (sel) { for (let n = e; n; n = n.parentNode) { const a = /^\[([\w-]+)\]$/.exec(sel); if (a && n.getAttribute && n.getAttribute(a[1]) !== null) return n; } return null; },
    contains: function (x) { for (let n = x; n; n = n.parentNode) if (n === e) return true; return false; },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    focus: function () {}, select: function () {}, blur: function () {},
  };
  e.classList = { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; }, enumerable: true });
  return e;
}
function bubble(target, ev) {
  if (!ev.target) { try { Object.defineProperty(ev, 'target', { value: target, configurable: true }); } catch (x) { ev.target = target; } }
  for (let n = target; n; n = n.parentNode) (n.listeners[ev.type] || []).slice().forEach(function (fn) { fn.call(n, ev); });
}

async function thePage(served) {
  test.subHeading('2. the page: a bubble for every known agent, the away one marked, its pane opens');
  // The row the server should give (shape 1), so the page is judged on its own even before the server is built.
  const goalRow = { id: 'k/G1', title: 'Known', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], design: false, waiting: 0,
    live: [CW.label], working: [], agents: { 'claude-windows': CW.key, gemma: GEMMA.key }, alone: false, alert: false, claims: 0, asks: 0, boxTaken: '' };
  if (served && served.agents && served.agents.gemma === GEMMA.key) test.check('the world: the row the server gave carries gemma as this page expects');
  const byId = {};
  const doc = { getElementById: function (id) { if (!byId[id]) { byId[id] = node('div'); byId[id].id = id; } return byId[id]; }, createElement: node, all: byId };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(PAGE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  const container = node('div');
  behavior.mount(container, {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name !== 'jobs.api' || !ask) return Promise.resolve({ status: 200, body: {} });
      const v = Object.keys(ask)[0];
      asked.push({ verb: v, args: ask[v] });
      if (v === 'items.search') return Promise.resolve({ status: 200, body: { items: [{ key: 'k/G1', label: JSON.stringify(goalRow) }], more: false } });
      if (v === 'scope.get') return Promise.resolve({ status: 200, body: { folder: 'spirit/run/shell/textEditor/' } });
      if (v === 'profile.get') return Promise.resolve({ status: 200, body: { name: 'ollama-gemma', nick: 'gemma' } });
      return Promise.resolve({ status: 200, body: { items: [], more: false, json: '{}', chat: [], chatMore: false } });
    },
    ui: { elements: { createPathSelector: function (o) { const r = node('div'); r.options = o; return r; } } },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    armUntilElsewhere: function () {}, fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  await settled();
  const tabs = byId['desk-tabs'] ? byId['desk-tabs'].innerHTML : '';
  const gemmaBubble = (/<span[^>]*data-bubble="gemma"[^>]*>/.exec(tabs) || [''])[0];
  const cwBubble = (/<span[^>]*data-bubble="claude-windows"[^>]*>/.exec(tabs) || [''])[0];
  if (gemmaBubble && /data-tab="agent:gemma"/.test(gemmaBubble)) test.check('gemma, not live, still has its bubble and tab');
  else test.fail(OWED + 'no bubble for gemma in the tab strip: ' + short(tabs.slice(0, 400)));
  if (gemmaBubble && /data-away="1"/.test(gemmaBubble) && !/data-working/.test(gemmaBubble)) test.check('its bubble is marked away (data-away="1"), not working');
  else test.fail(OWED + 'gemma\'s bubble reads ' + short(gemmaBubble));
  if (cwBubble && !/data-away/.test(cwBubble)) test.check('claude-windows, live, is not marked away');
  else test.fail(OWED + 'claude-windows\'s bubble reads ' + short(cwBubble));
  const t = node('button');
  t.setAttribute('data-tab', 'agent:gemma');
  doc.getElementById('desk-tabs').appendChild(t);
  bubble(t, { type: 'click', bubbles: true, currentTarget: doc.getElementById('desk-tabs'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  const got = asked.filter(function (a) { return a.verb === 'scope.get'; });
  if (got.length && got[got.length - 1].args.agent === GEMMA.key) test.check('opening gemma\'s tab asks scope.get with its key');
  else test.fail(OWED + 'scope.get asked ' + short(got));
  const pane = byId['desk-agent'] ? byId['desk-agent'].innerHTML : '';
  if (/spirit\/run\/shell\/textEditor\//.test(pane) && !/No key known/.test(pane)) test.check('its pane shows its scope, spirit/run/shell/textEditor/');
  else test.fail(OWED + 'its pane reads ' + short(pane));
}
