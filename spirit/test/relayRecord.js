'use strict';

// spirit/test/relayRecord.js
// CYCLE 11 — THE RECORD, ASSERTED AGAINST THE CYCLE DOCUMENT.
//
//   Andy: "our alpha shape needs to monitor member count so, that RAM
//   capacity can guarantee service."
//
// Written by wsl-claude under this cycle's agreement: the Windows Claude
// built cycle 11 R1-cycle 11 R7 and deliberately wrote no assertions, so that the suite is
// written from `design/cycles/2026-09-23-relay-record-cycle-11.md` rather
// than from the implementation. A suite written from the code can only
// describe it; one written from the document can disagree with it.
//
// WHERE THIS SUITE DISAGREES IT SAYS SO IN THE SUBHEADING, rather than
// going red on a reading the document leaves open. Two such places are
// flagged in the document itself (cycle 11 R3 and cycle 11 R6) and both are exercised here.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const nodeStore = require('../run/js/nodeStore');

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const RELAY = 'https://relay.example';

function home() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-record-'));
  return { dir: dir, store: nodeStore.open(dir) };
}

// CLOSE THE HANDLE BEFORE THE DIRECTORY GOES. Windows refuses to remove a
// file SQLite still holds — EPERM — while Linux removes it and says
// nothing, so this suite ran here and died at the first cleanup there.
// Found by the Windows Claude on the first cross-platform run of this
// file, which is the arrangement catching something about itself.
function closeAndRemove(w) {
  try { w.store.close(); } catch (e) { /* already closed */ }
  fs.rmSync(w.dir, { recursive: true, force: true });
}

// A report shaped like the one a relay actually sends (cycle 9's R13 for
// `seats`), with the people-carrying fields a relay must never leave in a
// record — cycle 11 R5 exists because a report CAN carry them.
function report(n, extra) {
  return Object.assign({
    peers: n,
    present: Math.max(0, n - 1),
    routes: n * 2,
    memory: { rss: 64 * 1048576 },
    seats: { held: n, outstanding: 2, allowance: 4096, free: 4096 - n },
  }, extra || {});
}

test.startTest('Cycle 11 — the record: what is kept, what is never kept, and what crosses');

// ── cycle 11 R1 ────────────────────────────────────────────────────────────────
test.subHeading('cycle 11 R1 — the named figures are columns, and an unnamed one survives whole');
{
  const w = home();
  w.store.record.put(RELAY, report(12, { somethingNobodyNamedYet: 7 }), 3 * MIN);
  const rows = w.store.record.since(RELAY, 0, 10);
  if (rows.length === 1 && rows[0].members === 12 && rows[0].connected === 11 &&
      rows[0].routes === 24 && rows[0].allowance === 4096 && rows[0].rssMB === 64) {
    test.check('the five named figures are columns, queried without opening the JSON');
  } else {
    test.fail('named columns wrong: ' + JSON.stringify(rows[0] || null));
  }
  let rest = null;
  try { rest = JSON.parse(rows[0].rest || '{}'); } catch (e) { rest = null; }
  if (rest && rest.somethingNobodyNamedYet === 7) {
    test.check('and a figure the schema never heard of is kept whole — no migration to add one');
  } else {
    test.fail('an unnamed figure was dropped: ' + JSON.stringify(rest));
  }
  closeAndRemove(w);
}

