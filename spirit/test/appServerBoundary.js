'use strict';

// spirit/test/appServerBoundary.js
// THE PUBLIC APP SERVER — THE BOUNDARY, DECLARED FROM THE DESIGN.
//
//   Andy, 2026-09-24, on the purpose of the design: "delieating all the
//   mandatory and optional boundaries and layering, so our join-app
//   doesn't have to be retro-fitted forever as the system evolves."
//
// Written by wsl-claude from design/shell/PUBLIC-APP-SERVER.md at
// 1b64374 — the CURRENT list G1-G13, not the superseded S-items further
// down that file. Every claim here comes from the document; where the
// document leaves something open, nothing is declared, because a board
// that guesses at an API has to be rewritten when the design settles.
//
// NOTHING IS BUILT YET, so these are declarations: a test written before
// the code cannot assert behaviour, it asserts presence, and the unit it
// names is what would make it real (ANDYS_RULES_FOR_AGENTS.md, the SOP).
//
// THE ESTIMATES NAME WHAT THEY COUNT. A guess nobody can check is the one
// number on the board that cannot be audited — which is this agent's own
// amendment to the SOP and applies to it first.
//
// WHAT IS DELIBERATELY NOT DECLARED, because the document argues it and
// Andy has not ruled: the fingerprint's ingredients (contents, and they
// want measuring on both platforms first), the MemoryMax two-writers
// hole, and how the units on a box are counted. Those are reasons in a
// document, not units on a board.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const RUN = path.join(REPO, 'spirit', 'run');

function has(rel) { return fs.existsSync(path.join(REPO, rel)); }
function read(rel) {
  try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); }
  catch (e) { return ''; }
}

const appServer = has('spirit/run/js/appServer.js');
const starter = has('spirit/run/app/starter');

test.startTest('The app server boundary — the layer join must not retrofit');

// ── THE THREE MEASUREMENTS THE DOCUMENT RESTS ON ─────────────────────
//
// The design measured the tree at 5cd0b12 and built its case on three
// facts. They are asserted rather than declared, because they are TRUE
// NOW and the design is wrong if any of them stops being true while the
// cycle runs — a boundary argued from a tree that has moved is a
// boundary argued from nothing.
test.subHeading('the measurements the design rests on are still true');
{
  const relayServer = read('spirit/run/js/relayServer.js');
  const deviceServed = /device\.html/.test(relayServer);
  if (deviceServed) {
    test.check('device.html is still served by the relay — the second instance of the pattern, which is what makes the layer general rather than fitted to one app');
  } else {
    test.fail('device.html is no longer served by the relay; the design cites it as the existing second instance');
  }

  const cssFiles = [];
  (function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    entries.forEach(function (e) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'relay-state') return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.css')) cssFiles.push(path.relative(REPO, p));
    });
  }(RUN));
  if (!cssFiles.length) {
    test.check('there are still zero .css files under spirit/run — the look is shared as tokens because there is no stylesheet to share');
  } else {
    test.fail('a stylesheet appeared: ' + cssFiles.join(', ') + ' — G4 assumed none exists');
  }
}

// ── G1, G2, G3 — the module and its door ─────────────────────────────
test.subHeading('G1, G2, G3 — a third startup module, one app, one ask');
test.awaiting('public-app-server/G1', 'spirit/run/js/appServer.js dispatched before node code is required', appServer,
  'the mode loads neither the shell nor the relay, and is named for what the process IS rather than for publicness',
  { there: 10, cost: 'the dispatch shape exists and is copied from the --relay branch in server.js; the module itself is new' });
test.awaiting('public-app-server/G2', 'the app server whitelist and its 404', appServer,
  'a path outside the whitelist 404s, there is no directory listing, the door is loopback and the page carries noindex',
  { there: 20, cost: 'noindex, loopback and key-addressing all exist in device.html to copy from; the whitelist and its refusal are new, ' +
    'and the document leaves OPEN how offering shell files widens it — these files are offered, never this folder is servable' });
test.awaiting('public-app-server/G3', 'the one shared ask', false,
  'the app server page calls the shared ask and contains no raw fetch to /api/',
  { there: 0, cost: 'fourteen lines, and three divergent copies exist that this cycle does NOT migrate — the requirement is that no fourth is written' });

