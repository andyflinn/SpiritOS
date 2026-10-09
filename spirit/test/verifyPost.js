'use strict';

// spirit/test/verifyPost.js
// THE LAST RECORDS, POSTED WHILE THE SUITE STILL EXISTS — goal/G8.1.
//
// testSupport posts a record as each assertion happens, and does not wait: check and fail are synchronous and return
// nothing, so waiting on a round trip would slow every one of about four and a half thousand assertions in a run.
// But a suite's last words are its report and then `process.exit(0)`, which takes whatever is still in the air with
// it. So testSupport hands this helper the records that had not come back yet and runs it with spawnSync: a child
// posts them, one at a time as Andy ruled, while the parent waits — once per suite, not once per assertion.
//
// A DUPLICATE COSTS NOTHING: deskVerify writes a row only for a test's first record or a change of outcome, so a
// record that was already posted and is sent again by this helper writes nothing (goal/G8.1).
//
//   node verifyPost.js <port> <json array of {suite, title, outcome}>

const port = Number(process.argv[2]);
let records = [];
try { records = JSON.parse(process.argv[3] || '[]'); } catch (e) { records = []; }
if (!Number.isInteger(port) || port <= 0 || !Array.isArray(records) || !records.length) process.exit(0);

(async function () {
  for (const r of records) {
    const body = JSON.stringify({ verb: 'jobs.api', ask: { deskVerify: { record: { suite: String(r.suite || ''), title: String(r.title || ''), outcome: String(r.outcome || '') } } } });
    try {
      await fetch('http://127.0.0.1:' + port + '/api/spirit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body });
    } catch (e) { /* the node is gone; a record nobody could take is not a suite's problem */ }
  }
})().then(function () { process.exit(0); }, function () { process.exit(0); });