// ── cycle 11 R5, before cycle 11 R2, because it is the one that matters if it is wrong ──
test.subHeading('cycle 11 R5 — a report carrying people becomes a record carrying counts');
{
  const w = home();
  const withPeople = report(3, {
    invites: [{ label: 'bella', token: 'a1b2c3' }, { label: 'saint', token: 'd4e5f6' }],
    partners: ['lab.andyflinn.com', 'spirit-4.example'],
    roll: [{ name: 'andy', key: 'MCowBQYD-andy' }, { name: 'erin', key: 'MCowBQYD-erin' }],
  });
  w.store.record.put(RELAY, withPeople, 4 * MIN);
  const raw = JSON.stringify(w.store.record.since(RELAY, 0, 10));
  const leaked = ['bella', 'saint', 'a1b2c3', 'd4e5f6', 'andy', 'erin', 'MCowBQYD',
    'lab.andyflinn.com', 'spirit-4.example'].filter(function (s) { return raw.indexOf(s) !== -1; });
  if (leaked.length === 0) {
    test.check('no label, token, member name, key or partner name reached the record — nine strings searched for');
  } else {
    test.fail('the record kept people: ' + leaked.join(', '));
  }
  let rest = null;
  try { rest = JSON.parse(w.store.record.since(RELAY, 0, 1)[0].rest || '{}'); } catch (e) { rest = null; }
  if (rest && rest.invites === 2 && rest.partners === 2 && rest.roll === 2) {
    test.check('each list became its COUNT — a series of counts, never a series of names (0012)');
  } else {
    test.fail('lists were not counted: ' + JSON.stringify(rest));
  }

  // ── AND THE HALF THE COUNTING DOES NOT COVER ──────────────────
  //
  // countIfPeople turns an ARRAY or an OBJECT into a count, which is the
  // shape a roll, a partner list and an invite list arrive in. A name
  // that arrives as a PLAIN STRING is not a list, so it is copied into
  // the JSON column verbatim and kept — including in the daily tier,
  // which cycle 11 R4 keeps for good. cycle 11 R5 is about what is KEPT, and this keeps it.
  //
  // It does not cross to a caller today, because the series drops that
  // column entirely (cycle 11 R6). So the exposure is the record on disc rather
  // than the read verb — a difference worth stating rather than
  // blurring: one would be a leak, this is a permanent record of people
  // on a box whose whole point is that it does not keep them.
  const scalars = home();
  scalars.store.record.put(RELAY, report(3, {
    ownerLabel: 'Andy Flinn', lastClaim: 'bella', partner: 'lab.andyflinn.com',
  }), 6 * MIN);
  const kept = ['Andy Flinn', 'bella', 'lab.andyflinn.com'].filter(function (str) {
    return JSON.stringify(scalars.store.record.since(RELAY, 0, 5)).indexOf(str) !== -1;
  });
  if (kept.length === 0) {
    test.check('a name arriving as a plain string is dropped too — the record keeps figures, not people');
  } else {
    test.fail('cycle 11 R5 BROKEN FOR SCALARS: kept verbatim in the record: ' + kept.join(', ') +
      ' — countIfPeople counts arrays and objects and copies a string through. Fix: keep numbers and booleans only, which is all cycle 11 R1 asks of that column');
  }
  closeAndRemove(scalars);
  closeAndRemove(w);
}

// ── cycle 11 R4 ────────────────────────────────────────────────────────────────
test.subHeading('cycle 11 R4 — one row a minute, and a day older than ninety keeps one row');
{
  const w = home();
  for (let i = 0; i < 5; i += 1) w.store.record.put(RELAY, report(i), 10 * MIN + i * 1000);
  if (w.store.record.since(RELAY, 0, 100).length === 1) {
    test.check('five reports inside one minute leave one row');
  } else {
    test.fail('minute coarsening failed: ' + w.store.record.since(RELAY, 0, 100).length + ' rows');
  }
  const last = w.store.record.since(RELAY, 0, 100)[0];
  if (last.members === 4) {
    test.check('and the LAST report in the minute wins, because the newest figures are the ones read');
  } else {
    test.fail('an earlier report won: members=' + last.members);
  }

  // A FRESH HOME FOR THE SWEEP, because the minute rows above sit at ten
  // past the epoch and are themselves older than ninety days once "now"
  // is day two hundred — which is a fixture mistake, not a defect, and it
  // cost this suite two red assertions before anybody read the dates.
  closeAndRemove(w);
  const s2 = home();
  const now = 200 * DAY;
  const old = now - 120 * DAY;
  for (let d = 0; d < 3; d += 1) {
    for (let k = 0; k < 3; k += 1) s2.store.record.put(RELAY, report(d * 10 + k), old + d * DAY + k * 5 * MIN);
  }
  // And one INSIDE the window, so the sweep has something it must not touch.
  s2.store.record.put(RELAY, report(99), now - 2 * DAY);
  const before = s2.store.record.since(RELAY, 0, 1000).length;
  s2.store.record.coarsen(now);
  const after = s2.store.record.since(RELAY, 0, 1000);
  const oldRows = after.filter(function (r) { return r.at < now - 90 * DAY; });
  if (before === 10 && oldRows.length === 3) {
    test.check('nine rows across three old days become three — one a day, kept for good');
  } else {
    test.fail('the sweep kept ' + oldRows.length + ' old rows from ' + before + ' (expected 3)');
  }
  if (after.filter(function (r) { return r.at >= now - 90 * DAY; }).length === 1) {
    test.check('and nothing inside ninety days was touched');
  } else {
    test.fail('the sweep reached into the fine tier');
  }
  closeAndRemove(s2);
}

