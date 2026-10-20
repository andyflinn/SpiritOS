'use strict';

// spirit/test/deskLiveFixes.js
// goal/G18.5: fix desk limbo, search and verify etc. Red on today's tree (428416fc); claude-windows wrote it and builds
// it. The item's box (v4), Andy, 2026-10-12: "your points accepted." (limbo: no limbo line while a claim waits on
// deskVerify; search: the desk searches onto the probabilit modules); "when a search is run agains the goal or an
// item, it takes the status box in the list using let's say 16em width, and shows progress there as well. the result
// string shown will be green or red, depending on the outcome." ("search" there is "the verifier run"); and "the red
// grant Buttons don't show up automatically in deskDetail, i'd like that as well".
//
// The search part came after his answers: "The bucket solves this. if all items are probability 0, that is equal to
// the old searches "*""; "chat lines are 50% of the weight, if there is no chat lines the rule still applies"; and
// "chats for items/goals are searchable in the UI, right above the chat input box.", then "yes, add it here."
//
// WHAT IS ASSERTED
//   1. limbo: a plain item whose claim waits on deskVerify is not in limbo, and the desk posts no limbo line for it
//      however its taker's word flips.
//   2. the checks travel: a write that changes an item's checks (item.files.add raising a core grant) publishes them,
//      so an open dialog draws the red grant button without a reopen.
//   3. the List status box: 16em wide; while deskVerify runs for a row it shows the run's progress there; the outcome
//      reads green when passed, red when rejected.
//   4. the desk searches rank by probability: items by half title-and-box, half their chat lines; chat lines alone.
//   5. the dialog's chat search: an input right above the chat input; typed, it sends chat.search and shows the ranked
//      lines in place of the chat; emptied, the chat comes back.
// rule/11: through testSupport only; its own folders and ports; never 65432.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G18.5: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const FACE = path.join(RUN, 'shell', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskLiveFixesTestCWAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskLiveFixesTestOwnerAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 12; i++) await settle(); }

test.startTest('goal/G18.5: limbo, the checks that travel, the verifier run in the List');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desklivefixes-'));

