'use strict';

// spirit/test/ownerAtInstall.js
// goal/G16.8: a relay's owner is set when the relay is INSTALLED, and in no other way. Written first, red on
// today's code, by wsl-claude; the build is the other agent's.
//
// WHY, in Andy's words (2026-10-11, answering Q1 of this item): "the invite path to ownership MUST be gone. it
// is a security gap, from the time of install until the time of first claim." And under goal/G16.3, 2026-10-10:
// "the relays should do first-claim, it should happen at install time. that's the only \"safe\" way." then "NOT
// first claim i mean"; "KILL the dead code / fallback. this type of stuff is always coming back to bite us.";
// "yes. ownership CANNOT be achieved via invite."
//
// THE GAP, stated plainly: between the moment a public relay starts and the moment its owner's first claim
// arrives, the box is ownable by whoever holds the token install.js printed. The token can be read over a
// shoulder, left in a scrollback, or pasted into the wrong window, and the relay cannot tell. Writing the owner
// file at install closes the window: there is never a moment when the relay is unowned and serving.
//
// TWO PREMISES OF THE ITEM'S BOX WERE WRONG, and this header records it so the next session does not re-derive
// it. Verified at 0005e443:
//   1. The box said "no install.js exists in the tree, so nothing mints one and the branch cannot be taken on a
//      real box." install.js IS in the tree, at the repo root, and mints the owner invite (invites.mintOwner).
//      It was already there at b355e36d, the commit the box was checked at. So the path is not dead code: it is
//      today's only way a fresh public relay becomes owned, and install.js goes WITH the path, not before or
//      after it. Andy's own answer settles the direction: install.js performs ownership by invite, which is the
//      thing being killed.
//   2. The box said the owner-invite suites are simply "retired from the list". They are not the whole of it.
//      spirit/test/world.js (the in-process scenario builder) and spirit/test/labWorld.js both make EVERY relay
//      they build owned by driving the first claim through the owner invite, via spirit/test/ownerClaim.js — and
//      29 test files lean on those helpers. Left out, the deletion turns a few hundred suites red at once and
//      none of it is a real fault. So the world builders own a relay by WRITING the owner file, which is what
//      this suite's own fixture already does (relayWith, below) and proof that it needs no invite.
//
// WHAT IS ASSERTED
//   1. NOTHING CAN BECOME AN OWNER OVER THE WIRE: a claim on a relay with no owner file is refused, and no
//      owner file appears. The relay does not take ownership from a claim under any circumstances.
//   2. THE MINT IS GONE: invites offers no owner kind — no mintOwner, no isOwnerInvite, no OWNER_INVITE — and
//      relay.js has no becomeOwner, so nothing in the running code can write an owner from the wire.
//   3. install.js IS GONE from the tree, because it exists only to mint that token.
//   4. THE INSTALL WRITES THE OWNER: bash/install-units takes the owner's public key the way bash/face-install
//      already does, writes relay-state/owner.json from it, and refuses to install a relay without one.
//   5. AN ORDINARY MEMBER CLAIM STILL WORKS on an owned relay, with a member invite. The item takes nothing
//      away from a person.
//   6. THE REFUSAL TEXTS THAT NAME THE DEAD PATH ARE GONE: no 'owner invite required' anywhere under spirit/run.
//   7. THE TEST WORLD OWNS WITHOUT AN INVITE: ownerClaim.js mints nothing, and world.js still builds an owned
//      relay — so the harness proves the install-time shape rather than the one being deleted.
//
// rule/11: through testSupport only; an in-process relay in its own temp home, no ports and no node.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/spirit/relayAuth.js');
const invites = require('../run/spirit/invites.js');
const nodeCard = require('../run/spirit/nodeCard.js');
const { createRelay } = require('../run/spirit/relay.js');

const OWED = 'OWED by goal/G16.8: ';
const ROOT = path.join(__dirname, '..', '..');
const RUN = path.join(ROOT, 'spirit', 'run');
const BASH = path.join(ROOT, 'bash');

function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 220); }
function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } }
function there(p) { try { fs.statSync(p); return true; } catch (e) { return false; } }

// Every .js under spirit/run, so a name can be looked for in the RUNNING code and nowhere else. The relay's own
// state and node_modules are not code we wrote.
function runFiles(rel, into) {
  const abs = path.join(RUN, rel);
  fs.readdirSync(abs).forEach(function (name) {
    if (name === 'node_modules' || name === 'relay-state') return;
    const sub = path.join(abs, name);
    let st; try { st = fs.statSync(sub); } catch (e) { return; }
    if (st.isDirectory()) runFiles(path.join(rel, name), into);
    else if (/\.js$/.test(name)) into.push({ rel: path.join('spirit/run', rel, name), text: read(sub) });
  });
  return into;
}

// A RELAY THAT IS OWNED BEFORE IT SERVES — which is the shape this item asks for, built here with no invite at
// all. The owner's key is written into relay-state/owner.json, exactly as bash/face-install does it for a face,
// and the relay is owned from its first breath.
function ownedRelay() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-ownerinstall-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const owner = auth.generateIdentity('owner');
  auth.writeOwner(home, owner.publicKey);
  return { home: home, owner: owner, box: createRelay(home) };
}

