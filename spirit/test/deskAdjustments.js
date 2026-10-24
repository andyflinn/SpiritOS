'use strict';

// spirit/test/deskAdjustments.js
// goal/G33.6: Desk adjustments, after goal/G33.3. Red first; claude-windows wrote it and builds it (one agent). Andy's
// words that set it: "the main list may only show one single button, and it is the button for the next wanted
// user-action, so verify button for any done button, a done button before any close button. the detail shows all
// available buttons.", "and go before done etc....", "just in the list, a goal offers no done or closed while items
// are not done or closed, the goal offers those only in the detail panel anytime", "please don't show verifier-busy an
// any verify button, i can check that for myself", and "The desk verifier still thinks 'idling' is a run".
//
// WHAT IS ASSERTED, on the real rendering code (shell/desk/desk.js, shell/deskDetails/deskDetails.js) and the real desk:
//   a. a List row draws exactly one action button: the first, in the step order Go, Verify, Done, Close and then the
//      rest in the item's own order, among the buttons its facts offer.
//   b. in the List a goal draws no Done and no Close while any of its items is not done or closed; once all are, it may.
//   c. the detail panel draws every button offered; the desk offers a goal's Done and Close at any time.
//   d. no Verify button, in the List or the dialog, shows the verifier's busy state.
//   e. the Verifier tab: idle is no run (no "Running now", a grey bar that does not move, "Idle, nothing running");
//      the idle-hour countdown only when the verifier says it has chores (hasChores in what it publishes); during a run,
//      "Running now" and a moving bar.
//   f. the run in the status column (Andy: "why do i no longer see the verifier run in the items status column?"): the
//      row of the item handed over (its facts: verifyRunning) shows, from deskVerify's own run publishes, "verifying",
//      the suite running and a bar; other rows do not; after an idle publish the row shows its status word again. The
//      dialog shows the same, from the same shared rendering (shell/shared/js/deskRunStatus.js), in #dd-run.
// rule/11: through testSupport only; its desk has its own folder, its own environment file and a pretend node on a port
// of its own, never 65432; it stops only the processes it started.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/spirit/kernel.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G33.6: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const FACE = path.join(RUN, 'shell', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskAdjustmentsTestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G33.6: one button per List row, the next one wanted; a goal\'s Done and Close in the detail only while items are open; Verify shows no busy; idle is no run');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskadjustments-'));

