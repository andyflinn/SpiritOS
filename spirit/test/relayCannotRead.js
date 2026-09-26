'use strict';

// spirit/test/relayCannotRead.js
// THE RELAY CANNOT READ A SEALED POST, PROVED BY TRYING TO READ IT.
//
//   Andy, 2026-09-26: "that is what the DEBUG flag is for, in the relay
//   it will stream the packet it sees, back to the owner node, where the
//   test can examine it." And on its reach: "this will be a popular
//   approach for assertion in the relay."
//
// Design and rulings: design/relay/PROVING-IT-CANNOT-READ.md, APPROVED
// 2026-09-26. Cycle 10's R10 and R16.
//
// ── WHY THIS IS A PROOF AND NOT A RESTATEMENT ───────────────────────
//
// "The relay cannot read it" is the kind of claim a suite can assert
// vacuously in four different ways, so each one is closed here on
// purpose:
//
//   IT COULD PASS WITH THE INSTRUMENT OFF. "No plaintext in the streamed
//   bytes" is true of a relay streaming nothing at all. Closed by D1/D2,
//   which show `held` EMPTY with DEBUG off and full with it on, and by
//   asking the switch what it is rather than assuming — Andy's "returned
//   and set" is what makes the proof establish its own precondition.
//
//   IT COULD PASS ON AN EMPTY MESSAGE. Closed by D5: the recipient opens
//   THE VERY BYTES THE RELAY HELD and gets the plaintext back exactly.
//   That is the paired positive, and it is the whole suite — without it
//   D4 proves only that the relay held something unreadable, which is
//   also true of garbage.
//
//   IT COULD PASS ON A SUMMARY. A relay that streamed a description
//   rather than a copy would contain no plaintext either. Closed by D6:
//   what was streamed is exactly as long as the row says the packet was.
//
//   IT COULD PASS BECAUSE NOBODY COULD TURN IT ON. Closed by D7, which
//   shows a non-owner cannot move the switch — the guard that makes the
//   instrument safe is also the one that would fake this result.
//
// READ-ONLY IS THE RULING THAT MATTERS MOST HERE. Andy: "the relays DEBUG
// mode is absolutely just READ-ONLY, it may only send byte-for-byte
// copies of observed items to the owner." D6 is that ruling as an
// assertion, not as a comment.

const test = require('./testSupport.js');
const mw = require('./monitorWorld.js');
const seal = require('../run/js/seal');

test.startTest('The relay cannot read a sealed post, proved by trying to read it');

const SECRET = 'the plaintext that must never appear in what the relay holds';

function lastRow(w, from) {
  const rows = mw.events(w.heard.andy).slice(from);
  return rows.length ? (rows[rows.length - 1].data || {}) : null;
}

