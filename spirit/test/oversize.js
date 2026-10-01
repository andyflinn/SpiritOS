'use strict';

// Oversized input is refused cleanly, everywhere.
//   Andy: "why can't the system cleanly reject oversized stuff? this must become a test.", and earlier "in the db
//   yes, but in the sent messages ther MUST be a MAX_PAYLOAD", "what kind of app doesn't measure the sum of its
//   packets?"
// The contract the builder follows (wsl-claude's, agreed in team/chat):
//   Whatever a server accepts must come back whole in one answer. So every write that stores text refuses a value
//   that could not, with a named refusal (a code ending in 'too-large', status 4xx), and stores nothing of it.
//   At the edge: the largest value accepted comes back whole, and one character more is refused.
//   A request too large for any server is refused by name (app-request-too-large); an answer too large to return is
//   refused by name (app-answer-too-large, a 5xx: the server's fault), never cut or hung.
//   A refusal says how large it was and what the limit is: extra.bytes and extra.max.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const appServer = require('../run/js/appServer.js');
const limits = require('../run/js/limits.js');

const OWED = 'OWED by oversize: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const BIG = 'x'.repeat(appClient.ANSWER_MAX);

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
const tooLarge = function (r) { return !!(r && r.status >= 400 && r.status < 500 && r.body && /too-large$/.test(String(r.body.code))); };
const said = function (r) { return JSON.stringify({ status: r && r.status, code: r && r.body && r.body.code }); };

