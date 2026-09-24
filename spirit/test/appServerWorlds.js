'use strict';

// spirit/test/appServerWorlds.js
// THE FOUR WORLDS AN APP SERVER CAN FIND ITSELF IN — built from outside,
// with no lever anywhere.
//
//   G11: "no failure-state lever; the states are reachable from outside."
//   Andy's own acceptance test for cycle 2: the sample, UNMODIFIED, driven
//   into all four states from outside.
//
// THAT SENTENCE IS THE WHOLE REASON THIS FILE EXISTS. A flag that puts an
// app server into its "relay is full" state proves the page renders. It
// proves nothing about whether a full relay produces that state, which is
// the only question a stranger's afternoon depends on. So every state here
// is made by CONSTRUCTING THE WORLD — a relay nobody claimed, a relay with
// every seat taken, an owner node that is not running, a relay answering
// with the wrong key — and the app server is left entirely alone.
//
// Written by wsl-claude for cycle 2, under the working agreement: the
// interface called here is G15's, read from design/shell/PUBLIC-APP-SERVER.md,
// never from the other half's source.
//
// ── WHAT THIS REACHES PAST THE PROTOCOL TO DO, NAMED ────────────────
//
// Like labWorld, and for the same reason: a cheat that is written down is
// a feature request, and a cheat that is not is a lie about coverage.
//
// 1. INVITES ARE WRITTEN STRAIGHT INTO THE RELAY'S DB (`invites.add`)
//    rather than minted by the owner over a held stream. Filling a relay
//    needs fifteen of them and the owner-signed mint is sixty lines of
//    stream handling that labWorld already carries; duplicating it would
//    be a second implementation of the thing most likely to drift.
//    COST: the mint path is not exercised here. It is exercised by
//    labWorld's own suites, so this is a gap in THIS file, not in the
//    tree.
//
// 2. THE RELAY'S MEMORY BOUND IS WRITTEN AS config.json AND THE NODE IS
//    RESTARTED, because nothing configures a running relay's allowance
//    from outside. Same shape as labWorld's `withConfig`.

const fs = require('fs');
const path = require('path');

const auth = require('../run/js/relayAuth');
const nodeCard = require('../run/js/nodeCard');
const invites = require('../run/js/invites');
const relayStore = require('../run/js/relayStore');

const ensureMaster = require('./labMaster/ensureMaster');
const labPaths = require('./labMaster/labPaths');
const { mintOwnerInvite } = require('./ownerClaim');
const { sealedClaimBody } = require('./labWorld');

// `asb-` for appServerBoundary, so these are identifiable as disposable
// without anybody keeping a list — the same reasoning as labWorld's `lw-`
// and the live relay's `lab-`. Everything with this prefix goes at the
// end; nothing else is touched.
const PREFIX = 'asb-';

// INSIDE THE LAB RANGE (65400-65429) AND BELOW labWorld's BLOCK, which
// holds 65425-65428. Two helpers that shared a port would not fail — the
// second would find the first's relay answering and test it instead,
// which is the wrong-green shape this whole harness is built to refuse.
const PORT_RELAY = 65424;
const PORT_OTHER_RELAY = 65423;
const PORT_OWNER_NODE = 65422;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function homeOf(id) {
  return path.join(labPaths.FIXTURE_ROOT, id, 'spirit', 'run');
}

async function post(url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let parsed = null;
    try { parsed = await res.json(); } catch (e) { parsed = null; }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: String((e && e.message) || e) };
  }
}

// ANSWERING, WITH A DEADLINE THAT REPORTS RATHER THAN HANGS. A helper
// that waits for ever turns one broken world into a harness that never
// finishes, and the run then says nothing at all about the other three.
async function answering(url, ms) {
  const until = Date.now() + (ms || 8000);
  while (Date.now() < until) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch (e) { /* not up yet */ }
    await sleep(120);
  }
  return false;
}

async function makeNode(name, type, port, config) {
  const id = PREFIX + name;
  const made = await ensureMaster.api('POST', '/api/nodes',
    { name: id, type: type, port: port, kind: 'fixture' });

  if (made.status === 409) {
    const cycled = await ensureMaster.api('POST', '/api/nodes/' + id + '/recycle');
    if (cycled.status !== 200) {
      return { ok: false, error: 'recycle ' + id + ': ' + cycled.text };
    }
  } else if (made.status !== 201 && made.status !== 200) {
    return { ok: false, error: 'create ' + id + ': ' + made.text };
  } else {
    const started = await ensureMaster.api('POST', '/api/nodes/' + id + '/start');
    if (started.status !== 200) {
      return { ok: false, error: 'start ' + id + ': ' + started.text };
    }
  }

  if (config) {
    const dir = path.join(homeOf(id), 'relay-state');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
    await ensureMaster.api('POST', '/api/nodes/' + id + '/restart');
  }

  const url = 'http://127.0.0.1:' + port;
  return { ok: true, id: id, port: port, url: url, home: homeOf(id) };
}