function fakeElement(id) {
  let html = '';
  const attrs = {};
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function (n) { return n in attrs ? attrs[n] : null; }, setAttribute: function (n, v) { attrs[n] = String(v); }, removeAttribute: function (n) { delete attrs[n]; }, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function target(attrs) { return { id: attrs.id || '', getAttribute: function (n) { return attrs[n] || null; }, closest: function () { return null; }, parentNode: null }; }
function text(h) { return String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

// THE LIST: rows from their facts, as the desk answers them; the buttons each row draws.
async function listHalf() {
  test.subHeading('a, b, d. the List: one button per row, the next one wanted; a goal\'s Done and Close only once its items are');
  const row = function (id, buttons, extra) { return Object.assign({ id: id, title: id, goal: 'goal/G100', status: 'running', with: '', buttons: buttons, blocking: ['goal/G100'], blocked: [], asks: 0, claims: 1, verified: 'green', verifyFailures: [], verifierBusy: true, verifyAnswer: 'busy' }, extra || {}); };
  const goalRow = function (id, buttons, blocked) { return { id: id, title: id, goal: '', design: false, status: '', with: '', buttons: buttons, blocking: [], blocked: blocked, live: [], working: [], waiting: 0, verified: 'green', verifyFailures: [], verifierBusy: true, verifyAnswer: 'busy' }; };
  const fake = require('./deskFake.js').create([]);
  fake.items = [
    goalRow('goal/G100', ['done', 'close', 'verify', 'go-all'], ['goal/G100.1']),
    row('goal/G100.1', ['done', 'verify']),
    row('goal/G100.2', ['done', 'go']),
    row('goal/G100.3', ['close', 'done']),
    row('goal/G100.4', ['close', 'go', 'verify', 'done']),
    row('goal/G100.5', ['bring-back']),
  ];
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, { spirit: {} });
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function () { return function () {}; }, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  const all = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  const rowHtml = function (id) { return (new RegExp('<tr data-row="' + id.replace(/[./]/g, '\\$&') + '"[\\s\\S]*?</tr>').exec(all()) || [''])[0]; };
  const pressesOf = function (id) { const out = []; const re = /<button[^>]*data-press="([^"]+)"[^>]*>([^<]*)<\/button>/g; let m; const h = rowHtml(id); while ((m = re.exec(h))) out.push({ what: m[1], label: m[2], html: m[0] }); return out; };
  const one = function (id, want, why) {
    const p = pressesOf(id);
    if (p.length === 1 && p[0].what === want) test.check(id + ' (' + why + '): one button, ' + want);
    else test.fail(OWED + id + ' (' + why + ') draws ' + short(p.map(function (x) { return x.what; })) + ', where ' + want + ' alone is owed');
  };
  one('goal/G100.1', 'verify', 'offers done and verify');
  one('goal/G100.2', 'go', 'offers done and go');
  one('goal/G100.3', 'done', 'offers close and done');
  one('goal/G100.4', 'go', 'offers close, go, verify and done');
  one('goal/G100.5', 'bring-back', 'offers bring-back alone');
  const g = pressesOf('goal/G100');
  if (!g.some(function (x) { return x.what === 'done' || x.what === 'close'; })) test.check('a goal with an item still open draws no Done and no Close in the List: ' + short(g.map(function (x) { return x.what; })));
  else test.fail(OWED + 'the goal with an open item draws ' + short(g.map(function (x) { return x.what; })));
  const v = pressesOf('goal/G100.1').filter(function (x) { return x.what === 'verify'; })[0];
  if (v && !/busy/i.test(v.html)) test.check('the List\'s Verify shows no busy state: ' + short(v.label));
  else test.fail(OWED + 'the List\'s Verify reads ' + short(v && v.html));

  // ALL ITEMS DONE: the goal may offer Done in the List.
  const fake2 = require('./deskFake.js').create([]);
  fake2.items = [goalRow('goal/G101', ['done', 'close', 'verify'], []), row('goal/G101.1', ['close', 'reopen'], { goal: 'goal/G101', blocking: ['goal/G101'], status: 'done' })];
  const byId2 = {};
  const doc2 = { getElementById: function (id) { return byId2[id] || (byId2[id] = fakeElement(id)); } };
  let behavior2 = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior2 = x; } }, core: kernel.core }, doc2, { spirit: {} });
  behavior2.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake2.verb,
    onPublished: function () { return function () {}; }, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  const all2 = Object.keys(byId2).map(function (k) { return byId2[k].innerHTML; }).join('\n');
  const g2 = (/<tr data-row="goal\/G101"[\s\S]*?<\/tr>/.exec(all2) || [''])[0];
  const g2p = (g2.match(/data-press="([^"]+)"/g) || []).map(function (x) { return x.slice(12, -1); });
  if (g2p.length === 1 && g2p[0] === 'verify') test.check('with every item done the goal row draws its one next button, Verify before Done');
  else test.fail(OWED + 'the goal with every item done draws ' + short(g2p));
}

// THE DETAIL PANEL: every button offered.
async function dialogHalf() {
  test.subHeading('c, d. the detail panel: every button offered, a goal\'s Done and Close at any time; Verify shows no busy');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const FACTS = {
    'goal/G100': { id: 'goal/G100', title: 'Goal', goal: '', status: '', with: '', buttons: ['done', 'verify', 'go-all', 'close', 'make-current'], blocking: [], blocked: ['goal/G100.1'], asks: 0, verified: 'green', verifyFailures: [], verifierBusy: true, verifyAnswer: 'busy' },
    'goal/G100.4': { id: 'goal/G100.4', title: 'Item', goal: 'goal/G100', status: 'running', with: '', buttons: ['go', 'done', 'verify', 'waive', 'delete'], blocking: ['goal/G100'], blocked: [], asks: 0, claims: 1, code: true, verified: 'green', verifyFailures: [], verifierBusy: true, verifyAnswer: 'busy' },
  };
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, test.withSpirit({ addEventListener: function () {}, 'spirit.fieldRules': require('../run/spirit/fieldRules.js') }));
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
      const v = ask && Object.keys(ask)[0];
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(FACTS[ask[v].id] || {}), version: 1, change: 1 } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], files: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  const bar = function () { return doc.getElementById('dd-name-row').innerHTML; };
  for (const id of ['goal/G100', 'goal/G100.4']) {
    await dd.open({ id: id, agents: {} });
    await settled();
    const missing = FACTS[id].buttons.filter(function (b) { return bar().indexOf('id="dd-' + b + '"') === -1; });
    if (!missing.length) test.check(id + ': the detail panel draws every button offered: ' + FACTS[id].buttons.join(', '));
    else test.fail(OWED + id + ': the detail panel lacks ' + short(missing) + '; it reads ' + short(text(bar())));
    const verifyBtn = (/<button[^>]*id="dd-verify"[^>]*>[^<]*<\/button>/.exec(bar()) || [''])[0];
    if (verifyBtn && !/busy/i.test(verifyBtn)) test.check(id + ': its Verify shows no busy state: ' + short(text(verifyBtn)));
    else test.fail(OWED + id + ': its Verify reads ' + short(verifyBtn));
  }
}

