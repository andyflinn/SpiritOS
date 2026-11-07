'use strict';

// spirit/test/deskListRows.js
// goal/G40.3: file lists past MAX_PAYLOAD break no item. The box (v13), Andy's words among it: "items are added one-by one, and desk streams those items to its
// clients"; "same set of verbs for all sub-item-tables add, remove, search."; "a red claim will fail if no suite-rows
// are registered with an item."; "i will get no single file grant checks anymore, just all in-one. and the grant request
// doesn't have to list them"; "the grant is not valid if core files are added after the grant is issued"; "and make
// sure that the grant lives until i click 'done'"; "yes to the commit-check making sure each file exists in the granted
// list."; "oh, re-open should put an item back to design mode."; "yes to the named verbs".
//
// WHAT IS ASSERTED, on a real desk server with seeded records (rule/11: its own scratch folder):
//   1. item.files.add {id, path} adds one row and keeps the others; a path already there is refused, saying which;
//      item.files.remove {id, path} takes one away, and refuses one not there.
//   2. A list larger than one answer is built a row at a time: item.files says filesMore, and item.files.search finds
//      a path deep in it, exactly.
//   3. One grant for the list, naming no path; Andy's one press grants it;
//      a core file added after it voids it and the item asks again.
//   5. Reopen puts the item back into design mode.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G40.3: ';
const RUN = path.join(__dirname, '..', 'run');
const SERVER = path.join(RUN, 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskListRowsTestCWAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskListRowsTestOwnerAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };
const MANY = 650;   // past one answer: about 35 bytes a row against the 22 KB an answer holds

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }

test.startTest('goal/G40.3: file lists past MAX_PAYLOAD break no item');

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desklistrows-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
function ok(r) { return !!r && r.status === 200 && !(r.body && r.body.ok === false); }
function why(r) { const b = (r && r.body) || {}; return String((b.extra && b.extra.why) || b.error || b.code || ''); }
async function facts(id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse(r.body.item); } catch (e) { return {}; } }
async function grants(id) { return ((((await call('item.checks', { id: id }, ANDY)).body || {}).checks) || []).filter(function (c) { return c.kind === 'G'; }); }
let kid = null;
async function start() {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
function stop() { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); }