(function () {
  const w = mw.world();
  mw.askMonitor(w, null, true);

  // ── D1: OFF BY DEFAULT, AND IT SAYS SO ─────────────────────────────
  {
    const at = w.heard.andy.length;
    mw.askDebug(w, null, undefined);
    const said = mw.replies(w, null, at)[0];
    if (said && said.ok === true && said.debug === false) {
      test.check('DEBUG is off by default, and the switch ANSWERS that rather than leaving a '
        + 'suite to assume it — "off by default, returned and set by owner-only api"');
    } else {
      test.fail('asking the switch answered ' + JSON.stringify(said));
    }
  }

  // ── D2: THE CONTROL — WITH IT OFF, NOTHING SHOULD BE HELD ─────────
  //
  // RED, AND IT IS A REAL DEFECT rather than an unbuilt feature. The
  // design says plainly what DEBUG is for: "the row says how big the
  // packet was and what it hashed to; DEBUG would decide whether it also
  // carries what the relay actually holds." It does not decide that.
  //
  // THE GATE IS ON THE WRONG EMITTER. relay.js:4649 reads
  // `row.held = debugging && ... : ''` — and it is inside `ownerEvent`,
  // whose callers are claim and revoke notices that carry no payload at
  // all. The rows that DO carry payloads come from `monitorEvent`, and
  // at relay.js:4735 it copies every key of `extra` onto the row with no
  // DEBUG check anywhere in the function.
  //
  // So the switch is honest about itself and wrong about the world: the
  // verb answers `debug:false` while the full sealed bytes of every post
  // stream to the owner regardless. Not a confidentiality breach — the
  // rows go only to the owner (presentNow.send(ownerKey, ...)) and the
  // payload is sealed, which D4 and D5 below prove the owner cannot read
  // either. But Andy's "DEBUG is Off by default" is true of the flag and
  // false of the behaviour, and every future assertion of the shape
  // "with DEBUG off the payload is absent" would be asserting a fiction.
  //
  // NOT FIXED HERE. It is a relay.js gate, and CLAUDE.md says to stop and
  // call a team review rather than patch one.
  {
    const at = mw.events(w.heard.andy).length;
    mw.post(w, w.owner, w.bella, SECRET);
    const row = lastRow(w, at);
    if (row && row.kind === 'post' && row.held === '') {
      test.check('with DEBUG off a real sealed post still streams a row, and its `held` is '
        + 'EMPTY — so "no plaintext in held" below is a finding and not a tautology');
    } else if (row && row.kind === 'post' && typeof row.held === 'string' && row.held.length) {
      test.fail('DEBUG IS OFF AND THE RELAY STREAMED THE WHOLE PAYLOAD ANYWAY — ' + row.held.length
        + ' bytes, with the switch reporting `debug:false`. The gate at relay.js:4649 is inside '
        + '`ownerEvent`, which carries no payloads; the payload rows come from `monitorEvent`, '
        + 'which copies `extra` onto the row at relay.js:4735 and never consults DEBUG. The '
        + 'instrument was declared built and it does not gate what it was built to gate');
    } else {
      test.fail('DEBUG-off row was ' + JSON.stringify(row && { kind: row.kind, held: row.held }));
    }
  }

  // ── D3: SET AND RETURNED, IN ONE VERB ──────────────────────────────
  {
    const at = w.heard.andy.length;
    mw.askDebug(w, null, true);
    const set = mw.replies(w, null, at)[0];
    const at2 = w.heard.andy.length;
    mw.askDebug(w, null, undefined);
    const read = mw.replies(w, null, at2)[0];
    if (set && set.debug === true && read && read.debug === true) {
      test.check('the owner turns DEBUG on and the verb RETURNS the state that resulted, which '
        + 'a second read confirms — the proof below establishes its own precondition instead '
        + 'of trusting that something flipped it');
    } else {
      test.fail('set answered ' + JSON.stringify(set) + ', re-read ' + JSON.stringify(read));
    }
  }

  // ── D4: THE PROOF ITSELF ───────────────────────────────────────────
  const at = mw.events(w.heard.andy).length;
  mw.post(w, w.owner, w.bella, SECRET);
  const row = lastRow(w, at);

  if (row && typeof row.held === 'string' && row.held.length > 0
      && row.held.indexOf(SECRET) === -1) {
    test.check('the relay streams the owner the EXACT BYTES it holds for a sealed post, ' + row.held.length
      + ' of them, and the plaintext is not among them — the relay carried this message and '
      + 'could not read it');
  } else if (!row || !row.held) {
    test.fail('DEBUG is on but nothing was held: ' + JSON.stringify(row && { kind: row.kind, held: row.held }));
  } else {
    test.fail('THE PLAINTEXT IS IN WHAT THE RELAY HOLDS. Per Andy this is the finding, not a '
      + 'breach: "if plain-text data is detected on alive-in-the-wild relay, it still can only '
      + 'be streamed to the owner, thus dispoving that the packets are unreadable"');
  }

  // ── D5: THE PAIRED POSITIVE, AND THE POINT OF THE WHOLE SUITE ──────
  //
  // D4 alone is also true of an empty message, a dropped one, or a
  // scrambled one. This opens THE VERY BYTES THE RELAY HELD, with the
  // recipient's key, and requires the plaintext back exactly.
  {
    const got = row && row.held
      ? seal.open(w.bella.sealPrivateKey, w.owner.publicKey, w.bella.publicKey, row.held)
      : null;
    if (got && got.text === SECRET) {
      test.check('and BELLA OPENS THOSE SAME BYTES and gets the words back exactly — so what '
        + 'the relay held was the real message in full, not an empty one or a broken one, '
        + 'which is the only thing that makes its unreadability worth anything');
    } else {
      test.fail('the recipient could not recover the plaintext from the held bytes, so the '
        + 'absence of plaintext above proves nothing about a message anyone could read: '
        + JSON.stringify(got && got.text));
    }
  }

  // ── D6: BYTE FOR BYTE, WHICH IS THE WHOLE LICENCE ──────────────────
  {
    const len = row && typeof row.held === 'string' ? Buffer.byteLength(row.held, 'utf8') : -1;
    if (row && len === row.bytes) {
      test.check('what was streamed is exactly as long as the row says the packet was, ' + len
        + ' bytes — a copy, not a summary and not a synthesis. Andy: DEBUG "may only send '
        + 'byte-for-byte copies of observed items to the owner"');
    } else {
      test.fail('held is ' + len + ' bytes but the row reports ' + (row && row.bytes)
        + ' — a relay that streams something OTHER than what it holds is not an instrument');
    }
  }

  // ── D7: AND THE SWITCH IS THE OWNER'S ──────────────────────────────
  //
  // The guard that makes the instrument safe is also the one that could
  // fake every result above, so it is asserted rather than assumed.
  {
    const at2 = w.heard.bella.length;
    mw.askDebug(w, w.bella, false);
    const said = mw.replies(w, w.bella, at2)[0];
    const after = w.heard.andy.length;
    mw.askDebug(w, null, undefined);
    const still = mw.replies(w, null, after)[0];
    if ((!said || said.ok !== true || said.debug !== false) && still && still.debug === true) {
      test.check('a member who is not the owner cannot move the switch, and DEBUG is still on '
        + 'afterwards — bella was answered ' + JSON.stringify(said && (said.error || said.code || said))
        + ' rather than obeyed');
    } else {
      test.fail('a non-owner changed DEBUG: bella got ' + JSON.stringify(said)
        + ' and the state is now ' + JSON.stringify(still));
    }
  }

  test.reportSuccessFailureCount();
}());
