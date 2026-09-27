'use strict';

// spirit/test/nodeHistory.js
// ANDY'S NODE CAN READ BACK ITS OWN RECORD — ALL OF IT, ONCE, AND NOTHING
// IT MUST NOT HAND OVER.
//
//   Andy, 2026-09-27: "yeah, my node should contain the overall record of
//   our activities." And Desk, his screen onto it, reads the record
//   through node.history (built by claude-windows at a660e43; designed in
//   design/shell/AGENTS-UI.md).
//
// Written by the tester from the agreed contract, against the interface
// history({ after, limit }) -> { rows, next, more } — not from the body of
// the function. Rows are written through the log's own `note`, the way
// the node writes them, so nothing here is a hand-made row the real node
// could never produce.
//
// THE DEFECT THIS WAS BORN FROM: trafficLog.arrivals pages by TIMESTAMP,
// strictly after, cut at `limit` — so a page ending inside one millisecond
// loses the rest of that millisecond. Measured before history existed:
// five arrivals, three in one ms, paged two at a time, came back as three.
// History pages by POSITION. The burst case below is that measurement,
// turned into an assertion.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const trafficLog = require('../run/js/trafficLog');

test.startTest('node.history returns the owner\'s whole record, once, and nothing held back');

function logWith(entries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-history-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const log = trafficLog.createTrafficLog({ rootDir: root });
  entries.forEach(function (e) { log.note(e); });
  return log;
}

function inbound(hash, payload, extra) {
  return Object.assign({ dir: 'in', kind: 'request', peer: 'PEER', hash: hash,
    outcome: 'delivered', admitted: true, payload: payload }, extra || {});
}
function outbound(hash, payload, outcome) {
  return { dir: 'out', kind: 'request', peer: 'PEER', hash: hash, outcome: outcome || 'sent', payload: payload };
}

// Every page, following `next` while `more` says there is one.
function allPages(log, limit) {
  const seen = [];
  let after;
  let pages = 0;
  while (pages < 1000) {
    pages += 1;
    const page = log.history({ after: after, limit: limit });
    page.rows.forEach(function (r) { seen.push(r); });
    if (!page.more) break;
    after = page.next;
  }
  return { rows: seen, pages: pages };
}

function hashes(rows) { return rows.map(function (r) { return r.hash; }); }

// ── 1. HELD AND IGNORED NEVER LEAVE — BUT THEY ARE THERE ─────────────
{
  const log = logWith([
    inbound('admitted', 'an admitted message'),
    inbound('held', 'held for a human decision', { admitted: false }),
    inbound('ignored', 'ignored at the door', { admitted: false, outcome: 'ignored' }),
  ]);
  const inFile = hashes(log.read());
  const given = hashes(log.history({}).rows);
  if (inFile.indexOf('held') !== -1 && inFile.indexOf('ignored') !== -1
      && given.indexOf('held') === -1 && given.indexOf('ignored') === -1
      && given.indexOf('admitted') !== -1) {
    test.check('a held and an ignored packet are IN the log and NOT in history, while an admitted '
      + 'one is — so this is a filter doing its job, not an empty answer');
  } else {
    test.fail('log had ' + inFile.join(',') + '; history gave ' + given.join(','));
  }
}

// ── 2. THE OWNER'S OWN OUTBOUND IS PART OF HIS RECORD ────────────────
{
  const log = logWith([inbound('in-1', 'hello'), outbound('out-1', 'what he wrote back')]);
  const got = log.history({}).rows;
  const out = got.filter(function (r) { return r.hash === 'out-1'; })[0];
  if (out && out.dir === 'out' && out.payload === 'what he wrote back') {
    test.check('what this node SENT is in its history too, with its words — a thread is both sides');
  } else {
    test.fail('outbound row: ' + JSON.stringify(out) + ' of ' + JSON.stringify(hashes(got)));
  }
}

// ── 3. NO FILTER BY APP ──────────────────────────────────────────────
{
  const log = logWith([
    inbound('a1', JSON.stringify({ app: 'agents', v: 1, body: { text: 'x' } })),
    inbound('n1', JSON.stringify({ app: 'natter', v: 1, body: { text: 'y' } })),
  ]);
  const got = hashes(log.history({}).rows);
  if (got.indexOf('a1') !== -1 && got.indexOf('n1') !== -1) {
    test.check('rows of two different apps both come back — the node never reads `app`; '
      + 'Desk filters, the node does not (hub.js: "no filter on packet.app, ever")');
  } else {
    test.fail('history gave ' + got.join(','));
  }
}

