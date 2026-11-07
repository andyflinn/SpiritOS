// ---------------------------------------------------------------------------
//  spirit/test/edges.js — ANDY'S RULINGS ON DEPENDENCIES BETWEEN TO-DOS.
//
//    Andy, 2026-09-27: "you may add dependencies, the regocgnition/acceptance
//    of which (by andy) might cause different rankings the next time around"
//    — and "in fact proposed dependencies are issues themselves", then
//    correcting his own word: they are to-dos.
//
//  An agent DECLARES a dependency with `after` on test.awaiting. That is a
//  proposal; boardRank.js ranks the owed list with only the `accepted` rows
//  of a list in this shape. No code requires this file today: runAll.js
//  skips it by name and no board is rendered from it.
//
//  ── THE RULES, SO IT CANNOT ROT ─────────────────────────────────────────
//
//  1. A ROW IS HIS ANSWER, never an agent's guess at it. `said` quotes him,
//     corrected for spelling only.
//  2. `rejected` IS KEPT, not deleted. It is what stops the same dependency
//     being proposed again.
//  3. One row per dependency: `from` waits on `to`, both full ids as
//     test.awaiting takes them.
//
// ---------------------------------------------------------------------------

'use strict';

module.exports = [
  // Asked, in the form he set that sitting ("these tow functions are needed
  // by the following to-do's: ... do you accept the implied change in
  // priorities?"): the stored owner key is needed by the loopback shim, and
  // through it by peerOwnerPost(). His answer covered both.
  { from: 'puppets/G7', to: 'puppets/G6', state: 'accepted', said: 'accepted.', at: '2026-09-27' },
  { from: 'puppets/G4', to: 'puppets/G7', state: 'accepted', said: 'accepted.', at: '2026-09-27' },
  // Asked under transport/R16: every deferred decision becomes a row waiting
  // on what meets its condition, "the database move is the first
  // ('transport/R16' frees it)". His answer covered the rule and this edge.
  { from: 'transport/R19', to: 'transport/R16', state: 'accepted', said: 'go.', at: '2026-09-27' },
  // The proposal dependency/17a6f422963f, from G10's declared `after`
  // (puppetsPending.js): the face door and the puppet group need the reply
  // path back to the browser first.
  { from: 'puppets/G10', to: 'public-app-server/G17', state: 'accepted', said: 'accepted.', at: '2026-09-27' },
];
