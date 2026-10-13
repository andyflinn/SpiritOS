'use strict';

// spirit/test/deskRedQOnPurpose.js
// goal/G21.2: a red Q is placed on purpose. Red on today's tree; claude-windows wrote it and builds it (one agent).
// The item's box, Andy's decisions:
//   - A red Q is a concise question placed with deliberation, to block an item until it is resolved.
//   - A question mark in a chat line never makes a red Q; only a deliberate Q check does.
//   - One open red Q per agent per item: a second is refused until the first is answered or cleared.
//   - A Q longer than one sentence, or over about 200 bytes, is refused with a why.
//   - Andy clears them himself: Q:clear deletes every red Q on the item; Q<n>:clear deletes only that one.
//   - When Andy clears a Q, the agent that placed it is notified; a clear is a form of reply, so the agent updates its
//     position on that question.
//   - A red Q clicked into Andy's chat box arrives followed by two newlines, so the question stands apart from the
//     answer he writes below it.
//
// THE SHAPES THIS SUITE NAMES (the box names none):
//   - His clear is a chat line of his, typed "Q:clear" or "Q<n>:clear" (case and blanks ignored), kept in the chat;
//     each Q it clears goes to state 'cleared' by a check.set record of his, addressed (to) the key that placed it,
//     so the placer's changes carry it and another agent's do not. A cleared Q leaves the panel as an answered one.
//   - A clear that names nothing open is refused with a why, and no line is kept.
//   - "One sentence": no sentence end (. ! ?) followed by more text, and no line break; at most 200 bytes, in bytes.
//   - Existing records: an open Q raised from a chat line before goal/G21.2 stays open after a restart.
// rule/11: through testSupport only; its own folders; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { DatabaseSync } = require('node:sqlite');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G21.2: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskRedQOnPurposeTestCWAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskRedQOnPurposeTestWSLAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskRedQOnPurposeTestOwnerAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 10; i++) await settle(); }

test.startTest('goal/G21.2: a red Q is placed on purpose, one per agent, one sentence, cleared by Andy');

(async function () {
  await theServer();
  await theDialog();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 300);
});

