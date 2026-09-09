'use strict';

// What a contact costs, counted (CYCLE-PACKET-7.md).
//
// A whoBook row is what a human decided about a key. These numbers are
// not a decision, so they do not live on the row: they are a sidecar per
// peer, under app/contacts/, named by peerFile so that bytesHeld already
// counts them as part of what that contact costs.
//
// What is under test here is the counting itself, and the three things
// that keep it honest:
//
//   - unansweredInbound counts up on inbound and ZEROES on outbound, so
//     it describes whether you answered rather than how popular you are;
//   - the same message id twice does not count twice — the relay's inbox
//     is a filter, not a queue, so every poll re-reads every line;
//   - rates come from a fixed 14-day window with missing days counting
//     as zero, so a total cannot grow forever and a quiet week shows.
//
// Whether a key is ELIGIBLE to be counted is the hub's question, not
// this module's: blocked, held and stranger all live in whoBook, and a
// file that had an opinion about them would be a second address book.
// See countInbound in hub.js, and chatPeople.js for those tests.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');
const peerFile = require('../run/js/peerFile.js');
const peerStats = require('../run/js/peerStats.js');

const BERT = 'MCowBQYDK2VwAyEAbertbertbertbertbertbertbertbertbertb=';
const CAROL = 'MCowBQYDK2VwAyEAcarolcarolcarolcarolcarolcarolcaro=';

// A fixed clock. Every rate here is a division by a window of days, and
// a test that asked the wall clock would answer differently at midnight.
const NOON = Date.parse('2026-09-09T12:00:00.000Z');

function daysBefore(ms, n) {
  return ms - (n * 24 * 60 * 60 * 1000);
}

function tmpHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-peerstats-'));
}

function readRaw(home, key) {
  return JSON.parse(fs.readFileSync(peerStats.statsPath(home, key), 'utf8'));
}

test.startTest('Peer stats — what a contact costs, counted rather than remembered');

test.subHeading('Inbound counts up, and answering is what puts it back');

{
  const home = tmpHome();

  const first = peerStats.noteIn(home, BERT, 'm1', NOON);
  if (first.unansweredInbound === 1 && readRaw(home, BERT).days[0].in === 1) {
    test.check('one delivered line is one unanswered inbound and one on today');
  } else {
    test.fail('after one: ' + JSON.stringify(first) + ' ' + JSON.stringify(readRaw(home, BERT).days));
  }

  peerStats.noteIn(home, BERT, 'm2', NOON);
  peerStats.noteIn(home, BERT, 'm3', NOON);
  if (peerStats.readSummary(home, BERT, NOON).unansweredInbound === 3) {
    test.check('and three lines with nothing back from you is three');
  } else {
    test.fail('after three: ' + JSON.stringify(peerStats.readSummary(home, BERT, NOON)));
  }

  // The whole point of the number. It is not "how much did bert write",
  // which would only ever grow — it is "did I answer", and replying is
  // what answers it.
  const answered = peerStats.noteOut(home, BERT, NOON);
  const raw = readRaw(home, BERT);
  if (answered.unansweredInbound === 0 && raw.days[0].out === 1 && raw.days[0].in === 3) {
    test.check('and one reply puts it back to nothing without erasing what arrived');
  } else {
    test.fail('after reply: ' + JSON.stringify(answered) + ' ' + JSON.stringify(raw.days));
  }

  peerStats.noteIn(home, BERT, 'm4', NOON);
  if (peerStats.readSummary(home, BERT, NOON).unansweredInbound === 1) {
    test.check('and it starts again from the next thing they say');
  } else {
    test.fail('after reply then inbound: ' + JSON.stringify(peerStats.readSummary(home, BERT, NOON)));
  }
}

test.subHeading('The same line, read twice, is one line');

