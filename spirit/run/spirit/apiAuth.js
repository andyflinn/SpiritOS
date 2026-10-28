'use strict';

// spirit/run/spirit/apiAuth.js
// WHO MAY CALL WHICH API: the owner's allow-table and the verbs that keep it (apiAuth/G1.3, G1.4).
//
//   Andy: "apiAuth will enforce an active consent scheme: denial is the absence of authorization. only
//   authorization is stored", "it will know absolutely nothing about faces, or apps, or grantFace, it will only
//   only now how to grant peerPost() access to an api-tree, based on a lookup table that matches caller ID's with
//   paths in the api tree", and on the verbs (their own node family, auth, since goal/G30.6: "move auth stuff into
//   its own node family."), "approved
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

const PATH = /^[A-Za-z][A-Za-z0-9_-]*(\.[A-Za-z0-9_.-]+)?$/;
const refuse = function (code) { return { refusal: code }; };
const text = function (v) { return typeof v === 'string' && v !== ''; };

// THE BUNDLES (goal/G41.13; Andy, box v7): "A bundle is a clearly defined subset of an API, with no user, process or
// agent tied to it", keyed "by an ID in the shadow roll's form, generated when the row is added", its paths "rows of
// their own, grouped by the bundle's ID". Its row is nodeStore's (bundles); its paths are bundle_paths (bundle_id,
// path), the grants' shape, through the one interface to such a table (authTableInterface.js). A BUNDLE IS NOT GRANTED
// BY REFERENCE (Andy, box v7): the grants app copies its paths, one auth.grant per path, so nothing here touches a grant.
const authTable = require('./authTableInterface');
const { generateIdentity } = require('./relayAuth');
const BUNDLE_OPS = ['add', 'set', 'delete', 'get', 'search'];

function createApiAuth(opts) {
  const o = opts || {};
  const rootDir = o.rootDir;
  // The live tree, to tell a served path: (appClient.ask('api')).body. Only grant needs it.
  const servedTree = typeof o.tree === 'function' ? o.tree : function () { return Promise.resolve({}); };
  const store = function () { return nodeStore.open(rootDir).auth; };
  // The bundle rows, and their paths, opened once in node.db beside them (the store opens node.db first).
  let paths = null;
  function bundles() { return nodeStore.open(rootDir).bundles; }
  function bundlePaths() { if (!paths) { bundles(); paths = authTable.open(nodeStore.dbPath(rootDir), 'bundle_paths', 'bundle_id'); } return paths; }
  // A bundle as get answers it, and as a search item's label carries it.
  function shown(row) { return { id: row.id, label: row.label, description: row.description, paths: bundlePaths().paths(row.id) }; }
  // The paths a bundle may hold, as a grant may: each a family or family.verb, never the owner's fs family. '' when
  // they pass, else the refusal's code.
  function pathsWhy(list) {
    if (!Array.isArray(list) || !list.every(function (p) { return typeof p === 'string'; })) return 'bad-request';
    if (list.some(function (p) { return !PATH.test(p); })) return 'not-a-path';
    if (list.some(function (p) { return p.split('.')[0] === 'fs'; })) return 'owner-only';
    return '';
  }
  function setPaths(id, list) {
    const t = bundlePaths();
    t.paths(id).forEach(function (p) { t.revoke(id, p); });
    list.forEach(function (p) { t.grant(id, p); });
  }

  // A path the live tree serves: its app answered a tree, and the verb, if one is named, is in it.
  function served(tree, p) {
    const dot = p.indexOf('.');
    const app = dot === -1 ? p : p.slice(0, dot);
    const branch = tree && tree[app];
    if (!branch || typeof branch !== 'object' || branch.ok === false) return false;
    return dot === -1 || Object.prototype.hasOwnProperty.call(branch, p.slice(dot + 1));
  }
  // The label at grant time: his contacts' name for the key, else none. No key's tail stands in for a name (Andy,
  // 2026-10-24, goal/G40.1: "we don't show the fucking tail anywhere anymore.").
  function labelFor(key) {
    let row = null;
    try { row = contacts.byPublicKey(rootDir, key); } catch (e) { row = null; }
    return row && row.myLabel ? String(row.myLabel) : '';
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
      // THE fs FAMILY IS THE OWNER'S (goal/G33.10, Andy: "i want fs to be hard-coded owner only"): never granted.
      if (a.path.split('.')[0] === 'fs') return Promise.resolve(refuse('owner-only'));
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

    // THE BUNDLE VERB (goal/G41.13; Andy, box v7: "one verb under the auth family, auth.bundle, akin to the <tableName>
    // verbs of the agent app: op add, set, delete, get and search. Granted, no review."), flat as those are:
    //   add {label, description, paths}  answers { id }, a new key set's public key
    //   set {id, ...}                    changes what it names and keeps the rest; paths replaces the whole list
    //   delete {id}                      removes the bundle and its paths; answers { id }
    //   get {id}                         answers { id, label, description, paths }
    //   search {text}                    answers { items, more }, each keyed by the bundle's id, its label the bundle as
    //                                    get shows it, best first; no words is every bundle
    bundle: function (a) {
      const op = a && a.op;
      if (BUNDLE_OPS.indexOf(op) === -1) return refuse('bad-request');
      const B = bundles();
      if (op === 'add') {
        const why = pathsWhy(a.paths === undefined ? [] : a.paths);
        if (why) return refuse(why);
        const id = generateIdentity('').publicKey;
        B.add(id, a.label, a.description);
        setPaths(id, a.paths || []);
        return { id: id };
      }
      if (op === 'search') {
        if (a.text !== undefined && typeof a.text !== 'string') return refuse('bad-request');
        const words = String(a.text || '').trim();
        const bucket = createProbabilityBucket(Infinity);
        let i = 0;
        for (const r of B.all()) {
          i += 1;
          const row = shown(r);
          const score = words ? probabilityStringObjectMatch(words, { label: row.label, description: row.description, paths: row.paths.join(' ').split('.').join(' ') }) : 0;
          if (words && !(score > 0)) continue;
          bucket.seatFor(words ? score * (1 - 1e-9) + 1e-9 / (1 + i) : 1 / (1 + i), { key: row.id, label: JSON.stringify(row) });
        }
        const res = bucket.serialize(null, SEARCH_ROOM);
        return { items: res.items, more: !!res.more };
      }
      if (!text(a.id)) return refuse('bad-request');
      const was = B.get(a.id);
      if (!was) return refuse('no-such-bundle');
      if (op === 'get') return shown(was);
      if (op === 'delete') {
        setPaths(a.id, []);
        B.del(a.id);
        return { id: a.id };
      }
      // set: what it names, the rest kept.
      if (a.paths !== undefined) { const why = pathsWhy(a.paths); if (why) return refuse(why); }
      B.set(a.id, a.label !== undefined ? a.label : was.label, a.description !== undefined ? a.description : was.description);
      if (a.paths !== undefined) setPaths(a.id, a.paths);
      return { id: a.id };
    },
  };
}

module.exports = { createApiAuth: createApiAuth, PATH: PATH };