// ── G4 — the optional layer ───────────────────────────────────────────
test.subHeading('G4 — the optional layer is provided by a folder, not by a process');
test.awaiting('public-app-server/G4', 'the shell folder offering elements and tokens as files', false,
  'elements and style adoption are separately optional, and an element that decides anything cannot be offered — it paints, never decides',
  { there: 0, cost: 'the rule already exists in the shell (the deciding lives in an isomorphic module, the painting here); what is missing is ' +
    'the offering itself and the separation of the two options' });

// ── G5 — the name, which is the part in scope ────────────────────────
test.subHeading('G5 — the mode name is decided here, its rendering is not');
{
  const template = read('bash/systemd/spirit-relay.service');
  if (/--relay/.test(template) && !/__MODE__/.test(template)) {
    test.check('the unit template still hardcodes --relay — the blocker the document names, and the rendering is deliberately out of scope');
  } else if (/__MODE__/.test(template)) {
    test.fail('__MODE__ is in the template: the RENDERING was implemented, which this design put out of scope');
  } else {
    test.fail('the unit template no longer matches what the document measured');
  }
}

// ── G6, G7 — binding and role ────────────────────────────────────────
test.subHeading('G6, G7 — one relay, learned not configured, and a role that fails closed');
test.awaiting('public-app-server/G6', 'the bind: learn the owner, wait while unclaimed, refuse if not a member', appServer,
  'with an unclaimed relay it starts, serves a waiting page and acts on nothing; with a relay it is not a member of it refuses to start and says why',
  { there: 30, cost: 'the relay answers ownerKey and publishes a signed key statement since the flag day, so the learning half has its source; ' +
    'missing is the waiting state, the refusal, and the rule that the first bind is final' });
test.awaiting('public-app-server/G7', 'nodeIsOwnerNode and nodeIsPublicApp, derived on demand', false,
  'revoking ownership changes the answer without a restart, no persisted file holds either value, and UNKNOWN means NOT the owner node',
  { there: 0, cost: 'the shell holds no role concept at all — these would be the first of their kind; the danger is the reason for care, ' +
    'because the tempting implementation is a one-minute cache that reintroduces exactly the failure the rule prevents' });

// ── G8 — the split that the whole cycle exists for ───────────────────
test.subHeading('G8 — layer 1 splits by promise, and the stable half is named');
test.awaiting('public-app-server/G8', 'the named stable half of layer 1', false,
  'the app contract is in a named half that needs a deprecation path, and box concerns are in one that does not — if removing it would break an app that never changed, it is in the stable half',
  { there: 0, cost: 'a naming and a written test, no code: the value is that a later session can place a new thing without re-deriving the philosophy' });

// ── G9 — posture, and its honest limit ───────────────────────────────
test.subHeading('G9 — strict posture: one enforced half, one declared half');
test.awaiting('public-app-server/G9-persist', 'the writable-scope declaration for an app server', false,
  'an app server persists nothing about a visitor, which falls out of the declaration and is checkable',
  { there: 40, cost: 'writable-scope declarations exist and are gated; missing is the app server taking one and the default being empty' });
test.awaiting('public-app-server/G9-refusals', 'the declared closed refusal sets', false,
  'every refusal an app can emit is a member of SOME declared set, and nothing outside a set is emitted',
  { there: 0, cost: 'the platform set (unbound, full, owner asleep, key mismatch, not a member) and the app set are both new. ' +
    'NOTE THE LIMIT THE DOCUMENT STATES: a closed set does not make a sentence good — it converts a continuous prose problem into a ' +
    'one-time review plus a mechanical check, and asserting more than that would be the check that cannot fail' });

// ── G10 — the box report ─────────────────────────────────────────────
test.subHeading('G10 — four fields about the box, and one opinion withheld');
test.awaiting('public-app-server/G10', 'the four box fields in the owner report', false,
  'assigned box label, opaque fingerprint, allotment at install and the box total as measured — and never the opinion that the box is over-committed',
  { there: 25, cost: 'the box total is free (measure already produces it) and the owner report exists; missing are the label minted by the owner at ' +
    'bind, the fingerprint, and the allotment being carried. The INGREDIENTS of the fingerprint are deliberately not declared — they are contents ' +
    'and want measuring on both platforms first, which is this agent to do' });