{
  const home = tmpHome();

  // This is not a corner case, it is every poll after the first. The
  // relay's inbox FILTERS its store rather than draining it
  // (relay.js, inbox()), so a message stays in the mailbox and comes
  // back on every read until it ages out. Without the id, a chat window
  // left open would show bert writing once and count it hundreds of
  // times.
  peerStats.noteIn(home, BERT, 'm1', NOON);
  peerStats.noteIn(home, BERT, 'm1', NOON);
  peerStats.noteIn(home, BERT, 'm1', NOON);
  const summary = peerStats.readSummary(home, BERT, NOON);
  if (summary.unansweredInbound === 1 && readRaw(home, BERT).days[0].in === 1) {
    test.check('one id read three times counts once');
  } else {
    test.fail('re-read: ' + JSON.stringify(summary));
  }

  peerStats.noteIn(home, BERT, 'm2', NOON);
  if (peerStats.readSummary(home, BERT, NOON).unansweredInbound === 2) {
    test.check('and a genuinely new id still counts');
  } else {
    test.fail('new id: ' + JSON.stringify(peerStats.readSummary(home, BERT, NOON)));
  }

  // The remembered ids are a cap, not a transcript — deliberately the
  // same 200 as the relay's whole store (MAX_MESSAGES, relay.js), so
  // every id that could still come back is still known, and no more.
  const raw = readRaw(home, BERT);
  if (raw.seenIds.length === 2 && raw.seenIds.indexOf('m1') !== -1 &&
      Object.keys(raw).indexOf('text') === -1) {
    test.check('and what is remembered is ids, never a word of what was said');
  } else {
    test.fail('seenIds: ' + JSON.stringify(raw));
  }
}

test.subHeading('A rate is a window, so it can fall');

{
  const home = tmpHome();

  // Fourteen lines on one day. A lifetime total would read 14 forever;
  // a rate reads 1 a day this fortnight and 0 the next, which is the
  // difference the whole packet is about.
  for (let i = 0; i < 14; i++) peerStats.noteIn(home, BERT, 'm' + i, NOON);
  const today = peerStats.readSummary(home, BERT, NOON);
  if (today.inboundPerDay === 1 && today.outboundPerDay === 0) {
    test.check('fourteen in one day over a fourteen-day window is one a day');
  } else {
    test.fail('rate: ' + JSON.stringify(today));
  }

  // The same file, read a fortnight later. Nothing was written in
  // between and nothing had to be: the days that are missing count as
  // zero, which is what makes a quiet contact go quiet on screen.
  const later = peerStats.readSummary(home, BERT, daysBefore(NOON, -14));
  if (later.inboundPerDay === 0) {
    test.check('and the same file a fortnight on reads nothing, with no write in between');
  } else {
    test.fail('window did not roll off: ' + JSON.stringify(later));
  }

  // Half a window out, half the days are still inside it.
  const half = peerStats.readSummary(home, BERT, daysBefore(NOON, -7));
  if (half.inboundPerDay === 1) {
    test.check('and a day still inside the window still counts for its whole share');
  } else {
    test.fail('half-rolled window: ' + JSON.stringify(half));
  }

  if (peerStats.WINDOW_DAYS === 14) {
    test.check('and the divisor is the window, stated once and exported');
  } else {
    test.fail('WINDOW_DAYS: ' + peerStats.WINDOW_DAYS);
  }
}

test.subHeading('Days are the grain, and the ring is bounded');

{
  const home = tmpHome();

  // Twenty days of one line each. The file must not grow forever, and
  // what falls off the end is the oldest.
  for (let i = 19; i >= 0; i--) peerStats.noteIn(home, BERT, 'd' + i, daysBefore(NOON, i));
  const raw = readRaw(home, BERT);
  if (raw.days.length === peerStats.WINDOW_DAYS) {
    test.check('twenty days of traffic keeps fourteen buckets, not twenty');
  } else {
    test.fail('days kept: ' + raw.days.length);
  }

  // Day grain is a PRIVACY decision, not a storage one: per-message
  // timestamps would be a second archive of when everybody wrote — the
  // thing chat's own cap exists to avoid — and you cannot rebuild a
  // conversation out of a daily count.
  const buckets = raw.days.map(function (b) { return Object.keys(b).sort().join(','); });
  const uniform = buckets.every(function (k) { return k === 'day,in,out'; });
  const dated = raw.days.every(function (b) { return /^\d{4}-\d{2}-\d{2}$/.test(b.day); });
  if (uniform && dated) {
    test.check('and a bucket is a date and two counts — no times, no ids, no text');
  } else {
    test.fail('bucket shape: ' + JSON.stringify(raw.days.slice(0, 2)));
  }
}