// A relay with NO owner file: the state this item says must never serve, and must never become owned by a claim.
function unownedRelay() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-noowner-'));
  fs.mkdirSync(path.join(home, 'relay-state'), { recursive: true });
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  return { home: home, box: createRelay(home) };
}

function ownerFileOf(home) { return path.join(home, 'relay-state', 'owner.json'); }

// ── 1. NOTHING BECOMES AN OWNER OVER THE WIRE ───────────────────────────
test.startTest('Ownership never by invite: the first-claim path goes (goal/G16.8)');
test.subHeading('1. a claim on a relay with no owner is refused, and makes no owner');
{
  const w = unownedRelay();
  const comer = auth.generateIdentity('stranger');
  const got = w.box.claim('stranger', auth.sign(comer.privateKey, auth.claimMessage('stranger')), comer.publicKey, '10.0.0.9');
  // THE REFUSAL IS PINNED TO ITS OWN REASON, and that is not pedantry. Found while verifying 2010cbdb: with the
  // no-owner refusal deleted, an unowned relay still refuses — 'invite required', further down the path — so a
  // check that accepted any refusal passed while the gate it names was gone. The relay must turn a claim away
  // BECAUSE it has no owner, before the invite question is reached at all.
  if (got && got.ok === false && /no owner/.test(String(got.error))) {
    test.check('a claim on an unowned relay is refused for having no owner: ' + short(got.error));
  } else if (got && got.ok === false) {
    test.fail(OWED + 'an unowned relay refused for the wrong reason, so the no-owner gate is not there: ' + short(got.error));
  } else {
    test.fail(OWED + 'an unowned relay took a claim: ' + short(got));
  }

  if (!there(ownerFileOf(w.home))) test.check('and it wrote no owner file, so nothing was handed the box');
  else test.fail(OWED + 'the claim wrote relay-state/owner.json: ' + short(read(ownerFileOf(w.home))));
}

// The same attempt, now with a token in hand. This is the gap Andy named: today a minted owner invite turns this
// exact refusal into ownership.
//
// The attempt is driven EXACTLY as spirit/test/ownerClaim.js drives it today — the token, the spoken label and
// the owner's card — so that this check is red on today's code for the right reason. A claim that merely failed
// to present a well-formed invite would pass it while the gap stood wide open.
{
  const w = unownedRelay();
  const comer = auth.generateIdentity('andy');
  let got = null;
  try {
    const row = invites.mintOwner(w.home, 'andy');
    got = w.box.claim('andy', auth.sign(comer.privateKey, auth.claimMessage('andy')), comer.publicKey,
      '10.0.0.9', row.token, 'andy', nodeCard.cardFrom(Object.assign({ name: 'andy' }, comer)));
  } catch (e) {
    // mintOwner gone is the item built: there is then nothing to present, which is the point.
    got = { ok: false, error: 'nothing can be minted: ' + String(e && e.message) };
  }
  if (got && got.ok === false) test.check('a claim presenting an owner token is refused too: ' + short(got.error));
  else test.fail(OWED + 'a token made an owner over the wire: ' + short(got) + ' — this is the gap, from install until first claim');
  if (!there(ownerFileOf(w.home))) test.check('and still no owner file');
  else test.fail(OWED + 'a token wrote relay-state/owner.json over the wire — the box changed hands on the strength of a printed string');
}

// ── 2. THE MINT AND THE WRITER ARE GONE FROM THE RUNNING CODE ───────────
test.subHeading('2. the owner kind of invite, and the relay\'s owner writer, are gone');
{
  ['mintOwner', 'isOwnerInvite', 'OWNER_INVITE'].forEach(function (name) {
    if (invites[name] === undefined) test.check('invites offers no ' + name);
    else test.fail(OWED + 'invites still offers ' + name + ', so the owner kind of invite is still mintable');
  });

  const relayText = read(path.join(RUN, 'spirit', 'relay.js'));
  if (!/function becomeOwner\b/.test(relayText)) test.check('relay.js has no becomeOwner, so no claim can write an owner');
  else test.fail(OWED + 'relay.js still defines becomeOwner — the wire can still write relay-state/owner.json');
  if (!/firstOwner/.test(relayText)) test.check('and no firstOwner branch is left to take');
  else test.fail(OWED + 'relay.js still carries a firstOwner branch');
}

// ── 3. install.js IS GONE ───────────────────────────────────────────────
test.subHeading('3. install.js is gone, because minting that token was all it did');
{
  if (!there(path.join(ROOT, 'install.js'))) test.check('install.js is no longer in the tree');
  else test.fail(OWED + 'install.js is still at the repo root and still mints the owner invite (invites.mintOwner)');
}

