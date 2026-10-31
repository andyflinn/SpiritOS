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

const fs = require('fs');
const path = require('path');
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

// THE BUNDLES (goal/G41.14; Andy, box): "A bundle is a clearly defined subset of an API, with no ID (user, process or
// agent,....) tied to it", kept in TWO tables, nodeStore's: bundle (a hidden number, a label never empty) and branch (a
// number, the bundle it belongs to, a family, a verb or '' for all of it). "a bundle is a bundle, and in itself does
// not constitute an authorization": the grants app copies a bundle's branches into grants, so nothing here touches one.
// The two verbs are the owner's until he grants them (apiGate), as every auth verb is.
const BUNDLE_OPS = ['add', 'set', 'delete', 'get', 'search'];
const isId = function (v) { return typeof v === 'number' && Number.isInteger(v) && v > 0; };

function createApiAuth(opts) {
  const o = opts || {};
  const rootDir = o.rootDir;
  // The live tree, to tell a served path: (appClient.ask('api')).body. Only grant needs it.
  const servedTree = typeof o.tree === 'function' ? o.tree : function () { return Promise.resolve({}); };
  const store = function () { return nodeStore.open(rootDir).auth; };
  // The two bundle tables, nodeStore's.
  function bundles() { return nodeStore.open(rootDir).bundles; }
  function branches() { return nodeStore.open(rootDir).branches; }
  // EVERY CHANGE TOLD, ROW BY ROW (goal/G41.14): fn({ table, row }) for a row added or set, the row as get shows it, and
  // fn({ table, row: { id }, gone: true }) for one deleted; the node publishes them on its stream (server.js, the bundles
  // job). A grant is told the same way, table 'grant', its row { key, path, label }, gone with { key, path }. A refused
  // ask tells nothing.
  const listeners = [];
  function told(change) { listeners.forEach(function (fn) { try { fn(change); } catch (e) { /* one listener's fault */ } }); }
  // One search answer: rows ranked by the probability modules over their words, best first; no words is every row in
  // the table's order. Each item is keyed by the row's id, its label the row as get shows it.
  function ranked(rows, words, wordsOf) {
    const bucket = createProbabilityBucket(Infinity);
    rows.forEach(function (row, i) {
      const score = words ? probabilityStringObjectMatch(words, wordsOf(row)) : 0;
      if (words && !(score > 0)) return;
      bucket.seatFor(words ? score * (1 - 1e-9) + 1e-9 / (2 + i) : 1 / (2 + i), { key: String(row.id), label: JSON.stringify(row) });
    });
    const res = bucket.serialize(null, SEARCH_ROOM);
    return { items: res.items, more: !!res.more };
  }
  // A bundle's owner: "node", or an app server's name, a family's name; anything else is read as "node" (goal/G41.25).
  function ownerOf(v) { return typeof v === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(v) ? v : 'node'; }
  function owned(row) { return row ? { id: row.id, label: row.label, owner: ownerOf(row.owner) } : row; }
  // A branch's family and verb against the live tree (Andy, box: "MUST be validated against the nodes API tree when a
  // row is added or changed, and refused if the values are not valid"). '' when they pass, else the refusal's code.
  function branchWhy(family, verb) {
    return Promise.resolve(servedTree()).then(function (tree) {
      const branch = tree && tree[family];
      if (!branch || typeof branch !== 'object' || branch.ok === false) return 'no-such-family';
      if (verb !== '' && !Object.prototype.hasOwnProperty.call(branch, verb)) return 'no-such-verb';
      return '';
    });
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

  // EACH APPSERVER'S BUNDLES, WRITTEN AT THE NODE'S BOOT (goal/G41.24; Andy, box: "the apiAuth.js module, when the node
  // boots, will check for all valid \"process/js/<appServerName>/<appServerName>Bundles.json.\" files, and update the
  // auth.bundle and auth.branch ... always using/asserting the server <appServerName> as \"owner\""; "when the appServer is
  // booted, the loopback interface is not be alive/listening yet, It will write the to the tables directly"). Each key of
  // the file is one bundle, { label, branches: [{ family, verb }] }; relay-state/process/<appServerName>/bundles.json
  // keeps each key's bundle id and label, so a bundle is never added twice. A kept id whose row is gone, or no longer
  // the appServer's, is added again under the same key ("if a USER deletes a bundle owned by an Server, apiAuth.js it
  // will create a new bundle"); a key no longer in the file goes with all its branches ("apiAuth.js will delete that
  // key from auth.bundle AND all its rows in auth.branch"). A bundle the editor added for the appServer is kept under no
  // key, so it is never touched. No appServer runs yet, so its own verbs are not in the live tree: the branches are
  // written as the file says, unchecked.
  function bundleFile(app) {
    let got = null;
    try { got = JSON.parse(fs.readFileSync(path.join(rootDir, 'process', 'js', app, app + 'Bundles.json'), 'utf8')); } catch (e) { return null; }
    if (!got || typeof got !== 'object' || Array.isArray(got)) return null;
    const keys = Object.keys(got);
    const fine = keys.every(function (k) {
      const row = got[k];
      return row && typeof row === 'object' && text(row.label) && Array.isArray(row.branches) && row.branches.every(function (b) {
        return b && typeof b === 'object' && text(b.family) && (b.verb === undefined || typeof b.verb === 'string');
      });
    });
    return fine ? got : null;
  }
  function syncApp(app) {
    const file = bundleFile(app);
    if (!file) return;
    const dir = path.join(rootDir, 'relay-state', 'process', app);
    const statePath = path.join(dir, 'bundles.json');
    let kept = {};
    try { kept = JSON.parse(fs.readFileSync(statePath, 'utf8')) || {}; } catch (e) { kept = {}; }
    const B = bundles();
    const R = branches();
    const next = {};
    Object.keys(kept).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(file, k)) return;
      const was = kept[k] && B.get(kept[k].id);
      if (was && ownerOf(was.owner) === app) B.del(was.id);
    });
    Object.keys(file).forEach(function (k) {
      const row = file[k];
      const label = String(row.label);
      const at = kept[k] && B.get(kept[k].id);
      let id = at && ownerOf(at.owner) === app ? at.id : 0;
      if (!id) id = B.add(label, app);
      else if (at.label !== label) B.set(id, label);
      const want = row.branches.map(function (b) { return { family: String(b.family), verb: String(b.verb || '') }; });
      const have = R.all().filter(function (r) { return r.bundle === id; });
      have.forEach(function (r) {
        if (!want.some(function (w) { return w.family === r.family && w.verb === r.verb; })) R.del(r.id);
      });
      want.forEach(function (w) {
        if (!R.same(id, w.family, w.verb, 0)) R.add(id, w.family, w.verb);
      });
      next[k] = { id: id, label: label };
    });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(statePath, JSON.stringify(next, null, 2) + '\n');
  }
  if (rootDir) {
    let apps = [];
    try { apps = fs.readdirSync(path.join(rootDir, 'process', 'js')); } catch (e) { apps = []; }
    apps.filter(function (app) { return ownerOf(app) === app && app !== 'node'; }).forEach(function (app) {
      try { syncApp(app); } catch (e) { /* one appServer's file never stops the node's boot */ }
    });
  }

  return {
    // goal/G41.14: fn(change) for each bundle and branch row added, set or deleted (told, above).
    onChange: function (fn) { if (typeof fn === 'function') listeners.push(fn); },

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
        // Told as the table holds it: { key, path, label } (goal/G41.14, the grants on the stream).
        told({ table: 'grant', row: { key: a.key, path: a.path, label: use } });
        return { key: a.key, label: use, path: a.path };
      });
    },

    revoke: function (a) {
      if (!text(a.key) || !text(a.path)) return refuse('bad-request');
      if (!store().revoke(a.key, a.path)) return refuse('not-granted');
      told({ table: 'grant', row: { key: a.key, path: a.path }, gone: true });
      return { revoked: true };
    },

    relabel: function (a) {
      if (!text(a.key) || !text(a.label)) return refuse('bad-request');
      if (!store().relabel(a.key, a.label)) return refuse('no-such-peer');
      // Every grant of that ID shows the new name.
      store().paths(a.key).forEach(function (p) { told({ table: 'grant', row: { key: a.key, path: p, label: a.label } }); });
      return { key: a.key, label: a.label };
    },

    // THE TWO BUNDLE VERBS (goal/G41.14; Andy, box: "TWO verbs under the auth family, auth.bundle and auth.branch, akin
    // to the <tableName> verbs of the agent app: op add, set, delete, get and search. Granted, no review."), flat as
    // those are. auth.bundle:
    //   add {label}        answers { id }, the number the table gives it; a label never empty
    //   set {id, label}    renames it, never to an empty label
    //   delete {id}        removes the bundle and every branch that names it; answers { id }
    //   get {id}           answers { id, label, owner }
    //   search {text, owner?}
    //                      answers { items, more }, each keyed by the bundle's id, its label the bundle as get shows it,
    //                      best first; no words is every bundle, an owner that one's alone
    // THE OWNER (goal/G41.25; Andy, box: "the bundle table gains 1 field: \"owner\", which can contains either \"node\"
    // (default), or the name of an appServer"; "the owner field can never be changed after a bundle is added"; "for
    // bundles without a valid \"owner\" field, the auth.bundle verb will replace the content of the invalid \"owner\" field
    // with \"node\", incoming or outgoing"). Given at the add, never by a set; read as node wherever it is not valid.
    bundle: function (a) {
      const op = a && a.op;
      if (BUNDLE_OPS.indexOf(op) === -1) return refuse('bad-request');
      const B = bundles();
      if (op === 'add') {
        if (!text(a.label)) return refuse('bad-request');
        const made = B.add(a.label, ownerOf(a.owner));
        told({ table: 'bundle', row: owned(B.get(made)) });
        return { id: made };
      }
      if (op === 'search') {
        if (a.text !== undefined && typeof a.text !== 'string') return refuse('bad-request');
        const of = typeof a.owner === 'string' && a.owner ? ownerOf(a.owner) : '';
        const rows = B.all().map(owned).filter(function (row) { return !of || row.owner === of; });
        return ranked(rows, String(a.text || '').trim(), function (row) { return { label: row.label }; });
      }
      if (!isId(a.id)) return refuse('bad-request');
      const was = owned(B.get(a.id));
      if (!was) return refuse('no-such-bundle');
      if (op === 'get') return was;
      if (op === 'delete') {
        // The bundle and its branches go in one transaction; each is told gone.
        const its = branches().all().filter(function (r) { return r.bundle === a.id; });
        B.del(a.id);
        its.forEach(function (r) { told({ table: 'branch', row: { id: r.id }, gone: true }); });
        told({ table: 'bundle', row: { id: a.id }, gone: true });
        return { id: a.id };
      }
      // set: the label, never an empty one; an owner it is given is left as the add made it.
      if (a.label !== undefined && !text(a.label)) return refuse('bad-request');
      if (a.label !== undefined) { B.set(a.id, a.label); told({ table: 'bundle', row: owned(B.get(a.id)) }); }
      return { id: a.id };
    },

    // auth.branch, a bundle's family, and one verb of it or all of it:
    //   add {bundle, family, verb}  answers { id }; the bundle must be there, the family and verb in the live tree
    //                               (verb '' or left out: all of the family), and not in that bundle already
    //   set {id, family?, verb?}    changes what it names and keeps the rest, checked as an add is
    //   delete {id}                 removes that branch alone; answers { id }
    //   get {id}                    answers { id, bundle, family, verb }
    //   search {text, bundle?, family?, verb?}
    //                               answers { items, more }, narrowed by each filter given that is not empty
    branch: function (a) {
      const op = a && a.op;
      if (BUNDLE_OPS.indexOf(op) === -1) return Promise.resolve(refuse('bad-request'));
      const R = branches();
      if (op === 'search') {
        if (a.text !== undefined && typeof a.text !== 'string') return Promise.resolve(refuse('bad-request'));
        const rows = R.all().filter(function (r) {
          return (!a.bundle || r.bundle === a.bundle) && (!a.family || r.family === a.family) && (!a.verb || r.verb === a.verb);
        });
        return Promise.resolve(ranked(rows, String(a.text || '').trim(), function (r) { return { family: r.family, verb: r.verb.split('.').join(' ') }; }));
      }
      if (op === 'add') {
        if (!isId(a.bundle) || !text(a.family) || (a.verb !== undefined && typeof a.verb !== 'string')) return Promise.resolve(refuse('bad-request'));
        if (!bundles().get(a.bundle)) return Promise.resolve(refuse('no-such-bundle'));
        const verb = a.verb || '';
        return branchWhy(a.family, verb).then(function (why) {
          if (why) return refuse(why);
          if (R.same(a.bundle, a.family, verb, 0)) return refuse('already-in-bundle');
          const made = R.add(a.bundle, a.family, verb);
          told({ table: 'branch', row: R.get(made) });
          return { id: made };
        });
      }
      if (!isId(a.id)) return Promise.resolve(refuse('bad-request'));
      const was = R.get(a.id);
      if (!was) return Promise.resolve(refuse('no-such-branch'));
      if (op === 'get') return Promise.resolve(was);
      if (op === 'delete') { R.del(a.id); told({ table: 'branch', row: { id: a.id }, gone: true }); return Promise.resolve({ id: a.id }); }
      // set: the family and verb it names, the rest kept; the bundle a branch belongs to is not changed.
      if ((a.family !== undefined && !text(a.family)) || (a.verb !== undefined && typeof a.verb !== 'string')) return Promise.resolve(refuse('bad-request'));
      const family = a.family !== undefined ? a.family : was.family;
      const verb = a.verb !== undefined ? a.verb : was.verb;
      return branchWhy(family, verb).then(function (why) {
        if (why) return refuse(why);
        if (R.same(was.bundle, family, verb, was.id)) return refuse('already-in-bundle');
        R.set(was.id, family, verb);
        told({ table: 'branch', row: R.get(was.id) });
        return { id: was.id };
      });
    },
  };
}

module.exports = { createApiAuth: createApiAuth, PATH: PATH };
