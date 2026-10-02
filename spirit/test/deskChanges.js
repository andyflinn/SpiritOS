'use strict';

// apiAuth/G1.12: Desk tells an agent what changed since change N.
//   Andy: "dsek needs an interface for that. desk can't serve agents at different locations otherwise", "(you know
//   you cheated, instead of telling me about this flaw)", and his yes on the verb, 2026-10-01: "yes on the verb".
// The shape, converged in the team meeting (both agents, the box holds it):
//   changes { n, line } -> { records, lines, n, line, more }
//   - records: the records table's rows after n, oldest first, each { n, at, verb, by, body } as stored;
//   - lines: the lines table's rows after rowid `line`, oldest first, each carrying its rowid as `line`;
//   - the reply's n and line are the cursors to resume from; asking again with them answers empty, more false;
//   - one answer: the bucket cuts, more says so, and resuming from the returned cursors loses nothing and
//     doubles nothing (the rowid is the cursor BECAUSE a time re-reads or misses on equal stamps);
//   - a read: it takes no by.
//   DONE WHEN also held deskEar.js to asking this verb instead of opening the db file. That listener went with
//   the agents app (goal/G3.2); the one that replaces it is held to account by its own suites (goal/G3.4, G3.6).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by apiAuth/G1.12: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

test.startTest('apiAuth/G1.12: Desk tells an agent what changed since change N');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskchanges-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
// Writers are CALLERS since apiAuth/G1.13 (deskWriterKey.js): the door
// forwards who asked and desk refuses a by argument, so a write here
// hands appClient the caller it would have been handed.
const CW = { key: 'MCowBQYDK2VwAyEAdeskChangesTestPeerCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const WSL = { key: 'MCowBQYDK2VwAyEAdeskChangesTestPeerWSAAAAAAAAAAAAAAAA=', label: 'wsl-claude' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskChangesTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };
const call = function (verb, args, caller) { const b = {}; b[verb] = args; return client.ask({ desk: b }, caller).then(function (r) { return r || {}; }, function (e) { return { status: 0, error: e.message }; }); };
let kid = null;

(async function () {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }

  // A goal, a press, a chat line: three records. And two desk lines.
  await call('session.set', { json: JSON.stringify({ goal: { id: 'c/G1', title: 'Goal' }, items: [{ id: 'c/G1.1', title: 'A', blocks: ['c/G1'] }] }) }, CW);
  await call('press', { id: 'c/G1', what: 'end-design' }, ANDY);
  await call('chat.add', { id: 'c/G1.1', text: 'FIRST-CHAT' }, WSL);
  await call('log.add', { json: JSON.stringify({ key: 'L1', at: '2026-10-01T14:00:00.000Z', dir: 'out', from: 'andy', kind: 'note', text: 'LINE-ONE', todo: 'team/chat' }) });
  await call('log.add', { json: JSON.stringify({ key: 'L2', at: '2026-10-01T14:00:00.000Z', dir: 'out', from: 'andy', kind: 'note', text: 'LINE-TWO', todo: 'team/chat' }) });

  test.subHeading('the verb exists, and answers both tables from zero');
  const first = await call('changes', { n: 0, line: 0 });
  const b1 = first.body || {};
  if (first.status !== 200) {
    test.fail(OWED + 'changes { n, line } answered ' + JSON.stringify({ status: first.status, code: b1.code }));
  } else {
    const rec = b1.records || [];
    const verbsSeen = rec.map(function (r) { return r.verb; });
    const ordered = rec.every(function (r, i) { return i === 0 || rec[i - 1].n < r.n; });
    if (rec.length >= 3 && ordered && verbsSeen.indexOf('session.set') !== -1 && verbsSeen.indexOf('press') !== -1 && verbsSeen.indexOf('chat.add') !== -1 &&
        rec.every(function (r) { return typeof r.n === 'number' && r.at && r.verb && typeof r.by === 'string' && r.body !== undefined; })) {
      test.check('records after 0: every record, oldest first, each { n, at, verb, by, body }');
    } else test.fail(OWED + 'records answered ' + JSON.stringify(rec).slice(0, 220));
    const lines = b1.lines || [];
    const texts = lines.map(function (l) { return (l.text !== undefined ? l : JSON.parse(l.line || '{}')).text; });
    if (lines.length === 2 && texts.indexOf('LINE-ONE') !== -1 && texts.indexOf('LINE-TWO') !== -1 &&
        lines.every(function (l) { return typeof l.line === 'number'; })) {
      test.check('lines after 0: both, each carrying its rowid as line (two lines share one at: only the rowid resumes exactly)');
    } else test.fail(OWED + 'lines answered ' + JSON.stringify(lines).slice(0, 220));
    if (typeof b1.n === 'number' && typeof b1.line === 'number' && b1.more === false) test.check('the reply carries the cursors and more false when caught up');
    else test.fail(OWED + 'cursors answered ' + JSON.stringify({ n: b1.n, line: b1.line, more: b1.more }));

    test.subHeading('resuming from the returned cursors answers nothing twice');
    const again = (await call('changes', { n: b1.n, line: b1.line })).body || {};
    if ((again.records || []).length === 0 && (again.lines || []).length === 0 && again.more === false) test.check('asking again from { n, line } answers empty');
    else test.fail(OWED + 'resume answered ' + JSON.stringify(again).slice(0, 200));

    test.subHeading('one answer: the cut says more, and the resume loses nothing and doubles nothing');
    let version = 0;
    for (let i = 0; i < 6; i++) {
      const w = await call('box.write', { id: 'c/G1.1', text: 'B' + i + '-' + 'x'.repeat(4400), version: version }, CW);
      version = (w.body || {}).version || version;
    }
    const walked = [];
    let cur = { n: b1.n, line: b1.line };
    let hops = 0;
    let sawMore = false;
    let oversized = 0;
    for (; hops < 10; hops++) {
      const r = (await call('changes', cur)).body || {};
      // Every answer fits one answer: the room the shared layer gives it, never over.
      if (Buffer.byteLength(JSON.stringify(r), 'utf8') > appClient.ANSWER_MAX) oversized += 1;
      (r.records || []).forEach(function (x) { walked.push(x.n); });
      if (r.more) sawMore = true;
      if (!r.more) { cur = { n: r.n, line: r.line }; break; }
      cur = { n: r.n, line: r.line };
    }
    const dupFree = walked.length === new Set(walked).size;
    const contiguous = walked.every(function (n, i) { return i === 0 || walked[i - 1] < n; });
    if (sawMore && walked.length === 6 && dupFree && contiguous && oversized === 0) test.check('6 big records came over ' + (hops + 1) + ' answers: cut with more, each within one answer, resumed exactly');
    else test.fail(OWED + 'the cut walk: more seen ' + sawMore + ', got ' + walked.length + ' records in ' + (hops + 1) + ' answers, dupFree ' + dupFree + ', oversized ' + oversized);
  }

  test.subHeading('a read takes no by');
  const withBy = await call('changes', { n: 0, line: 0, by: 'wsl-claude' });
  if (withBy.status >= 400 && (withBy.body || {}).code === 'no-such-argument') test.check('changes with a by is refused no-such-argument: it is a read');
  else test.fail(OWED + 'changes with a by answered ' + JSON.stringify({ status: withBy.status, code: (withBy.body || {}).code }));
})().catch(function (e) { test.fail('the run broke: ' + (e && e.stack || e)); }).then(function () {
  if (kid) kid.kill();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