// ── 4. THE INSTALL WRITES THE OWNER FILE ────────────────────────────────
//
// Asserted on the text of the script, which is how spirit/test/hostHardening.js already judges bash/ — these are
// root-only scripts and a suite cannot run them. bash/face-install is the model: it takes <OWNER_KEY> as its
// first argument and writes owner.json from it.
test.subHeading('4. bash/install-units takes the owner key and writes the owner file');
{
  const units = read(path.join(BASH, 'install-units'));
  if (!units) {
    test.fail(OWED + 'bash/install-units could not be read');
  } else {
    if (/\bOWNER_KEY\b/.test(units)) test.check('install-units takes an OWNER_KEY, as face-install does');
    else test.fail(OWED + 'install-units names no OWNER_KEY: an operator still writes owner.json by hand');

    if (/owner\.json/.test(units)) test.check('and writes relay-state/owner.json from it');
    else test.fail(OWED + 'install-units never writes owner.json, so a relay still starts unowned');

    // A relay that starts with no owner is the window this item closes, so the script must refuse rather than
    // install one.
    if (/\bOWNER_KEY\b/.test(units) && /\b(die|refuse|exit 1|usage)\b/.test(units)) {
      test.check('and refuses to install a relay with no owner key given');
    } else {
      test.fail(OWED + 'install-units does not refuse without an owner key');
    }

    // The document must say it in the one place an operator reads before installing, and say it of the install
    // — today it mentions owner.json only as state that is not in git, which tells an operator nothing about
    // where it comes from.
    const doc = read(path.join(BASH, 'RELAY-HOST.md'));
    if (/\bOWNER_KEY\b/.test(doc) || /install-units[^\n]*owner/i.test(doc)) {
      test.check('RELAY-HOST.md says the install is given the owner key and writes the owner file');
    } else {
      test.fail(OWED + 'RELAY-HOST.md never names OWNER_KEY: it still does not say where owner.json comes from');
    }
  }
}

// ── 5. AN ORDINARY MEMBER CLAIM STILL WORKS ─────────────────────────────
//
// The point of the control: this item deletes a path, and a deletion that also broke the ordinary door would pass
// every check above while making the relay useless.
test.subHeading('5. a member still claims on an owned relay, with a member invite');
{
  const w = ownedRelay();
  const ownerIn = w.box.claim('owner', auth.sign(w.owner.privateKey, auth.claimMessage('owner')), w.owner.publicKey, '10.0.0.1');
  if (ownerIn && ownerIn.ok) test.check('the owner, named in the owner file, claims his own box');
  else test.fail(OWED + 'the owner could not claim a relay that already names him: ' + short(ownerIn));

  // mint(ownerName, label, days) — the owner's own node asks it locally, so there is no signature here; the
  // owner is the name in the owner file (relay.js mint).
  let minted = null;
  try { minted = w.box.mint('owner', 'bert', 7); } catch (e) { minted = { ok: false, error: String(e && e.message) }; }
  if (minted && minted.ok && minted.invite && minted.invite.token) {
    const bert = auth.generateIdentity('bert');
    const got = w.box.claim('bert', auth.sign(bert.privateKey, auth.claimMessage('bert')), bert.publicKey, '10.0.0.2', minted.invite.token, 'bert');
    if (got && got.ok) test.check('and a member claims with the invite the owner minted');
    else test.fail(OWED + 'a member invite no longer admits a member: ' + short(got));
  } else {
    test.fail(OWED + 'the owner could not mint a member invite: ' + short(minted));
  }
}

// ── 6. THE TEXTS THAT NAME THE DEAD PATH ARE GONE ───────────────────────
test.subHeading('6. no refusal under spirit/run still asks for an owner invite');
{
  const left = runFiles('', []).filter(function (f) { return /owner invite/i.test(f.text); });
  if (!left.length) test.check('nothing under spirit/run mentions an owner invite');
  else test.fail(OWED + 'the owner invite is still named in: ' + left.map(function (f) { return f.rel; }).join(', '));
}

// ── 7. THE TEST WORLD OWNS WITHOUT AN INVITE ────────────────────────────
//
// Not tidiness. world.js builds the relays a large part of the harness runs on, and it owns them through the path
// being deleted. If this check is red the build is not finished, whatever the suites say.
test.subHeading('7. the scenario builders own a relay by writing the owner file');
{
  const ownerClaim = read(path.join(__dirname, 'ownerClaim.js'));
  if (!/mintOwner/.test(ownerClaim)) test.check('ownerClaim.js mints no owner invite');
  else test.fail(OWED + 'ownerClaim.js still mints an owner invite, so 29 suites still drive the deleted path');

  const labWorld = read(path.join(__dirname, 'labWorld.js'));
  if (!/mintOwnerInvite/.test(labWorld)) test.check('labWorld.js asks for no owner invite');
  else test.fail(OWED + 'labWorld.js still asks for an owner invite to own the relay it builds');

  // And the builder still works: an owned relay out of world.js is what the rest of the harness needs.
  let built = null;
  try {
    const world = require('./world.js');
    built = world.build ? world.build({ owner: 'andy', relays: ['one'], peers: [] }) : null;
  } catch (e) {
    built = { error: String(e && e.message) };
  }
  if (built && !built.error) test.check('world.js still builds an owned relay');
  else test.fail(OWED + 'world.js can no longer build an owned relay: ' + short(built && built.error));
}

test.reportSuccessFailureCount();