// ── 4. A SAME-MILLISECOND BURST, PAGED SMALL, LOSES NOTHING ──────────
//
// The log stamps its own `at`, so rows written through `note` in a loop
// only SOMETIMES share a millisecond — and the first version of this check
// passed on a run where they did not, with the collision it exists for
// never happening. So the rows are written by `note`, as the node writes
// them, and then given ONE shared timestamp on disc. The collision is now
// a precondition, asserted, not a coincidence.
{
  const entries = ['b1', 'b2', 'b3', 'b4', 'b5'].map(function (h) { return inbound(h, 'burst ' + h); });
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-history-burst-'));
  fs.mkdirSync(path.join(root, 'relay-state'), { recursive: true });
  const writer = trafficLog.createTrafficLog({ rootDir: root });
  entries.forEach(function (e) { writer.note(e); });
  const file = trafficLog.logPath(root);
  const AT = '2026-09-27T00:00:00.001Z';
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(function (l) {
    const row = JSON.parse(l);
    row.at = AT;
    return JSON.stringify(row);
  }).join('\n') + '\n');
  const log = trafficLog.createTrafficLog({ rootDir: root });

  const stamped = log.read().map(function (r) { return r.at; });
  const sameMs = stamped.length === 5 && stamped.every(function (t) { return t === AT; });
  const got = hashes(allPages(log, 2).rows);
  if (!sameMs) {
    test.fail('the precondition did not hold — the five rows do not share one millisecond ('
      + JSON.stringify(stamped) + '), so nothing here tests the collision');
  } else if (got.length === 5 && got.slice().sort().join(',') === 'b1,b2,b3,b4,b5') {
    test.check('five messages sharing ONE millisecond, paged two at a time, come back as five, '
      + 'each once — the case trafficLog.arrivals loses (measured on this same file, next)');
  } else {
    test.fail('paged at 2, got ' + got.join(',') + ' — ' + got.length + ' of 5');
  }

  // THE CONTROL, ON THE SAME FILE: arrivals, paged the way it pages, does
  // lose rows here. If it did not, the file above is not the case that
  // breaks timestamp paging, and the check above proves less than it says.
  const lost = [];
  let since;
  for (let i = 0; i < 10; i += 1) {
    const page = log.arrivals({ since: since, limit: 2 });
    if (!page.length) break;
    page.forEach(function (r) { lost.push(r.hash); });
    since = page[page.length - 1].at;
  }
  if (lost.length < 5) {
    test.check('and on that same file, timestamp paging (arrivals) returns ' + lost.length
      + ' of 5 — so the file really is the case that breaks it');
  } else {
    test.fail('arrivals paged the burst without loss (' + lost.length + ' of 5), so this file does '
      + 'not reproduce the defect the check above is meant to guard');
  }
}

// ── 5. A REFUSED POST SAYS SO; ONE MESSAGE IS ONE ROW ────────────────
{
  const log = logWith([
    outbound('never-went', 'words that did not leave', 'refused'),
    outbound('went-later', 'words that went on retry', 'queued'),
    outbound('went-later', 'words that went on retry', 'refused'),
    outbound('went-later', 'words that went on retry', 'sent'),
  ]);
  const got = log.history({}).rows;
  const refused = got.filter(function (r) { return r.hash === 'never-went'; });
  const later = got.filter(function (r) { return r.hash === 'went-later'; });
  if (refused.length === 1 && refused[0].outcome === 'refused'
      && later.length === 1 && later[0].outcome === 'sent') {
    test.check('a post that never left shows `refused`, and a post queued, refused and then sent '
      + 'is ONE row saying `sent` — "you wrote this and it did not go" is visible, and a retry '
      + 'is not three messages');
  } else {
    test.fail('refused ' + JSON.stringify(refused) + ', retried ' + JSON.stringify(later));
  }
}

// ── 6. THE BYTE CAP STOPS EARLY, AND THE CURSOR RESUMES EXACTLY ──────
{
  const big = 'm'.repeat(15000);
  const entries = [];
  for (let i = 0; i < 30; i += 1) entries.push(inbound('big' + i, big + i));
  const log = logWith(entries);
  const first = log.history({ limit: 500 });
  const firstBytes = first.rows.reduce(function (n, r) { return n + Buffer.byteLength(String(r.payload || ''), 'utf8'); }, 0);
  const all = allPages(log, 500);
  const got = hashes(all.rows);
  const unique = Object.keys(got.reduce(function (m, h) { m[h] = true; return m; }, {}));
  if (first.more && first.rows.length < 30 && firstBytes <= 256 * 1024
      && got.length === 30 && unique.length === 30 && all.pages > 1) {
    test.check('thirty 15 KB messages do not fit one page: it stops at ' + first.rows.length
      + ' rows under 256 KB and says `more`, and following `next` returns all thirty exactly once over '
      + all.pages + ' pages');
  } else {
    test.fail('first page ' + first.rows.length + ' rows, ' + firstBytes + ' bytes, more=' + first.more
      + '; all pages gave ' + got.length + ' (' + unique.length + ' distinct) over ' + all.pages);
  }
}

// ── AND THE MEMBERSHIP HALF STAYS WHERE IT IS ────────────────────────
{
  const log = logWith([
    inbound('msg', 'a message'),
    { dir: 'in', kind: 'owner', peer: 'RELAY', hash: 'claim-1', outcome: 'delivered', event: 'claimed' },
  ]);
  const got = hashes(log.history({}).rows);
  if (got.indexOf('msg') !== -1 && got.indexOf('claim-1') === -1) {
    test.check('a relay\'s owner event is not in history: it is a fact about membership with its own '
      + 'read (ownerEvents), not a message in his record');
  } else {
    test.fail('history gave ' + got.join(','));
  }
}

test.reportSuccessFailureCount();
