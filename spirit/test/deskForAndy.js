'use strict';

// goal/G4.20: Desk for Andy. Red on today's tree; wsl-claude wrote it, claude-windows builds it.
//   His words are in goal/G4.20's box (v4), split from goal/G4.18. The DECIDED points this suite holds:
//   1  search: "the search should search the database, and return matches, one extra search filter toggle
//      [include closed] would do the trick on my side."
//   2  Reopen: "re-open maybe should retract the done status, not only the closed status"; "agreed: \"Reopen takes
//      back Done as well as Close\""
//   3  Done: "when the done button appears it also shows number of claims [Done (2)]"; "i don't want to have a done
//      button on an item, when nobody claimed done."
//   8  the star: "ha ha, the red star has no function anymore. take it out."
//   9  takes: "anybody that takes somethings that affects the box, and the box is red. cap also."
//   10-11 the waiting list: "the Grants are red arm-buttons that turn green and are logged, and questions are
//      red-text that disappears when you feel i answered usefully."; "when i click on a question, it appends a line
//      in my input box, referencing that question?"; "the questions number and the text (for me)"; and ICON.ERROR
//      on the row exactly while that list is not empty ("if those two things would match at all times, id know
//      exactly where i need to navigate to.").
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  items.search's request gains includeClosed (false by default in the List): true answers closed items too.
//      The List draws a toggle #desk-include-closed beside #desk-current-goal; a click asks items.search again
//      with includeClosed flipped. The List's every items.search carries includeClosed.
//   2  buttons() of a closed item is ['reopen']. press reopen clears done AND closed; go stays true; the claims go,
//      so Done is not offered again by accident, and Go is not offered (his Go is kept).
//   3  facts gain claims: the number of agents that claimed done. The dialog's Done reads "Done (n)".
//   8  facts lose star; the List draws no DESK_UNSEEN; the dialog presses no seen for a star. agentLineN goes with
//      it. (alert, the bring-back ❗, stays: it is not the star.)
//   9  A new desk verb box.take {id} (a Desk verb, not a node verb): an agent takes the box before a change it
//      will write (cap, split, "update the box"). facts gain boxTaken: the taker's name, '' when none. While it
//      stands another agent's box.take and box.write are refused 'taken'; the taker's box.write clears it. Andy
//      takes nothing (bad-request), as line.take. The dialog draws the box with data-taken="<taker>" and a red
//      border while boxTaken is set. Words his lines race on (green, explain, "push it") stay line.take's.
//   10-11 THE WAITING LIST IS THE CHECKS, two more kinds: G (a grant) and Q (a question), beside C (how he checks
//      it, his Done verifications) and T. check.set gains two states: granted (a G, Andy alone; an agent is refused
//      not-owner) and answered (a Q, an agent's). facts gain asks: the number of open G, open Q, and open C
//      while Done is offered. The List row shows ICON.ERROR exactly while asks > 0 — so an item that offers
//      Close alone (design mode) shows none. The dialog draws #dd-waiting between #dd-box and #dd-say:
//      an open G a red arm-button data-grant="G1" (first click arms, second sends check.set state granted),
//      a granted G green with data-granted="G1", an open Q red text data-question="Q1" with its number and words;
//      a click on it appends "Q1: <words>" as a line of its own to #dd-say. An answered Q is not drawn.
//
// LEFT OPEN, not asserted: whether a Go offered, or a Done offered with no C written, counts in asks; whether
//   includeClosed also shows an abandoned goal's items; the commit check enforcing grants (TO SHAPE in the box).
//   Older suites assert what this replaces (deskRules B3: a closed item offers no buttons; deskList and
//   deskDialogClose feed star; deskServer's VERBS list): the builder rewrites them to the new shapes.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G4.20: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const LIST_JS = path.join(__dirname, '..', 'run', 'shell', 'desk', 'desk.js');
const DETAILS = path.join(__dirname, '..', 'run', 'shell', 'deskDetails', 'deskDetails.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskForAndyTestPeerCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskForAndyTestPeerWSLAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskForAndyTestOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const ERROR_ICON = kernel.core.const.ICON.ERROR;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function settle() { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }
function has(list, what) { return (list || []).indexOf(what) !== -1; }
function code(file) { return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1'); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

// ── fakes for the two pages, as deskList.js and deskDialogClose.js build them ──
function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, checked: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}
function fakeDocument() {
  const byId = {};
  return { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); }, all: byId };
}
function target(attrs) {
  const a = attrs || {};
  const t = { id: a.id || '', getAttribute: function (n) { return Object.prototype.hasOwnProperty.call(a, n) ? a[n] : null; }, parentNode: null };
  t.closest = function (sel) {
    const m = /^\[([\w-]+)\]$/.exec(sel);
    return m && t.getAttribute(m[1]) !== null ? t : null;
  };
  return t;
}

