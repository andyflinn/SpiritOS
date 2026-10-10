'use strict';

// goal/G2.13: an item that offers Done no longer offers Go. Red on today's tree.
//   RULING (Andy, 2026-10-02, verbatim, under goal/G2.11): "how can there be a Go button AND a Done button on this
//   item?", then "when Done is offered, Go may no longer be displayed."
//   In the tree: desk.js buttons() offers Go while an item has not gone and nothing open blocks it (desk.js:426),
//   and Done once an agent has claimed (desk.js:434) — two independent rules, so an item claimed without a Go
//   press offers both.
// The contract the builder follows (the shape in goal/G2.13's box; the arguable parts fixed here by name):
//   1. The one rule lives in buttons(), so the List and the dialog follow it alike: an item that offers Done does
//      not offer Go. An item with no claim offers Go as before; once claimed it offers Done and no Go.
//   2. THE CLAIM CONSUMED THE GO (Andy, 2026-10-02, under goal/G2.13: "When Done is offered, Go will be considered
//      pressed/consumed") — REPLACED by goal/G3.9 (Andy, 2026-10-03: "yes, the desk may refuse a claim-done, on an
//      item without 'go' on record"): a claim before his Go is refused and changes nothing; the item is gone by his
//      Go alone. After it, Done still leads to Close and Reopen, a Reopen offers no Go again, and an item that
//      went by his Go offers neither Go nor, until a claim, Done. deskRules.js has the refusal in full.
//   3. The press is refused where the button is gone: a Go pressed on an item that offers Done is refused as not
//      offered (desk.js's press guard, not-offered).

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G2.13: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskGoOrDoneTestPeerCWAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskGoOrDoneTestOwnerAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function has(list, what) { return (list || []).indexOf(what) !== -1; }

test.startTest('goal/G2.13: an item that offers Done no longer offers Go');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-goordone-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const itemOf = async function (id) { const r = await call('item.get', { id: id }, ANDY); try { return JSON.parse((r.body || {}).item) || {}; } catch (e) { return {}; } };
  const buttonsOf = async function (id) { return (await itemOf(id)).buttons || ['?']; };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    const set = await call('session.set', { json: JSON.stringify({ goal: { id: 'g/G1', title: 'Round' }, items: [
      { id: 'g/G1.1', title: 'A', blocks: ['g/G1'] }, { id: 'g/G1.2', title: 'B', blocks: ['g/G1'] }] }) }, CW);
    if (set.status !== 200) { test.fail(OWED + 'the session was not taken: ' + JSON.stringify(set.body)); return; }
    await call('press', { id: 'g/G1', what: 'end-design' }, ANDY);

    test.subHeading('1. one rule: Done offered, Go gone');
    const fresh = await buttonsOf('g/G1.1');
    if (has(fresh, 'go') && !has(fresh, 'done')) test.check('an item with no claim offers Go, as before');
    else test.fail('g/G1.1 with no claim: ' + JSON.stringify(fresh));
    // goal/G3.9: a claim before his Go is refused; the item still offers Go. His Go, then the claim, offers Done alone.
    const early = await call('press', { id: 'g/G1.1', what: 'claim-done' }, CW);
    const stillFresh = await buttonsOf('g/G1.1');
    if ((early.body || {}).ok === false && has(stillFresh, 'go') && !has(stillFresh, 'done')) test.check('a claim before his Go is refused, and the item still offers Go (goal/G3.9)');
    else test.fail('OWED by goal/G3.9: the claim before Go answered ' + JSON.stringify(early.body) + ', buttons ' + JSON.stringify(stillFresh));
    await call('press', { id: 'g/G1.1', what: 'go' }, ANDY);
    await call('press', { id: 'g/G1.1', what: 'claim-done' }, CW);
    // goal/G16.13: a plain item's claim no longer brings Done by itself — the
    // verifier's word does. Andy: "only the verifier should give me a done button".
    await call('verify.pass', { id: 'g/G1.1' }, ANDY);
    const claimed = await buttonsOf('g/G1.1');
    if (has(claimed, 'done') && !has(claimed, 'go')) test.check('gone by his Go and claimed: Done offered, Go no longer');
    else test.fail(OWED + 'g/G1.1 gone and claimed: ' + JSON.stringify(claimed));
    // The List draws from items.search: {items: [{key, label}]}, the label being the item's facts as JSON.
    const list = await call('items.search', { text: '', currentGoalOnly: false, goalsOnly: false, includeClosed: false }, ANDY);
    const row = (function () {
      const hit = (((list.body || {}).items) || []).filter(function (r) { return r.key === 'g/G1.1'; })[0];
      try { return hit ? JSON.parse(hit.label) : null; } catch (e) { return null; }
    })();
    if (row && row.buttons && has(row.buttons, 'done') && !has(row.buttons, 'go')) test.check('and the List row agrees with the dialog (one rule, buttons())');
    else test.fail(OWED + 'the List row for g/G1.1 offers ' + JSON.stringify(row && row.buttons) + (row ? '' : ' (row not found in items.search)'));

    test.subHeading('2. nothing else moves');
    await call('press', { id: 'g/G1.1', what: 'done' }, ANDY);
    const done = await buttonsOf('g/G1.1');
    if (has(done, 'close') && has(done, 'reopen') && !has(done, 'go')) test.check('Done leads to Close and Reopen, no Go');
    else test.fail('g/G1.1 after Done: ' + JSON.stringify(done));
    await call('press', { id: 'g/G1.1', what: 'reopen' }, ANDY);
    const reopened = await buttonsOf('g/G1.1');
    if (!has(reopened, 'go') && !has(reopened, 'done')) test.check('gone once: after a Reopen there is no Go, and no Done until a new claim');
    else test.fail(OWED + 'g/G1.1 after Reopen (gone by his Go): ' + JSON.stringify(reopened));
    await call('press', { id: 'g/G1.2', what: 'go' }, ANDY);
    const went = await buttonsOf('g/G1.2');
    if (!has(went, 'go') && !has(went, 'done')) test.check('an item that went offers neither Go nor, until a claim, Done');
    else test.fail('g/G1.2 after Go: ' + JSON.stringify(went));
    await call('press', { id: 'g/G1.2', what: 'claim-done' }, CW);
    await call('verify.pass', { id: 'g/G1.2' }, ANDY);
    const wentClaimed = await buttonsOf('g/G1.2');
    if (has(wentClaimed, 'done') && !has(wentClaimed, 'go')) test.check('and once claimed it offers Done');
    else test.fail('g/G1.2 claimed after Go: ' + JSON.stringify(wentClaimed));

    test.subHeading('3. a Go pressed where Done is offered does not mark the item gone');
    await call('press', { id: 'g/G1.1', what: 'claim-done' }, CW);
    await call('verify.pass', { id: 'g/G1.1' }, ANDY);
    const goAnswer = await call('press', { id: 'g/G1.1', what: 'go' }, ANDY);
    const after = await itemOf('g/G1.1');
    const code = (goAnswer.body || {}).code || '';
    if (code === 'not-offered' && has(after.buttons, 'done') && !has(after.buttons, 'go')) test.check('a Go pressed on a claimed item is refused as not offered; Done still offered');
    else test.fail(OWED + 'after a Go on a claimed item: answer ' + JSON.stringify(goAnswer.body) + ', buttons ' + JSON.stringify(after.buttons));
  } catch (e) {
    test.fail(OWED + 'the red itself tripped: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }
})().then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
