'use strict';

// goal/G9.17, change 3: a refused press names what blocks it. Red on today's tree; wsl-claude wrote it from
// G9.17's box and does not build it.
//   Andy, 2026-10-09, under goal/G9.17, after a press of his came back as "Not pressed: not-offered (that press is
//   not offered for this item now)": "and it doesn't tell me why either." And to "shall a refused press name what
//   blocks it, folded into this item?": "yes".
//
// WHAT IS TRUE TODAY (read in the tree at 5b40c186): refused(code) carries the code alone (desk.js:1128), so every
// one of these refusals answers 409 {ok: false, code: 'not-offered', error: 'that press is not offered for this item
// now', extra: {verb: 'press'}} - the same words whichever gate stopped it. The gates each know more: a press not
// among the item's buttons (:2144), End design while an item or the goal carries an open red question (:2151), a Go
// on an item with one (:2152), and the Go rule, which wants design mode off and no open blocker (:810).
//
// WHAT IS ASSERTED: the refusal still refuses, and its answer names the particular thing that blocked it - the
// blocking item, design mode, the item carrying the red question - the way line-too-large names its bytes and its
// room (:105). The suite reads the whole answer, so where the reason lands (error text, extra) is the builder's.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G9.17: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const AGENT = { key: 'MCowBQYDK2VwAyEAdeskRefusalReasonTestAgentAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskRefusalReasonTestOwnerAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }

test.startTest('goal/G9.17: a refused press names what blocks it');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskrefusalreason-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
// The refusal itself is the subject here, so nothing is swallowed: a rejection comes back as an answer to read.
const call = function (verb, args, caller) {
  const q = {}; q[verb] = args;
  return client.ask({ desk: q }, caller).then(
    function (r) { return { status: (r || {}).status, body: (r || {}).body, thrown: null }; },
    function (e) { return { status: 0, body: null, thrown: { message: e && e.message, refusal: e && e.refusal, extra: e && e.extra } }; });
};
// Everything the desk said about the refusal, as one string: the builder chooses where the reason sits.
function said(answer) { return JSON.stringify(answer || {}); }
function refused(answer) {
  const b = answer && answer.body;
  if (b && b.ok === false) return true;
  return !!(answer && answer.thrown);
}
let kid = null;
async function start() {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
function stop() { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); }
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); return parse(r.body && r.body.item) || {}; }

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  const g = await call('goal.add', { title: 'Refusals' }, AGENT);
  const gid = g.body && g.body.id;
  if (!gid) { test.fail('the goal was not minted: ' + short(g.body)); return; }
  const a = await call('item.add', { goal: gid, title: 'The one that waits' }, AGENT);
  const A = a.body && a.body.id;
  const b = await call('item.add', { goal: gid, title: 'The blocker', blocks: A }, AGENT);
  const B = b.body && b.body.id;
  if (!A || !B) { test.fail('the items were not minted: ' + short([a.body, b.body])); return; }

  test.subHeading('1. a Go refused while the goal is in design mode says design mode');
  const inDesign = await call('press', { id: A, what: 'go' }, ANDY);
  if (refused(inDesign)) test.check('the world: the press is refused while the goal is in design mode');
  else { test.fail('the world: the Go was taken in design mode: ' + said(inDesign)); return; }
  if (/design/i.test(said(inDesign))) test.check('the answer says design mode');
  else test.fail(OWED + 'the answer names nothing about design mode: ' + said(inDesign));

  const ended = await call('press', { id: gid, what: 'end-design' }, ANDY);
  const gf = await facts(gid);
  if (gf.design !== true) test.check('design mode is off on the goal');
  else { test.fail('the suite could not end design: ' + said(ended) + '; ' + short(gf)); return; }

  test.subHeading('2. a Go refused behind an open blocker names that blocker');
  const blocked = await call('press', { id: A, what: 'go' }, ANDY);
  if (refused(blocked)) test.check('the world: the press is refused while a blocker is open');
  else { test.fail('the world: the Go was taken with ' + B + ' open: ' + said(blocked)); return; }
  if (said(blocked).indexOf(B) !== -1) test.check('the answer names the blocker ' + B);
  else test.fail(OWED + 'the answer does not name ' + B + ': ' + said(blocked));

  test.subHeading('3. an End design refused by a red question names the item that carries it');
  await call('press', { id: gid, what: 'start-design' }, ANDY);
  const q = await call('check.add', { id: B, kind: 'Q', words: 'Which way round?', test: '' }, AGENT);
  const bf = await facts(B);
  if ((bf.asks || 0) >= 1) test.check('the world: ' + B + ' carries an open red question');
  else { test.fail('the suite could not raise a question on ' + B + ': ' + said(q) + '; ' + short(bf)); return; }
  const stuck = await call('press', { id: gid, what: 'end-design' }, ANDY);
  if (refused(stuck)) test.check('the world: End design is refused while a red question stands');
  else { test.fail('the world: End design was taken with a red question on ' + B + ': ' + said(stuck)); return; }
  if (said(stuck).indexOf(B) !== -1) test.check('the answer names ' + B + ', the item that carries the question');
  else test.fail(OWED + 'the answer does not name ' + B + ': ' + said(stuck));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
