'use strict';

// spirit/test/deskBindingNick.js
// goal/G21.1: the agent's pane in Desk, names and keys, the binding nick, included and cap. Red on today's tree;
// claude-windows wrote it and builds it (one agent). The item's box, Andy's decisions:
//   - The pane: row one name and nick (text inputs); row two the toggles included and cap. Written by Andy alone;
//     every agent may read every pane. The nick is Andy's shorthand for addressing a key.
//   - The page shows the agent's name everywhere it shows the agent (chat lines, presence bubble, Team list, taker
//     marks), looked up by the agent's key; the node's label only when no name is set. Keys are never shown.
//   - Every chat line carries its writer's key; every decision about who goes by key.
//   - A line of Andy's starting with a nick followed by any punctuation or a space is addressed to that agent alone:
//     only it is notified, only it may take it.
//   - A nick request about the box hands the box to that agent for one write: red at once, nobody else takes it
//     (Andy included), the hold ends when the write lands or after one minute; a refused write does not use it up.
//   - included off: the agent reads everything, every write of it is refused, its bubble shows absent.
//   - cap on: a bare "cap" from Andy offers the box to every agent with cap on, the first to take it holds it under the
//     one-write rule; cap off: a cap only when addressed by its nick.
//
// THE SHAPES THIS SUITE NAMES (the box names none):
//   - profile.set takes included and cap (booleans) beside agent, name and nick, both optional; profile.get answers
//     them too. A profile never set reads included true, cap true.
//   - item.chat and chat.search lines carry key (the writer's) and name (its profile name, '' when none).
//   - every item's facts carry names, {label: name} for the agents it mentions; the goal row's for every agent it
//     knows, and excluded, the labels of the agents that are not included (out of live).
//   - A NICK REQUEST ABOUT THE BOX is Andy's nick-addressed line holding the word box or cap.
//   - the one minute is the server's manifest value boxHoldMs (default 60000): the clock this suite injects.
//   - a write by an excluded agent is refused not-included, with a why.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G21.1: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const PAGE = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskBindingNickTestCWAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskBindingNickTestWSLAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const UBI = { key: 'MCowBQYDK2VwAyEAdeskBindingNickTestUBIAAAAAAAAAAAAAAAAAA=', label: 'ubuntu-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskBindingNickTestOwnerAAAAAAAAAAAAAAA=', label: 'andy' };
const HOLD_MS = 1500;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 10; i++) await settle(); }

test.startTest('goal/G21.1: the agent pane, names by key, the binding nick, included and cap');

(async function () {
  await theServer();
  await thePage();
  await theDialog();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 300);
});