async function stop(id) {
  await ensureMaster.api('POST', '/api/nodes/' + id + '/stop');
}

// BY PATTERN, never from what any object happens to remember — a teardown
// run in a fresh process must still delete yesterday's leftovers, or the
// next build finds the ports it wants held and fails with a message about
// something else entirely.
async function clear() {
  const listed = await ensureMaster.api('GET', '/api/nodes');
  const rows = (listed.json && listed.json.nodes) || [];
  for (const row of rows) {
    if (String(row.id || '').indexOf(PREFIX) !== 0) continue;
    await ensureMaster.api('POST', '/api/nodes/' + row.id + '/delete');
  }
}

// ── WORLD 1 — A REAL RELAY THAT NOBODY HAS CLAIMED ──────────────────
//
// The state an app server meets on the day a box is installed and before
// the owner has taken it. The document's expectation: it starts, serves a
// waiting page, and ACTS ON NOTHING.
async function unclaimedRelay() {
  const relay = await makeNode('relay', 'relay', PORT_RELAY, { ramLimitMB: 128 });
  if (!relay.ok) return relay;
  if (!await answering(relay.url + '/api/relay/key')) {
    return { ok: false, error: 'the unclaimed relay did not answer on ' + relay.url };
  }
  // NOT CLAIMED, DELIBERATELY, AND CHECKED. "I did not claim it" is an
  // absence, and an absence is exactly what a test must not assume: a
  // recycled node that kept its allow.json would be owned, the world
  // would be the wrong one, and the assertion built on it would pass or
  // fail for a reason nobody could see.
  const who = await fetch(relay.url + '/api/relay/who').then(function (r) { return r.json(); }).catch(function () { return null; });
  const owned = !!(who && who.byName && Object.keys(who.byName).length);
  if (owned) {
    return { ok: false, error: 'the relay meant to be unclaimed already has an owner — the world is not the one this asserts against' };
  }
  return { ok: true, relay: relay, claimed: false };
}

