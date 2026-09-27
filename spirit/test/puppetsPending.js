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
//   whether fixList and appFaceApp move into their own processes.
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
  // SLICE 1 IS BUILT: searchBucket.js, createSearch(opts).getResult(),
  // at ff22e8c, asserted by sharedSearch.js. What G2 still owes is the rest
  // of Andy's order: "replace the getList interface flat-out , with
  // \"search\" and KILL the replaced verb". So the probe is now that no
  // verb in server.js is called *.list. everyVerb.js's LISTS_TODAY names
  // every verb that still ANSWERS with a list, which is the finer count.
  const listVerbs = [...fs.readFileSync(path.join(REPO, 'spirit/run/js/server.js'), 'utf8')
    .matchAll(/^ {4}'([a-z]+\.list)':/gm)].map(function (m) { return m[1]; });
  test.awaiting('puppets/G2', 'no list verb left: each is search + get', listVerbs.length === 0,
    'still claimed: ' + (listVerbs.join(', ') || 'none') + '. Each becomes search(label) giving key/label ' +
    'pairs through searchBucket.js, plus get(key), and the list verb dies in the same commit as the apps ' +
    'that call it',
    { there: 50, cost: 'a sitting per collection, after Andy\'s yes on the verb list' });

  // puppets/G3, ANDY'S OWN INSTRUMENT ("then you need only one suite that
  // makes every api call"), is no longer owed: spirit/test/everyVerb.js is
  // it, on his "go." of 2026-09-27. Its bound check waits on G1's number,
  // which G1 above still declares.
}