// ── cycle 11 R3 ────────────────────────────────────────────────────────────────
test.subHeading('cycle 11 R3 — an outage is marked; a quiet stretch is not — and a THIRD state is neither');
{
  const w = home();
  w.store.record.put(RELAY, report(5), 10 * MIN);
  w.store.record.put(RELAY, report(5), 11 * MIN);          // quiet: nothing happened, stream up
  w.store.record.edge(RELAY, 'close', 12 * MIN + 30 * 1000, 'stream lost');
  w.store.record.edge(RELAY, 'open', 20 * MIN + 12 * 1000);
  w.store.record.put(RELAY, report(6), 21 * MIN);

  const rows = w.store.record.since(RELAY, 0, 100);
  const kinds = rows.map(function (r) { return r.kind; }).join(',');
  if (kinds === 'report,report,close,open,report') {
    test.check('the two edges sit in the series in order, distinguishable by kind: ' + kinds);
  } else {
    test.fail('edges are not in the record: ' + kinds);
  }
  const closeRow = rows.find(function (r) { return r.kind === 'close'; });
  if (closeRow.at % MIN !== 0) {
    test.check('an edge keeps its instant rather than its minute — two in one minute is a flap, which is the thing worth seeing');
  } else {
    test.fail('the edge was truncated to the minute and a flap would vanish');
  }
  let why = null;
  try { why = JSON.parse(closeRow.rest || '{}').why; } catch (e) { why = null; }
  if (why === 'stream lost') {
    test.check('and a close says why, so a reader is not left inferring the reason from the silence');
  } else {
    test.fail('the close kept no reason: ' + JSON.stringify(why));
  }

  // THE READING THE DOCUMENT FLAGS: marked, or merely inferable?
  const gapIsMarked = rows.some(function (r) { return r.kind === 'close'; }) &&
    rows.some(function (r) { return r.kind === 'open'; });
  if (gapIsMarked) {
    test.check('so an OUTAGE is marked by its edges — a quiet stretch has no rows at all, and the two do not look alike');
  } else {
    test.fail('a gap can only be inferred from the rows either side');
  }

  // AND THE STATE NEITHER MARKS, which is this suite's finding rather
  // than the cycle's: if the NODE is down, no report and no edge is
  // written, so the record shows the same empty stretch as a quiet relay.
  // The relay was fine; the watcher was not; the record cannot say so.
  const nodeWasDown = w.store.record.since(RELAY, 13 * MIN, 100)
    .filter(function (r) { return r.at < 20 * MIN; }).length;
  if (nodeWasDown === 0) {
    test.check('FINDING, not a failure: a node that was itself down leaves exactly this — no rows, no edges — so "the relay was quiet" and "nobody was watching" are still one shape');
  } else {
    test.fail('unexpected rows inside the gap: ' + nodeWasDown);
  }
  closeAndRemove(w);
}

// ── cycle 11 R6 and cycle 11 R7 ─────────────────────────────────────────────────────────
test.subHeading('cycle 11 R6 — what crosses is a series of decided values, and cycle 11 R7 keeps the seats in it');
{
  const w = home();
  w.store.record.put(RELAY, report(9, { invites: [{ label: 'bella' }] }), 30 * MIN);
  w.store.record.edge(RELAY, 'close', 31 * MIN);
  const series = w.store.record.series(RELAY, 0, 10);

  const value = series.find(function (s) { return s.members !== undefined; });
  const keys = Object.keys(value).sort().join(',');
  if (keys === 'allowance,at,connected,free,members,outstanding,routes,rssMB') {
    test.check('a row crosses as eight decided values: ' + keys);
  } else {
    test.fail('the series carried something else: ' + keys);
  }
  if (value.rest === undefined && value.kind === undefined && value.relay === undefined) {
    test.check('and the row itself does not cross — no `rest`, no `kind`, no `relay` (0020: a value may cross, a structure may not)');
  } else {
    test.fail('the working-out crossed with the answer: ' + JSON.stringify(value));
  }
  if (value.free === 4087 && value.outstanding === 2) {
    test.check('cycle 11 R7: seats free and outstanding cross as figures, so a lever reads them without digging in JSON');
  } else {
    test.fail('the seat series is not in the answer: ' + JSON.stringify(value));
  }
  const edge = series.find(function (s) { return s.was !== undefined; });
  if (edge && edge.was === 'close' && edge.members === undefined) {
    test.check('an edge crosses as an edge — a moment, not a set of zeroes pretending to be a reading');
  } else {
    test.fail('the edge crossed as figures: ' + JSON.stringify(edge));
  }
  if (JSON.stringify(series).indexOf('bella') === -1) {
    test.check('and cycle 11 R5 holds through the reader as well as the writer');
  } else {
    test.fail('a label crossed to the caller');
  }
  closeAndRemove(w);
}

