# spirit/joinStepsJob.js — its own test

Where the join steps stand, as a stream (goal/G30.1; Andy: *"keeps the screen untouched until a streamed event
actually affects it"*). The node publishes its join facts as news of its own job `spirit`, kind `join`
(goal/G43.20), only when they change. Owed since the rule *"every production script has its own test"* (goal/G47.1,
box v72). Run in process on a scratch root; the jobs table is planted and records each `ownNews`.

- `facts`: on a bare node, `{ seated: false, relayUrl: '', contact: false, face: '', faceUrl: '' }` and no email field
  (goal/G40.11). A listed relay is the `relayUrl`; a seat there makes `seated`; a face kept there gives `face` and
  `https://<face>.<relay host>`; `contact` is true only for a kept key that is neither this node nor a relay it knows.
  Never a throw, on a root with no records.
- `create`: publishes the facts at once as `{ join }` on `spirit`, kind `join`; its `facts()` reads the records now.
- `refresh`: publishes nothing and answers false when nothing changed; once, answering true, when something did.

## What its test must try to break

A refresh that publishes on every call (the screen touched with no change); the node's own key or a relay's counted
as a contact; a face url that drops the face name; anything but `{ join }` in the news.