// ── peerOwnerPost ────────────────────────────────────────────────────
//
// `PUPPETS.md` §12. Andy: *"so node only a peerProxy() function that
// proxies the entire node api"* — and, naming it: *"the interface might
// better be call peerOwnerPost()"*, *"it's more true."*
test.subHeading('peerOwnerPost — the owner configures a puppet over the wire');
{
  const server = read('spirit/run/js/server.js');
  // ── puppets/G4 IS BUILT: peerOwnerPost ────────────────────────────
  //
  // Built by claude-windows at 8c8347c (ownerPost.js, verb owner.command);
  // asserted in spirit/test/ownerPost.js end to end against a real
  // puppetDoor. Only reachability here, as for G5, G6 and G7.
  if (/peerOwnerPost/.test(server) && typeof require('../run/js/ownerPost').createOwnerPost === 'function') {
    test.check('the sending end exists as a unit — ownerPost.createOwnerPost, wired as peerOwnerPost, '
      + 'asserted in ownerPost.js: signed, answered only by that puppet, once, within the wait');
  } else {
    test.fail('puppets/G4 regressed: ownerPost.createOwnerPost or its wiring is gone');
  }

  // The receiving half, and the reason it is its own requirement: the
  // switch is where a remote packet becomes local authority, so it is
  // the whole security boundary of this feature.
  const nodeApps = read('spirit/run/js/nodeApps.js');
  // ── puppets/G5 IS BUILT, SO THE DECLARATION BECAME AN ASSERTION ──────
  //
  // This suite told me so in those words — "puppets/G5 EXISTS NOW. It was
  // declared as awaiting; write the assertion it was standing in for" — which
  // is the handover an awaiting declaration exists to force. The behaviour is
  // asserted in spirit/test/ownerCommand.js, ten checks; what is asserted HERE
  // is only that the unit exists and is reachable, so this file keeps saying
  // what is owed and does not become a second copy of that suite.
  if (typeof require('../run/js/nodeApps').ownerCommandIn === 'function') {
    test.check('the owner switch exists as a unit — nodeApps.ownerCommandIn, asserted in '
      + 'ownerCommand.js: the mode gate, no signature, a lifted transport signature, '
      + 'a sibling-signed command, a replay at a sibling, a signature moved to another '
      + 'envelope, a stale minute, plain chat and an app packet');
  } else {
    test.fail('puppets/G5 regressed: nodeApps no longer exports ownerCommandIn');
  }

  // ── puppets/G6 IS BUILT, SO THE DECLARATION BECAME AN ASSERTION ──────
  //
  // Andy's title: "Lock puppet out of Self-Ownership". Built by
  // claude-windows at edbadff; this suite then said "puppets/G6 EXISTS NOW
  // ... write the assertion it was standing in for", and it was written:
  // spirit/test/puppetOwner.js, eight checks, mutation-tested against the
  // read-only list. As with G5, only reachability is asserted here, so this
  // file keeps saying what is owed and does not become a second copy.
  // Moved to the NODE at 3feddc5 -- relay-state/puppet.json, { owner, carries }
  // -- after Andy ruled "a node OWNED by another node's ID is a puppet".
  if (typeof require('../run/js/nodeApps').puppetIn === 'function' && /puppet\.json/.test(nodeApps)) {
    test.check('the owner lock exists as a unit — nodeApps.puppetIn and the node\'s puppet.json, asserted '
      + 'in puppetOwner.js: read through api.owner(), unreachable from the puppet by any path, no '
      + 'self-planting, an owner edit seen at once, anything not a key means nobody');
  } else {
    test.fail('puppets/G6 regressed: nodeApps no longer has puppetIn and puppet.json');
  }

  // ── puppets/G7 IS BUILT: THE OWNER DOOR ──────────────────────────────
  //
  // Split from its second half at 3b30b1a. Andy, asking why it still led
  // his list: "with verification is should dissappear", and "but once it
  // freed all it can free, it's no longer relevant to me". Asserted in
  // spirit/test/puppetDoor.js, 9 checks, mutation-tested.
  //
  // WHY IT NEVER WENT RED ON ITS OWN, unlike G5 and G6: its probe was
  // /synthetic|shimReq|asLoopback/ -- names GUESSED for an implementation
  // not yet written, and the one built used none of them. So the
  // declaration could not see a built, tested door. A probe must name what
  // was AGREED, which is why G10 below names nodeApps.faceDoor.
  if (typeof require('../run/js/nodeApps').puppetDoor === 'function') {
    test.check('the owner door exists as a unit — nodeApps.puppetDoor, asserted in puppetDoor.js: the '
      + 'owner\'s signed command to a carried group runs and is answered, an uncarried group is refused by '
      + 'name, strangers get silence, a failing handler fails alone, now or later');
  } else {
    test.fail('puppets/G7 regressed: nodeApps no longer exports puppetDoor');
  }

  // ── puppets/G10: THE FACE DOOR AND THE PUPPET GROUP ─────────────────
  //
  // The half of G7's approved shape that cannot start yet: visitors through
  // the face reach only the 'puppet' group, and the rest of the tree is not
  // there for them. It needs an app's declared commands (public-app-server
  // G14) and join's route (public-app-server G17). The probe is the name
  // AGREED with claude-windows for slice 2, nodeApps.faceDoor, so it goes
  // red the moment the unit exists and asks for its assertions.
  test.awaiting('puppets/G10', 'the face door and the puppet group',
    typeof require('../run/js/nodeApps').faceDoor === 'function',
    'visitors through the face reach only the puppet group; a face request naming a node verb answers '
    + 'exactly as an unknown verb; both ends of the face door are app-blind',
    { there: 0, cost: 'a sitting, after its two prerequisites',
      after: ['public-app-server/G14', 'public-app-server/G17'] });
}

// ── THE SIBLING-PUPPET DIRECTION, WHICH ANDY'S MODE GATE DOES NOT REACH
//
//   Andy, 2026-09-26, closing most of the hole wsl-claude found: "only in
//   puppet mode can messages be passed as fake loopback, because they come
//   from the owner, the reverse is not true, the owner is never in
//   puppet-mode, to that gate closes automatically." Then, of what is left:
//   "that needs testing".
//
// HIS GATE IS STRONGER THAN A CHECK. An owner command is only ever accepted
// BY a puppet, so a forged packet arriving at the owner is not a command that
// fails a test — it is not a command at all, because that node takes none.
// Puppet -> owner is closed by construction.
//
// PUPPET -> SIBLING PUPPET IS NOT. Both ends of that are legitimate: the
// sibling IS in puppet mode, and the node key IS its owner key, so a packet
// from puppet A is indistinguishable from one from the owner. Tolerable while
// every puppet is Andy's own code; not once a puppet is third-party, which is
// his own example — a jpeg tagger taking work from other nodes.
test.subHeading('A puppet can compose any envelope, which is what makes the sibling case real');

