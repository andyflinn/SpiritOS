'use strict';

// spirit/test/scenario.js
// One vocabulary for describing a world, read by two builders.
//
// Andy: "a scenario is a scenario, a test is a test within a scenario. I
// can visually run 1/1000 of the number of tests you can run
// automatically, but we both can use the same scenario."
//
// So the DESCRIPTION is shared and the BUILDING is not:
//
//   world.js      builds it in process, in milliseconds, and a suite
//                 runs hundreds of variations through it
//   labWorld.js   builds it as real processes on real ports, once, so a
//                 person can look at it
//
// Neither knows about the other. What they share is this file, which is
// why a scenario a suite explores and a scenario Andy looks at cannot
// mean two different things.
//
// This module builds nothing. It normalises and it complains.

// The whole vocabulary. Anything outside it is refused rather than
// ignored, because a field somebody added in good faith that silently
// does nothing is worse than an error.
const TOP = [
  'title', 'why', 'covers', 'look',   // documentation, for the visual side
  'relays', 'owner', 'peers', 'knows', 'messages', 'then',
];
const PEER = ['name', 'label', 'on', 'running', 'expect'];
const MESSAGE = ['from', 'to', 'text'];
const THEN = ['remove', 'from', 'why'];

// `lab` is the relay a world always has. `live` names the real one and
// exists only for the visual builder — in process there is nothing live
// to join, so peers that name it simply land on the lab relay.
const DEFAULT_RELAYS = ['lab'];
const LIVE = 'live';

// THE TWO WORLDS ALMOST EVERY SUITE STARTS FROM. Written here once
// because they were being written out by hand in a dozen files, and a
// setup copied a dozen times is a setup that has already drifted: some
// saved the owner's key to disk and some did not, some claimed with an
// IP and some without.
//
// A suite needing anything else writes its own literal — that is a
// scenario too, and it is one line.
const OWNER_ONLY = {
  title: 'An owner alone with a relay',
  why: 'The world the device arc happens in. A device is not a peer: it is a second key on the owner\'s one row.',
  peers: [],
};

// `owner: null` is not an incomplete world. It is the state every relay
// is in before anybody claims it, and it is the only world in which the
// act of claiming can be watched happening.
const UNCLAIMED = {
  title: 'A relay nobody has claimed',
  why: 'Where first-run and invite-redemption live. The claim under test must be the first one the box has seen.',
  owner: null,
  peers: [],
};

function unknown(obj, allowed) {
  return Object.keys(obj || {}).filter(function (k) { return allowed.indexOf(k) === -1; });
}

// Fills in what a scenario left unsaid, so every builder starts from the
// same complete picture rather than each inventing its own defaults.
function normalize(input) {
  const doc = input || {};
  const relays = (doc.relays && doc.relays.length ? doc.relays : DEFAULT_RELAYS).slice();

  const peers = (doc.peers || []).map(function (p) {
    const peer = typeof p === 'string' ? { name: p } : (p || {});
    return {
      name: peer.name,
      // A display label that is NOT the name is how two peers wear one
      // label with two keys — "two johns is still two keys", which is
      // the case the device and router work turns on.
      label: peer.label || peer.name,
      on: (peer.on && peer.on.length ? peer.on : [relays[0]]).slice(),
      running: peer.running !== false,
      expect: peer.expect || '',
    };
  });

  return {
    title: doc.title || '',
    why: doc.why || '',
    covers: (doc.covers || []).slice(),
    look: (doc.look || []).slice(),
    relays: relays,
    // `null` means nobody has claimed yet — the first-run case, which is
    // a world in its own right and not an incomplete one.
    owner: doc.owner === null ? null : (doc.owner || 'andy'),
    peers: peers,
    knows: (doc.knows || []).map(function (pair) { return (pair || []).slice(); }),
    messages: (doc.messages || []).map(function (m) {
      return { from: m.from, to: m.to || null, text: m.text || '' };
    }),
    then: (doc.then || []).map(function (step) {
      return { remove: step.remove, from: step.from || 'lab', why: step.why || '' };
    }),
  };
}

