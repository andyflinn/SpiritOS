'use strict';

// spirit/run/js/verbTable.js
// What the loopback client door can be asked, and who answers it.
//
//   Andy: "I think the modules handling various requests, should register
//   then as a group of interfaces to the api dispatch, so that the API
//   dispatch can route them based on what the handlers registered... the
//   alterations to the api would be made in a way that no longer needs to
//   touch tedious things like matching every post type with who might
//   handle it?"
//
// ── WHY THIS IS NOT A TABLE IN server.js ─────────────────────────────
//
// It was, for about an hour. `LOOPBACK_VERBS` held one entry and would
// have held nineteen by the time /api/hub folded — nineteen lines whose
// only content is "this verb belongs to that function", which is a fact
// the module implementing it already knows.
//
// That is the same tedium the four post-path doors were: a thing said in
// two places, kept in step by remembering. The shell has had the better
// shape all along — `registerApp`, where an app declares itself and the
// shell enumerates nothing.
//
// So server.js gains ONE line per module rather than one per verb, and a
// verb added later touches only the file that answers it.
//
// ── CLAIM, NOT REGISTER ──────────────────────────────────────────────
//
//   Andy: "claim, not register: i agree."
//
// A namespace is OWNED. `fs.*` is the fs module's and nobody else's, and
// that turns two mistakes into loud ones:
//
//   COLLISION — two modules claiming `fs.save` is a crash at boot, not
//     last-wins. Silent shadowing is real here: `unknownPolicy` appeared
//     twice in one object literal in hub.js and nothing said a word.
//
//   OUT OF NAMESPACE — a module that claims `fs` may not answer
//     `peer.post`. That is what keeps "which side of this node does the
//     verb live on" readable IN THE VERB, and enforced rather than a
//     naming convention somebody follows.
//
// ── CLAIMED AFTER BOOT ───────────────────────────────────────────────
//
//   Andy: "registration after boot. it avoids dependency messes."
//
// The alternative — modules self-registering when required — makes load
// order load-bearing and invisible, which this tree has already been
// bitten by (index.html carries a comment about chatLog.js needing
// peerFile.js first). And `handlePost`'s deps, peerRouter and presence,
// are built at the FOOT of server.js: a module claiming at require time
// would be claiming before the things it needs exist. That is the same
// shape as the ReferenceError that killed the node on its first mint.
//
// So claims happen where the deps do, and the door is only reachable
// after `listen`.

function createVerbTable() {
  var owner = Object.create(null);   // namespace -> who claimed it
  var answer = Object.create(null);  // 'ns.verb' -> handler

  var NAMESPACE_RE = /^[a-z][a-z0-9]*$/;
  var VERB_RE = /^[a-z][a-z0-9]*\.[a-z][a-zA-Z0-9]*$/;

  // `by` is the claimant's own name, and it is not decoration: when a
  // collision is reported, "fs.save is claimed by jobs and by fs" names
  // the two files to look in.
  function claim(namespace, by, group) {
    var ns = String(namespace || '');
    if (!NAMESPACE_RE.test(ns)) {
      throw new Error('verbTable: bad namespace ' + JSON.stringify(namespace));
    }
    if (owner[ns]) {
      throw new Error('verbTable: namespace ' + ns + ' already claimed by ' + owner[ns]);
    }
    if (!group || typeof group !== 'object') {
      throw new Error('verbTable: ' + ns + ' claimed nothing');
    }

    Object.keys(group).forEach(function (verb) {
      if (!VERB_RE.test(verb)) {
        throw new Error('verbTable: ' + by + ' offered a malformed verb ' + JSON.stringify(verb));
      }
      if (verb.slice(0, ns.length + 1) !== ns + '.') {
        throw new Error('verbTable: ' + by + ' claimed ' + ns +
          ' but offered ' + verb + ' — a module answers in its own namespace');
      }
      if (typeof group[verb] !== 'function') {
        throw new Error('verbTable: ' + verb + ' is not a function');
      }
      // Cannot happen while namespaces are exclusive, and asserted
      // anyway: it is the check that stops being redundant the day
      // somebody adds a second way to claim.
      if (answer[verb]) {
        throw new Error('verbTable: ' + verb + ' already answered by ' + owner[ns]);
      }
      answer[verb] = group[verb];
    });

    owner[ns] = String(by || ns);
    return true;
  }

  // Null for anything unclaimed, so the door reports "no such verb"
  // rather than this deciding what a refusal looks like. A table says
  // who answers; it does not speak HTTP.
  function handlerFor(verb) {
    var name = String(verb || '');
    return Object.prototype.hasOwnProperty.call(answer, name) ? answer[name] : null;
  }

  // Everything claimed, sorted. For a test to assert against, and for a
  // client to be told what this node can do — which is the beginning of
  // the answer to "what is the API", asked of the node rather than of a
  // document that goes stale.
  function verbs() {
    return Object.keys(answer).sort();
  }

  function namespaces() {
    return Object.keys(owner).sort().map(function (ns) {
      return { namespace: ns, by: owner[ns] };
    });
  }

  return {
    claim: claim,
    handlerFor: handlerFor,
    verbs: verbs,
    namespaces: namespaces,
  };
}

module.exports = { createVerbTable: createVerbTable };