async function theServer() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskredq-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return (r && r.body) || {}; }, function () { return {}; }); };
  let kid = null;
  const start = async function () {
    kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
    return false;
  };
  const stop = function () { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); };
  const qsOf = async function (id) { return (((await call('item.checks', { id: id }, ANDY)).checks) || []).filter(function (c) { return c.kind === 'Q'; }); };
  const openQs = async function (id) { return (await qsOf(id)).filter(function (c) { return c.state === 'open'; }); };
  const chatOf = async function (id) { return ((await call('item.chat', { id: id }, ANDY)).chat) || []; };
  const facts = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.item); } catch (e) { return {}; } };
  const why = function (r) { return r && r.extra && r.extra.why ? String(r.extra.why) : ''; };
  const ask = function (id, words, who) { return call('check.add', { id: id, kind: 'Q', words: words, test: '' }, who); };
  const lastN = async function () { const r = await call('item.get', { id: 'q/G1' }, ANDY); return Number(r.change) || 0; };
  const recordsFor = async function (from, caller) {
    const out = [];
    let n = from;
    for (let i = 0; i < 50; i++) {
      const r = await call('changes', { n: n, line: 1e12 }, caller);
      if (!Array.isArray(r.records)) return out;
      r.records.forEach(function (x) { out.push(x); });
      if (!r.more) return out;
      n = r.n;
    }
    return out;
  };
  const clearsIn = function (recs, id, number) {
    return recs.some(function (x) {
      if (x.verb !== 'check.set') return false;
      let b = {}; try { b = JSON.parse(x.body); } catch (e) { b = {}; }
      return b.id === id && b.check === number && b.state === 'cleared';
    });
  };
  try {
    if (!await start()) { test.fail('the world: the desk did not start'); return; }
    const items = ['q/G1.1', 'q/G1.2', 'q/G1.3', 'q/G1.4', 'q/G1.5', 'q/G1.6', 'q/G1.7'].map(function (id) { return { id: id, title: 'Item ' + id, blocks: ['q/G1'] }; });
    await call('session.set', { json: JSON.stringify({ goal: { id: 'q/G1', title: 'Red Qs' }, items: items }) }, CW);
    await call('agent.state', { word: 'listening' }, CW);
    await call('agent.state', { word: 'listening' }, WSL);

    test.subHeading('1. a question mark in a chat line never makes a red Q');
    await call('item.take', { id: 'q/G1.1' }, WSL);
    const said = await call('chat.add', { id: 'q/G1.1', text: 'wsl: should the keys stay in the owner row?' }, WSL);
    const after1 = await qsOf('q/G1.1');
    const line1 = (await chatOf('q/G1.1')).filter(function (l) { return /owner row/.test(l.text); })[0] || {};
    if (said.change && after1.length === 0) test.check('an agent line ending in "?" is kept and raises no Q');
    else test.fail(OWED + 'the "?" line answered ' + short(said) + ' and raised ' + short(after1));
    if (line1.text && line1.q === undefined) test.check('the line carries no Q number');
    else test.fail(OWED + 'the line reads ' + short(line1));

    test.subHeading('2. a deliberate Q check is a red Q, by the agent that placed it, and blocks');
    const placed = await ask('q/G1.1', 'Should the keys stay in the owner row?', WSL);
    const open2 = await openQs('q/G1.1');
    if (placed.change && open2.length === 1 && open2[0].words === 'Should the keys stay in the owner row?') test.check('check.add kind Q places one open red Q with its words');
    else test.fail(OWED + 'check.add answered ' + short(placed) + '; open Qs ' + short(open2));
    const f2 = await facts('q/G1.1');
    if (f2.green === false && f2.asks > 0) test.check('the item is held: not green, and waiting on Andy');
    else test.fail(OWED + 'the item\'s facts: green ' + short(f2.green) + ', asks ' + short(f2.asks));

    test.subHeading('3. one open red Q per agent per item');
    const second = await ask('q/G1.1', 'And the whoBook?', WSL);
    if (second.ok === false && why(second)) test.check('a second open Q by the same agent is refused, with a why: ' + short(why(second)));
    else test.fail(OWED + 'a second Q by wsl-claude answered ' + short(second));
    const other = await ask('q/G1.1', 'Does the restore keep it?', CW);
    if (other.change) test.check('another agent may place its own Q on the same item');
    else test.fail(OWED + 'claude-windows\'s Q answered ' + short(other));
    const elsewhere = await ask('q/G1.2', 'Is the second item fine?', WSL);
    if (elsewhere.change) test.check('the same agent may place a Q on another item');
    else test.fail(OWED + 'wsl-claude\'s Q on another item answered ' + short(elsewhere));
    const firstNumber = open2.length ? open2[0].number : 'Q1';
    await call('check.set', { id: 'q/G1.1', check: firstNumber, state: 'answered' }, WSL);
    const afterAnswer = await ask('q/G1.1', 'And the whoBook?', WSL);
    if (afterAnswer.change) test.check('once its first is answered, the agent may place another');
    else test.fail(OWED + 'after answering, wsl-claude\'s Q answered ' + short(afterAnswer));

    test.subHeading('4. one sentence, at most about 200 bytes, refused with a why');
    const two = await ask('q/G1.3', 'The keys move. Should the whoBook move too?', WSL);
    if (two.ok === false && why(two)) test.check('two sentences are refused, with a why: ' + short(why(two)));
    else test.fail(OWED + 'a two-sentence Q answered ' + short(two));
    const broken = await ask('q/G1.3', 'Should the keys move\nwith the whoBook?', WSL);
    if (broken.ok === false && why(broken)) test.check('a Q across two lines is refused, with a why');
    else test.fail(OWED + 'a two-line Q answered ' + short(broken));
    const long = await ask('q/G1.3', 'Should ' + 'the keys and '.repeat(16) + 'the whoBook move?', WSL);
    if (long.ok === false && why(long)) test.check('a Q over 200 bytes is refused, with a why: ' + short(why(long)));
    else test.fail(OWED + 'a long Q answered ' + short(long));
    const wide = 'Is ' + 'é'.repeat(97) + ' right?';
    const wideQ = await ask('q/G1.3', wide, WSL);
    if (wide.length <= 200 && Buffer.byteLength(wide) > 200 && wideQ.ok === false) test.check('counted in bytes: ' + wide.length + ' characters, ' + Buffer.byteLength(wide) + ' bytes, refused');
    else test.fail(OWED + 'a Q of ' + wide.length + ' characters and ' + Buffer.byteLength(wide) + ' bytes answered ' + short(wideQ));
    const fine = await ask('q/G1.3', 'Does goal/G21.2 keep e.g.-style dots in names like desk.js working?', WSL);
    if (fine.change) test.check('one sentence with dots inside words is taken');
    else test.fail(OWED + 'a one-sentence Q answered ' + short(fine));

    test.subHeading('5. Andy clears them: Q:clear every red Q, Q<n>:clear that one');
    await ask('q/G1.4', 'First from wsl?', WSL);
    await ask('q/G1.4', 'First from cw?', CW);
    const n5 = await lastN();
    const one = await call('chat.add', { id: 'q/G1.4', text: '  q2 : CLEAR ' }, ANDY);
    const left = await openQs('q/G1.4');
    if (one.change && left.length === 1 && left[0].number === 'Q1') test.check('"q2 : CLEAR" clears Q2 alone (case and blanks ignored)');
    else test.fail(OWED + 'after "q2 : CLEAR" the open Qs are ' + short(left) + '; the line answered ' + short(one));
    if ((await qsOf('q/G1.4')).every(function (c) { return c.number !== 'Q2'; })) test.check('the cleared Q leaves the panel');
    else test.fail(OWED + 'the panel still holds Q2: ' + short(await qsOf('q/G1.4')));
    const kept = (await chatOf('q/G1.4')).filter(function (l) { return l.by === 'andy'; });
    if (kept.length === 1 && /clear/i.test(kept[0].text)) test.check('his clear line stays in the chat as his action');
    else test.fail(OWED + 'his lines in the chat: ' + short(kept));
    const recCw = await recordsFor(n5, CW);
    const recWsl = await recordsFor(n5, WSL);
    if (clearsIn(recCw, 'q/G1.4', 'Q2')) test.check('the agent that placed Q2 is notified: its changes carry the clear');
    else test.fail(OWED + 'claude-windows\'s changes after the clear: ' + short(recCw.map(function (x) { return x.verb + ' ' + x.body; })));
    if (!clearsIn(recWsl, 'q/G1.4', 'Q2')) test.check('the clear of Q2 is addressed to its placer, not handed to another agent');
    else test.fail(OWED + 'wsl-claude was handed the clear of claude-windows\'s Q2');
    await ask('q/G1.5', 'Is this one held?', WSL);
    await ask('q/G1.5', 'Is that one held?', CW);
    const n6 = await lastN();
    const all = await call('chat.add', { id: 'q/G1.5', text: 'Q:clear' }, ANDY);
    const none = await openQs('q/G1.5');
    if (all.change && none.length === 0) test.check('"Q:clear" clears every red Q on the item');
    else test.fail(OWED + 'after "Q:clear" the open Qs are ' + short(none));
    const f5 = await facts('q/G1.5');
    if (f5.green === true && !f5.asks) test.check('cleared Qs no longer hold the item');
    else test.fail(OWED + 'after the clear: green ' + short(f5.green) + ', asks ' + short(f5.asks));
    if (clearsIn(await recordsFor(n6, WSL), 'q/G1.5', 'Q1') && clearsIn(await recordsFor(n6, CW), 'q/G1.5', 'Q2')) test.check('each placer is notified of its own Q\'s clear');
    else test.fail(OWED + 'the clears did not reach both placers');
    if ((await openQs('q/G1.4')).length === 1) test.check('a clear on one item touches no other item');
    else test.fail(OWED + 'q/G1.4\'s open Qs after clearing q/G1.5: ' + short(await openQs('q/G1.4')));
    const again = await ask('q/G1.5', 'Placed again after the clear?', WSL);
    if (again.change) test.check('after his clear the agent may place a Q again');
    else test.fail(OWED + 'a Q after the clear answered ' + short(again));
    const nothing = await call('chat.add', { id: 'q/G1.6', text: 'Q3:clear' }, ANDY);
    if (nothing.ok === false && why(nothing)) test.check('a clear naming no open Q is refused, with a why: ' + short(why(nothing)));
    else test.fail(OWED + '"Q3:clear" on an item with no Qs answered ' + short(nothing));
    await call('item.take', { id: 'q/G1.6' }, WSL);
    await ask('q/G1.6', 'Can an agent clear it?', WSL);
    await call('chat.add', { id: 'q/G1.6', text: 'Q:clear' }, WSL);
    if ((await openQs('q/G1.6')).length === 1) test.check('an agent\'s "Q:clear" is a chat line and clears nothing');
    else test.fail(OWED + 'an agent\'s "Q:clear" cleared ' + short(await qsOf('q/G1.6')));

    test.subHeading('6. an open red Q holds a press until it is cleared');
    await call('session.set', { json: JSON.stringify({ goal: { id: 'p/G1', title: 'Press' }, items: [{ id: 'p/G1.1', title: 'Held', blocks: ['p/G1'] }] }) }, CW);
    await ask('p/G1.1', 'Is the shape settled?', WSL);
    const held = await call('press', { id: 'p/G1', what: 'end-design' }, ANDY);
    await call('chat.add', { id: 'p/G1.1', text: 'Q1:clear' }, ANDY);
    const freed = await call('press', { id: 'p/G1', what: 'end-design' }, ANDY);
    if (held.ok === false && freed.change) test.check('End design is refused while the Q is open and taken once Andy cleared it');
    else test.fail(OWED + 'end-design held ' + short(held) + ', after the clear ' + short(freed));

    test.subHeading('7. existing open checks stay as they are');
    await call('item.take', { id: 'q/G1.7' }, WSL);
    await call('chat.add', { id: 'q/G1.7', text: 'wsl: an old question, before goal/G21.2?' }, WSL);
    await stop();
    const db = new DatabaseSync(path.join(state, 'desk.db'));
    db.prepare('INSERT INTO records (at, verb, by, key, body) VALUES (?, ?, ?, ?, ?)').run(new Date().toISOString(), 'check.add', WSL.label, WSL.key,
      JSON.stringify({ id: 'q/G1.7', kind: 'Q', words: 'an old question, before goal/G21.2?', test: '', asked: WSL.label, forLine: 0 }));
    db.close();
    if (!await start()) { test.fail('the world: the desk did not start again'); return; }
    const old = (await openQs('q/G1.7')).filter(function (c) { return c.words === 'an old question, before goal/G21.2?'; });
    const oldLine = (await chatOf('q/G1.7'))[0] || {};
    if (old.length === 1 && oldLine.q === old[0].number) test.check('a Q raised from a line before goal/G21.2 stays open, its line still marked');
    else test.fail(OWED + 'the old Q reads ' + short(old) + '; its line ' + short(oldLine));
  } finally {
    await stop();
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  }
}

