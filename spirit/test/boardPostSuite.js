'use strict';

// spirit/test/boardPostSuite.js
// THE BOARD REACHES ANDY'S DESK WHEN IT CHANGED, AND NEVER IN PART.

const test = require('./testSupport.js');
const boardPost = require('./boardPost.js');
const agents = require('../run/process/js/agents/agents.js');
const limits = require('../run/js/limits.js');

test.startTest('The lead posts the board when it changed, and refuses one too big to send');

function boardOf(rows) { return JSON.stringify({ rows: rows }, null, 2); }
function envelopeOf(json) { return JSON.stringify(agents.makeEnvelope('lead', 'board', json)); }

const small = boardOf([{ kind: 'to-do', id: 'x/a', title: 'a' }]);

// ── A CHANGED BOARD IS POSTED, AN UNCHANGED ONE IS NOT ───────────────
{
  const first = boardPost.decide(small, '', envelopeOf(small));
  const again = boardPost.decide(small, first.hash, envelopeOf(small));
  if (first.post && first.why === 'changed' && !again.post && again.why === 'unchanged') {
    test.check('a board is posted the first time and not again while nothing in it changed');
  } else {
    test.fail('first ' + JSON.stringify(first) + ', again ' + JSON.stringify(again));
  }
}

// ── TOO BIG IS REFUSED, NOT TRUNCATED ────────────────────────────────
{
  const rows = [];
  for (let i = 0; i < 400; i += 1) rows.push({ kind: 'to-do', id: 'x/r' + i, title: 'a to-do with a title ' + i });
  const big = boardOf(rows);
  const d = boardPost.decide(big, '', envelopeOf(big));
  if (!d.post && d.why === 'too-big' && d.bytes > d.max) {
    test.check('a board too big to seal is refused, with its size and the limit, rather than cut '
      + 'short — a Desk showing part of a list looks exactly like one showing all of it ('
      + d.bytes + ' > ' + d.max + ')');
  } else {
    test.fail('a ' + big.length + '-character board was ' + JSON.stringify(d));
  }
}

// ── THE CONTROL: THE LIMIT IS THE SEALED ONE, MEASURED ON THE ENVELOPE ─
//
// A board whose own JSON fits can still fail once it is escaped again
// inside the envelope. So a board that fits as plain text but not as the
// envelope that travels must be refused — without this, a check on the
// board alone would pass here and fail on the wire.
{
  let n = 0;
  let json = small;
  // Grow until the ENVELOPE stops fitting, while the board alone still fits.
  while (limits.fitsSealed(json) && limits.fitsSealed(envelopeOf(json))) {
    n += 20;
    const rows = [];
    for (let i = 0; i < n; i += 1) rows.push({ kind: 'to-do', id: 'x/r' + i, title: 't"' + i });
    json = boardOf(rows);
  }
  const d = boardPost.decide(json, '', envelopeOf(json));
  if (limits.fitsSealed(json) && !d.post && d.why === 'too-big') {
    test.check('a board that would fit on its own but not once wrapped in its envelope is '
      + 'refused — the size that counts is the one that travels');
  } else if (!limits.fitsSealed(json)) {
    test.fail('could not build a board that fits alone but not wrapped; the control proves nothing');
  } else {
    test.fail('the wrapped board was ' + JSON.stringify(d));
  }
}

// ── AND THE ENVELOPE REFUSES ANYTHING THAT IS NOT A BOARD ────────────
{
  let refused = false;
  try { agents.makeEnvelope('lead', 'board', 'not json at all'); } catch (e) { refused = true; }
  let accepted = false;
  try { agents.makeEnvelope('lead', 'board', small); accepted = true; } catch (e) { accepted = false; }
  if (refused && accepted) {
    test.check('a board envelope is refused at the sender unless its text is the scoreboard JSON, '
      + 'and accepted when it is');
  } else {
    test.fail('refused non-board: ' + refused + ', accepted board: ' + accepted);
  }
}

test.reportSuccessFailureCount();