// THE DESK: a goal's Done and Close are offered at any time (the List alone holds them back).
async function deskHalf() {
  test.subHeading('c. the desk offers a goal\'s Done and Close while its items are open');
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        { const na = test.nodeApi(j); if (na) { res.writeHead(na.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(na.body)); return; } }
        const out = test.foldAsk(j) === 'api' ? { desk: {} } : {};
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
      });
    }).listen(0, '127.0.0.1', function () { resolve({ port: s.address().port, close: function () { s.close(); } }); });
  });
  const root = path.join(scratch, 'desk');
  const state = path.join(root, 'state');
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  fs.mkdirSync(state, { recursive: true });
  fs.writeFileSync(path.join(root, 'relay-state', 'environment.json'), JSON.stringify({ PORT: node.port }));
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(root, 'desk', 'win32', 'process') : path.join(root, 'door.sock');
  const client = appClient.createAppClient({ rootDir: root });
  client.register('desk', pipe);
  // The world (goal/G33.7: session.set went), seeded before the desk starts.
  test.seedDesk(state, { goal: { id: 'goal/G102', title: 'Open' }, items: [{ id: 'goal/G102.1', title: 'Still open', blocks: ['goal/G102'] }] });
  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const call = function (verb, a) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, ANDY).then(function (r) { return r || {}; }, function () { return {}; }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: the desk did not start'); return; }
    await call('press', { id: 'goal/G102', what: 'end-design' });
    const g = parse(((await call('item.get', { id: 'goal/G102' })).body || {}).item) || {};
    const b = g.buttons || [];
    if (b.indexOf('done') !== -1 && b.indexOf('close') !== -1) test.check('a goal with an item still open is offered Done and Close (for the detail panel): ' + short(b));
    else test.fail(OWED + 'the goal with an open item is offered ' + short(b));
  } finally {
    await new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); });
    node.close();
  }
}

