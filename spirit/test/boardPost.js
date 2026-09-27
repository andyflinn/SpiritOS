'use strict';

// spirit/test/boardPost.js
// WHETHER THE LEAD BOX POSTS THE BOARD TO ANDY'S NODE, AND WHY NOT.
//
// Decided in design/shell/AGENTS-UI.md (73fffcd): the lead posts
// SCOREBOARD.json to Andy's node as an agents packet of kind 'board',
// ONLY WHEN IT CHANGED, and REFUSES LOUDLY when it is too big — a board
// that does not fit is never truncated, because a Desk showing part of a
// list looks exactly like a Desk showing all of it.
//
// NOT A SUITE. Pure: no socket, no file. runAll reads the last posted
// hash, asks this, sends, and writes the hash only after a send that
// landed. boardPostSuite.js holds it to account.
//
// `envelopeText` is what actually travels — the agents envelope around the
// board, stringified — and it is measured with limits.fitsSealed, not by
// counting characters: the JSON is escaped again inside the envelope, and
// escaping cost depends on content (limits.js says why at length).

const crypto = require('crypto');
const limits = require('../run/js/limits.js');

function decide(jsonText, lastHash, envelopeText) {
  const text = String(jsonText || '');
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  if (hash === String(lastHash || '').trim()) {
    return { post: false, why: 'unchanged', hash: hash };
  }
  const env = String(envelopeText === undefined ? text : envelopeText);
  const bytes = Buffer.byteLength(JSON.stringify(env), 'utf8');
  if (!limits.fitsSealed(env)) {
    return { post: false, why: 'too-big', hash: hash, bytes: bytes, max: limits.SEALED_MAX };
  }
  return { post: true, why: 'changed', hash: hash, bytes: bytes, max: limits.SEALED_MAX };
}

module.exports = { decide: decide };
