// ---------------------------------------------------------------------------
//  spirit/test/edges.js — ANDY'S RULINGS ON DEPENDENCIES BETWEEN TO-DOS.
//
//    Andy, 2026-09-27: "you may add dependencies, the regocgnition/acceptance
//    of which (by andy) might cause different rankings the next time around"
//    — and "in fact proposed dependencies are issues themselves", then
//    correcting his own word: they are to-dos.
//
//  An agent DECLARES a dependency with `after` on test.awaiting. That is a
//  proposal, and the board shows it to Andy as a to-do of his, with the pair
//  of handles as its handle — "(G17) waits on (transport/R12)" — for him to
//  answer yes or no. Only a row here, `accepted`, makes it shape the order.
//
//  ── THE RULES, SO IT CANNOT ROT ─────────────────────────────────────────
//
//  1. A ROW IS HIS ANSWER, never an agent's guess at it. `said` quotes him,
//     corrected for spelling only.
//  2. `rejected` IS KEPT, not deleted. It is what stops the same dependency
//     being proposed again; the board says so if one is.
//  3. One row per dependency: `from` waits on `to`, both full ids as
//     test.awaiting takes them.
//
//  Empty until he rules on the first one.
// ---------------------------------------------------------------------------

'use strict';

module.exports = [
  // Asked, in the form he set that sitting ("these tow functions are needed
  // by the following to-do's: ... do you accept the implied change in
  // priorities?"): the stored owner key is needed by the loopback shim, and
  // through it by peerOwnerPost(). His answer covered both.
  { from: 'puppets/G7', to: 'puppets/G6', state: 'accepted', said: 'accepted.', at: '2026-09-27' },
  { from: 'puppets/G4', to: 'puppets/G7', state: 'accepted', said: 'accepted.', at: '2026-09-27' },
];