async function theServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskbindingnick-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  const kid = spawn(process.execPath, [SERVER, JSON.stringify({ boxHoldMs: HOLD_MS }), '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const facts = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };
  const chatOf = async function (id) { return ((await call('item.chat', { id: id }, ANDY)).chat) || []; };
  const goalRow = async function () {
    const r = await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: true, includeClosed: false }, ANDY);
    try { return JSON.parse((((r.items) || [])[0] || {}).label); } catch (e) { return {}; }
  };
  const cursor = async function () { const r = await call('changes', { n: 1e12, line: 1e12 }, ANDY); return { n: 0, line: 0, r: r }; };
  const heardBy = async function (from, caller, text) {
    let n = from;
    for (let i = 0; i < 50; i++) {
      const r = await call('changes', { n: n, line: 1e12 }, caller);
      if (!Array.isArray(r.records)) return null;
      if (r.records.some(function (x) { return x.verb === 'chat.add' && String(x.body).indexOf(text) !== -1; })) return true;
      if (!r.more) return false;
      n = r.n;
    }
    return false;
  };
  const lastN = async function () { const r = await call('item.get', { id: 'b/G1' }, ANDY); return Number(r.change) || 0; };
  const why = function (r) { return r && r.extra && r.extra.why ? String(r.extra.why) : ''; };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: the desk did not start'); return; }
    await cursor();
    const items = ['b/G1.1', 'b/G1.2', 'b/G1.3', 'b/G1.4', 'b/G1.5', 'b/G1.6'].map(function (id) { return { id: id, title: 'Item ' + id, blocks: ['b/G1'] }; });
    await call('session.set', { json: JSON.stringify({ goal: { id: 'b/G1', title: 'Binding' }, items: items }) }, CW);
    await call('agent.state', { word: 'listening' }, CW);
    await call('agent.state', { word: 'listening' }, WSL);

    test.subHeading('0. the pane\'s fields: profile.set takes included and cap, profile.get answers them');
    const p1 = await call('profile.set', { agent: CW.key, name: 'Claude Windows', nick: 'cw', included: true, cap: true }, ANDY);
    const p2 = await call('profile.set', { agent: WSL.key, name: 'WSL Claude', nick: 'wsl', included: true, cap: false }, ANDY);
    const p3 = await call('profile.set', { agent: UBI.key, name: 'Ubuntu Claude', nick: 'ubi' }, ANDY);
    const g2 = await call('profile.get', { agent: WSL.key }, CW);
    const g3 = await call('profile.get', { agent: UBI.key }, CW);
    if (p1.change && p2.change && g2.included === true && g2.cap === false) test.check('profile.set takes included and cap; any agent reads them back');
    else test.fail(OWED + 'profile.set answered ' + short([p1, p2]) + '; profile.get of wsl ' + short(g2));
    if (p3.change && g3.included === true && g3.cap === true) test.check('a profile set without them reads included true, cap true');
    else test.fail(OWED + 'a profile without the toggles answered ' + short(p3) + ', reads ' + short(g3));

    test.subHeading('1. names by key: chat lines carry the key and the name; facts carry names');
    await call('item.take', { id: 'b/G1.1' }, CW);
    await call('chat.add', { id: 'b/G1.1', text: 'cw writing' }, CW);
    const line = (await chatOf('b/G1.1')).filter(function (l) { return l.text === 'cw writing'; })[0] || {};
    if (line.key === CW.key && line.name === 'Claude Windows' && line.by === CW.label) test.check('item.chat: the line keeps by, and carries key and name');
    else test.fail(OWED + 'the line reads ' + short(line));
    const found = await call('chat.search', { id: 'b/G1.1', text: '', by: '', since: '', before: '' }, CW);
    const hit = (found.items || []).map(function (x) { try { return JSON.parse(x.label); } catch (e) { return {}; } }).filter(function (l) { return l.text === 'cw writing'; })[0] || {};
    if (hit.key === CW.key && hit.name === 'Claude Windows') test.check('chat.search: the line carries key and name too');
    else test.fail(OWED + 'chat.search\'s line reads ' + short(hit));
    const f1 = await facts('b/G1.1');
    if (f1.with === CW.label && f1.names && f1.names[CW.label] === 'Claude Windows') test.check('an item\'s facts name its taker by key: names[' + CW.label + ']');
    else test.fail(OWED + 'the item\'s facts: with ' + short(f1.with) + ', names ' + short(f1.names));
    const row = await goalRow();
    if (row.names && row.names[CW.label] === 'Claude Windows' && row.names[WSL.label] === 'WSL Claude') test.check('the goal row names every agent it knows');
    else test.fail(OWED + 'the goal row\'s names: ' + short(row.names));

    test.subHeading('2. a nick followed by punctuation or a space binds the line');
    let n0 = await lastN();
    await call('chat.add', { id: 'b/G1.2', text: 'wsl, have a look' }, ANDY);
    const cwTake = await call('line.take', { id: 'b/G1.2' }, CW);
    const cwSay = await call('chat.add', { id: 'b/G1.2', text: 'cw butting in' }, CW);
    if (cwTake.ok === false && cwSay.ok === false) test.check('"wsl, ..." is wsl\'s: claude-windows can neither take it nor answer');
    else test.fail(OWED + 'claude-windows on "wsl, ...": take ' + short(cwTake) + ', line ' + short(cwSay));
    const wslSay = await call('chat.add', { id: 'b/G1.2', text: 'wsl answers' }, WSL);
    if (wslSay.change) test.check('wsl-claude answers it');
    else test.fail(OWED + 'wsl-claude\'s answer: ' + short(wslSay));

    test.subHeading('3. only the addressed agent is notified');
    const toWsl = await heardBy(n0, WSL, 'wsl, have a look');
    const toCw = await heardBy(n0, CW, 'wsl, have a look');
    const toAndy = await heardBy(n0, ANDY, 'wsl, have a look');
    if (toWsl === true && toCw === false && toAndy === true) test.check('changes hands "wsl, ..." to wsl-claude (and Andy), not to claude-windows');
    else test.fail(OWED + 'changes: wsl ' + toWsl + ', claude-windows ' + toCw + ', Andy ' + toAndy);

    test.subHeading('2b. a space binds; the old "<nick>:" still binds; a longer word does not');
    await call('chat.add', { id: 'b/G1.3', text: 'cw look here' }, ANDY);
    const wslTake = await call('line.take', { id: 'b/G1.3' }, WSL);
    const cwAns = await call('chat.add', { id: 'b/G1.3', text: 'cw answers the space' }, CW);
    if (wslTake.ok === false && cwAns.change) test.check('"cw look here" is claude-windows\'s');
    else test.fail(OWED + '"cw look here": wsl take ' + short(wslTake) + ', cw answer ' + short(cwAns));
    await call('chat.add', { id: 'b/G1.3', text: 'CW: the old form' }, ANDY);
    const wslTake2 = await call('line.take', { id: 'b/G1.3' }, WSL);
    const cwAns2 = await call('chat.add', { id: 'b/G1.3', text: 'cw answers the colon' }, CW);
    if (wslTake2.ok === false && cwAns2.change) test.check('"CW: ..." still binds, case ignored');
    else test.fail('"CW: ...": wsl take ' + short(wslTake2) + ', cw answer ' + short(cwAns2));
    await call('chat.add', { id: 'b/G1.3', text: 'cwx is not a nick' }, ANDY);
    const free = await call('line.take', { id: 'b/G1.3' }, WSL);
    if (free.change) test.check('"cwx ..." binds nobody: wsl-claude takes it');
    else test.fail('"cwx ...": wsl take ' + short(free));

    test.subHeading('4. only the addressed agent may take it, even one never heard from');
    await call('chat.add', { id: 'b/G1.4', text: 'ubi! are you there' }, ANDY);
    const cwOnUbi = await call('line.take', { id: 'b/G1.4' }, CW);
    const ubiTake = await call('line.take', { id: 'b/G1.4' }, UBI);
    const ubiSay = await call('chat.add', { id: 'b/G1.4', text: 'ubi here' }, UBI);
    if (cwOnUbi.ok === false && ubiSay.change) test.check('"ubi! ..." is refused to claude-windows; ubuntu-claude, never heard from before, answers' + (ubiTake.ok === false ? '' : ' (its take answered too)'));
    else test.fail(OWED + '"ubi! ...": cw take ' + short(cwOnUbi) + ', ubi take ' + short(ubiTake) + ', ubi line ' + short(ubiSay));

    test.subHeading('5. a nick request about the box: one write, red at once, nobody else');
    const v0 = (await call('item.box', { id: 'b/G1.5' }, ANDY)).version;
    await call('chat.add', { id: 'b/G1.5', text: 'cw, cap the box please' }, ANDY);
    const f5 = await facts('b/G1.5');
    if (f5.boxTaken === CW.label) test.check('the box is red at once, awaiting claude-windows');
    else test.fail(OWED + 'after "cw, cap the box": boxTaken ' + short(f5.boxTaken));
    const andyTake = await call('box.take', { id: 'b/G1.5' }, ANDY);
    const andyWrite = await call('box.write', { id: 'b/G1.5', text: 'andy writes', version: v0 }, ANDY);
    const wslBox = await call('box.take', { id: 'b/G1.5' }, WSL);
    if (andyTake.ok === false && andyWrite.ok === false && wslBox.ok === false) test.check('nobody else takes or writes it, Andy included');
    else test.fail(OWED + 'meanwhile: andy take ' + short(andyTake) + ', andy write ' + short(andyWrite) + ', wsl take ' + short(wslBox));
    const wrong = await call('box.write', { id: 'b/G1.5', text: 'stale', version: v0 + 7 }, CW);
    const still = await facts('b/G1.5');
    if (wrong.ok === false && still.boxTaken === CW.label) test.check('a write the desk refuses (' + (wrong.code || '?') + ') does not use up the one update');
    else test.fail(OWED + 'a refused write: ' + short(wrong) + ', then boxTaken ' + short(still.boxTaken));
    const right = await call('box.write', { id: 'b/G1.5', text: 'capped', version: v0 }, CW);
    const after = await facts('b/G1.5');
    if (right.change && !after.boxTaken) test.check('the write lands and the hold ends');
    else test.fail(OWED + 'the write: ' + short(right) + ', then boxTaken ' + short(after.boxTaken));
    const v1 = (await call('item.box', { id: 'b/G1.5' }, ANDY)).version;
    await call('chat.add', { id: 'b/G1.5', text: 'wsl: update the box' }, ANDY);
    const held = await facts('b/G1.5');
    await sleep(HOLD_MS + 600);
    const gone = await facts('b/G1.5');
    const andyNow = await call('box.take', { id: 'b/G1.5' }, ANDY);
    if (held.boxTaken === WSL.label && !gone.boxTaken && andyNow.change) test.check('unwritten, the hold ends after its minute (here ' + HOLD_MS + ' ms); Andy takes the box again');
    else test.fail(OWED + 'hold for wsl ' + short(held.boxTaken) + ', after the minute ' + short(gone.boxTaken) + ', andy take ' + short(andyNow));
    await call('box.write', { id: 'b/G1.5', text: 'andy again', version: v1 }, ANDY);
    const plain = await facts('b/G1.5');
    await call('chat.add', { id: 'b/G1.5', text: 'cw, what do you think' }, ANDY);
    const notBox = await facts('b/G1.5');
    if (!plain.boxTaken && !notBox.boxTaken) test.check('a nick line not about the box holds no box');
    else test.fail(OWED + 'a nick line not about the box: boxTaken ' + short(notBox.boxTaken));
    await call('chat.add', { id: 'b/G1.5', text: 'noted' }, CW);

    test.subHeading('6. included off: writes refused, reads answered, the bubble absent');
    await call('profile.set', { agent: WSL.key, name: 'WSL Claude', nick: 'wsl', included: false, cap: false }, ANDY);
    const wState = await call('agent.state', { word: 'working' }, WSL);
    const wTake = await call('item.take', { id: 'b/G1.6' }, WSL);
    const wRead = await call('item.get', { id: 'b/G1.6' }, WSL);
    if (wState.code === 'not-included' && wTake.code === 'not-included' && why(wTake)) test.check('an excluded agent\'s writes are refused not-included: ' + why(wTake));
    else test.fail(OWED + 'excluded writes answered ' + short(wState) + ' / ' + short(wTake));
    if (wRead.item) test.check('its reads are answered');
    else test.fail(OWED + 'an excluded agent\'s read answered ' + short(wRead));
    const row6 = await goalRow();
    if ((row6.live || []).indexOf(WSL.label) === -1 && (row6.excluded || []).indexOf(WSL.label) !== -1) test.check('the goal row has it out of live and in excluded');
    else test.fail(OWED + 'the goal row: live ' + short(row6.live) + ', excluded ' + short(row6.excluded));
    await call('profile.set', { agent: WSL.key, name: 'WSL Claude', nick: 'wsl', included: true, cap: false }, ANDY);
    const back = await call('agent.state', { word: 'listening' }, WSL);
    if (back.change) test.check('included again, it writes again');
    else test.fail(OWED + 'included again: ' + short(back));

    test.subHeading('7. a bare "cap": to the agents with cap on');
    n0 = await lastN();
    await call('chat.add', { id: 'b/G1.6', text: 'cap' }, ANDY);
    const capCw = await heardBy(n0, CW, '"cap"');
    const capWsl = await heardBy(n0, WSL, '"cap"');
    if (capCw === true && capWsl === false) test.check('the cap reaches claude-windows (cap on), not wsl-claude (cap off)');
    else test.fail(OWED + 'the cap reached cw ' + capCw + ', wsl ' + capWsl);
    const wslCap = await call('box.take', { id: 'b/G1.6' }, WSL);
    const cwCap = await call('box.take', { id: 'b/G1.6' }, CW);
    const f7 = await facts('b/G1.6');
    if (wslCap.ok === false && cwCap.change && f7.boxTaken === CW.label) test.check('cap off is refused the box; the first cap-on agent holds it');
    else test.fail(OWED + 'wsl take ' + short(wslCap) + ', cw take ' + short(cwCap) + ', boxTaken ' + short(f7.boxTaken));
    const andyCap = await call('box.take', { id: 'b/G1.6' }, ANDY);
    await sleep(HOLD_MS + 600);
    const f7b = await facts('b/G1.6');
    if (andyCap.ok === false && !f7b.boxTaken) test.check('held under the one-write rule: Andy refused, freed after its minute');
    else test.fail(OWED + 'andy take ' + short(andyCap) + ', after the minute ' + short(f7b.boxTaken));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    setTimeout(function () { try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ } }, 500);
  }
}