// ── WORLD 2 — A CLAIMED RELAY, OPTIONALLY FILLED TO THE WALL ────────
//
// `members` is how many claims to add AFTER the owner. The owner holds
// the first seat: a relay is not a relay until it is owned, and the
// owner's claim is admitted regardless of capacity — `relay.js` reads
// `if (!firstOwner && …full…)` at both the seat check and the disc
// check, so the one account that can raise the limit can always get on.
// A recipe that forgets this sends a stranger one claim past the wall it
// was meant to stop at.
async function claimedRelay(opts) {
  opts = opts || {};
  const ram = opts.ramLimitMB || 128;
  const members = opts.members || 0;
  const port = opts.port || PORT_RELAY;
  const name = opts.name || 'relay';

  const relay = await makeNode(name, 'relay', port, { ramLimitMB: ram });
  if (!relay.ok) return relay;
  if (!await answering(relay.url + '/api/relay/key')) {
    return { ok: false, error: 'the relay did not answer on ' + relay.url };
  }

  const owner = opts.owner || auth.generateIdentity('asbowner');
  const ownerName = owner.name || 'asbowner';
  const ownerInvite = mintOwnerInvite(relay.home, ownerName);
  const claimed = await post(relay.url + '/api/relay/claim', await sealedClaimBody(relay.url, owner, {
    name: ownerName,
    publicKey: owner.publicKey,
    sig: auth.sign(owner.privateKey, auth.claimMessage(ownerName)),
    invite: ownerInvite.token,
    inviteLabel: ownerName,
    card: nodeCard.cardFrom(Object.assign({ name: ownerName }, owner)),
  }));
  if (!claimed.ok) {
    return { ok: false, error: 'the owner could not claim: ' + JSON.stringify(claimed.body) };
  }

  // THE FILLING. Each member needs an invite; see cheat 1 at the head of
  // this file — the row is written into the relay's own db rather than
  // minted over the owner's stream, and the store is closed at once so no
  // handle is held on a file labMaster will want to delete.
  //
  // ── AND A RELAY CANNOT BE FILLED QUICKLY FROM ONE ADDRESS ─────────
  //
  // MEASURED, on the first rehearsal of this builder, and it corrects the
  // recipe rather than the code. Claim number ten was refused with
  // `too many claims` — `relay.js:1559`, `CLAIM_PER_MIN = 10` at :148,
  // over a `WINDOW_MS` of 60 seconds at :220, keyed by the caller's
  // address. Every claim a suite makes comes from 127.0.0.1, so it is one
  // caller and the tenth trips the limit.
  //
  // THAT IS THE DEFENCE WORKING, NOT AN OBSTACLE. Sixteen seats cannot be
  // taken from one machine in under two minutes, which is a fact about
  // the product that the recipe accidentally measured — and it belongs in
  // the sample's README beside the recipe, because a reader who tries to
  // reproduce the full state and meets a 429 will otherwise believe they
  // have found the wall when they have found a different one.
  //
  // So the builder WAITS for the window rather than pretending: no
  // X-Forwarded-For, no second interface, no lever. A world built by
  // stepping around a gate is a world the gate is not in.
  const CLAIMS_PER_WINDOW = 10;
  const WINDOW_MS = 60 * 1000;
  let sinceWait = 1; // the owner's claim is the first in this window
  const joined = [];
  for (let i = 0; i < members; i += 1) {
    if (sinceWait >= CLAIMS_PER_WINDOW) {
      // A little past the window, because the limit is a sliding window
      // and the oldest entry has to fall out of it, not merely age.
      await sleep(WINDOW_MS + 2000);
      sinceWait = 0;
    }
    sinceWait += 1;
    const label = 'asbm' + (i + 1);
    const row = invites.add(relay.home, { label: label, days: 1 });
    relayStore.open(relay.home).close();
    const id = auth.generateIdentity(label);
    const res = await post(relay.url + '/api/relay/claim', await sealedClaimBody(relay.url, id, {
      name: label,
      publicKey: id.publicKey,
      sig: auth.sign(id.privateKey, auth.claimMessage(label)),
      invite: row.token,
      inviteLabel: label,
      card: nodeCard.cardFrom(Object.assign({ name: label }, id)),
    }));
    if (!res.ok) {
      // THE REFUSAL IS THE RESULT, NOT AN ERROR, when the point of the
      // world is that the relay is full. The caller is told how far it
      // got and decides whether that is the world it wanted.
      return { ok: true, relay: relay, owner: owner, joined: joined, stoppedAt: i + 1, refusal: res.body };
    }
    joined.push({ label: label, identity: id });
  }

  // PROVING THE WALL, WHICH IS NOT THE SAME AS FILLING THE SEATS. A relay
  // with sixteen members and one spare seat looks identical from here to
  // one that is full, and an assertion about fullness run against it
  // passes or fails for a reason nobody can see. So the world can be
  // asked to take one claim too many and report what it met.
  //
  // MEASURED 2026-09-24 at ramLimitMB 1: owner + 15 is sixteen of
  // sixteen, and the seventeenth claim is refused with
  //   "this relay is full: 16 of 16 members, which is what 1 MB of RAM
  //    can serve at once. Its owner must raise ramLimitMB or remove
  //    members."
  // So the recipe "the owner claim and FIFTEEN more" is exact, and now by
  // measurement rather than by reading `full()`.
  let wall = null;
  if (opts.proveFull) {
    const label = 'asbwall';
    const row = invites.add(relay.home, { label: label, days: 1 });
    relayStore.open(relay.home).close();
    const id = auth.generateIdentity(label);
    const res = await post(relay.url + '/api/relay/claim', await sealedClaimBody(relay.url, id, {
      name: label,
      publicKey: id.publicKey,
      sig: auth.sign(id.privateKey, auth.claimMessage(label)),
      invite: row.token,
      inviteLabel: label,
      card: nodeCard.cardFrom(Object.assign({ name: label }, id)),
    }));
    wall = { admitted: res.ok, refusal: res.body, status: res.status };
  }

  return { ok: true, relay: relay, owner: owner, joined: joined, stoppedAt: null, refusal: null, wall: wall };
}

// ── WORLD 3 — AN OWNER NODE THAT IS NOT RUNNING ─────────────────────
//
// Built by starting one and stopping it, rather than by never starting
// one: the app server must meet an owner it KNOWS ABOUT and cannot reach,
// which is a different state from an owner it has never heard of. The
// first is "asleep"; the second is "unbound", and confusing them is how a
// stranger gets told the wrong thing to do.
async function ownerAsleep(world) {
  const node = await makeNode('ownernode', 'avatar', PORT_OWNER_NODE);
  if (!node.ok) return node;
  if (world && world.owner) {
    auth.saveIdentity(node.home, world.owner);
    await ensureMaster.api('POST', '/api/nodes/' + node.id + '/restart');
    await answering(node.url + '/api/version', 6000);
  }
  await stop(node.id);
  return { ok: true, node: node, running: false };
}

