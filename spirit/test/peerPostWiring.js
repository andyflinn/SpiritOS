'use strict';

// spirit/test/peerPostWiring.js
// ONE peerPost, THREE INSTANTIATIONS, AND EVERY OMISSION DECIDED.
//
//   Andy, 2026-09-24: "so we again have multiple implementations of
//   peerPost()?" — and, when told the answer was one implementation with
//   three call sites and two defects in the newest: "needs to be
//   rectified and harnessed."
//
// ── WHY A GATE AND NOT A COMMENT ─────────────────────────────────────
//
// Because this tree has already lost packets to it, silently, for
// months. Until 2026-09-13 `server.js` built its router WITHOUT
// `onArrival`, and `arrivals.js` records what that cost: a packet posted
// by a peer was *"admitted at the front door, written to the traffic
// log, answered with a bare receipt, and dropped. Nothing above the node
// boundary could ever see it."*
//
// AND THE SUITE WRITTEN FOR THAT BUG DOES NOT PREVENT IT. `arrivals.js`
// builds its OWN router with `onArrival` and proves the hook works — it
// never asks whether the production call site passes one. So the exact
// defect could return and that suite would stay green, which is the
// vacuous shape this project keeps finding: a green resting on
// scaffolding rather than on the tree.
//
// ── WHAT IS ASSERTED, AND WHAT DELIBERATELY IS NOT ───────────────────
//
// This does not judge whether a wiring is CORRECT — it cannot, and a
// suite that pretended to would be inventing policy. It asserts that
// every production call site's shape is one somebody wrote down. A new
// site, a new key, or a vanished key is a red, and clearing it means
// declaring the change here, where the next reader can see what each
// site is missing and why.
//
// AN ABSENT HOOK THAT NOBODY DECIDED IS A DROPPED PACKET. An absent hook
// that is written down is a decision.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

test.startTest('peerPost is instantiated in declared shapes only');

const RUN_JS = path.join(__dirname, '..', 'run', 'js');

// ── THE DECLARED SHAPES ──────────────────────────────────────────────
//
// Production call sites only. A suite may build whatever router it needs
// — that is a fixture, and fixtures are allowed to be peculiar; these
// are the three a running system actually uses.
const DECLARED = {
  // THE NODE. Everything, because a personal node does everything: it
  // answers verbs, admits strangers, keeps a whoBook and a traffic log,
  // and hands arrivals to whatever is watching above the node boundary.
  //
  // AND THIS LIST WAS WRONG ON ITS FIRST RUN, which is the best argument
  // for the gate. It was gathered with a loose grep that matched ANY
  // `key:` line inside the call, so it picked up `at`, `via` and `rank`
  // — keys of a NESTED object passed to one of the hooks, never options
  // of the factory. The gate went red immediately and named the three.
  // A declaration nobody checks is a declaration that drifts from the
  // thing it describes, and this one drifted before it was committed.
  'server.js': [
    'rootDir', 'request', 'store', 'checkTunnel', 'answer', 'admit',
    'keepCard', 'sealKeyFor', 'noteSeen', 'remember', 'onArrival',
    'traffic', 'stats',
  ],

  // THE RELAY'S PARTNER ROUTER. Deliberately almost nothing: a relay
  // keeps nobody's intentions, so it has no store, and what it sends a
  // partner IS the wrapper, which is why checkTunnel is off — a signed
  // wrapper addressed to the partner itself is never tunnelled again.
  'relayServer.js': ['rootDir', 'request', 'sealsPosts'],

  // THE APP SERVER (cycle 2). Each absence is a decision, argued where
  // the router is built:
  //   store       a durable queue would hold a post for an owner who is
  //               asleep, and "refuse, never queue" is the rule for
  //               exactly that state
  //   answer      it answers no verbs; it posts
  //   onArrival   it receives nothing
  //   admit/remember/traffic  it persists nothing about anybody
  //   keepCard    PRESENT since cycle 3. The app server must hold its
  //               OWNER's card before it can seal anything to them, and a
  //               card request is the one packet that travels unsealed
  //               (Andy: "card is the only possible un-cyphered
  //               peerPost"). Without it every reach was refused at 428
  //               by this server before anything left the box — which
  //               read as "the owner is asleep" and was not.
  //   sealKeyFor  PRESENT since cycle 3, and it is the other half: read
  //               per post rather than captured, so a card that arrives
  //               or a key that rotates mid-run is seen. Empty means the
  //               post is refused rather than sent plain.
  //
  // THESE TWO ARE A NARROWING, NOT A WIDENING, and that is why they are
  // allowed here: the app server now holds exactly ONE contact row, its
  // owner's, and G9's "acts on nothing" is a promise about STRANGERS. It
  // still passes no store, no answer, no onArrival, no admit, no
  // remember and no traffic.
  'appServer.js': ['rootDir', 'keepCard', 'sealKeyFor', 'request', 'checkTunnel'],
};

