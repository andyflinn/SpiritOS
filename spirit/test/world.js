'use strict';

// spirit/test/world.js
// A scenario, built in process, in milliseconds.
//
// The fast half of the pair. `labWorld.js` builds the same description as
// real processes on real ports so a person can look at it; this builds it
// as objects so a suite can run hundreds of variations through it. They
// share `scenario.js` and nothing else — which is what stops "the world I
// tested" and "the world I looked at" from meaning two different things.
//
// It replaces a `lab()` helper that had been copied into six suites and
// had already drifted between them: some minted invites, some did not,
// some saved the owner's identity to disk and some forgot, and each had
// its own quiet opinion about what a peer needs before it can be sent to.
//
// No sockets, no processes, no temp servers. A world here costs about a
// millisecond, which is the whole point.

const os = require('os');
const fs = require('fs');
const path = require('path');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const deviceAuth = require('../run/js/deviceAuth');
const scenario = require('./scenario');
const { createRelay } = require('../run/js/relay');

function tmpHome(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-world-' + (tag || '') + '-'));
}

// build(description) -> a world, or { ok:false, error } if the
// description is wrong. Refused rather than half-built: a suite that
// starts against a broken world reports its failures somewhere else.
function build(description) {
  const wrong = scenario.problems(description);
  if (wrong.length) {
    return { ok: false, error: 'scenario: ' + wrong.join('; ') };
  }
  try {
    return assemble(scenario.normalize(description));
  } catch (e) {
    // REPORTED, NOT THROWN. Every caller checks `ok`, and a builder that
    // sometimes returns a refusal and sometimes explodes makes each of
    // them handle two shapes — so half of them handle one.
    return { ok: false, error: String((e && e.message) || e) };
  }
}