// THE VERIFIER TAB: idle is no run.
async function tabHalf() {
  test.subHeading('e. the Verifier tab: idle is no run; the countdown only with chores; a run reads Running now');
  const fake = require('./deskFake.js').create([]);
  fake.items = [{ id: 'goal/G100', title: 'Goal', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: [], live: [], working: [], waiting: 0 }];
  fake.verifier = { now: function () { return { busy: false, running: { suite: '', since: '' }, stopAsked: false }; }, stop: function () { return { stopped: false }; },
    console: function () { return { run: '', start: 0, from: 0, to: 0, more: false, ended: true, text: '' }; } };
  const handlers = {};
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function (fn, server) { (handlers[server || 'desk'] = handlers[server || 'desk'] || []).push(fn); }, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  await settled();
  const tabs = doc.getElementById('desk-tabs');
  for (let i = 0; i < 20 && tabs.innerHTML.indexOf('data-tab="verifier"') === -1; i++) { await sleep(50); await settled(); }
  tabs.fire('click', { target: target({ 'data-tab': 'verifier' }), currentTarget: tabs });
  await settled(); await sleep(30); await settled();
  const body = doc.getElementById('desk-verifier');
  const emit = async function (o) { (handlers.deskVerify || []).forEach(function (fn) { fn(o); }); await settled(); };
  const barOf = function () { return (/<progress[^>]*>/.exec(body.innerHTML) || [''])[0]; };
  const idleObj = function (extra) { return Object.assign({ doing: 'idle', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle, nothing running', since: new Date(Date.now() - 18 * 60000).toISOString(), stopAsked: false, idleMs: 3600000, chores: '' }, extra || {}); };

  await emit(idleObj({ hasChores: false }));
  const idle = body.innerHTML;
  if (!/Running now/.test(idle) && /Idle, nothing running/.test(text(idle)) && /data-phase="done"/.test(barOf()) && /value="0"/.test(barOf()) && !/Idle in \d+ min|hour filling/i.test(text(idle))) test.check('idle with no chores: no "Running now", "Idle, nothing running", a grey bar standing at 0, no countdown');
  else test.fail(OWED + 'the idle tab reads ' + short(text(idle)) + '; bar ' + short(barOf()));
  await emit(idleObj({ hasChores: true }));
  const withChores = body.innerHTML;
  if (!/Running now/.test(withChores) && /Idle in \d+ min/.test(text(withChores)) && /data-phase="done"/.test(barOf())) test.check('idle on a verifier with chores: the countdown to its idle hour, the bar still grey');
  else test.fail(OWED + 'the idle tab with chores reads ' + short(text(withChores)) + '; bar ' + short(barOf()));
  await emit({ doing: 'run', suite: 'spirit/test/zzA.js', index: 1, of: 2, tests: 3, expected: 6, line: 'running zzA.js, suite 1 of 2', since: new Date().toISOString(), stopAsked: false, idleMs: 3600000, chores: '' });
  const running = body.innerHTML;
  if (/Running now/.test(running) && /data-phase="run"/.test(barOf()) && !/value="0"/.test(barOf())) test.check('during a run: "Running now", and the bar moves');
  else test.fail(OWED + 'the tab during a run reads ' + short(text(running)) + '; bar ' + short(barOf()));
}

// ── f. THE RUN IN THE STATUS COLUMN, AND IN THE DIALOG ──
const RUN_STATUS = path.join(RUN, 'shell', 'shared', 'js', 'deskRunStatus.js');
// The page loads the shared rendering once; here it is read into the window the apps are handed, as the page's would be.
function sharedWindow(win) {
  try { new Function('window', fs.readFileSync(RUN_STATUS, 'utf8'))(win); } catch (e) { /* not there: the apps draw without it */ }
  return win;
}
const RUN_OBJ = { doing: 'run', suite: 'spirit/test/zzRunning.js', index: 1, of: 2, tests: 3, expected: 6, line: 'running zzRunning.js, suite 1 of 2', since: new Date().toISOString(), stopAsked: false, idleMs: 3600000, chores: '' };
const IDLE_OBJ = { doing: 'idle', suite: '', index: 0, of: 0, tests: 0, expected: 0, line: 'idle, nothing running', since: new Date().toISOString(), stopAsked: false, idleMs: 3600000, chores: '' };
async function runHalf() {
  test.subHeading('f. the run in the status column and in the dialog, from deskVerify\'s own publishes');
  const row = function (id, extra) { return Object.assign({ id: id, title: id, goal: 'goal/G103', status: 'handed to deskVerify', with: '', buttons: ['done', 'verify'], blocking: ['goal/G103'], blocked: [], asks: 0, claims: 1, verified: 'none', verifyFailures: [], verifyRunning: false }, extra || {}); };
  const fake = require('./deskFake.js').create([]);
  fake.items = [
    { id: 'goal/G103', title: 'Goal', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: ['goal/G103.1', 'goal/G103.2'], live: [], working: [], waiting: 0 },
    row('goal/G103.1', { verifyRunning: true }),
    row('goal/G103.2', { status: 'verified green', verified: 'green' }),
    // goal/G33.7 (box v10): ended runs, their outcome in the facts, the status word saying something else.
    row('goal/G103.3', { status: 'running', verified: 'red', verifyRed: 3, verifyFailures: ['spirit/test/a.js red: FAILURE #1 x'] }),
    row('goal/G103.4', { status: 'waiting for deskVerify', verified: 'green' }),
    // goal/G33.8 (box v13): a row his attention is wanted on (the phase holder wrote).
    row('goal/G103.5', { status: 'red', alert: true, title: 'MARKED-ITEM' }),
  ];
  const handlers = {};
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))({ shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, sharedWindow({ spirit: {} }));
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function (fn, server) { (handlers[server || 'desk'] = handlers[server || 'desk'] || []).push(fn); return function () {}; }, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  const emit = async function (o) { (handlers.deskVerify || []).forEach(function (fn) { fn(o); }); await settled(); await sleep(20); await settled(); };
  const all = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  const statusOf = function (id) {
    const tr = (new RegExp('<tr data-row="' + id.replace(/[./]/g, '\\$&') + '"[\\s\\S]*?</tr>').exec(all()) || [''])[0];
    const tds = tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
    return tds[tds.length - 1] || '';
  };
  await emit(RUN_OBJ);
  const running = statusOf('goal/G103.1');
  if (/verifying/i.test(text(running)) && /zzRunning\.js/.test(running) && /<progress/.test(running)) test.check('the row of the item handed over shows the run: ' + short(text(running)));
  else test.fail(OWED + 'the handed-over row\'s status column reads ' + short(running));
  const other = statusOf('goal/G103.2');
  if (!/<progress/.test(other) && !/zzRunning/.test(other)) test.check('and no other row does');
  else test.fail(OWED + 'another row shows the run: ' + short(other));
  await emit(IDLE_OBJ);
  const back = statusOf('goal/G103.1');
  if (!/<progress/.test(back) && /handed to deskVerify/.test(back)) test.check('after an idle publish the row shows its status word again');
  else test.fail(OWED + 'after idle the row reads ' + short(back));
  // goal/G33.7 (box v10, Andy: he "can't tell whether a Verify succeeded"): once a run ended, the row says its outcome
  // from the facts, "verified green" or "red: N suites", until the next run starts.
  const redRow = text(statusOf('goal/G103.3'));
  const greenRow = text(statusOf('goal/G103.4'));
  if (/red: 3 suites/.test(redRow) && /verified green/.test(greenRow)) test.check('ended runs show their outcome in the status column: ' + short(redRow) + ' / ' + short(greenRow));
  else test.fail('OWED by goal/G33.7: the status column of an ended red run reads ' + short(redRow) + ', of a green one ' + short(greenRow));

  // goal/G33.8 (box v11): publishes can overtake each other; the List drops only an older version of the same row, so
  // an earlier write's row of another item, arriving after a later write's, is still drawn.
  const deskEmit = async function (o) { (handlers.desk || []).forEach(function (fn) { fn(o); }); await settled(); await sleep(20); await settled(); };
  await deskEmit({ change: 50, verb: 'chat.add', item: row('goal/G103.2', { status: 'LATER-ROW', verified: 'none' }), listed: true, key: { goal: 103, item: 2 } });
  await deskEmit({ change: 49, verb: 'item.status', item: row('goal/G103.1', { status: 'EARLIER-ROW' }), listed: true, key: { goal: 103, item: 1 } });
  await deskEmit({ change: 48, verb: 'item.status', item: row('goal/G103.2', { status: 'OLDER-ROW', verified: 'none' }), listed: true, key: { goal: 103, item: 2 } });
  if (/EARLIER-ROW/.test(statusOf('goal/G103.1')) && /LATER-ROW/.test(statusOf('goal/G103.2'))) test.check('an earlier write\'s row of another item, arriving last, is drawn; an older version of the same row is not');
  else test.fail('OWED by goal/G33.8: after changes 50, 49, 48 the rows read ' + short(text(statusOf('goal/G103.1'))) + ' / ' + short(text(statusOf('goal/G103.2'))));

  // goal/G33.8 (box v12; Andy: "it's really hard to tell the goal from it's items in the list", and his Done meant for
  // goal/G33.8 landed on goal/G33): (A) the goal row is clearly distinct, a goal sign in its icon cell and a shaded row;
  // (B) an item's row carries no link to its own goal.
  const rowRe = function (id, rest) { return new RegExp('<tr data-row="' + id.replace(/[./]/g, '\\$&') + '"' + rest); };
  const trOf = function (id) { return (rowRe(id, '[^>]*>').exec(all()) || [''])[0]; };
  const cellsOf = function (id) { return ((rowRe(id, '[\\s\\S]*?</tr>').exec(all()) || [''])[0]).match(/<td[^>]*>[\s\S]*?<\/td>/g) || []; };
  const goalTr = trOf('goal/G103');
  const itemTr = trOf('goal/G103.1');
  const goalIcon = (cellsOf('goal/G103')[1] || '');
  const itemIcon = (cellsOf('goal/G103.1')[1] || '');
  if (/data-goal="1"/.test(goalTr) && /background/.test(goalTr) && !/data-goal/.test(itemTr) && !/background/.test(itemTr) && text(goalIcon).trim() && text(goalIcon) !== text(itemIcon)) test.check('the goal row is marked data-goal, shaded, with a goal sign; an item row is none of these');
  else test.fail('OWED by goal/G33.8: the goal row ' + short(goalTr) + ' icon ' + short(goalIcon) + '; an item row ' + short(itemTr) + ' icon ' + short(itemIcon));
  // goal/G33.8 (box v13; Andy: "it's enough to put a red ! next to the item"): a marked row is not drawn red; a red !
  // stands beside its title and id, the rest of the row in its normal colour.
  const markedTr = trOf('goal/G103.5');
  const markedTitle = (cellsOf('goal/G103.5')[2] || '');
  if (!/#d00/.test(markedTr) && /data-alert-mark/.test(markedTitle) && /color:#d00[^>]*>!</.test(markedTitle)) test.check('a marked row keeps its colour, and a red ! stands beside its title');
  else test.fail('OWED by goal/G33.8: the marked row ' + short(markedTr) + ', its title cell ' + short(markedTitle));
  const itemLinks = cellsOf('goal/G103.1').join('');
  if (!/data-open="goal\/G103"/.test(itemLinks)) test.check('an item\'s row carries no link to its own goal');
  else test.fail('OWED by goal/G33.8: goal/G103.1\'s row links its own goal: ' + short(itemLinks));

  // THE DIALOG: the same rendering, in #dd-run.
  const dById = {};
  const ddoc = { getElementById: function (id) { return dById[id] || (dById[id] = fakeElement(id)); } };
  const dHandlers = {};
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, ddoc, sharedWindow(test.withSpirit({ addEventListener: function () {}, 'spirit.fieldRules': require('../run/spirit/fieldRules.js') })));
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
      const v = ask && Object.keys(ask)[0];
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(row('goal/G103.1', { verifyRunning: true, verified: 'red', verifyRed: 2 })), version: 1, change: 1 } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], files: [], box: '', version: 1 } });
    },
    onPublished: function (fn, server) { (dHandlers[server || 'desk'] = dHandlers[server || 'desk'] || []).push(fn); return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  await dd.open({ id: 'goal/G103.1', agents: {} });
  await settled();
  const dEmit = async function (o) { (dHandlers.deskVerify || []).forEach(function (fn) { fn(o); }); await settled(); await sleep(20); await settled(); };
  await dEmit(RUN_OBJ);
  const dRun = ddoc.getElementById('dd-run').innerHTML;
  if (/verifying/i.test(text(dRun)) && /zzRunning\.js/.test(dRun) && /<progress/.test(dRun)) test.check('the dialog shows the same run: ' + short(text(dRun)));
  else test.fail(OWED + 'the dialog\'s #dd-run reads ' + short(dRun) + ' (deskVerify subscribed: ' + !!dHandlers.deskVerify + ')');
  await dEmit(IDLE_OBJ);
  const dIdle = ddoc.getElementById('dd-run').innerHTML;
  if (!/<progress/.test(dIdle)) test.check('and drops it on an idle publish');
  else test.fail(OWED + 'the dialog after idle reads ' + short(dIdle));
  // goal/G33.8 (box v12): the item's dialog carries no link to its own goal either.
  ddoc.getElementById('dd-body').fire('click', { target: target({ 'data-panel': 'blocks' }), preventDefault: function () {} });
  await settled();
  const dLinks = Object.keys(dById).map(function (k) { return dById[k].innerHTML; }).join('\n');
  if (!/data-open="goal\/G103"/.test(dLinks)) test.check('the item\'s dialog carries no link to its own goal');
  else test.fail('OWED by goal/G33.8: the dialog of goal/G103.1 links its own goal');
  if (/red: 2 suites/.test(text(dIdle))) test.check('then the dialog shows the ended run\'s outcome, the same way: ' + short(text(dIdle)));
  else test.fail('OWED by goal/G33.7: the dialog after the run reads ' + short(text(dIdle)));
}

(async function () {
  await listHalf();
  await dialogHalf();
  await deskHalf();
  await tabHalf();
  await runHalf();
})().catch(function (e) { test.fail(OWED + 'the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