function dialog(facts, checks) {
  const doc = fakeDocument();
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (v) asked.push({ verb: v, args: ask[v] });
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify(facts), version: 1, change: 3 } });
      if (v === 'item.box') return Promise.resolve({ status: 200, body: { box: 'BOX', version: 1 } });
      if (v === 'item.checks') return Promise.resolve({ status: 200, body: { checks: checks || [] } });
      if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [], chatMore: false } });
      return Promise.resolve({ status: 200, body: { change: 4 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: facts.id, agents: {} });
  return {
    doc: doc, asked: asked,
    html: function (id) { return doc.getElementById(id).innerHTML; },
    click: function (attrs) { doc.getElementById('dd-body').fire('click', { target: target(attrs), preventDefault: function () {} }); },
    sent: function (verb) { return asked.filter(function (a) { return a.verb === verb; }); },
  };
}
const FACTS = function (over) {
  return Object.assign({ id: 't/G1.2', title: 'Beta', goal: 't/G1', status: 'running', with: '', buttons: [], blocking: [], blocked: [],
    go: true, alone: false, alert: false, claims: 0, asks: 0, boxTaken: '' }, over || {});
};

function listPage(rows) {
  const doc = fakeDocument();
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(LIST_JS, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const asked = [];
  behavior.mount(fakeElement('container'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      const ask = body && body.ask && body.ask.desk;
      if (name === 'jobs.api' && ask) {
        const v = Object.keys(ask)[0];
        asked.push({ verb: v, args: ask[v] });
        if (v === 'items.search') return Promise.resolve({ status: 200, body: { items: rows.map(function (r) { return { key: r.id, label: JSON.stringify(r) }; }), more: false } });
        return Promise.resolve({ status: 200, body: { items: [], more: false, json: '{}' } });
      }
      return Promise.resolve({ status: 200, body: {} });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    peerPost: function () { return Promise.resolve({ ok: true }); }, callDialog: function () { return new Promise(function () {}); },
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  return {
    page: function () { return Object.keys(doc.all).map(function (k) { return doc.all[k].innerHTML; }).join('\n'); },
    click: function (id) { doc.getElementById(id).fire('click', { target: target({ id: id }), currentTarget: doc.getElementById(id), preventDefault: function () {} }); },
    searches: function () { return asked.filter(function (a) { return a.verb === 'items.search'; }); },
    listens: function (id) { return !!doc.all[id] && (doc.all[id].listeners.click || []).length > 0; },
  };
}
const rowOf = function (html, title) { return html.split('<tr').filter(function (s) { return s.indexOf(title) !== -1; })[0] || ''; };

test.startTest('goal/G4.20: Desk for Andy');

(async function () {
  // ── THE SERVER ──
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskforandy-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const factsOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item) || {}; } catch (e) { return {}; } };
  const checksOf = async function (id) { const r = await call('item.checks', { id: id }, ANDY); return (r.body || {}).checks || []; };
  const codeOf = function (r) { return (r.body || {}).code || ''; };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [
      { id: 'g/G1.1', title: 'Asks', blocks: ['g/G1'] }, { id: 'g/G1.2', title: 'Claimed', blocks: ['g/G1'] },
      { id: 'g/G1.3', title: 'Hidden', blocks: ['g/G1'] }, { id: 'g/G1.4', title: 'Boxed', blocks: ['g/G1'] }] }) }, CW);
    if (set.status !== 200) { test.fail(OWED + 'the session was not taken: ' + short(set.body)); return; }

    test.subHeading('10-11. the waiting list: G and Q checks, asks, and Close alone counts nothing');
    const design = await factsOf('g/G1.1');
    if (has(design.buttons, 'close') && design.asks === 0) test.check('in design an item offering Close has asks 0');
    else test.fail(OWED + 'facts.asks in design: ' + short({ buttons: design.buttons, asks: design.asks }));
    const g1 = await call('check.add', { id: 'g/G1.1', kind: 'G', words: 'core grant: appServer.js', test: '' }, CW);
    const q1 = await call('check.add', { id: 'g/G1.1', kind: 'Q', words: 'Which port?', test: '' }, CW);
    const k0 = await checksOf('g/G1.1');
    const numbers = k0.map(function (c) { return c.number + ':' + c.state; }).join(',');
    if (g1.status === 200 && q1.status === 200 && numbers === 'G1:open,Q1:open') test.check('check.add takes kinds G and Q, numbered G1 and Q1, open');
    else test.fail(OWED + 'check.add G/Q answered ' + g1.status + '/' + q1.status + ' ' + short(g1.body) + '; checks ' + numbers);
    const asks2 = (await factsOf('g/G1.1')).asks;
    if (asks2 === 2) test.check('an open grant and an open question: asks 2');
    else test.fail(OWED + 'asks with G1 and Q1 open: ' + asks2);
    const agentGrant = await call('check.set', { id: 'g/G1.1', check: 'G1', state: 'granted' }, CW);
    if (codeOf(agentGrant) === 'not-owner') test.check('an agent granting G1 is refused not-owner');
    else test.fail(OWED + 'an agent\'s grant answered ' + agentGrant.status + ' ' + short(agentGrant.body));
    const hisGrant = await call('check.set', { id: 'g/G1.1', check: 'G1', state: 'granted' }, ANDY);
    const gRow = (await checksOf('g/G1.1')).filter(function (c) { return c.number === 'G1'; })[0] || {};
    if (hisGrant.status === 200 && gRow.state === 'granted' && gRow.by === 'andy' && gRow.at) test.check('his grant is taken and logged: G1 granted, by andy, with its time');
    else test.fail(OWED + 'his grant answered ' + hisGrant.status + ' ' + short(hisGrant.body) + '; G1 ' + short(gRow));
    const answered = await call('check.set', { id: 'g/G1.1', check: 'Q1', state: 'answered' }, CW);
    const asks0 = (await factsOf('g/G1.1')).asks;
    if (answered.status === 200 && asks0 === 0) test.check('the agent marks Q1 answered: asks 0');
    else test.fail(OWED + 'Q1 answered -> ' + answered.status + ' ' + short(answered.body) + ', asks ' + asks0);

    await call('press', { id: 'g/G1', what: 'end-design' }, ANDY);

    test.subHeading('3. Done only after a claim, with the count');
    await call('press', { id: 'g/G1.2', what: 'go' }, ANDY);
    const gone = await factsOf('g/G1.2');
    if (gone.claims === 0 && !has(gone.buttons, 'done')) test.check('gone, nobody claimed: claims 0 and no Done');
    else test.fail(OWED + 'after his Go: ' + short({ claims: gone.claims, buttons: gone.buttons }));
    await call('press', { id: 'g/G1.2', what: 'claim-done' }, CW);
    const one = await factsOf('g/G1.2');
    await call('press', { id: 'g/G1.2', what: 'claim-done' }, WSL);
    const two = await factsOf('g/G1.2');
    if (one.claims === 1 && two.claims === 2 && has(two.buttons, 'done')) test.check('one claim: claims 1; two: claims 2, Done offered');
    else test.fail(OWED + 'facts.claims after one and two claims: ' + one.claims + ', ' + two.claims + '; buttons ' + short(two.buttons));
    await call('check.add', { id: 'g/G1.2', kind: 'C', words: 'open the dialog and look', test: '' }, CW);
    const cOpen = (await factsOf('g/G1.2')).asks;
    await call('check.set', { id: 'g/G1.2', check: 'C1', state: 'passed' }, ANDY);
    const cPassed = (await factsOf('g/G1.2')).asks;
    // Nobody took g/G1.2 and both claimed it, so its offered Done counts one too (goal/G4.26: "only if all agents
    // involved in that item consider it done.").
    if (cOpen === 2 && cPassed === 1) test.check('an open C while Done is offered counts in asks; passed, it does not (the claimed Done counts 1)');
    else test.fail(OWED + 'asks with C1 open / passed under Done: ' + cOpen + ' / ' + cPassed);

    test.subHeading('2. Reopen on a closed item takes back Done and Close, keeps his Go');
    await call('press', { id: 'g/G1.2', what: 'done' }, ANDY);
    await call('press', { id: 'g/G1.2', what: 'close' }, ANDY);
    const shut = await factsOf('g/G1.2');
    if (shut.status === 'closed' && has(shut.buttons, 'reopen')) test.check('a closed item offers Reopen');
    else test.fail(OWED + 'closed item: ' + short({ status: shut.status, buttons: shut.buttons }));
    const reopen = await call('press', { id: 'g/G1.2', what: 'reopen' }, ANDY);
    const back = await factsOf('g/G1.2');
    if (reopen.status === 200 && back.status !== 'closed' && back.status !== 'done' && back.go === true && !has(back.buttons, 'go') && !has(back.buttons, 'done')) {
      test.check('Reopen: neither done nor closed, his Go kept, no Go and no Done offered');
    } else test.fail(OWED + 'reopen answered ' + reopen.status + ' ' + short(reopen.body) + '; facts ' + short({ status: back.status, go: back.go, buttons: back.buttons }));

    test.subHeading('1. items.search with includeClosed');
    await call('press', { id: 'g/G1.3', what: 'close' }, ANDY);
    const ids = function (r) { return ((r.body || {}).items || []).map(function (x) { return x.key; }); };
    const without = await call('items.search', { text: 'Hidden', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, ANDY);
    const withClosed = await call('items.search', { text: 'Hidden', currentGoalOnly: false, goalsOnly: false, includeClosed: true }, ANDY);
    if (without.status === 200 && !has(ids(without), 'g/G1.3')) test.check('includeClosed false: the closed item is not found');
    else test.fail(OWED + 'items.search includeClosed false answered ' + without.status + ' ' + short(without.body));
    if (withClosed.status === 200 && has(ids(withClosed), 'g/G1.3')) test.check('includeClosed true: the closed item is found');
    else test.fail(OWED + 'items.search includeClosed true answered ' + withClosed.status + ' ' + short(withClosed.body));

    test.subHeading('9. box.take: the box is the taker\'s, and red, until it writes');
    const take = await call('box.take', { id: 'g/G1.4' }, CW);
    const taken = await factsOf('g/G1.4');
    if (take.status === 200 && taken.boxTaken === 'claude-windows') test.check('box.take by claude-windows: boxTaken names it');
    else test.fail(OWED + 'box.take answered ' + take.status + ' ' + short(take.body) + '; boxTaken ' + short(taken.boxTaken));
    const second = await call('box.take', { id: 'g/G1.4' }, WSL);
    const other = await call('box.write', { id: 'g/G1.4', text: 'mine', version: 0 }, WSL);
    if (codeOf(second) === 'taken' && codeOf(other) === 'taken') test.check('meanwhile another agent\'s box.take and box.write are refused taken');
    else test.fail(OWED + 'second take ' + short(second.body) + '; other\'s write ' + short(other.body));
    // SINCE goal/G9.3 HE TAKES THE BOX TOO, where G4.20 point 9 refused him by name. Andy, 2026-10-07: "the text box
    // in item/goal detail must be an input area for the user. When the user activates that input area, the area is
    // \"taken\" by the user, and not modifiable for agents." His take of a free box is accepted, and box.release frees
    // it without a write (deskBoxTake.js holds the whole rule).
    const his = await call('box.take', { id: 'g/G1.1' }, ANDY);
    const hisBox = await factsOf('g/G1.1');
    if (his.status === 200 && hisBox.boxTaken === 'andy') test.check('his box.take is accepted too (goal/G9.3), and boxTaken names him');
    else test.fail(OWED + 'his box.take answered ' + his.status + ' ' + short(his.body) + '; boxTaken ' + short(hisBox.boxTaken));
    const hisRelease = await call('box.release', { id: 'g/G1.1' }, ANDY);
    if (hisRelease.status === 200 && (await factsOf('g/G1.1')).boxTaken === '') test.check('and his box.release frees it again');
    else test.fail(OWED + 'his box.release answered ' + hisRelease.status + ' ' + short(hisRelease.body));
    const now = Number(((await call('item.box', { id: 'g/G1.4' }, ANDY)).body || {}).version) || 0;
    const write = await call('box.write', { id: 'g/G1.4', text: 'CAP', version: now }, CW);
    const freed = await factsOf('g/G1.4');
    if (write.status === 200 && freed.boxTaken === '') test.check('the taker\'s box.write clears the take');
    else test.fail(OWED + 'taker\'s write answered ' + write.status + ' ' + short(write.body) + '; boxTaken ' + short(freed.boxTaken));

    test.subHeading('8. no star in the facts');
    await call('chat.add', { id: 'g/G1.4', text: 'agent to agent' }, CW);
    const quiet = await factsOf('g/G1.4');
    if (quiet.id && !Object.prototype.hasOwnProperty.call(quiet, 'star')) test.check('an agent line under an item: the facts carry no star');
    else test.fail(OWED + 'the facts still carry star: ' + short(quiet.star));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }

  // ── THE DIALOG ──
  test.subHeading('3. the dialog\'s Done reads "Done (n)"');
  const d3 = dialog(FACTS({ buttons: ['done'], claims: 2 }));
  await settled();
  if (/>Done \(2\)</.test(d3.html('dd-name-row'))) test.check('claims 2: the button reads Done (2)');
  else test.fail(OWED + 'the Done button: ' + short((/<button[^>]*id="dd-done"[^>]*>[^<]*/.exec(d3.html('dd-name-row')) || [''])[0]));

  test.subHeading('10-11. the dialog\'s waiting list');
  const CHECKS = [
    { number: 'G1', kind: 'G', words: 'core grant: appServer.js', test: '', state: 'open', by: '', at: '' },
    { number: 'G2', kind: 'G', words: 'core grant: hub.js', test: '', state: 'granted', by: 'andy', at: '2026-10-04T10:00:00.000Z' },
    { number: 'Q1', kind: 'Q', words: 'Which port?', test: '', state: 'open', by: '', at: '' },
    { number: 'Q2', kind: 'Q', words: 'Already answered', test: '', state: 'answered', by: 'claude-windows', at: '2026-10-04T10:01:00.000Z' },
  ];
  const dw = dialog(FACTS({ asks: 2 }), CHECKS);
  await settled();
  const body = dw.html('dd-body');
  const at = function (s) { return body.indexOf(s); };
  if (at('id="dd-waiting"') > at('id="dd-box"') && at('id="dd-waiting"') < at('id="dd-say"') && at('id="dd-box"') !== -1) test.check('#dd-waiting sits between the box and his input');
  else test.fail(OWED + 'no #dd-waiting between #dd-box and #dd-say');
  const waiting = dw.html('dd-waiting');
  if (/data-grant="G1"/.test(waiting) && !/data-grant="G2"/.test(waiting) && /data-granted="G2"/.test(waiting)) test.check('open G1 is an arm-button (data-grant); granted G2 is drawn green (data-granted)');
  else test.fail(OWED + 'grants in #dd-waiting: ' + short(waiting));
  if (/data-question="Q1"/.test(waiting) && waiting.indexOf('Which port?') !== -1 && waiting.indexOf('Already answered') === -1) test.check('open Q1 is drawn with its words; answered Q2 is not');
  else test.fail(OWED + 'questions in #dd-waiting: ' + short(waiting));
  dw.click({ 'data-question': 'Q1' });
  await settled();
  const say = dw.doc.getElementById('dd-say');
  const first = say.value;
  say.value = 'my answer';
  dw.click({ 'data-question': 'Q1' });
  await settled();
  if (first === 'Q1: Which port?' && say.value === 'my answer\nQ1: Which port?') test.check('a click on Q1 appends "Q1: Which port?" to his input, on a line of its own');
  else test.fail(OWED + 'after clicks on Q1 the input held ' + short(first) + ' then ' + short(say.value));
  dw.click({ 'data-grant': 'G1' });
  await settled();
  const armedOnly = dw.sent('check.set').length;
  dw.click({ 'data-grant': 'G1' });
  await settled();
  const sets = dw.sent('check.set');
  const grant = sets[0] && sets[0].args;
  if (armedOnly === 0 && sets.length === 1 && grant.id === 't/G1.2' && grant.check === 'G1' && grant.state === 'granted') test.check('G1: the first click arms, the second sends check.set {check: G1, state: granted}');
  else test.fail(OWED + 'grant clicks sent ' + armedOnly + ' then ' + short(sets));

  test.subHeading('9. a taken box shows red in the dialog');
  const db = dialog(FACTS({ boxTaken: 'claude-windows' }));
  await settled();
  if (/data-taken="claude-windows"/.test(db.html('dd-box'))) test.check('boxTaken: the box carries data-taken="claude-windows"');
  else test.fail(OWED + 'the taken box: ' + short(db.html('dd-box')));

  // ── THE LIST ──
  test.subHeading('10-11. ICON.ERROR on the row exactly while asks > 0');
  const rows = [
    { id: 't/G1', title: 'The goal', goal: '', status: '', with: '', buttons: [], blocking: [], blocked: [], go: false, alone: false, alert: false, claims: 0, asks: 0, boxTaken: '', design: true, waiting: 1, live: [] },
    { id: 't/G1.1', title: 'Quiet', goal: 't/G1', status: '', with: '', buttons: ['close'], blocking: [], blocked: [], go: false, alone: false, alert: false, claims: 0, asks: 0, boxTaken: '' },
    { id: 't/G1.2', title: 'Loud', goal: 't/G1', status: '', with: '', buttons: ['close'], blocking: [], blocked: [], go: false, alone: false, alert: false, claims: 0, asks: 2, boxTaken: '' },
    { id: 't/G1.3', title: 'Starred', goal: 't/G1', status: '', with: '', buttons: [], blocking: [], blocked: [], go: false, alone: false, alert: false, star: true, claims: 0, asks: 0, boxTaken: '' },
  ];
  const l = listPage(rows);
  await settled();
  const page = l.page();
  const quietRow = rowOf(page, 'Quiet');
  const loudRow = rowOf(page, 'Loud');
  if (quietRow && quietRow.indexOf(ERROR_ICON) === -1) test.check('Close alone, asks 0: no ICON.ERROR');
  else test.fail(OWED + 'the row Quiet (close only, asks 0): ' + short(quietRow.slice(0, 300)));
  if (loudRow.indexOf(ERROR_ICON) !== -1) test.check('asks 2: ICON.ERROR');
  else test.fail('the row Loud (asks 2) has no ICON.ERROR: ' + short(loudRow.slice(0, 300)));

  test.subHeading('8. the List draws no star');
  if (rowOf(page, 'Starred').indexOf('unseen changes') === -1 && !/\bDESK_UNSEEN\b/.test(code(LIST_JS))) test.check('no DESK_UNSEEN in the List, and a star in a label draws nothing');
  else test.fail(OWED + 'DESK_UNSEEN is still in shell/desk/desk.js');
  if (!/\.star\b/.test(code(DETAILS)) && !/\bagentLineN\b/.test(code(SERVER)) && !/\.star\b/.test(code(LIST_JS))) test.check('nothing feeds or reads a star: no agentLineN in the server, no .star in either page');
  else test.fail(OWED + 'star remains: ' + ['agentLineN in desk.js', '.star in the List', '.star in the dialog'].filter(function (x, i) {
    return [/\bagentLineN\b/.test(code(SERVER)), /\.star\b/.test(code(LIST_JS)), /\.star\b/.test(code(DETAILS))][i];
  }).join(', '));

  test.subHeading('1. the List\'s [include closed] toggle');
  const firstAsk = l.searches()[0];
  if (firstAsk && firstAsk.args.includeClosed === false) test.check('on open the List asks items.search with includeClosed false');
  else test.fail(OWED + 'the List\'s first items.search: ' + short(firstAsk && firstAsk.args));
  if (l.listens('desk-include-closed')) {
    l.click('desk-include-closed');
    await settled();
    const after = l.searches();
    const last = after[after.length - 1];
    if (after.length === 2 && last.args.includeClosed === true) test.check('a click on #desk-include-closed asks again with includeClosed true');
    else test.fail(OWED + 'after the toggle: ' + short(after.map(function (a) { return a.args; })));
  } else test.fail(OWED + 'no #desk-include-closed toggle on the List');

})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