// Reads the keys a call site passes, from the source. Deliberately
// textual: requiring these modules would start servers, and the question
// is about what is WRITTEN rather than what a particular run produced.
function keysAt(file) {
  const src = fs.readFileSync(path.join(RUN_JS, file), 'utf8');
  const at = src.indexOf('createPeerPost({');
  if (at === -1) return null;
  // To the matching close of the object literal, counting braces so a
  // nested one does not end it early.
  let depth = 0;
  let i = src.indexOf('{', at);
  let end = -1;
  for (; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) return null;
  const body = src.slice(at, end);
  const keys = [];
  body.split('\n').forEach(function (line) {
    const m = /^\s{4}([a-zA-Z][a-zA-Z0-9_]*)\s*:/.exec(line);
    if (m && keys.indexOf(m[1]) === -1) keys.push(m[1]);
  });
  return keys;
}

test.subHeading('Every production instantiation has a declared shape');

{
  // A NEW CALL SITE IS THE THING THIS CATCHES FIRST, because it is how
  // the next divergence arrives: somebody needs a router, builds one,
  // and wires it like the example nearest to hand.
  const found = fs.readdirSync(RUN_JS)
    .filter(function (f) { return /\.js$/.test(f) && f !== 'peerPost.js'; })
    .filter(function (f) {
      return fs.readFileSync(path.join(RUN_JS, f), 'utf8').indexOf('createPeerPost(') !== -1;
    })
    .sort();

  const undeclared = found.filter(function (f) { return !DECLARED[f]; });
  const vanished = Object.keys(DECLARED).filter(function (f) { return found.indexOf(f) === -1; });

  if (!undeclared.length && !vanished.length) {
    test.check(found.length + ' production call sites, all declared: ' + found.join(', '));
  } else {
    test.fail('undeclared: ' + (undeclared.join(', ') || 'none') +
      ' | declared but gone: ' + (vanished.join(', ') || 'none') +
      ' — add it to DECLARED with what it omits and why');
  }
}

test.subHeading('And no shape has drifted from what was written down');

{
  const drifted = [];
  Object.keys(DECLARED).sort().forEach(function (file) {
    const keys = keysAt(file);
    if (!keys) { drifted.push(file + ': no createPeerPost({ found'); return; }
    const want = DECLARED[file];
    const added = keys.filter(function (k) { return want.indexOf(k) === -1; });
    const gone = want.filter(function (k) { return keys.indexOf(k) === -1; });
    if (added.length || gone.length) {
      drifted.push(file + ': +[' + added.join(' ') + '] -[' + gone.join(' ') + ']');
    }
  });

  if (!drifted.length) {
    test.check('all three shapes match their declaration, key for key');
  } else {
    // A KEY THAT VANISHED IS THE arrivals.js DEFECT RETURNING. A key that
    // appeared is somebody wiring a hook nobody else has, which is how
    // two call sites start behaving differently.
    test.fail(drifted.join(' | '));
  }
}

test.subHeading('THE ONE THING THIS DOES NOT CHECK, said so nobody reads more into a green');

{
  // It does not know whether a wiring is RIGHT. `server.js` could pass
  // `onArrival: null` and this would be satisfied. What it removes is
  // the SILENT divergence — a site whose shape nobody compared to the
  // others — and that is the form the historical defect took.
  //
  // The honest addition, and it is not free: an assertion that each
  // declared omission is still the right decision would need a reader
  // for each hook's meaning, which is a suite per hook rather than one
  // walk. Named here rather than pretended at.
  const sites = Object.keys(DECLARED).length;
  if (sites === 3) {
    test.check('shape is compared, MEANING is not — ' + sites + ' sites, and a wiring that is ' +
      'wrong in a way somebody wrote down still passes here');
  } else {
    test.fail('the count of declared sites moved to ' + sites + ' without this note being revisited');
  }
}

test.reportSuccessFailureCount();
