'use strict';

// spirit/run/js/faceRoute.js
// WHERE A FACE NAME LIVES — public-app-server/G17, THE ROUTE.
//
//   Andy, 2026-09-27, in Desk under G17, "go.": the face domain one level
//   down, and "so the owner.node.ID is the boot-route, for every other name
//   segment". The owner node, asked by its puppet, answers where a name
//   lives, "like an HTTP redirect then the node gives the puppet a signed
//   reply, allowing the appFaceApp to cache that route in RAM for future
//   use", and "at restart, the dance starts anew".
//
// Two pure pieces, no I/O, so each is driven by a test and not by a lab:
//
//   nameOf(host, faceDomain)        which name a visitor asked for
//   createRouteCache(opts)          the puppet's memory of the owner's answers
//
// NO TEST HELPERS IN THE NODE (goal/G19.10). Andy, 2026-10-12: "there shall
// be no test helpers inside node." answerRoute (the owner signing a route)
// and routeIsSigned (the holding node's check on one) had no caller but
// spirit/test/faceRouteSuite.js, so they live there now. Signed routes stay
// readable by the cache, through routeMessage below, for the day a node signs
// them; that day the signer and the holder's check come back as code with a
// caller.
//
// ── WHAT A SIGNATURE HERE PROVES ──────────────────────────────────────
//
// The reply packet carrying a route is already signed by the owner node,
// as every packet is, and the puppet takes it only from its owner's key
// and only as the answer to its own question (ownerPost's rule). The route
// ALSO carries a signature of its own, because it travels on: the puppet
// forwards it with each visitor's request, so the slot's owner can check,
// without asking anyone, that the owner node sent this face to it.
// Prefixed 'face-route' like relayAuth's messages, so a signature made
// for a route can never be replayed as anything else.

// The name a host asks for, or null. 'join.face.spirit.x' with face domain
// 'face.spirit.x' is 'join'. One label only: a wildcard certificate covers
// one label (PUPPETS.md §10), so 'a.b.face.spirit.x' is no name. The bare
// face domain is no name either: no grant has an empty one.
function nameOf(host, faceDomain) {
  var h = String(host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  var d = String(faceDomain || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h || !d) return null;
  var suffix = '.' + d;
  if (h.length <= suffix.length || h.slice(h.length - suffix.length) !== suffix) return null;
  var label = h.slice(0, h.length - suffix.length);
  return faceLabel(label);
}

// ONE FACE NAME BY THE RULE THE HOST PARSER USES, and the one a relay accepts when a member applies for it
// (goal/G30.1): a single DNS label, a-z 0-9 and hyphen, at most 63, lowercased, else null. andy and Andy are one name.
function faceLabel(name) {
  var l = String(name == null ? '' : name).trim().toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l) ? l : null;
}

// An hour: a name taken back stops routing within it. A "no such route"
// is kept a minute, so an unknown name cannot make the puppet ask on
// every hit.
var ROUTE_MS = 60 * 60 * 1000;
var NONE_MS = 60 * 1000;

// The face's own key is signed in too (wsl-claude): a route is good only
// in the hands of the puppet it was given to, so a copy drives nothing.
function routeMessage(ownerKey, name, to, until, faceKey) {
  var NL = String.fromCharCode(10);
  return 'face-route' + NL + String(ownerKey || '') + NL + String(name || '') + NL +
    String(to || '') + NL + String(Number(until) || 0) + NL + String(faceKey || '');
}

// The cache's question of a signed route: did the owner sign exactly this?
// Signature only; the face that holds the cache is the one the route was
// given to, so it has no "is it for me" to ask (wsl-claude).
function routeSignatureHolds(route, ownerKey, verify) {
  if (!route || route.route !== 'to' || !route.sig) return false;
  try { return !!verify(ownerKey, routeMessage(ownerKey, route.name, route.to, route.until, route.face), route.sig); }
  catch (e) { return false; }
}

// ── THE PUPPET'S MEMORY OF ROUTES, IN RAM ────────────────────────────
//
// opts: { ownerKey, verify(publicKey, message, sig), now() }.
//   take(answer, fromKey, re, askedHash)  an arrival that may be a route
//   lookup(name)                          { to, route } | { none } | null
//   drop(name)                            the target refused: ask again
// Nothing is written anywhere, so a restart forgets every route.
function createRouteCache(opts) {
  var o = opts || {};
  var now = typeof o.now === 'function' ? o.now : function () { return Date.now(); };
  var held = Object.create(null);

  // `storeAs`: the key to remember it by. The VPS never knows names, only
  // hosts ("the VPS matches nothing"), so it keeps a route under the host it
  // asked about; the signature still covers the name inside the answer.
  function take(answer, fromKey, re, askedHash, storeAs) {
    // ONLY THE OWNER'S ANSWER TO THIS QUESTION COUNTS (wsl-claude): any
    // other node could otherwise pull a name's visitors to itself.
    if (!answer || !o.ownerKey || fromKey !== o.ownerKey) return false;
    if (!askedHash || re !== askedHash) return false;
    var name = String(storeAs || answer.name || '');
    if (!name) return false;
    if (answer.route === 'none') { held[name] = { none: true, until: now() + NONE_MS }; return true; }
    if (answer.route === 'mine') { held[name] = { mine: true, until: now() + ROUTE_MS }; return true; }
    // THE OWNER'S PLAIN ANSWER, "the owner of this name is <key>" (Andy:
    // "the owner, of appFaceApp simple responds with the key of the
    // subdomain owner, or an error"). Taken on the owner's word and the
    // question's hash; the face forwards there whoever it is, and the
    // receiving node decides whether to trust a visitor.
    if (answer.route === 'owner') {
      if (!answer.to) return false;
      held[name] = { to: String(answer.to), route: answer, until: now() + ROUTE_MS };
      return true;
    }
    if (answer.route !== 'to' || !routeSignatureHolds(answer, o.ownerKey, o.verify)) return false;
    // Never longer than an hour from now, whatever the answer claims.
    var until = Math.min(Number(answer.until) || 0, now() + ROUTE_MS);
    if (until <= now()) return false;
    held[name] = { to: answer.to, route: answer, until: until };
    return true;
  }

  function lookup(name) {
    var h = held[String(name || '')];
    if (!h) return null;
    if (h.until <= now()) { delete held[String(name || '')]; return null; }
    if (h.none) return { none: true };
    if (h.mine) return { mine: true };
    return { to: h.to, route: h.route };
  }

  function drop(name) { delete held[String(name || '')]; }

  return { take: take, lookup: lookup, drop: drop };
}

module.exports = {
  nameOf: nameOf, faceLabel: faceLabel,
  createRouteCache: createRouteCache, ROUTE_MS: ROUTE_MS, NONE_MS: NONE_MS,
};