// ── cycle 11 R2 ────────────────────────────────────────────────────────────────
test.subHeading('cycle 11 R2 — the node process writes the record, and nothing else does');
{
  const RUN = path.join(__dirname, '..', 'run');
  function walk(dir, out) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, out);
      else if (e.name.endsWith('.js')) out.push(p);
    });
    return out;
  }
  const writers = walk(RUN, []).filter(function (f) {
    const src = fs.readFileSync(f, 'utf8');
    return /record\s*\.\s*(put|edge)\s*\(/.test(src);
  }).map(function (f) { return path.relative(RUN, f).split(path.sep).join('/'); });

  // The node's own arrival path is the one writer the cycle allows. A
  // second one — a job, a timer, a shell app — is the failure this
  // asserts against, and it fails CLOSED: no writer at all is also wrong,
  // because it would mean the guard has lost track of what it guards.
  if (writers.length === 1) {
    test.check('exactly one place in spirit/run writes the record: ' + writers[0]);
  } else if (writers.length === 0) {
    test.fail('no writer found — either the record is written elsewhere or this guard has gone blind');
  } else {
    test.fail('more than one writer, and a second writer on the node\'s own file is what cycle 11 R2 forbids: ' + writers.join(', '));
  }
  const jobs = writers.filter(function (f) { return /job/i.test(f); });
  if (jobs.length === 0) {
    test.check('and no job writes it — the node already receives every report on the stream it holds');
  } else {
    test.fail('a job writes the record: ' + jobs.join(', '));
  }
}

// ── C3 — THE STATE THE RECORD CANNOT REACH, AND THE SHAPE FOR IT ─────
//
// Found by this suite: an outage is marked by edges and a quiet stretch
// has no rows, so those two do not look alike. A NODE THAT WAS ITSELF
// DOWN writes neither, because the node is what writes the record and
// cannot record its own absence. "The relay was quiet" and "nobody was
// watching" are one shape, and the second is the one that makes a
// reader trust a gap they should not trust.
//
// THE SHAPE, wsl-claude’s call as the finder, and it is deliberately
// two rows rather than one:
//
//   `started` — written at node boot, for each relay it will watch.
//   `stopped` — written in the goodbye the node already runs on SIGTERM.
//
// Why both. A `started` alone bounds a gap from the right: a reader
// meeting it knows the node began watching THERE and that anything
// before it is unattributed. Adding `stopped` separates the two ways a
// node leaves: STOPPED then STARTED is a deliberate absence — an update,
// a reboot, an operator — while a STARTED with no `stopped` before it is
// a node that died or was killed. Those are different sentences to an
// owner asking why his record has a hole in it, and the second is the
// one worth chasing.
//
// AND THE HONEST LIMIT, which belongs in the cycle rather than in a
// comment nobody reads: NOTHING CAN MARK A GAP WHILE IT IS HAPPENING,
// because the writer is gone. The record can only ever say where it
// stopped and where it resumed. A reader must still not read the
// interval between them as evidence about the relay — only as evidence
// about the node. That is a smaller claim than the edges make, and it
// should be stated where the edges are documented, or the two kinds of
// gap will be read alike again by whoever arrives next.
//
// Declared rather than built: the code is one line in the node’s boot
// beside the seal-key migration, and one in the goodbye beside
// presence.goingAway — but writing it is the builder’s half of this
// cycle’s agreement, and this is the assertion that says what it must do.
{
  const w = home();
  const kinds = [];
  try { w.store.record.edge(RELAY, 'started', 1000); } catch (e) { /* not built */ }
  w.store.record.since(RELAY, 0, 10).forEach(function (r) { kinds.push(r.kind); });
  const hasStarted = kinds.indexOf('started') !== -1;
  test.awaiting('cycle-11/C3', 'a started row at node boot and a stopped row in its goodbye',
    hasStarted,
    'a reader can tell "the relay was quiet" from "this node was not running", and a deliberate stop from a death',
    { there: 40, cost: 'MEASURED WHILE DECLARING IT, not guessed: record.edge coerces any kind that is not open to close, so the two row kinds do not exist yet — that is one line there. Then the call at boot (server.js, beside ensureIdentity), the call in the goodbye (beside presence.goingAway), the reader in series treating them as moments, and this assertion becoming real' });
  closeAndRemove(w);
}
test.reportSuccessFailureCount();