async function theDialog() {
  test.subHeading('8. a red Q clicked into his chat box arrives followed by two newlines');
  const byId = {};
  const doc = { getElementById: function (id) { if (!byId[id]) { byId[id] = node('div'); byId[id].id = id; } return byId[id]; }, createElement: node };
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))({ shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, {});
  const f = { id: 'k/G1.1', title: 'Talk', goal: 'k/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], names: {}, files: [] };
  dd.mount(node('div'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const a = body && body.ask && body.ask.desk;
      const v = a ? Object.keys(a)[0] : '';
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(f), version: 1, change: 1 } });
      if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: 'text', version: 1 } });
      if (v === 'item.checks') return Promise.resolve({ status: 200, body: { checks: [{ number: 'Q1', kind: 'Q', words: 'Which port?', test: '', state: 'open', by: '', at: '' }] } });
      if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], chatMore: false } });
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function () {}, onPacket: function () {}, peerPost: function () { return Promise.resolve({ ok: true }); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  await dd.open({ id: 'k/G1.1' });
  await settled();
  const click = function () { const t = node('div'); t.setAttribute('data-question', 'Q1'); doc.getElementById('dd-body').dispatchEvent({ type: 'click', target: t, preventDefault: function () {} }); };
  const say = doc.getElementById('dd-say');
  say.value = '';
  click();
  await settled();
  const first = say.value;
  say.value = 'my answer';
  click();
  await settled();
  if (first === 'Q1: Which port?\n\n') test.check('into an empty box: "Q1: Which port?" and two newlines');
  else test.fail(OWED + 'into an empty box the click wrote ' + short(first));
  if (say.value === 'my answer\nQ1: Which port?\n\n') test.check('after his text: on a line of its own, then two newlines');
  else test.fail(OWED + 'after "my answer" the box holds ' + short(say.value));
}

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
    dispatchEvent: function (ev) { (e.listeners[ev.type] || []).slice().forEach(function (fn) { fn.call(e, ev); }); return true; },
    setAttribute: function (k, v) { e.attrs[k] = String(v); if (k.indexOf('data-') === 0) e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })] = String(v); if (k === 'class') e.className = String(v); },
    getAttribute: function (k) { if (k.indexOf('data-') === 0) { const d = e.dataset[k.slice(5).replace(/-([a-z])/g, function (m, ch) { return ch.toUpperCase(); })]; return d === undefined ? null : d; } return e.attrs[k] === undefined ? null : e.attrs[k]; },
    removeAttribute: function (k) { delete e.attrs[k]; },
    closest: function (sel) { for (let n = e; n; n = n.parentNode) { const a = /^\[([\w-]+)\]$/.exec(sel); if (a && n.getAttribute && n.getAttribute(a[1]) !== null) return n; } return null; },
    contains: function (x) { for (let n = x; n; n = n.parentNode) if (n === e) return true; return false; },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    focus: function () {}, select: function () {}, blur: function () {},
  };
  e.classList = { add: function () {}, remove: function () {}, toggle: function () {}, contains: function () { return false; } };
  Object.defineProperty(e, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); e.children = []; }, enumerable: true });
  return e;
}