// A small DOM of created nodes (as deskKnownAgents.js has one).
function node(tag) {
  let html = '';
  const e = { tagName: String(tag || 'div').toUpperCase(), value: '', checked: false, type: '', textContent: '', className: '', style: {}, dataset: {}, children: [], listeners: {}, parentNode: null, hidden: false, attrs: {}, id: '',
    appendChild: function (c) { if (c.parentNode) c.parentNode.removeChild(c); e.children.push(c); c.parentNode = e; return c; },
    insertBefore: function (c) { return e.appendChild(c); },
    removeChild: function (c) { e.children = e.children.filter(function (x) { return x !== c; }); c.parentNode = null; return c; },
    replaceChildren: function () { e.children.forEach(function (c) { c.parentNode = null; }); e.children = []; Array.from(arguments).forEach(function (c) { e.appendChild(c); }); },
    remove: function () { if (e.parentNode) e.parentNode.removeChild(e); },
    addEventListener: function (t, fn) { (e.listeners[t] = e.listeners[t] || []).push(fn); },
    removeEventListener: function (t, fn) { e.listeners[t] = (e.listeners[t] || []).filter(function (f) { return f !== fn; }); },
    dispatchEvent: function (ev) { bubble(e, ev); return true; },
    setAttribute: function (k, v) { e.attrs[k] = String(v); if (k.indexOf('data-') === 0) e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })] = String(v); if (k === 'class') e.className = String(v); if (k === 'hidden') e.hidden = true; if (k === 'type') e.type = String(v); },
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
function all(el) { return [el].concat(el.children.reduce(function (a, c) { return a.concat(all(c)); }, [])); }
function byProfile(el, which) { return all(el).filter(function (x) { return x.getAttribute('data-profile') === which; })[0] || null; }