// Every complaint, not the first one — a scenario with three mistakes
// should cost one reading rather than three.
function problems(input) {
  const found = [];
  const doc = input || {};

  unknown(doc, TOP).forEach(function (k) { found.push('unknown field `' + k + '`'); });

  const s = normalize(doc);
  const names = [];

  s.peers.forEach(function (p) {
    const raw = (doc.peers || []).filter(function (x) {
      return x && (x.name === p.name || x === p.name);
    })[0];
    if (raw && typeof raw === 'object') {
      unknown(raw, PEER).forEach(function (k) {
        found.push('peer `' + p.name + '` has unknown field `' + k + '`');
      });
    }
    if (!p.name) found.push('a peer has no name');
    else if (names.indexOf(p.name) !== -1) found.push('two peers named `' + p.name + '`');
    names.push(p.name);
    if (!p.on.length) found.push('`' + p.name + '` is on no relay');
    p.on.forEach(function (r) {
      if (r !== LIVE && s.relays.indexOf(r) === -1) {
        found.push('`' + p.name + '` is on unknown relay `' + r + '`');
      }
    });
  });

  // Everyone named anywhere has to be somebody the world contains.
  // A scenario that greets a stranger is one that has been edited in one
  // place and not another.
  s.knows.forEach(function (pair) {
    if (pair.length !== 2) found.push('`knows` wants pairs, got ' + JSON.stringify(pair));
    pair.forEach(function (n) {
      if (names.indexOf(n) === -1) found.push('`knows` names a stranger: `' + n + '`');
    });
  });

  (doc.messages || []).forEach(function (m) {
    unknown(m, MESSAGE).forEach(function (k) {
      found.push('a message has unknown field `' + k + '`');
    });
  });
  s.messages.forEach(function (m) {
    if (names.indexOf(m.from) === -1) found.push('a message is from a stranger: `' + m.from + '`');
    if (m.to && names.indexOf(m.to) === -1 && m.to !== s.owner) {
      found.push('a message is to a stranger: `' + m.to + '`');
    }
  });

  (doc.then || []).forEach(function (step) {
    unknown(step, THEN).forEach(function (k) {
      found.push('a `then` step has unknown field `' + k + '`');
    });
  });
  s.then.forEach(function (step) {
    if (names.indexOf(step.remove) === -1) {
      found.push('`then` removes a stranger: `' + step.remove + '`');
    }
    if (step.from !== LIVE && s.relays.indexOf(step.from) === -1) {
      found.push('`then` removes from unknown relay `' + step.from + '`');
    }
  });

  return found;
}

function valid(input) {
  return problems(input).length === 0;
}

// The extra things a scenario owes only because somebody is going to LOOK
// at it. Kept apart from problems() deliberately: a world with an owner,
// a device and nobody else is perfectly well-formed — it is the world the
// whole device arc happens in — and the fast builder must be able to make
// it. It is just not worth spawning four processes to stare at.
//
// So the grammar is one question and the exhibit is another, and only
// visualScenarios.js asks the second.
function exhibitProblems(input) {
  const found = [];
  const doc = input || {};
  const s = normalize(doc);

  if (!doc.title) found.push('no title');
  if (!doc.why) found.push('no reason given');
  if (!s.look.length) found.push('nothing named to look at');
  if (!s.covers.length) found.push('covers no suite');
  if (!s.peers.length) found.push('no peers, so there is nothing to see');

  return found;
}

module.exports = {
  normalize: normalize,
  problems: problems,
  exhibitProblems: exhibitProblems,
  valid: valid,
  OWNER_ONLY: OWNER_ONLY,
  UNCLAIMED: UNCLAIMED,
  TOP: TOP,
  PEER: PEER,
  LIVE: LIVE,
  DEFAULT_RELAYS: DEFAULT_RELAYS,
};
