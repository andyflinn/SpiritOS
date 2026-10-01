'use strict';

// spirit/run/js/apiDoor.js
// A MEMBER ASKS THE NODE FOR 'api' — appPair/G1.3.
//
//   Andy, 2026-09-28: "peerPost is the wire to the api introspection", and
//   his yes on the verb itself, "yes to all of wsl points" (Desk, appPair/G1:
//   the node's 'api' verb over peerPost). A NEW NODE VERB: changing it needs
//   peer review and his yes again (CLAUDE.md, "You do not").
//
// An arrivals witness, as puppetDoor and appFaceApp are: it reads packets
// of app 'api' only, so app-less ones stay puppetDoor's. The body is 'api'
// or {app: {verb: {args}}} (D10); the node's appClient answers it
// (appClient.ask), and the answer goes back to the asker as a packet of app
// 'api' that answers the ask's hash, flat, exactly as it came (D11).
//
// ONLY A KNOWN SENDER IS ANSWERED. The front door admits a stranger when
// the node's policy is 'acquire' (hub.frontDoor), and that admission does
// not reach here: Andy, "why not just an exemption for aquire?". So isKnown
// is the front door's 'known' alone, and a stranger gets no reply at all.
//
// THE GATE (apiAuth/G1.2) is the layer appPair D5 deferred, landed here.
//   Andy: "apiAuth will enforce an active consent scheme: denial is the
//   absence of authorization", "authorization may happen on an app basis,
//   (ID<>app) or a verb basis (ID<>app.verb)", "even an api-call will be
//   rejected", "Where: apiDoor", "no special treatment for you guys!".
// createApiDoor takes opts.auth = { pathsOf(key) } (G1.3's table, read
// through G1.4's module; it throws when the store cannot be read), and a
// member's every ask is decided by it. No auth handed means no grants
// readable: the member reads as denied, never as ungated.

// DEBUG and DEPENDENCIES are the owner's on every server (Andy, desk/G2.5:
// "DEBUG verb is never allowed through peerPost()"; apiAuth/G1.10:
// DEPENDENCIES owner-only "like DEBUG"), granted or not.
const OWNER_VERBS = ['DEBUG', 'DEPENDENCIES'];

function refusal(code, error) {
  return { status: 403, body: { ok: false, code: code, error: error } };
}

// A member's api is the tree stripped to its grants (Andy: "apiAuth will
// strip the app.DEBUG verb the result of returned api trees, including all
// branches of the tree that don't have a match for the calling ID"): a
// granted app keeps its verbs but the owner's two; a granted verb keeps
// that verb alone. Exact strings, no prefix, no case folding.
function stripTree(tree, paths) {
  const kept = {};
  Object.keys(tree || {}).forEach(function (app) {
    const verbs = tree[app];
    if (!verbs || typeof verbs !== 'object') return;
    const whole = paths.indexOf(app) !== -1;
    Object.keys(verbs).forEach(function (verb) {
      if (OWNER_VERBS.indexOf(verb) !== -1) return;
      if (whole || paths.indexOf(app + '.' + verb) !== -1) {
        (kept[app] = kept[app] || {})[verb] = verbs[verb];
      }
    });
  });
  return kept;
}

// THE ONE WAY IN (desk/G1 D4): a member's packet here and the local shell's
// jobs.api on the loopback door both end in this, so the gate has one place
// to live. caller is { owner: true } for loopback and puppeteering (jobs.api
// passes it; a missing caller counts as the owner — Andy: "a call from your
// own machine counts as you"), else { key, auth } for a member.
function answer(servers, ask, caller) {
  const c = caller || { owner: true };
  // The caller rides on to the servers (apiAuth/G1.13): the owner as
  // handed (jobs.api gives his mark, key and name), a member as its
  // verified key with the label the auth table holds for it — never the
  // auth handle, which is the gate's own and no server's business.
  if (c.owner === true) {
    const own = { owner: true };
    if (typeof c.key === 'string' && c.key) own.key = c.key;
    if (typeof c.label === 'string' && c.label) own.label = c.label;
    return Promise.resolve(servers.ask(ask, own));
  }
  const who = { key: c.key };
  try {
    if (c.auth && typeof c.auth.labelOf === 'function') {
      const label = c.auth.labelOf(c.key);
      if (typeof label === 'string' && label) who.label = label;
    }
  } catch (e) { /* an unreadable label is no label; the key stands alone */ }
  let paths = null;
  try {
    paths = (c.auth && typeof c.auth.pathsOf === 'function') ? (c.auth.pathsOf(c.key) || []) : [];
  } catch (e) {
    // The gate fails closed: grants it cannot read grant nothing.
    return Promise.resolve(refusal('store-unavailable', 'the grants cannot be read: ' + e.message));
  }
  if (ask === 'api') {
    if (!paths.length) return Promise.resolve(refusal('not-granted', 'no path is granted to this key'));
    return Promise.resolve(servers.ask('api', who)).then(function (r) {
      const kept = stripTree(r && r.body, paths);
      if (!Object.keys(kept).length) return refusal('not-granted', 'no granted path is served');
      return { status: 200, body: kept };
    });
  }
  // A call runs only when its app or its exact app.verb is granted; a
  // granted app's missing verb is the server's to answer, never the gate's.
  const apps = (ask && typeof ask === 'object' && !Array.isArray(ask)) ? Object.keys(ask) : [];
  let named = 0;
  for (const app of apps) {
    const verbs = ask[app];
    if (!verbs || typeof verbs !== 'object') return Promise.resolve(refusal('not-granted', String(app) + ' asks nothing grantable'));
    for (const verb of Object.keys(verbs)) {
      named += 1;
      if (paths.indexOf(app) === -1 && paths.indexOf(app + '.' + verb) === -1) {
        return Promise.resolve(refusal('not-granted', app + '.' + verb + ' is not granted to this key'));
      }
    }
  }
  if (!named) return Promise.resolve(refusal('not-granted', 'the ask names no app.verb'));
  return Promise.resolve(servers.ask(ask, who));
}

