'use strict';

// spirit/run/js/apiAuth.js
// WHO MAY CALL WHICH API: the owner's allow-table and the verbs that keep it (apiAuth/G1.3, G1.4).
//
//   Andy: "apiAuth will enforce an active consent scheme: denial is the absence of authorization. only
//   authorization is stored", "it will know absolutely nothing about faces, or apps, or grantFace, it will only
//   only now how to grant peerPost() access to an api-tree, based on a lookup table that matches caller ID's with
//   paths in the api tree", "jobs.auth supersedes: "api.auth, sibling to app names";", and on the verbs, "approved
//   with dropping label out of grant.input", "relabel is FINE verb.", "please fix the api, to be consistent with
//   your practices in terms of precise answer shapes."
//
// The rows are nodeStore's (node.db, peers and grants). A record is { key, label, path }; a path is 'app' or
// 'app.verb', matched exactly. Every verb answers an object or a refusal { refusal: code }; server.js turns the
// refusal into { ok: false, code, error } with the catalogue's status. Loopback only: jobs.* never travel.

const nodeStore = require('./nodeStore');
const contacts = require('./contacts');
const limits = require('./limits');
const probabilityStringObjectMatch = require('./probabilityStringObjectMatch').probabilityStringObjectMatch;
const createProbabilityBucket = require('./probabilityBucket').createProbabilityBucket;
// What one search answer may hold: the plaintext room, less its own frame.
const SEARCH_ROOM = limits.PLAINTEXT_MAX - Buffer.byteLength(JSON.stringify({ items: [], more: false }), 'utf8');
const keyTail = require('./kernel.js').keyTail;

const PATH = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_.-]+)?$/;
const refuse = function (code) { return { refusal: code }; };
const text = function (v) { return typeof v === 'string' && v !== ''; };

function createApiAuth(opts) {
  const o = opts || {};
  const rootDir = o.rootDir;
  // The live tree, to tell a served path: (appClient.ask('api')).body. Only grant needs it.
  const servedTree = typeof o.tree === 'function' ? o.tree : function () { return Promise.resolve({}); };
  const store = function () { return nodeStore.open(rootDir).auth; };

  // A path the live tree serves: its app answered a tree, and the verb, if one is named, is in it.
  function served(tree, p) {
    const dot = p.indexOf('.');
    const app = dot === -1 ? p : p.slice(0, dot);
    const branch = tree && tree[app];
    if (!branch || typeof branch !== 'object' || branch.ok === false) return false;
    return dot === -1 || Object.prototype.hasOwnProperty.call(branch, p.slice(dot + 1));
  }
  // The label at grant time: his contacts' name for the key, else the kernel's one cut (G1.11).
  function labelFor(key) {
    let row = null;
    try { row = contacts.byPublicKey(rootDir, key); } catch (e) { row = null; }
    return row && row.myLabel ? String(row.myLabel) : keyTail(key);
  }

  return {
    // THE GATE'S READ (G1.2): the paths granted to a key. Throws when node.db cannot be read; the gate fails closed.
    pathsOf: function (key) { return store().paths(key); },

    // THE DOOR'S LABEL (G1.13): the peers row's name for a key, forwarded
    // to the server beside it. null when the table knows no such peer.
    labelOf: function (key) { return store().label(key); },

    query: function (a) {
      if (!text(a.key) || !text(a.path)) return refuse('bad-request');
      return { allowed: store().has(a.key, a.path) };
    },

    // THE NEW SEARCH (goal/G29.7; Andy: "we're changing EVERYTHING to the new search one-by-one"): words ranked by
    // the probability modules over the peer's name and the words of the path, never the key, best first; no words is
    // every grant in the table's order. Each grant answers {key: key + newline + path, label: {name, key, path}},
    // bounded in bytes as every answer is.
    search: function (a) {
      if (typeof a.text !== 'string') return refuse('bad-request');
      const words = a.text.trim();
      const bucket = createProbabilityBucket(Infinity);
      let i = 0;
      for (const r of store().all()) {
        i += 1;
        const score = words ? probabilityStringObjectMatch(words, { name: r.label, path: r.path.split('.').join(' ') }) : 0;
        if (words && !(score > 0)) continue;
        bucket.seatFor(words ? score * (1 - 1e-9) + 1e-9 / (1 + i) : 1 / (1 + i),
          { key: r.key + '\n' + r.path, label: JSON.stringify({ name: r.label, key: r.key, path: r.path }) });
      }
      const res = bucket.serialize(null, SEARCH_ROOM);
      return { ok: true, items: res.items, more: !!res.more };
    },

    peer: function (a) {
      if (!text(a.key)) return refuse('bad-request');
      return { records: store().peer(a.key) };
    },

    grant: function (a) {
      if (!text(a.key) || !text(a.path)) return Promise.resolve(refuse('bad-request'));
      if (!PATH.test(a.path)) return Promise.resolve(refuse('not-a-path'));
      const s = store();
      if (s.has(a.key, a.path)) return Promise.resolve(refuse('already-granted'));
      // Andy: "only if the path is known from a previous configuration, where owner has not pruned yet", so that
      // "an owner [can] suspend/repair an appServer and return it with auth configuration intact".
      return Promise.resolve(servedTree()).then(function (tree) {
        if (!served(tree, a.path) && !s.knownPath(a.path)) return refuse('unknown-path');
        const label = s.label(a.key);
        const use = label === null ? labelFor(a.key) : label;
        s.grant(a.key, a.path, use);
        return { key: a.key, label: use, path: a.path };
      });
    },

    revoke: function (a) {
      if (!text(a.key) || !text(a.path)) return refuse('bad-request');
      return store().revoke(a.key, a.path) ? { revoked: true } : refuse('not-granted');
    },

    relabel: function (a) {
      if (!text(a.key) || !text(a.label)) return refuse('bad-request');
      return store().relabel(a.key, a.label) ? { key: a.key, label: a.label } : refuse('no-such-peer');
    },
  };
}

module.exports = { createApiAuth: createApiAuth, PATH: PATH };
