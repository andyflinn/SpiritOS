'use strict';

// spirit/test/puppetsPending.js
// WHAT THE PUPPET DESIGN OWES, COUNTED.
//
// Beside `design/principles/PUPPETS.md` and the enforcement point in
// `design/principles/THE-REQUESTER-IS-RESPONSIBLE.md`, because a design
// sitting that ends without one leaves nothing counting it.
//
//   Andy, 2026-09-23: "a design is accompanied by a test suite, and i
//   want to observe progress agains that."
//   And 2026-09-25, on this one: "test suite needs updating then, before
//   go."
//
// ── WHAT GOES ON THIS BOARD, AND WHAT MUST NOT ───────────────────────
//
// The rule is wsl-claude's, 2026-09-25, and two of its three branches
// are the ones an agent gets wrong:
//
//   DECIDED and the missing unit is NAMEABLE  -> awaiting, here
//   DECIDED and not nameable                  -> the document, as a cost
//   NOT DECIDED                               -> NEITHER. Nothing at all.
//
// The third is the one that matters. A board entry for something Andy
// has not ruled DECLARES A THING HE HAS NOT DECIDED, which is worse than
// an untested guard: it makes his open question look agreed, and the
// next session reads the board rather than the document.
//
// So these are deliberately ABSENT from the board and live in
// `PUPPETS.md` under OPEN:
//
//   the node-command crossing — unruled. `nodeCard.js:13` records that a
//     node answers nothing and that crossing it changes what a node is.
//     He has not ruled, and a row here would say he had.
//   the maintenance packet reaching every puppet — wsl-claude's, and
//     his to assert when that interface exists.
//   whether fixList and appShellApp move into their own processes.
//   how a puppet's owner key is planted, and whether it may change.
//   the local puppet's port — "that's for later", and later is the whole
//     of the schedule.
//
// And one DECIDED thing is absent for the other reason — it is decided
// and NOT NAMEABLE:
//
//   RESERVE BEFORE ADMITTING THE FIRST MEMBER. Being early is the only
//   protection, so a member admitted first can hold `join` legitimately,
//   by the rules, with no bug anywhere. No code can assert an ordering
//   IN THE WORLD, and a row here would be a permanent red nobody can
//   clear. It is a deployment note and it lives in the document.
//
// ── WHY `G<n>`, AND THE TWO GATES THAT DECIDED IT ────────────────────
//
// TWO DRAFTS WERE WRONG BEFORE THIS ONE, AND EACH WAS CAUGHT BY A
// DIFFERENT GATE ON ITS FIRST RUN. Worth recording, because both
// mistakes look like naming and neither is.
//
//   `R1`-`R7`: `R<n>` is the CYCLE requirement namespace, and
//   `cycleCitations.js:176` counts a bare one as unresolvable —
//   R19 names a different requirement in different cycles. Prefixing
//   with `puppets/` does not help and should not: `\b` treats `/` as a
//   boundary, so the id is still bare.
//
//   `P1`-`P7`: `runAll.js:357` joins a declaration to its heading by
//   `<document>/<id>` and reads `^### ([RCG]\d+)`, so a `P` matches no
//   heading anywhere. The board said so out loud — "NOT DECLARED IN A
//   DOCUMENT — a suite waits on a requirement no document names" — which
//   is the drift shown rather than hidden, aimed at me.
//
// So `G`, and it is not a workaround: these are GUARANTEES OF A DESIGN
// rather than promises of a cycle, which is the same reason
// `PUBLIC-APP-SERVER.md` uses `G`. Declared as `### G1`..`### G8`
// headings in `design/principles/PUPPETS.md` — a requirement no document
// names is drift whoever wrote it.
//
// ── WHY `available` IS DERIVED HERE AND NOT PASSED `false` ───────────
//
// `testSupport.awaiting` goes RED when the unit turns out to exist —
// "it was declared as awaiting; write the assertion it was standing in
// for". THAT RED IS THE HANDOVER, and it only fires if somebody asks
// the tree rather than asserting a constant. A hardcoded `false` is a
// remembered fact in a file whose whole purpose is to notice a change.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
function read(rel) {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
  catch (e) { return ''; }
}
function has(rel) { return fs.existsSync(path.join(REPO, rel)); }

// Asked of the module rather than of the file, where a module will
// answer: an export that exists is the unit, and a comment mentioning it
// is not.
function exports_(rel) {
  try { return Object.keys(require(path.join(REPO, rel))); }
  catch (e) { return []; }
}

test.startTest('What the puppet design owes — counted, so the count can fall');