// opts: { servers: {ask}, post(relay, toKey, text), encode, decode, isKnown(key), auth: {pathsOf(key)}, log }
function asksOwnerVerb(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.keys(body).some(function (app) {
    const v = body[app];
    return v && typeof v === 'object' && OWNER_VERBS.some(function (verb) {
      return Object.prototype.hasOwnProperty.call(v, verb);
    });
  });
}

// A write that names its author as 'andy', the owner's name in the desk server's
// `by` (desk/G2.1). The server cannot see who asks, so a member must not say it.
function asksAsOwner(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  return Object.keys(body).some(function (app) {
    const v = body[app];
    return v && typeof v === 'object' && Object.keys(v).some(function (verb) {
      const args = v[verb];
      return args && typeof args === 'object' && args.by === 'andy';
    });
  });
}

function createApiDoor(opts) {
  const o = opts || {};
  const say = o.log || function () {};

  function reply(message, answer, kind) {
    let made = o.encode('api', answer, { re: message.hash });
    // Too big for a packet is said, never dropped, as puppetDoor does.
    if (!made || !made.text) {
      made = o.encode('api', { ok: false, code: 'answer-too-large', error: 'answer too large for a packet' }, { re: message.hash });
      if (!made || !made.text) return Promise.resolve();
    }
    // A server that marked its answer background has it posted so, the word
    // the queue already ranks by (fileTransfer goal/G1.3; Andy: "same for
    // responses."). Nothing new travels between peers.
    const how = kind === 'background' ? { kind: 'background' } : undefined;
    return Promise.resolve(o.post(message.relay || '', message.fromKey, made.text, how)).catch(function (e) {
      say('api door: the answer to ' + String(message.hash).slice(0, 8) + ' could not be sent: ' + e.message);
    });
  }

  return function (message) {
    if (!message || typeof message.text !== 'string') return;
    let info = null;
    try { info = o.decode(message.text); } catch (e) { info = null; }
    if (!info || info.app !== 'api') return;
    // AN ANSWER IS NEVER ASKED. A packet carrying 're' is a reply, and
    // answering it made two nodes (or one asking itself) answer each other
    // forever, about 9 a second (wsl-claude's hand check on a857b52).
    if (info.re) return;
    if (!o.isKnown(message.fromKey)) return;
    // 'DEBUG verb is never allowed through peerPost()' (Andy, desk/G2.5), and DEPENDENCIES with it
    // (apiAuth/G1.10, owner-only "like DEBUG"): a member's ask for either on any server is refused
    // here, by name, granted or not, and never passed on. jobs.api (answer) still reaches them.
    if (asksOwnerVerb(info.body)) return reply(message, { ok: false, code: 'not-owner', error: 'DEBUG and DEPENDENCIES are for the owner, on loopback only' });
    // Andy's presses come by jobs.api; a member writing as him is refused, never passed on.
    if (asksAsOwner(info.body)) return reply(message, { ok: false, code: 'not-owner', error: 'a member cannot write as the owner' });
    return answer(o.servers, info.body, { key: message.fromKey, auth: o.auth }).then(function (r) {
      return reply(message, r ? r.body : null, r && r.kind);
    }, function (e) {
      say('api door: ' + e.message);
    });
  };
}

module.exports = { createApiDoor: createApiDoor, answer: answer };