async function serverHalf() {
  // A node that runs a deskVerify (so a claim waits on it) and keeps what the desk publishes.
  const published = [];
  const node = await new Promise(function (resolve) {
    const s = http.createServer(function (req, res) {
      let b = ''; req.on('data', function (c) { b += c; });
      req.on('end', function () {
        let j = null; try { j = JSON.parse(b || '{}'); } catch (e) { j = null; }
        // A server's verb by name on the flat apiDoor (goal/G30.6), folded to {server: {verb: args}}; 'api' the tree.
        const flatCall = test.foldAsk(j);
        let out = {};
        if (j && j.verb === 'jobs.update') { if (j.app) published.push(j.app); out = { ok: true }; }
        else if (flatCall === 'api') out = { desk: {}, deskVerify: {} };
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
  const kid = spawn(process.execPath, [DESK, '{}', '--pipe', pipe, '--state', state], { cwd: root, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    env: Object.assign({}, process.env, { SPIRIT_JOB_ID: 'desk-job', SPIRIT_CALLBACK_URL: 'http://127.0.0.1:' + node.port + '/api/spirit' }) });
  const call = function (verb, a, caller) { const q = {}; q[verb] = a || {}; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(150); try { const r = await client.ask('api'); up = !!(r.body && r.body.desk && r.body.desk.ok !== false); } catch (e) { /* not yet */ } }
    if (!up) { test.fail('the world: the desk did not start'); return; }
    await sleep(500);
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await call('session.set', { json: JSON.stringify({ goal: { id: 'lf/G1', title: 'Live' }, items: [{ id: 'lf/G1.1', title: 'Plain', blocks: ['lf/G1'] }, { id: 'lf/G1.2', title: 'Core', blocks: ['lf/G1'] }] }) }, ANDY);
    await call('press', { id: 'lf/G1', what: 'end-design' }, ANDY);
    await call('press', { id: 'lf/G1.1', what: 'go' }, ANDY);
    await call('press', { id: 'lf/G1.2', what: 'go' }, ANDY);

    test.subHeading('1. a claim waiting on deskVerify is not limbo');
    await call('agent.state', { word: 'working' }, CW);
    await call('item.take', { id: 'lf/G1.1' }, CW);
    await call('press', { id: 'lf/G1.1', what: 'claim-done' }, CW);
    const limboLines = async function () {
      const ch = (await call('item.chat', { id: 'lf/G1.1' }, ANDY)).body || {};
      return (ch.chat || []).filter(function (l) { return l.by === 'desk' && /^limbo:/.test(String(l.text)); }).length;
    };
    const before = await limboLines();
    for (const word of ['listening', 'working', 'listening', 'working', 'listening']) await call('agent.state', { word: word }, CW);
    const f = parse(((await call('item.get', { id: 'lf/G1.1' }, ANDY)).body || {}).item) || {};
    const after = await limboLines();
    if (f.claims > 0 && (f.buttons || []).indexOf('done') === -1) test.check('the world: claimed, Done not yet offered (deskVerify on the node)');
    else test.fail('the world: the item reads ' + short(f));
    if (f.limbo === false && after === before) test.check('it is not in limbo, and no limbo line came while its taker\'s word flipped (' + after + ' before and after)');
    else test.fail(OWED + 'limbo ' + f.limbo + '; limbo lines ' + before + ' then ' + after);

    test.subHeading('2. a write that changes the checks publishes them');
    published.length = 0;
    await call('item.take', { id: 'lf/G1.2' }, CW);
    await call('item.files.add', { id: 'lf/G1.2', paths: ['spirit/run/js/zzLiveFixesCore.js'] }, CW);
    await sleep(500);
    const pub = published.filter(function (o) { return o && o.item && o.item.id === 'lf/G1.2' && o.verb === 'item.files.add'; }).pop();
    const grant = pub && Array.isArray(pub.checks) && pub.checks.filter(function (c) { return c.kind === 'G' && c.state === 'open'; })[0];
    if (grant && /core grant/.test(grant.words)) test.check('item.files.add raising a core grant publishes the checks with it: ' + grant.number + ' "' + grant.words + '"');
    else test.fail(OWED + 'item.files.add published ' + short(pub));

    // THE SEARCH (Q5, Q6 and his rulings in the box): ranked by probability through probabilityBucket, nothing
    // dropped ("if all items are probability 0, that is equal to the old searches "*""); an item scores
    // 0.5 x probabilityStringObjectMatch(text, {id, title, box}) + 0.5 x the mean of probabilityStringMatch over its
    // chat lines, 0 with none ("that half is going to default to a probability of 0"); a chat line scores
    // probabilityStringMatch(text, its text).
    test.subHeading('4. the desk searches rank by probability');
    const psm = require('../run/js/probabilityStringMatch.js').probabilityStringMatch;
    const psom = require('../run/js/probabilityStringObjectMatch.js').probabilityStringObjectMatch;
    // goal/G29.21: an agent's session creates no goal, so the owner writes the world.
    await call('session.set', { json: JSON.stringify({ goal: { id: 'sr/G1', title: 'Search' }, items: [
      { id: 'sr/G1.1', title: 'Apples and pears', blocks: ['sr/G1'] },
      { id: 'sr/G1.2', title: 'zebra crossing', blocks: ['sr/G1'] },
      { id: 'sr/G1.3', title: 'Plums', blocks: ['sr/G1'] },
    ] }) }, ANDY);
    // Since goal/G18.8 an agent writes only where it holds the item or the take of his line.
    // Since goal/G21.4 an agent holds one task at a time: claude-windows lets lf/G1.2 go before it takes sr/G1.3.
    await call('item.release', { id: 'lf/G1.2' }, CW);
    await call('item.take', { id: 'sr/G1.3' }, CW);
    await call('chat.add', { id: 'sr/G1.3', text: 'a zebra came by' }, CW);
    await call('chat.add', { id: 'sr/G1.3', text: 'nothing else' }, CW);
    const found = ((await call('items.search', { text: 'zebra', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, ANDY)).body || {}).items || [];
    const order = found.map(function (p) { return p.key; }).filter(function (k) { return /^sr\//.test(k); });
    const item = function (id, title, lines) {
      const fields = psom('zebra', { id: id, title: title, box: '' });
      const chat = lines.length ? lines.reduce(function (n, l) { return n + psm('zebra', l); }, 0) / lines.length : 0;
      return 0.5 * fields + 0.5 * chat;
    };
    const want = [['sr/G1.1', item('sr/G1.1', 'Apples and pears', [])], ['sr/G1.2', item('sr/G1.2', 'zebra crossing', [])], ['sr/G1.3', item('sr/G1.3', 'Plums', ['a zebra came by', 'nothing else'])], ['sr/G1', item('sr/G1', 'Search', [])]]
      .sort(function (x, y) { return y[1] - x[1]; }).map(function (x) { return x[0]; });
    if (order.length === 4 && order[0] === want[0] && order[1] === want[1]) test.check('items.search ranks by the item probability (fields half, chat half), best first: ' + order.join(', '));
    else test.fail(OWED + 'items.search for zebra answered ' + JSON.stringify(order) + ', the rulings give ' + JSON.stringify(want));
    if (order.indexOf('sr/G1.1') !== -1) test.check('and drops nothing: an item that matches not at all is still in the answer, last');
    else test.fail(OWED + 'items.search dropped the non-matching item: ' + JSON.stringify(order));
    const plain = ((await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, ANDY)).body || {}).items || [];
    const plainOrder = plain.map(function (p) { return p.key; }).filter(function (k) { return /^sr\//.test(k); });
    if (JSON.stringify(plainOrder) === JSON.stringify(['sr/G1', 'sr/G1.1', 'sr/G1.2', 'sr/G1.3'])) test.check('with no text every item is 0 and keeps its order, the goal and then its items, as the List needs');
    else test.fail(OWED + 'items.search with no text answered ' + JSON.stringify(plainOrder));
    const lines = ((await call('chat.search', { id: 'sr/G1.3', text: 'zebra', by: '', since: '', before: '', scope: '' }, ANDY)).body || {}).items || [];
    const texts = lines.map(function (p) { return (parse(p.label) || {}).text; });
    if (texts.length === 2 && texts[0] === 'a zebra came by' && texts[1] === 'nothing else') test.check('chat.search ranks the lines by probability, the non-matching one kept, last');
    else test.fail(OWED + 'chat.search for zebra answered ' + JSON.stringify(texts));
  } finally {
    await new Promise(function (r) { kid.once('exit', r); kid.kill(); setTimeout(r, 3000); });
    node.close();
  }
}

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}

async function listHalf() {
  test.subHeading('3. the verifier run in the List status box');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const subs = {};
  let behavior = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(FACE, 'utf8'))(
    { shell: { activateApp: function (x) { behavior = x; } }, core: kernel.core }, doc, {});
  const fake = require('./deskFake.js').create([]);
  const goal = { id: 'lv/G1', title: 'List', goal: '', design: false, status: '', with: '', buttons: [], blocking: [], blocked: ['lv/G1.1', 'lv/G1.2', 'lv/G1.3'], live: [], working: [], waiting: 0 };
  const row = function (id, status) { return { id: id, title: id, goal: 'lv/G1', status: status, with: '', buttons: [], blocking: ['lv/G1'], blocked: [], asks: 0 }; };
  fake.items = [goal, row('lv/G1.1', 'claimed, waiting for deskVerify'), row('lv/G1.2', 'deskVerify passed'), row('lv/G1.3', 'deskVerify rejected it')];
  fake.verifier = { now: function () { return { running: { id: '', suite: '', since: '' }, queued: [] }; } };
  behavior.mount(fakeElement('container'), {
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
    escapeHtml: kernel.core.util.escapeHtml, verb: fake.verb,
    onPublished: function (fn, app) { subs[app || ''] = fn; return function () {}; }, onPacket: function () {},
    peerPost: function () { return Promise.resolve({ ok: true, status: 200, hash: 'h' }); },
    callDialog: function () { return new Promise(function () {}); }, armUntilElsewhere: function () {},
  });
  for (let i = 0; i < 6; i++) { await settled(); await sleep(20); }
  const table = function () { return Object.keys(byId).map(function (k) { return byId[k].innerHTML; }).join('\n'); };
  const cellOf = function (id) {
    const tr = (new RegExp('<tr data-row="' + id.replace(/[./]/g, '\\$&') + '"[\\s\\S]*?</tr>').exec(table()) || [''])[0];
    const tds = tr.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
    return tds[tds.length - 1] || '';
  };
  if (/<th[^>]*style="[^"]*width:\s*16em[^"]*"[^>]*>status<\/th>/.test(table())) test.check('the status column is 16em wide');
  else test.fail(OWED + 'the status header reads ' + short((/<th[^>]*>status<\/th>/.exec(table()) || [''])[0]));

  if (typeof subs.deskVerify !== 'function') { test.fail('the world: the page did not subscribe to deskVerify'); return; }
  subs.deskVerify({ doing: 'item', id: 'lv/G1.1', suite: 'spirit/test/zzA.js', index: 1, of: 2, tests: 3, expected: 6, line: 'running zzA.js, suite 1 of 2', since: new Date().toISOString() });
  await settled(); await sleep(20); await settled();
  const running = cellOf('lv/G1.1');
  if (/<progress/.test(running) && /1 of 2/.test(running)) test.check('while deskVerify runs for a row, its status box shows the progress: ' + short(running.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')));
  else test.fail(OWED + 'the running row\'s status cell reads ' + short(running));
  const other = cellOf('lv/G1.2');
  if (!/<progress/.test(other)) test.check('and only that row');
  else test.fail(OWED + 'another row shows progress: ' + short(other));

  subs.deskVerify({ doing: 'idle', id: '', line: 'idle', since: new Date().toISOString() });
  await settled(); await sleep(20); await settled();
  const green = cellOf('lv/G1.2');
  const red = cellOf('lv/G1.3');
  if (/color:\s*#1a7f37|color:\s*green/i.test(green) && /deskVerify passed/.test(green)) test.check('passed reads green');
  else test.fail(OWED + 'the passed row reads ' + short(green));
  if (/color:\s*#c00|color:\s*red|color:\s*#d00/i.test(red) && /rejected/.test(red)) test.check('rejected reads red');
  else test.fail(OWED + 'the rejected row reads ' + short(red));
  if (!/<progress/.test(cellOf('lv/G1.1'))) test.check('once the run is idle, the progress is gone from the row');
  else test.fail(OWED + 'progress stays after idle: ' + short(cellOf('lv/G1.1')));
}

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '', className: '', scrollTop: 0, scrollHeight: 0,
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, removeAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}

async function dialogHalf() {
  test.subHeading('5. the chat of an item is searchable in its dialog, right above the chat input');
  const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  const calls = [];
  let dd = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(DETAILS, 'utf8'))(
    { shell: { activateApp: function (x) { dd = x; } }, core: kernel.core }, doc, { addEventListener: function () {}, spiritFieldRules: require('../run/js/fieldRules.js') });
  const line = function (i, by, text) { return { key: String(i), label: JSON.stringify({ by: by, at: '2026-10-12T10:0' + i + ':00.000Z', text: text }) }; };
  dd.mount(fakeElement('dd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    verb: function (name, body) {
      // The desk's verbs by name (desk.<verb>, goal/G30.6), folded back to {desk: {verb: args}}.
      const ask = (test.foldAsk(Object.assign({}, body, { verb: name })) || {}).desk;
      const v = ask && Object.keys(ask)[0];
      calls.push({ verb: v, args: ask && ask[v] });
      if (v === 'item.get') return Promise.resolve({ status: 200, body: { item: JSON.stringify({ id: 'lv/G1.2', title: 'Second', goal: 'lv/G1', status: 'running', with: '', buttons: [], blocking: ['lv/G1'], blocked: [], asks: 0 }), version: 1, change: 1 } });
      if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [{ by: 'andy', at: '2026-10-12T09:00:00.000Z', text: 'the plain chat line' }], chatMore: false } });
      if (v === 'chat.search') return Promise.resolve({ status: 200, body: { items: [line(2, 'wsl-claude', 'a zebra came by'), line(1, 'andy', 'nothing striped here')], more: false } });
      return Promise.resolve({ status: 200, body: { change: 1, items: [], more: false, checks: [], chat: [], box: '', version: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  dd.open({ id: 'lv/G1.2', agents: {} });
  await settled(); await sleep(20); await settled();
  const body = doc.getElementById('dd-body');
  const frame = body.innerHTML;
  const s = frame.indexOf('id="dd-chat-search"');
  const say = frame.indexOf('id="dd-say"');
  if (s !== -1 && say !== -1 && s < say) test.check('a chat search input sits right above the chat input');
  else test.fail(OWED + 'no #dd-chat-search above #dd-say: search at ' + s + ', say at ' + say);

  const n0 = calls.length;
  doc.getElementById('dd-chat-search').value = 'zebra';
  const target = { id: 'dd-chat-search', value: 'zebra', getAttribute: function (n) { return n === 'id' ? 'dd-chat-search' : null; }, closest: function () { return null; } };
  body.fire('input', { target: target });
  await settled(); await sleep(20); await settled();
  const sent = calls.slice(n0).filter(function (c) { return c.verb === 'chat.search'; });
  if (sent.length && JSON.stringify(sent[sent.length - 1].args) === JSON.stringify({ id: 'lv/G1.2', text: 'zebra', by: '', since: '', before: '', scope: '' })) test.check('typing in it sends chat.search {id, text} for this item');
  else test.fail(OWED + 'typing zebra sent ' + short(calls.slice(n0)));
  const shown = doc.getElementById('dd-chat').innerHTML;
  const a = shown.indexOf('a zebra came by');
  const b = shown.indexOf('nothing striped here');
  if (a !== -1 && b !== -1 && a < b && shown.indexOf('the plain chat line') === -1) test.check('the ranked lines show in place of the chat, in the order the desk ranked them');
  else test.fail(OWED + '#dd-chat reads ' + short(shown));

  doc.getElementById('dd-chat-search').value = '';
  target.value = '';
  body.fire('input', { target: target });
  await settled(); await sleep(20); await settled();
  if (doc.getElementById('dd-chat').innerHTML.indexOf('the plain chat line') !== -1) test.check('emptied, the chat comes back');
  else test.fail(OWED + 'with the search emptied #dd-chat reads ' + short(doc.getElementById('dd-chat').innerHTML));
}

(async function () {
  await serverHalf();
  await listHalf();
  await dialogHalf();
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
  test.reportSuccessFailureCount();
  process.exit(0);
});