// ── THE RETURN BOUND ─────────────────────────────────────────────────
//
// `THE-REQUESTER-IS-RESPONSIBLE.md`, "The enforcement point". Andy:
// *"good, so all searches are subject to the same return limit."*
test.subHeading('one return bound, both paths');
{
  // NOTHING IN limits.js BOUNDS A RESPONSE — every bound there is on a
  // request or a packet. That absence is the requirement, so the unit is
  // a named export and the check is for one.
  const limits = exports_('spirit/run/js/limits.js');
  const bound = limits.filter(function (k) { return /RETURN|RESPONSE|ANSWER/.test(k); });
  test.awaiting('puppets/G1', 'a response bound in limits.js', bound.length > 0,
    'one number that bounds what a verb hands back, so a call cannot succeed on loopback and fail as a packet. ' +
    'BODY_MAX (23552) bounds what the door accepts and PLAINTEXT_MAX (16384) bounds what a composer may build; ' +
    'nothing bounds the answer',
    { there: 0, cost: 'one line, plus deciding the number' });

  // The mechanism is bounded-and-truthful, NOT a refusal — the document's
  // own :127 against its :146. The nameable unit is the shared helper
  // every collection verb answers through, because a per-verb
  // implementation is the duplication the probe exists to catch.
  const hub = exports_('spirit/run/js/hub.js');
  const shared = hub.filter(function (k) { return /bounded|truncat|partial/i.test(k); });
  test.awaiting('puppets/G2', 'the shared bound-and-flag helper', shared.length > 0,
    'one helper that fills an answer to the bound and sets `more`, used by every verb that returns a collection. ' +
    '`peer.search` already returns { rows, more } (hub.js:2091) — the right shape with the wrong unit, ' +
    'bounding rows scanned rather than bytes',
    { there: 40, cost: 'a sitting — the shape exists, the unit and the sharing do not' });

  // ANDY'S OWN INSTRUMENT, ruled for a different job and doing two.
  // Named separately because it is what turns "every verb" from a
  // sentence into a number: the suite walks the verb table, so a sixth
  // collection verb announces itself.
  test.awaiting('puppets/G3', 'one suite that makes every api call', has('spirit/test/everyVerb.js'),
    'Andy: "then you need only one suite that makes every api call." It answers two questions at once — ' +
    'whether every answer is under the bound, and whether the owner-proxy shim is complete. ' +
    'Walking the verb table is what stops either becoming a hand-counted list',
    { there: 0, cost: 'a sitting' });
}

// ── peerOwnerPost ────────────────────────────────────────────────────
//
// `PUPPETS.md` §12. Andy: *"so node only a peerProxy() function that
// proxies the entire node api"* — and, naming it: *"the interface might
// better be call peerOwnerPost()"*, *"it's more true."*
test.subHeading('peerOwnerPost — the owner configures a puppet over the wire');
{
  const server = read('spirit/run/js/server.js');
  test.awaiting('puppets/G4', 'peerOwnerPost on the node', /peerOwnerPost/.test(server),
    'one function that wraps a node-api call as a signed packet to a puppet. Addressed as a WIRE namespace: ' +
    'verbTable.js:74 makes wire the client\'s failure contract and a namespace is uniformly one or the other, ' +
    'so a remote caller must name the proxy rather than the local verb',
    { there: 0, cost: 'a sitting' });

  // The receiving half, and the reason it is its own requirement: the
  // switch is where a remote packet becomes local authority, so it is
  // the whole security boundary of this feature.
  const nodeApps = read('spirit/run/js/nodeApps.js');
  test.awaiting('puppets/G5', 'the owner switch in a puppet', /ownerKey|fromOwner/.test(nodeApps),
    'checks a packet against the puppet\'s STORED OWNER KEY and, on a match, unwraps it and processes it as if ' +
    'it were loopback. Andy: "there has to be a switch in an app-node, that checks a request, if it came from ' +
    'it\'s owner". ON the arrival path, not beside it, so it inherits peerPost.js:1091\'s replay guard — these are ' +
    'configuration verbs and a replayed one re-executes',
    { there: 0, cost: 'a sitting' });

  // Named apart from puppets/G5 because it is the thing puppets/G5 checks AGAINST, and
  // because it has its own refusal: a puppet that can write its own
  // owner key owns itself, which is strictly worse than the allow.json
  // hole already closed.
  test.awaiting('puppets/G6', 'a puppet\'s stored owner key, owner-only', /OWNER_KEY|owner\.json/.test(nodeApps),
    'Andy: "the app must know who owns it, it stores the key of it\'s owner". Read-only to the puppet through the ' +
    'same mechanism allow.json uses, or a puppet rewrites its owner and takes itself over',
    { there: 20, cost: 'small — the readOnly mechanism exists, the key and its planting do not' });

  // The shim, separately, because it is the part most likely to rot:
  // handlers take real (req, res) and peekVerb reads the verb off the
  // body without consuming it.
  test.awaiting('puppets/G7', 'the loopback shim', /synthetic|shimReq|asLoopback/.test(nodeApps),
    'a readable carrying the unwrapped body and a writable capturing the answer, so server.js:921\'s dispatch runs ' +
    'unchanged. A handler reaching for req.headers or req.socket fails ALONE and QUIETLY, which is why puppets/G3 covers ' +
    'this and not a per-verb test',
    { there: 0, cost: 'a sitting' });
}

test.reportSuccessFailureCount();
