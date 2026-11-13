# spirit/router.js — its own test

`createRouter(opts)`: the relay's pending-request table, hash to who asked and who was asked. Register before you
forward, enforced by shape. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v71, 9).
Each test makes a router on a planted clock.

- `open`: the route is filed before the delivery runs, answering 202 with the hash and the time granted. Refused with
  no delivery (500), no hash, requester or target (400), an unknown requester class (500, never taken as a member). A
  delivery that fails, by false or by throwing, leaves no route (502). A hash in flight is 409, `inFlight`, nothing
  delivered.
- The caps (decision 0016, goal/G22.6): one in flight per requester (429); the target slot per sender, so a sender's
  second post to one member is busy (503, `busy`, `retryAfterMs` exact) while another sender's goes; a route to the
  relay's own key counts against no target slot (ruling A, 2026-10-10); both over, the requester's cap is said first; a
  full table refuses (503 router full) and drops nothing; a number for `maxPerRequester` sets every class, an object
  each.
- Time granted, not taken: less than the ceiling asked is given, more gets the ceiling; zero is refused
  (`tooLittleTime`), null is the default; a route expires at its own granted time, gone to `has`, `size` and the caps.
- `answer`: by the target, 200 with requester, target and carry, the route gone; anyone else 403, the route kept; no
  route or an expired one 404. `cancel`: the requester's own only. `release`: every route naming one identity, each
  with the side it was on.

## What its test must try to break

Delivering before filing; a failed delivery leaving its hash occupied; a typo of a class taken as member; one sender
making a member busy for everybody; a zero budget renewed at the ceiling; an expired route still counted or answered.