{
  // MEASURED, NOT ARGUED. The risk rests on one fact about the surface a
  // puppet is handed, and that fact is checkable today even though the switch
  // it threatens is not built. If this ever stops being true, the sibling
  // requirement below stops mattering and should be closed rather than
  // carried.
  // Two facts rather than one regex across lines: the puppet's post takes the
  // packet text, and that text reaches the router unexamined.
  // NO REGEX. Two literal substrings from the surface itself, so the check
  // cannot fail on an escape and be read as the hole having closed.
  const surface = read('spirit/run/js/server.js');
  const takesText = surface.indexOf('post: function (relayUrl, toKey, text, hints, how)') !== -1;
  const passesThrough = surface.indexOf('return peerRouter.post(relayUrl, toKey, text, hints, how)') !== -1;
  const rawText = takesText && passesThrough;
  if (rawText) {
    test.check('server.js hands a mounted puppet a post() whose text is RAW and passes it '
      + 'straight to peerRouter.post — so a puppet composes its own envelope and it '
      + 'travels signed by THIS node key. That is the whole basis of the sibling case, '
      + 'and it is a fact rather than a worry');
  } else {
    test.fail('the raw-text post surface at server.js:1335 has changed shape — re-read it '
      + 'and decide whether the sibling requirement below still has a basis');
  }
}

// THE REQUIREMENT ITSELF IS AWAITING AND NOT RED, deliberately. There is no
// switch yet — puppets/G5 is the switch and it is unbuilt — so nothing exists
// to accept or refuse, and a red assertion here would be asserting against
// absent code and reporting the absence twice. What is owed is a property the
// switch must have, and it cannot be met by checking the sender: the sender is
// correct in the attack.
// ── ANDY HAS GIVEN THE RULE, AND THE SECOND HALF IS THE LOAD-BEARING HALF
//
//   Andy, 2026-09-26: "a puppet always routes requests through its owner, the
//   owner is the only person talking to the puppet (not sure about this) ie,
//   the puppet is uable to sign any request with the owners signature. and
//   that signature must exist before the puppet routes the request to
//   loopback." Then, asked which part decides it: "the second half counts".
//
// SO IT IS THE TIMING, NOT THE CLAIM. "A puppet cannot sign as its owner" is
// already true of the identity key and already useless on its own, because a
// puppet posting through its node gets the NODE's transport signature applied
// on the way out — and to a sibling puppet that node key IS the owner key.
// The forger never signs anything; the router signs for it.
//
// What closes it is that the signature verified BEFORE LOOPBACK must be over
// the COMMAND, not the transport. peerOwnerPost adds none today: hub.js:2169
// encodes the packet and hands it to sendPacket, and the only signature on it
// is the router's. So the owner must sign the command at composition, with the
// identity key no puppet holds, and the switch must verify that before it
// dispatches — which is also the only moment at which refusing costs nothing.
// BUILT THE SAME SITTING IT WAS FOUND, so this is an assertion and not a
// declaration. The behaviour is in ownerCommand.js; what is asserted here is
// that the signed format exists and is distinct from the transport one, which
// is the property the whole requirement rests on.
{
  const a = require('../run/js/relayAuth');
  const owner = a.generateIdentity('o');
  const target = a.generateIdentity('t');
  const cmd = 'x';
  const inner = a.sign(owner.privateKey, a.commandMessage(owner.publicKey, target.publicKey, 'i1', cmd));
  const transport = a.sign(owner.privateKey, a.postMessage(owner.publicKey, target.publicKey, cmd));
  const innerOk = a.commandSignatureOk(owner.publicKey, owner.publicKey, target.publicKey, 'i1', cmd, inner);
  const liftedOk = a.commandSignatureOk(owner.publicKey, owner.publicKey, target.publicKey, 'i1', cmd, transport);
  if (innerOk && !liftedOk) {
    test.check('a command signature verifies and a TRANSPORT signature does not — the two '
      + 'formats are separated by their tag, so a router-made signature cannot be presented '
      + 'as an owner command by a puppet that has one for free');
  } else {
    test.fail('the two signed formats are not separated: inner ' + innerOk + ', lifted ' + liftedOk);
  }
}

test.reportSuccessFailureCount();