test.startTest('Oversized input is refused cleanly, by name, and nothing of it is kept');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-oversize-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
// Writers are CALLERS since apiAuth/G1.13 (deskWriterKey.js): desk refuses a by argument.
const CW = { key: 'MCowBQYDK2VwAyEAoversizeTestPeerCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAoversizeTestPeerWSAAAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAoversizeTestOwnerAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
const refusals = [];
let kid = null;

(async function () {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'o/G1', title: 'Goal' }, items: [{ id: 'o/G1.1', title: 'Item', blocks: ['o/G1'] }] }) }, CW);

  // ── THE EDGE: the largest accepted comes back whole, one more is refused ──
  test.subHeading('the edge: the largest chat line and box come back whole; one character more is refused');
  for (const kind of ['chat', 'box']) {
    const write = function (n, version) {
      const text = 'y'.repeat(n);
      return kind === 'chat' ? call('chat.add', { id: 'o/G1.1', text: text }, WSL)
        : call('box.write', { id: 'o/G1.1', text: text, version: version }, WSL);
    };
    const version = async function () { return ((await call('item.get', { id: 'o/G1.1' })).body || {}).version || 0; };
    // The largest n the server takes, by halving (a refusal stores nothing, so probing is safe).
    let lo = 1;
    let hi = appClient.ANSWER_MAX;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const r = await write(mid, await version());
      if (r.status === 200) lo = mid; else hi = mid - 1;
    }
    const at = await write(lo, await version());
    const over = await write(lo + 1, await version());
    const back = kind === 'chat' ? await call('item.chat', { id: 'o/G1.1' }) : await call('item.box', { id: 'o/G1.1' });
    const whole = kind === 'chat'
      ? ((back.body || {}).chat || []).some(function (l) { return String(l.text).length === lo; })
      : String((back.body || {}).box || '').length === lo;
    if (at.status === 200 && back.status === 200 && whole) test.check('a ' + kind + ' of ' + lo + ' characters is taken and comes back whole');
    else test.fail(OWED + 'the largest ' + kind + ' (' + lo + ') answered ' + said(at) + ', read back ' + said(back) + ' whole ' + whole);
    if (tooLarge(over)) { test.check('one character more is refused, ' + over.body.code); refusals.push(over); }
    else test.fail(OWED + 'a ' + kind + ' of ' + (lo + 1) + ' answered ' + said(over));
  }

  // ── EVERY OTHER WRITE THAT STORES TEXT ──────────────────────────────────
  test.subHeading('every write that stores text refuses what could not come back, and keeps nothing');
  const writes = [
    ['log.add', { json: JSON.stringify({ key: 'big1', at: '2026-09-30T00:00:00Z', text: BIG }) }],
    ['session.set', { json: JSON.stringify({ goal: { id: 'o/G2', title: BIG }, items: [] }) }, CW],
    ['check.add', { id: 'o/G1.1', kind: 'C', words: BIG, test: '' }, WSL],
    ['item.rename', { id: 'o/G1.1', title: BIG }, ANDY],
    ['item.status', { id: 'o/G1.1', word: BIG }, WSL],
    ['state.set', { json: JSON.stringify({ big: BIG }) }],
    ['seen.set', { json: JSON.stringify({ big: BIG }) }],
  ];
  for (const w of writes) {
    const r = await call(w[0], w[1], w[2]);
    if (tooLarge(r)) { test.check(w[0] + ' refuses it, ' + r.body.code); refusals.push(r); }
    else test.fail(OWED + w[0] + ' with an oversized value answered ' + said(r));
  }
  const facts = JSON.parse(((await call('item.get', { id: 'o/G1.1' })).body || {}).item || '{}');
  const checks = ((await call('item.checks', { id: 'o/G1.1' })).body || {}).checks || [];
  const goals = (((await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: true })).body || {}).items || []).map(function (i) { return i.key; });
  const st = await call('state.get', {});
  const kept = [];
  if (facts.title !== 'Item') kept.push('the title');
  if (String(facts.status || '').length > 100) kept.push('the status word');
  if (checks.length) kept.push('the check');
  if (goals.indexOf('o/G2') !== -1) kept.push('the goal');
  if (st.status !== 200 || String((st.body || {}).json || '').indexOf(BIG) !== -1) kept.push('the state');
  if (!kept.length) test.check('none of the refused values was kept, and every read still answers');
  else test.fail(OWED + 'kept or broken after a refusal: ' + kept.join(', '));

  // ── A REQUEST TOO LARGE FOR ANY SERVER, AND AN ANSWER TOO LARGE TO RETURN ──
  test.subHeading('a request too large for any server, and an answer too large to return');
  const huge = await call('chat.add', { id: 'o/G1.1', text: 'z'.repeat(limits.BODY_MAX + 1) }, WSL);
  if (tooLarge(huge) || (huge.status === 0 && /too large/i.test(String(huge.error)))) test.check('a request over BODY_MAX is refused by name');
  else test.fail(OWED + 'a request over BODY_MAX answered ' + said(huge) + ' ' + (huge.error || ''));
  if (huge.body) refusals.push(huge);
  const bigPipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'bigAnswer', 'win32', 'process') : path.join(scratch, 'big.sock');
  const srv = appServer.createAppServer({ grow: { request: {}, reply: { text: '' }, handler: function () { return { text: BIG }; } } }).listen(bigPipe);
  await sleep(200);
  client.register('bigAnswer', bigPipe);
  const grown = await client.ask({ bigAnswer: { grow: {} } }).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; });
  // The server's fault, not the caller's, so a 5xx: still refused by name, never cut.
  if (grown.status >= 500 && grown.body && grown.body.code === 'app-answer-too-large') { test.check('an answer over ANSWER_MAX is refused as app-answer-too-large, not cut'); refusals.push(grown); }
  else test.fail(OWED + 'an answer over ANSWER_MAX came back as ' + said(grown));
  srv.close();

  // ── A REFUSAL SAYS HOW LARGE, AND THE LIMIT ─────────────────────────────
  test.subHeading('each refusal says how large it was and what the limit is');
  const bare = refusals.filter(function (r) { const x = r.body && r.body.extra; return !(x && typeof x.bytes === 'number' && typeof x.max === 'number' && x.bytes > x.max); });
  if (refusals.length && !bare.length) test.check('all ' + refusals.length + ' refusals carry extra.bytes over extra.max');
  else test.fail(OWED + bare.length + ' of ' + refusals.length + ' refusals do not say their size and limit: ' + JSON.stringify(bare.map(function (r) { return r.body && r.body.code; })));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  if (kid) kid.kill();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