async function thePage() {
  test.subHeading('8. the page: names on bubbles, chat and List; the absent bubble; no key shown; the pane\'s two rows');
  const goalRow = { id: 'k/G1', title: 'Known', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], design: false, waiting: 0,
    live: [CW.label], working: [], excluded: [WSL.label], agents: { 'claude-windows': CW.key, 'wsl-claude': WSL.key },
    names: { 'claude-windows': 'Claude Windows', 'wsl-claude': 'WSL Claude' }, alone: false, alert: false, claims: 0, asks: 0, boxTaken: '' };
  const itemRow = { id: 'k/G1.1', title: 'Talk', goal: 'k/G1', status: 'running', with: CW.label, buttons: [], blocking: ['k/G1'], blocked: [], alone: false, alert: false,
    claims: 0, asks: 0, boxTaken: '', names: { 'claude-windows': 'Claude Windows' } };
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
      if (v === 'items.search') return Promise.resolve({ status: 200, body: { items: [{ key: 'k/G1', label: JSON.stringify(goalRow) }, { key: 'k/G1.1', label: JSON.stringify(itemRow) }], more: false } });
      if (v === 'profile.get') return Promise.resolve({ status: 200, body: { name: 'Claude Windows', nick: 'cw', included: true, cap: false } });
      if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [{ by: CW.label, key: CW.key, name: 'Claude Windows', at: new Date().toISOString(), text: 'hello team', taken: '' }], chatMore: false } });
      return Promise.resolve({ status: 200, body: { items: [], more: false, json: '{}', chat: [], chatMore: false, change: 1 } });
    },
    ui: { elements: {} },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    armUntilElsewhere: function () {}, fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  await settled();
  const tabs = byId['desk-tabs'] ? byId['desk-tabs'].innerHTML : '';
  const cwBubble = (/<span[^>]*data-bubble="claude-windows"[^>]*>([^<]*)<\/span>/.exec(tabs) || ['', ''])[1];
  if (cwBubble === 'Claude Windows') test.check('the presence bubble shows the name');
  else test.fail(OWED + 'claude-windows\'s bubble reads ' + short(cwBubble));
  const wslBubble = (/<span[^>]*data-bubble="wsl-claude"[^>]*>/.exec(tabs) || [''])[0];
  if (/data-absent="1"/.test(wslBubble)) test.check('an excluded agent\'s bubble shows absent');
  else test.fail(OWED + 'wsl-claude\'s bubble reads ' + short(wslBubble));
  const pageHtml = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n') + container.innerHTML; };
  if (/Claude Windows/.test(byId['desk-list'] ? byId['desk-list'].innerHTML : pageHtml()) && !/<td>claude-windows<\/td>/.test(pageHtml())) test.check('the List names the taker by name');
  else test.fail(OWED + 'the List: ' + short((/<td>[^<]*claude[^<]*<\/td>/i.exec(pageHtml()) || [''])[0]));
  const team = node('button');
  team.setAttribute('data-tab', 'team');
  doc.getElementById('desk-tabs').appendChild(team);
  bubble(team, { type: 'click', bubbles: true, currentTarget: doc.getElementById('desk-tabs'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  if (/<b>Claude Windows<\/b>/.test(pageHtml())) test.check('the group chat line shows the name');
  else test.fail(OWED + 'the group chat: ' + short((/<b>[^<]*<\/b>[^<]*<span[^>]*>[^<]*<\/span> hello team/.exec(pageHtml()) || ['no line'])[0]));
  const t = node('button');
  t.setAttribute('data-tab', 'agent:claude-windows');
  doc.getElementById('desk-tabs').appendChild(t);
  bubble(t, { type: 'click', bubbles: true, currentTarget: doc.getElementById('desk-tabs'), preventDefault: function () {}, stopPropagation: function () {} });
  await settled();
  if (pageHtml().indexOf(CW.key) === -1 && pageHtml().indexOf(WSL.key) === -1) test.check('no key is shown on the page');
  else test.fail(OWED + 'a key is on the page');
  const slot = byId['desk-agent-picker'];
  const rows = slot ? slot.children.filter(function (c) { return c.getAttribute('data-profile-row') !== null; }) : [];
  const name = slot && byProfile(slot, 'name');
  const nick = slot && byProfile(slot, 'nick');
  const inc = slot && byProfile(slot, 'included');
  const cap = slot && byProfile(slot, 'cap');
  const inRow = function (el, r) { return !!(el && r && r.contains(el)); };
  if (rows.length === 2 && inRow(name, rows[0]) && inRow(nick, rows[0]) && inRow(inc, rows[1]) && inRow(cap, rows[1])) test.check('the pane: row one name and nick, row two included and cap');
  else test.fail(OWED + 'the pane: ' + rows.length + ' rows; name ' + !!name + ', nick ' + !!nick + ', included ' + !!inc + ', cap ' + !!cap);
  if (inc && cap && inc.checked === true && cap.checked === false && name && name.value === 'Claude Windows') test.check('the pane reads the profile: included on, cap off');
  else test.fail(OWED + 'the pane read: included ' + (inc && inc.checked) + ', cap ' + (cap && cap.checked));
  if (cap) {
    cap.checked = true;
    (cap.listeners.change || []).forEach(function (fn) { fn({ target: cap }); });
    await settled();
  }
  const sets = asked.filter(function (a) { return a.verb === 'profile.set'; });
  const last = sets[sets.length - 1] || {};
  if (last.args && last.args.agent === CW.key && last.args.cap === true && last.args.included === true && last.args.nick === 'cw') test.check('toggling cap writes the profile with it at once');
  else test.fail(OWED + 'toggling cap asked ' + short(sets));
}

async function theDialog() {
  test.subHeading('9. the item dialog: chat lines and the box taker by name');
  const byId = {};
  const doc = { getElementById: function (id) { if (!byId[id]) { byId[id] = node('div'); byId[id].id = id; } return byId[id]; }, createElement: node };
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))({ shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, {});
  const f = { id: 'k/G1.1', title: 'Talk', goal: 'k/G1', status: '', with: CW.label, buttons: [], blocking: [], blocked: [], boxTaken: CW.label,
    names: { 'claude-windows': 'Claude Windows' }, files: [{ path: 'a.js', by: CW.label, core: false }] };
  dd.mount(node('div'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask ? Object.keys(ask)[0] : '';
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(f), version: 1, change: 1 } });
      if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: 'text', version: 1 } });
      if (v === 'item.checks') return Promise.resolve({ status: 200, body: { checks: [] } });
      if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [{ by: CW.label, key: CW.key, name: 'Claude Windows', at: new Date().toISOString(), text: 'in the dialog', taken: '' }], chatMore: false } });
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function () {}, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  await dd.open({ id: 'k/G1.1' });
  await settled();
  const html = Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n');
  if (/<b>Claude Windows<\/b>/.test(html)) test.check('a chat line in the dialog shows the name');
  else test.fail(OWED + 'the dialog\'s chat: ' + short((/<b>[^<]*<\/b>[^<]*<span[^>]*>[^<]*<\/span> in the dialog/.exec(html) || ['no line'])[0]));
  if (/title="Claude Windows is changing this box"/.test(html)) test.check('the red box names its taker by name');
  else test.fail(OWED + 'the box taker: ' + short((/title="[^"]*changing this box"/.exec(html) || ['none'])[0]));
  if (/\(Claude Windows\)/.test(html)) test.check('the files list names the writer by name');
  else test.fail(OWED + 'the files list: ' + short((/data-file="a.js"[^\n]*/.exec(html) || ['none'])[0]));
  if (html.indexOf(CW.key) === -1) test.check('no key in the dialog');
  else test.fail(OWED + 'a key is in the dialog');
}