function assemble(s) {

  // One home per relay, because a relay's state IS its directory and two
  // sharing one would quietly be the same mailbox.
  const boxes = Object.create(null);
  const homes = Object.create(null);
  const keys = Object.create(null);
  s.relays.forEach(function (name) {
    const home = tmpHome(name);
    homes[name] = home;
    // THE MAILBOX'S OWN KEY, which is not the owner's. server.js makes it
    // with ensureIdentity(ROOT_DIR, 'relay') on the first --relay boot,
    // and relay.js says so at mailboxPublicKey(): "the owner is a peer
    // who claimed, the mailbox is the box."
    //
    // This file used to save the OWNER there instead, so every world it
    // built had a relay whose key was its owner's — and any check that
    // distinguishes the two would have passed without distinguishing
    // anything. Made before createRelay, which reads the file.
    keys[name] = auth.ensureIdentity(home, 'relay');
    boxes[name] = createRelay(home);
  });
  const first = s.relays[0];

  let owner = null;
  if (s.owner) {
    owner = auth.generateIdentity(s.owner);
    s.relays.forEach(function (name) {
      // Claimed, and NOT written into the relay's home — the owner's key
      // belongs in the owner's NODE home, which is what ownerHome()
      // below builds and what deviceTick and the hub read.
      const claimed = boxes[name].claim(
        s.owner,
        auth.sign(owner.privateKey, auth.claimMessage(s.owner)),
        owner.publicKey,
        '10.0.0.1'
      );
      if (!claimed.ok) throw new Error('owner could not claim ' + name + ': ' + claimed.error);
    });
  }

  // name -> identity. The LABEL is what goes on the wire; the name is
  // how a suite refers to somebody. Two peers may share a label and can
  // never share a name, which is the two-johns case made ordinary.
  //
  // Each also claims from ITS OWN ADDRESS. The 4th argument to claim()
  // is the rate-limit bucket (relay.js, CLAIM_PER_MIN = 10), so a
  // builder that claimed everybody from 10.0.0.1 would refuse the
  // eleventh peer and blame the scenario rather than itself — and Andy's
  // lab already runs nine. It is also simply truer: peers do not share a
  // machine.
  const cast = Object.create(null);
  let nth = 0;
  s.peers.forEach(function (p) {
    nth += 1;
    const from = '10.0.' + Math.floor(nth / 250) + '.' + (nth % 250 + 1);
    const id = auth.generateIdentity(p.label);
    cast[p.name] = {
      name: p.name, label: p.label, id: id,
      on: p.on, running: p.running, from: from,
    };

    // DEDUPED, because `live` folds onto the first relay in process and
    // a peer on both would otherwise claim the same box twice — "key
    // already claimed", from a scenario that is perfectly correct for
    // the builder it was written for. The visual builder has a real
    // second relay; this one does not, and folding is the honest
    // approximation as long as it folds only once.
    const targets = [];
    p.on.forEach(function (relayName) {
      const target = relayName === scenario.LIVE ? first : relayName;
      if (targets.indexOf(target) === -1) targets.push(target);
    });

    targets.forEach(function (target) {
      const box = boxes[target];
      if (!box) return;

      let token = null;
      if (owner) {
        const minted = box.mint(
          s.owner, p.label, 7,
          auth.sign(owner.privateKey, invites.mintMessage(p.label, 7))
        );
        if (!minted.ok) throw new Error('mint for ' + p.name + ': ' + minted.error);
        token = minted.invite.token;
      }
      const joined = box.claim(
        p.label,
        auth.sign(id.privateKey, auth.claimMessage(p.label)),
        id.publicKey,
        from,
        token
      );
      if (!joined.ok) throw new Error('join ' + p.name + ': ' + joined.error);
    });
  });

  // Mail, so a suite about reading does not have to write its own first.
  s.messages.forEach(function (m) {
    const from = cast[m.from];
    if (!from) return;
    const toLabel = m.to ? (cast[m.to] ? cast[m.to].label : m.to) : s.owner;
    if (!toLabel) return;
    boxes[first].send(
      from.label, toLabel, m.text,
      auth.sign(from.id.privateKey, auth.sendMessage(from.label, toLabel, m.text))
    );
  });

  // What happens AFTER. Removing somebody who stays in an address book
  // is the only way the third presence state occurs, and it is the step
  // a world is most likely to be missing.
  s.then.forEach(function (step) {
    if (!owner) return;
    const who = cast[step.remove];
    if (!who) return;
    const target = step.from === scenario.LIVE ? first : step.from;
    const box = boxes[target];
    if (!box) return;
    box.removePeer(
      s.owner, who.id.publicKey,
      auth.sign(owner.privateKey, auth.removePeerMessage(who.id.publicKey))
    );
  });

  return {
    ok: true,
    scenario: s,
    // The first relay, which is the only one most suites have.
    box: boxes[first],
    home: homes[first],
    owner: owner,
    ownerName: s.owner,
    relay: function (name) { return boxes[name || first]; },
    relayHome: function (name) { return homes[name || first]; },
    // The mailbox's own identity, for the suites that check a message
    // came FROM the box rather than from whoever owns it.
    relayKey: function (name) { return keys[name || first]; },
    relayNames: function () { return s.relays.slice(); },
    peer: function (name) { return cast[name] ? cast[name].id : null; },
    peerLabel: function (name) { return cast[name] ? cast[name].label : null; },
    // The address a peer claimed from, for the suites that check a rate
    // limit or a per-client bucket.
    peerAddress: function (name) { return cast[name] ? cast[name].from : null; },
    peers: function () {
      return Object.keys(cast).map(function (n) { return cast[n]; });
    },

    // A personal node's home for somebody in the cast: their identity on
    // disk and a relays.json pointing at the world. What a node needs
    // before it can be a node, which several suites were assembling by
    // hand and one was getting wrong.
    nodeHome: function (name, urls) {
      const who = cast[name];
      if (!who) return null;
      const home = tmpHome(name);
      auth.saveIdentity(home, who.id);
      fs.mkdirSync(path.join(home, 'app', 'natter'), { recursive: true });
      fs.writeFileSync(
        path.join(home, 'app', 'natter', 'relays.json'),
        JSON.stringify((urls || ['http://relay']).map(function (u) {
          return { label: 'lab', url: u };
        }), null, 2)
      );
      // The file that decides firstRun(). Without it a node with a key,
      // a claim and a relay still believes it has no name.
      fs.writeFileSync(
        path.join(home, 'app', 'natter', 'session.json'),
        JSON.stringify({ label: who.label, boundAt: new Date().toISOString() }, null, 2)
      );
      return home;
    },

    // The owner's own node home, for suites about the device window and
    // the hub rather than about peers.
    ownerHome: function (urls) {
      if (!owner) return null;
      const home = tmpHome('owner');
      auth.saveIdentity(home, owner);
      fs.mkdirSync(path.join(home, 'app', 'natter'), { recursive: true });
      fs.writeFileSync(
        path.join(home, 'app', 'natter', 'relays.json'),
        JSON.stringify((urls || ['http://relay']).map(function (u) {
          return { label: 'lab', url: u };
        }), null, 2)
      );
      return home;
    },

    // Shortcuts for the things every suite signs, so a test reads as
    // what it is checking rather than as key handling.
    sign: {
      claim: function (name) {
        const who = cast[name] || { id: owner, label: s.owner };
        return auth.sign(who.id.privateKey, auth.claimMessage(who.label));
      },
      inbox: function (name, token) {
        const who = cast[name] || { id: owner, label: s.owner };
        return auth.sign(who.id.privateKey, auth.inboxMessage(token || who.label));
      },
      stream: function (name) {
        const who = cast[name] || { id: owner, label: s.owner };
        return auth.sign(who.id.privateKey, auth.streamMessage(who.id.publicKey));
      },
      deviceTake: function (name) {
        const who = cast[name] || { id: owner, label: s.owner };
        return auth.sign(who.id.privateKey, deviceAuth.deviceTakeMessage(who.label));
      },
    },
  };
}

module.exports = { build: build, tmpHome: tmpHome };