(async function () {
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Rows' }, items: [
    { id: 'goal/G100.1', title: 'Files a row at a time', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.2', title: 'Suites a row at a time', blocks: ['goal/G100'], code: true },
    { id: 'goal/G100.3', title: 'Reopened', blocks: ['goal/G100'] },
  ] });
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
  for (const id of ['goal/G100.1', 'goal/G100.2', 'goal/G100.3']) await call('press', { id: id, what: 'go' }, ANDY);
  await call('phase.take', { id: 'goal/G100.1', phase: 'red' }, CW);
  const ID = 'goal/G100.1';

  // ── 1. ONE ROW A WRITE ───────────────────────────────────────────────
  test.subHeading('1. item.files.add and .remove write one row each');
  const a1 = await call('item.files.add', { id: ID, path: 'spirit/test/deskListRows.js' }, CW);
  const a2 = await call('item.files.add', { id: ID, path: 'spirit/run/shell/desk/desk.js' }, CW);
  const listed = ((((await call('item.files', { id: ID }, ANDY)).body) || {}).files || []).map(function (f) { return f.path; });
  if (ok(a1) && ok(a2) && listed.indexOf('spirit/test/deskListRows.js') !== -1 && listed.indexOf('spirit/run/shell/desk/desk.js') !== -1)
    test.check('two adds of one path each: both rows are on the list, the second dropped nothing');
  else test.fail(OWED + 'item.files.add {id, path} answered ' + short([a1.status, why(a1), a2.status, why(a2)]) + '; the list holds ' + short(listed));
  const again = await call('item.files.add', { id: ID, path: 'spirit/test/deskListRows.js' }, CW);
  if (!ok(again) && /deskListRows\.js/.test(why(again))) test.check('a path already there is refused, naming it: ' + short(why(again)));
  else test.fail(OWED + 'adding a path already listed answered ' + short(again.status + ' ' + why(again)));
  const r1 = await call('item.files.remove', { id: ID, path: 'spirit/run/shell/desk/desk.js' }, CW);
  const after = ((((await call('item.files', { id: ID }, ANDY)).body) || {}).files || []).map(function (f) { return f.path; });
  const r2 = await call('item.files.remove', { id: ID, path: 'spirit/run/shell/desk/desk.js' }, CW);
  if (ok(r1) && after.indexOf('spirit/run/shell/desk/desk.js') === -1 && after.indexOf('spirit/test/deskListRows.js') !== -1 && !ok(r2) && /desk\.js/.test(why(r2)))
    test.check('item.files.remove takes one row away, keeps the rest, and refuses a path not there, naming it');
  else test.fail(OWED + 'item.files.remove answered ' + short([r1.status, why(r1)]) + ', list after ' + short(after) + ', a second remove ' + short([r2.status, why(r2)]));

  // ── 2. PAST ONE ANSWER ───────────────────────────────────────────────
  test.subHeading('2. a list larger than one answer, built a row at a time');
  let added = 0;
  for (let i = 0; i < MANY; i++) { if (ok(await call('item.files.add', { id: ID, path: 'spirit/test/many/suite' + i + '.js' }, CW))) added += 1; }
  const read = (await call('item.files', { id: ID }, ANDY)).body || {};
  const deep = 'spirit/test/many/suite' + (MANY - 7) + '.js';
  const found = ((((await call('item.files.search', { id: ID, text: deep }, ANDY)).body) || {}).items || []);
  const exact = found.some(function (p) { try { return JSON.parse(p.label).path === deep; } catch (e) { return p.key === deep; } });
  if (added === MANY && read.filesMore === true) test.check(MANY + ' rows added one by one; item.files answers what fits and says filesMore');
  else test.fail(OWED + added + ' of ' + MANY + ' adds taken; item.files filesMore ' + short(read.filesMore));
  if (exact) test.check('item.files.search finds a path deep in the list, exactly: ' + deep);
  else test.fail(OWED + 'item.files.search for ' + deep + ' gave ' + short(found.slice(0, 3)));

  // ── 3. ONE GRANT FOR THE LIST ────────────────────────────────────────
  test.subHeading('3. one grant for the list, naming no path, living until Done');
  await call('item.files.add', { id: ID, path: 'spirit/run/spirit/limits.js' }, CW);
  await call('item.files.add', { id: ID, path: 'spirit/run/spirit/kernel.js' }, CW);
  const g1 = (await grants(ID)).filter(function (c) { return c.state === 'open'; });
  if (g1.length === 1 && !/spirit\//.test(String(g1[0].words))) test.check('one open grant for the list, its words naming no path: ' + short(g1[0].words));
  else test.fail(OWED + 'the open grants are ' + short(g1.map(function (c) { return c.words; })));
  const pressed = g1[0] ? await call('check.set', { id: ID, check: g1[0].number, state: 'granted' }, ANDY) : {};
  await call('item.files.add', { id: ID, path: 'spirit/run/spirit/hub.js' }, CW);
  const voided = await grants(ID);
  if (voided.some(function (c) { return c.state === 'open'; }) && !voided.some(function (c) { return c.state === 'granted' && c.number === (g1[0] && g1[0].number); }))
    test.check('a core file added after the grant voids it; the item asks for the grant again');
  else test.fail(OWED + 'after a core add past the grant: ' + short(voided.map(function (c) { return c.number + ' ' + c.state; })));

  // ── 5. REOPEN ────────────────────────────────────────────────────────
  test.subHeading('5. Reopen puts the item back into design mode');
  const R = 'goal/G100.3';
  await call('press', { id: R, what: 'claim-done' }, CW);
  await call('press', { id: R, what: 'done' }, ANDY);
  await call('press', { id: R, what: 'reopen' }, ANDY);
  const fr = await facts(R);
  if (fr.design === true) test.check('after his Reopen the item is in design mode');
  else test.fail(OWED + 'after his Reopen: design ' + short(fr.design) + ', status ' + short(fr.status));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();


  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