test.subHeading('One file per peer, where peerFile says and where bytesHeld looks');

{
  const home = tmpHome();
  peerStats.noteIn(home, BERT, 'm1', NOON);
  peerStats.noteIn(home, CAROL, 'm1', NOON);

  const bertPath = peerStats.statsPath(home, BERT);
  const rel = path.relative(home, bertPath).split(path.sep);

  // Under app/contacts/ and named by peerFile: both halves matter.
  // hub.js's bytesHeldByPeer walks app/ for the peerfile- prefix and
  // asks peerFile whose it is, so a sidecar counts toward what that
  // contact costs without hub.js being told this module exists.
  if (rel.length === 3 && rel[0] === 'app' && rel[1] === 'contacts' &&
      rel[2] === peerFile.fileName(BERT)) {
    test.check('a sidecar is app/contacts/ plus the name peerFile gives it');
  } else {
    test.fail('path: ' + rel.join('/'));
  }

  if (peerFile.keyFromFileName(rel[2]) === BERT) {
    test.check('and the name says whose it is, so nothing has to be indexed');
  } else {
    test.fail('name does not round-trip: ' + rel[2]);
  }

  // Two peers, two files, no shared state.
  peerStats.noteIn(home, CAROL, 'm2', NOON);
  const b = peerStats.readSummary(home, BERT, NOON);
  const c = peerStats.readSummary(home, CAROL, NOON);
  if (b.unansweredInbound === 1 && c.unansweredInbound === 2) {
    test.check('and two peers are two files that cannot count each other');
  } else {
    test.fail('bert ' + b.unansweredInbound + ', carol ' + c.unansweredInbound);
  }
}

test.subHeading('Nothing counted is nothing, not an error');

{
  const home = tmpHome();

  // The counters start when counting starts. A contact from before this
  // shipped reads zero, and that is the true answer — backfilling from
  // chat's ring is the dishonest number packet 7 exists to refuse.
  const none = peerStats.readSummary(home, BERT, NOON);
  if (none.unansweredInbound === 0 && none.inboundPerDay === 0 && none.outboundPerDay === 0 &&
      !fs.existsSync(peerStats.statsPath(home, BERT))) {
    test.check('a peer never counted summarises as zeros, and no file is made to say so');
  } else {
    test.fail('absent: ' + JSON.stringify(none) + ' file: ' + fs.existsSync(peerStats.statsPath(home, BERT)));
  }

  // A file somebody edited by hand, or half-written by a crash. It must
  // read as "nothing counted" rather than throw, because the caller is
  // the inbox path and an exception there would stop mail arriving.
  fs.mkdirSync(path.join(home, 'app', 'contacts'), { recursive: true });
  fs.writeFileSync(peerStats.statsPath(home, BERT), '{ not json');
  const salvaged = peerStats.readSummary(home, BERT, NOON);
  if (salvaged.unansweredInbound === 0 && salvaged.inboundPerDay === 0) {
    test.check('and a corrupt sidecar reads as nothing counted rather than throwing at the inbox');
  } else {
    test.fail('corrupt: ' + JSON.stringify(salvaged));
  }

  // And it recovers: the next line counted rewrites the file whole.
  peerStats.noteIn(home, BERT, 'm1', NOON);
  if (peerStats.readSummary(home, BERT, NOON).unansweredInbound === 1) {
    test.check('and the next line counted replaces it rather than appending to rubbish');
  } else {
    test.fail('after corrupt: ' + JSON.stringify(peerStats.readSummary(home, BERT, NOON)));
  }

  // No key, nothing to name a file after.
  if (peerStats.noteIn(home, '', 'm1', NOON) === null &&
      peerStats.noteOut(home, '', NOON) === null) {
    test.check('and a message with no key writes nothing at all');
  } else {
    test.fail('keyless wrote something');
  }
}

test.reportSuccessFailureCount();