// ── WORLD 4 — A SECOND RELAY, WITH A DIFFERENT KEY ──────────────────
//
// The hostile half of G6. A URL is a name somebody else controls: an
// expired domain, a DNS change, a restored backup or a typo answers once
// and, under "learns its owner", owns the app for good. So the bind is to
// the KEY the relay proved at first contact, and a later different answer
// is refused, kept and reported.
async function otherRelay() {
  const made = await claimedRelay({ name: 'other', port: PORT_OTHER_RELAY, ramLimitMB: 128 });
  return made;
}

// ── FIXTURE APPS — FOUR WRONG MANIFESTS, WHICH THE SAMPLE CANNOT BE ──
//
// G14 says an app gets nothing it did not ask for, that absent means
// nothing, that utilities are separately grantable, and that a public app
// server refuses an app that is not strict. NONE of that is observable
// from the sample's manifest, because the sample is correct — a correct
// declaration exercises the grant and never the refusal.
//
// So the suite brings its own apps. These are the suite's artefacts and
// not the other half's: they live under the app server's own rootDir in a
// fixture, they are thrown away with it, and they exist only to be wrong
// in one named way each.
//
// AN APP IS A FOLDER PLUS A SIBLING MANIFEST — `app/<name>/<name>.json`,
// which `kernel.js` enforces (MANIFEST_PATTERN) and G15 inherits rather
// than reinvents. These are built to that shape for the same reason the
// contract uses it: a fixture that invented its own layout would be
// testing a boundary nobody ships.
function plantApp(rootDir, name, manifest) {
  const dir = path.join(rootDir, 'app', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + '.json'),
    JSON.stringify(Object.assign({ name: name, description: 'a fixture app' }, manifest), null, 2));
  // A page, because an app that serves nothing cannot be asked for
  // anything, and half these assertions are about what it is handed when
  // it asks.
  fs.writeFileSync(path.join(dir, 'index.html'),
    '<!doctype html><meta name="robots" content="noindex"><title>' + name + '</title><p>' + name + '</p>');
  return dir;
}

// The four, each wrong in ONE way, because a fixture wrong in two cannot
// say which one produced the refusal.
const WRONG_MANIFESTS = {
  // Declares nothing. Under "absent means nothing" it must be handed no
  // api members at all — and this is the fixture that makes the rule
  // assertable, which was the argument for choosing it.
  'asb-declares-nothing': { posture: 'strict' },
  // Declares a member that is not in any vocabulary. The open item was
  // settled recommended-no: refused AT LOAD with the member NAMED, never
  // at the moment the app reaches for it.
  'asb-asks-the-impossible': { posture: 'strict', surface: ['verb', 'thereIsNoSuchMember'] },
  // Not strict. A public app server refuses to serve it.
  'asb-not-strict': { posture: 'ordinary', surface: ['verb'] },
  // One utility of the three. G4 requires them SEPARATELY optional, so
  // taking elements must not bring dialogs along.
  'asb-elements-only': { posture: 'strict', surface: ['verb'], utilities: ['elements'] },
};

// AND THE REAL APP HAS TO BE ON THE BOX, which is the defect this
// function exists to close. The four G11 worlds ran an app server with
// `appName: 'starter'` against a fixture root that contained no starter —
// so the contract came back empty, and every assertion about what the
// sample does was made about an app that was not there.
//
// It was invisible because it looks exactly like the state where the
// feature is unbuilt. THE CONTROL THAT FOUND IT was planting a manifest
// this suite wrote itself and requiring the server to show it back: that
// one WAS read, which proved the reader worked and the cupboard was bare.
//
// Copying the app onto the box is what a deployment does — G12's whole
// point is that code is replaced and state is not — so this is the real
// motion rather than a convenience.
function plantStarter(rootDir, repoRoot) {
  const from = path.join(repoRoot, 'spirit', 'run', 'app', 'starter');
  if (!fs.existsSync(from)) return null;
  const to = path.join(rootDir, 'app', 'starter');
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
  return to;
}

function plantWrongApps(rootDir) {
  const planted = {};
  Object.keys(WRONG_MANIFESTS).forEach(function (name) {
    planted[name] = plantApp(rootDir, name, WRONG_MANIFESTS[name]);
  });
  return planted;
}

module.exports = {
  PREFIX: PREFIX,
  plantApp: plantApp,
  plantStarter: plantStarter,
  plantWrongApps: plantWrongApps,
  WRONG_MANIFESTS: WRONG_MANIFESTS,
  PORT_RELAY: PORT_RELAY,
  PORT_OTHER_RELAY: PORT_OTHER_RELAY,
  PORT_OWNER_NODE: PORT_OWNER_NODE,
  unclaimedRelay: unclaimedRelay,
  claimedRelay: claimedRelay,
  ownerAsleep: ownerAsleep,
  otherRelay: otherRelay,
  clear: clear,
  stop: stop,
  answering: answering,
};