// ── G11 — the four states, declared separately on purpose ────────────
//
// FOUR DECLARATIONS RATHER THAN ONE, and the reason is what the board is
// for: these four states are independently constructible, so they are
// independently reachable-or-not, and Andy's question is WHICH of his
// failure states can be produced. One declaration would answer "the
// capability exists" and hide three states that do not.
//
// Each names the world that produces it, because that recipe IS the
// sample's README under G11 — a state whose construction nobody has
// written down is a state nobody else can reach.
test.subHeading('G11 — the four failure states, each reachable from outside an unmodified instance');
[
  ['unbound', 'start a real relay and do not claim it', 'the app server serves a waiting page and acts on nothing'],
  // MEASURED RATHER THAN ASSUMED: a relay cannot be given zero seats. The
  // floor is one megabyte because the floor in relay.js is one stream, and
  // the allowance is sixteen streams per megabyte, so the smallest honest
  // relay has sixteen. full() is `held >= allowance`, so the world is built
  // by FILLING it rather than by configuring it to nothing. The recipe in
  // this declaration is the sample README under G11, so a recipe nobody can
  // follow would have shipped as documentation.
  // AND THE FIRST SEAT IS ALREADY TAKEN. A relay is not a relay until it
  // is owned, and the owner's claim is admitted REGARDLESS of capacity —
  // relay.js:1730 and :1740 both read `if (!firstOwner && …full…)`, so the
  // owner bypasses the seat check AND the disc check. That bypass is what
  // makes a relay recoverable at all: the one account that can raise the
  // limit must be able to get on. So sixteen seats is the owner plus
  // fifteen, and a recipe that says sixteen more sends a stranger one claim
  // past the wall it was meant to stop at. (Andy found the premise; the
  // line numbers are this suite checking it rather than taking it.)
  ['full', 'start a relay at ramLimitMB 1 — sixteen seats, the smallest honest allowance — then the owner claim and FIFTEEN more', 'the visitor is offered the other door and sees none of the box figures'],
  ['owner-asleep', 'do not start the owner node', 'the refusal names what to do and nothing durable holds what arrived'],
  ['key-mismatch', 'stand up a second relay with a different key and point the sample at it', 'the bind refuses rather than learning a new owner'],
].forEach(function (s) {
  test.awaiting('public-app-server/G11', 'the ' + s[0] + ' state reachable from outside: ' + s[1], false,
    s[2],
    { there: 0, cost: 'no lever ships, so this needs the world built around an unmodified instance — the same method as the systemd rehearsal and ' +
      'the private-network-namespace clone run; the four commands are the sample README rather than a suite elsewhere' });
});

// ── G12 — code and state ─────────────────────────────────────────────
test.subHeading('G12 — app code and app state do not share a directory');
test.awaiting('public-app-server/G12', 'an app state home keyed by app name, beside the node state', false,
  'a redeployment replaces app code and cannot touch app state',
  { there: 50, cost: 'the shape exists exactly in relay-state — gitignored, deployment-safe, never confused with code; missing is the same for an ' +
    'app, and the decision costs nearly nothing today because a public app persists nothing about a visitor by default' });

// ── G13 — the sample, and the name ───────────────────────────────────
test.subHeading('G13 — the starter instantiates the template and is the acceptance test');
test.awaiting('public-app-server/G13', 'spirit/run/app/starter', starter,
  'it binds, learns its owner, serves a page, posts to the owner node — and nothing else: no GitHub, no seats, no visitor story',
  { there: 0, cost: 'ten lines of code and about 150 of comment by the alpha plan, the comments being the product; it cannot be written before the ' +
    'template it instantiates' });

// ONE NAME, ONE ARTEFACT. Andy ruled `app/starter/` and the tree already
// holds `process/js/hello/`, a different artefact with a different job.
// The defect this catches is not a matter of taste: two things called by
// one name cost a stranger an afternoon, and the stranger is the person
// the sample exists for.
{
  const otherHello = has('spirit/run/app/hello') || has('spirit/run/app/hallo');
  if (!otherHello) {
    test.check('no second artefact claims the sample name — process/js/hello keeps its own, the app layer has app/starter and nothing else');
  } else {
    test.fail('two artefacts claim the sample name: app/hello or app/hallo exists beside the ruled app/starter');
  }
}

test.reportSuccessFailureCount();
