'use strict';
// spirit/run/spirit/data.js
// THE FACELESS LAYER (goal/G30.16, box v14-v16). Andy: "we need to view the shell like a transient version of a node. it
// needs a 100% faceless layer", "accurately mirror the exact state of the node that is its partner", "the shell stores
// all data in one central location". The UI is a fast reading of this; nothing here touches the page, so it runs and
// tests in node.
//
//   spirit.data     HELPER FUNCTIONS AND ONE OBJECT PER FAMILY (goal/G43.7; Andy, the box: "this object has only helper functions
//                   and object <name> for every application"). spirit.data.<name>.data is what the family's data.js answers,
//                   its reads; spirit.data.<name>.cache is its rows, a level per node (Q5: "yes."), the same in a page and in an
//                   appServer in client mode: cache[node][branch][row] -> value. node is the key of the node that served the
//                   rows, in base64url (Q8: "yes."), so neither a path nor appServer's cache file name splits on its / or +.
//   makeFamily(name, make)  the one way a family's data.js stands: make() runs once, for this data set, translates what it keeps
//                   and answers its reads, and they stand at spirit.data.<name>.data. Answers the family.
//   a path          '<node>/<family>/<branch>/<row>' (a row may hold slashes, a file's path does); '<node>/<family>/<branch>'
//                   is the branch. The tree is addressed through the family's own view, at(node, family), below.
//   setPath(path, v)    the one write
//   mergePath(path, f)  set(path, the value there with f's fields over it)
//   delPath(path)       the other write
//   watchPath(path, fn) the only event handling: fn(path, value) when that path is written, and for a branch's watch when
//                   any row of it is; value undefined on a delete. Answers the unwatch.
//   rowsOf(branch)    the branch as [{ key, ...value }], what a list draws (a view: ranking is the list's)
//   readyBranch(branch)   true once the stream has handed the whole branch over (files: the watcher's treeComplete)
//   seatRows(branch, items)  a search answer's items ({ key, label: json }) merged into the tree like any event
//
//   nodeId(key)     a public key in base64url, as data names the node
//   homeNode(key?)      the node a reader means when it names none: on a page the node that served it (spirit.node.key,
//                   which spirit.js asks of node.card once as the page loads; Andy, Q10: "yes."), in a process the node
//                   whose rows it last took. Given a key on a page, it is the page's node from now on.
//   viewAt(node, family)  a family's view of the tree: get, set, merge, del, watch, rows, seat, ready, quietly and branch
//                   take '<branch>/<row>' and '<branch>', and path(branch) is the branch's whole path, for a list that is a
//                   view of it (probabilitySearch's data). node null is home(), asked again at each call.
//
//   followStream(o)       a server's ask for its own node's events (goal/G43.5): the one stream, into the translators; on a page it
//                   is fed anyway. o.onConnection(up) is told each time the stream comes up or goes down.
//   addTranslator(t)    a type's translator, registered by its row element (goal/G30.20, G41.16): t.onJob(job, D), t.onRename(d, D), t.onDelete(gone, D), t.onRelay(event); answers its release;
//                   every one ends in set, merge or del. A job comes with fromNode, the node that served it, so the
//                   translator files it under that node. This file knows no type.
//
//   forgetAll()        everything kept goes, each type told once (type, undefined): a connect, the partner pushes it whole
//   recordPaths(fn)   the paths fn wrote (set, merge, del), so a stream's row can take what it wrote with it (goal/G41.12)
//   byteCap(n?)         the byte cap: reads it, or sets it in a process
//
// NO CAP ON A PAGE (box v17; Andy: "the browsers side will flush on every page-refresh, so we'll avoid the complication of
// bounding those browser site caches completely. no cache bounding on the browser side."). A PROCESS'S CACHE IS A NODE
// STORE (goal/G41.3, Q2): past its byte cap it sheds the oldest writes first, each told as a delete.
(function (root) {
  var families = Object.create(null);  // name -> spirit.data.<name>
  var watchers = Object.create(null);   // path -> [fn]
  var readyOf = Object.create(null);
  var quiet = Object.create(null);      // a type being filled without telling (the tree arriving)
  var onPage = !!(root.spirit && typeof root.spirit.isBrowser === 'function' && root.spirit.isBrowser());
  var PROCESS_CAP = 4 * 1024 * 1024;
  var capBytes = onPage ? Infinity : PROCESS_CAP;
  var sizes = new Map();                // path -> bytes, oldest write first (a process only)
  var total = 0;

  // A path cut where the tree is: node, family, branch, and the row, which may hold slashes. type is the branch's whole
  // path, the unit every watch, ready and quiet is kept by.
  function split(path) {
    var parts = String(path || '').split('/');
    var s = { node: parts[0] || '', family: parts[1] || '', branch: parts[2] || '', key: parts.slice(3).join('/') };
    s.type = s.node + '/' + s.family + '/' + s.branch;
    return s;
  }
  function level(o, k) { return o[k] || (o[k] = Object.create(null)); }
  // A family stands once a row is written for it or its data.js has run. A name a helper holds is kept here alone, so it can
  // never replace the helper.
  function familyOf(name) {
    var n = String(name);
    if (!families[n]) {
      families[n] = { data: null, cache: Object.create(null) };
      if (!(n in api)) api[n] = families[n];
    }
    return families[n];
  }
  function family(name, make) {
    var f = familyOf(name);
    if (f.data === null) f.data = (typeof make === 'function' && make()) || Object.freeze({});
    return f;
  }
  function branchOf(s) { return level(level(familyOf(s.family).cache, s.node), s.branch); }
  // A branch's rows, by its whole path; a shorter path answers that level of the tree. A READ MAKES NOTHING: a level
  // not there answers empty, and only a write grows the tree.
  var NONE = Object.freeze(Object.create(null));
  function branch(path) {
    var s = split(path);
    if (!s.family) {
      var kept = Object.keys(families).filter(function (f) { return families[f].cache[s.node]; });
      if (!kept.length) return NONE;
      var whole = Object.create(null);
      kept.forEach(function (f) { whole[f] = families[f].cache[s.node]; });
      return whole;
    }
    var at = families[s.family] && families[s.family].cache[s.node];
    if (at && s.branch) at = at[s.branch];
    return at || NONE;
  }
  // A watch of the home node is kept under HOME_MARK in place of the node, so one made before the page knows its node
  // (Q10: node.card answers after the page has begun) hears the home node's writes once it does.
  var HOME_MARK = '~';
  function heard(p) {
    var out = (watchers[p] || []).slice();
    var cut = p.indexOf('/');
    if (cut > 0 && homeNode && p.slice(0, cut) === homeNode) out = out.concat((watchers[HOME_MARK + p.slice(cut)] || []).slice());
    return out;
  }
  function tell(type, key, value) {
    if (quiet[type]) return;
    heard(type + '/' + key).forEach(function (fn) { try { fn(type + '/' + key, value); } catch (e) { /* one reader's fault */ } });
    heard(type).forEach(function (fn) { try { fn(type + '/' + key, value); } catch (e) { /* one reader's fault */ } });
  }
  function get(path) { var s = split(path); return s.key ? (s.branch ? branch(path)[s.key] : undefined) : branch(path); }
  function set(path, value) {
    var s = split(path);
    if (!s.node || !s.family || !s.branch || !s.key) return;
    recorded(s.type + '/' + s.key);
    branchOf(s)[s.key] = value;
    tell(s.type, s.key, value);
    counted(s.type + '/' + s.key, value);
  }
  function merge(path, fields) { set(path, Object.assign({}, get(path) || {}, fields || {})); }
  function del(path) {
    var s = split(path);
    if (!s.node || !s.family || !s.branch) return;
    var b = branch(path);
    recorded(s.type + '/' + s.key);
    if (!(s.key in b)) return;
    delete b[s.key];
    counted(s.type + '/' + s.key, undefined);
    tell(s.type, s.key, undefined);
  }
  // Every branch the tree holds, by its whole path.
  function branches() {
    var out = [];
    Object.keys(families).forEach(function (f) { Object.keys(families[f].cache).forEach(function (n) { Object.keys(families[f].cache[n]).forEach(function (b) { out.push(n + '/' + f + '/' + b); }); }); });
    return out;
  }
  // THE BYTES KEPT, IN A PROCESS: each write counted as its path and its JSON, and made the newest; past the cap the
  // oldest go, the one just written last of all.
  function counted(path, value) {
    if (capBytes === Infinity) return;
    if (sizes.has(path)) { total -= sizes.get(path); sizes.delete(path); }
    if (value === undefined) return;
    var n = utf8Bytes(path) + utf8Bytes(JSON.stringify(value) || '');
    sizes.set(path, n);
    total += n;
    shed(path);
  }
  function shed(keep) {
    var oldest = sizes.keys();
    while (total > capBytes) {
      var p = oldest.next();
      if (p.done) break;
      if (p.value !== keep) del(p.value);
    }
  }
  function cap(n) {
    if (n === undefined) return capBytes;
    if (onPage || !(Number(n) > 0)) return capBytes;
    capBytes = Number(n);
    shed(null);
    return capBytes;
  }
  // EVERYTHING KEPT GOES (goal/G41.3, Q2: on a reconnect a cache forgets, and its partner pushes it whole again): the
  // branches stay the same objects, emptied; each type that held anything is told once, as ready tells.
  function forget() {
    branches().forEach(function (type) {
      var b = branch(type);
      var had = Object.keys(b).length > 0 || !!readyOf[type];
      Object.keys(b).forEach(function (k) { delete b[k]; });
      delete readyOf[type];
      quiet[type] = false;
      if (had) heard(type).forEach(function (fn) { try { fn(type, undefined); } catch (e) { /* one reader's fault */ } });
    });
    sizes.clear();
    total = 0;
  }
  // WHAT A WRITE TOUCHED (goal/G41.12): a stream's client keeps each row with the paths it wrote, so a row its cache
  // sheds, or a full push replaces, takes those with it (appServer). recordPaths(fn) answers every path fn set, merged or
  // deleted, once each, in order; a recording inside another counts for both.
  var recorders = [];
  function recorded(path) {
    recorders.forEach(function (r) { if (!r.seen[path]) { r.seen[path] = true; r.paths.push(path); } });
  }
  function recording(fn) {
    var r = { seen: Object.create(null), paths: [] };
    recorders.push(r);
    try { fn(); } finally { recorders.splice(recorders.indexOf(r), 1); }
    return r.paths;
  }
  function watch(path, fn) {
    if (typeof fn !== 'function') return function () {};
    var p = String(path || '');
    (watchers[p] = watchers[p] || []).push(fn);
    return function () { watchers[p] = (watchers[p] || []).filter(function (x) { return x !== fn; }); };
  }
  function rows(type) {
    var b = branch(type);
    return Object.keys(b).map(function (k) { return Object.assign({ key: k }, b[k]); });
  }
  function seat(type, items) {
    (items || []).forEach(function (it) {
      if (!it || it.key == null) return;
      var row = null;
      try { row = JSON.parse(it.label); } catch (e) { row = null; }
      if (row && typeof row === 'object') merge(type + '/' + it.key, row);
    });
  }

  // ── THE SERVER NODE (goal/G41.28) ─────────────────────────────────────────────────────────────────────────────────
  // A public key as data names it: base64url (Andy, Q8: "Shall the server key in spirit.data and in the cache file name be
  // base64url, - for + and _ for /?" "yes."), without the padding, as Buffer's base64url writes it.
  function nodeId(key) { return String(key || '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  var homeNode = '';
  function home(key) {
    if (key !== undefined && String(key)) { var was = homeNode; homeNode = nodeId(key); if (onPage && !was) replay(); return homeNode; }
    // A KEY IS A STRING (goal/G43.20, found by data-families): spirit.node is the node family, bound when first called
    // (spirit.js lazyCall), so before node.card has answered spirit.node.key is a function waiting for the family, and a
    // page filed every row under that function's text.
    if (!homeNode && root.spirit && root.spirit.node && typeof root.spirit.node.key === 'string' && root.spirit.node.key) homeNode = nodeId(root.spirit.node.key);
    return homeNode;
  }
  // A FAMILY'S VIEW (goal/G41.28): what its data.js or its row element addresses, its branches under its own
  // family of one node, so no reader spells a node or a family. A view of node null follows home().
  function at(node, family) {
    var fam = String(family || '');
    function base() { return (node ? nodeId(node) : home()) + '/' + fam + '/'; }
    function full(p) { return base() + String(p || ''); }
    return {
      family: fam,
      node: function () { return node ? nodeId(node) : home(); },
      path: function (b) { return full(b); },
      get: function (p) { return get(full(p)); },
      set: function (p, v) { set(full(p), v); },
      merge: function (p, f) { merge(full(p), f); },
      del: function (p) { del(full(p)); },
      watch: function (p, fn) { return watch((node ? nodeId(node) : HOME_MARK) + '/' + fam + '/' + String(p || ''), fn); },
      rows: function (b) { return rows(full(b)); },
      seat: function (b, items) { seat(full(b), items); },
      ready: function (b, now) { return ready(full(b), now); },
      quietly: function (b, on) { quietly(full(b), on); },
      branch: function (b) { return branch(full(b)); },
      // The row's own path back from a whole path this view wrote, or '' when it is not this view's.
      row: function (whole, b) { var pre = full(b) + '/'; return String(whole || '').indexOf(pre) === 0 ? String(whole).slice(pre.length) : ''; },
    };
  }

  // ── THE TRANSLATORS ARE THE TYPES' (goal/G30.20) ─────────────────────────────────────────────────────────────
  // Each type's row element (spirit/element/search/file/rowElement.js, spirit/element/search/contact/rowElement.js; goal/G41.16) registers here what it
  // makes of the stream's events: addTranslator({ onJob(job, D), onRename(d, D), onDelete(gone, D), onRelay(event) }). This
  // file knows no type.
  // A TYPE LOADED LATE IS HANDED ITS DATA WHOLE (goal/G41.3, Q4: the translators are lazy, each loading with its app):
  // on a page every job as it now stands and every rename are kept as the stream hands them, and a translator registered
  // later is handed them all at once, so its branch is whole. A process's translator comes with its server, before any
  // row, so nothing is kept there.
  var translators = [];
  var seenJobs = new Map();             // job id (and kind of news) -> the job as it now stands (a page only)
  // ONE OF THE NODE'S OWN JOBS CARRIES ONE KIND OF NEWS PER EVENT (goal/G43.20, box: "each event only its own news"): spirit.app
  // its app list or a face part, spirit its stats or its join steps. So such a job is kept once per kind, told by the
  // fields its data carries, and a translator registered later is handed every kind, not only the newest event.
  function seenKey(job) {
    var d = job.kind === 'permanent' && job.data && typeof job.data === 'object' ? Object.keys(job.data).sort().join(',') : '';
    return d ? job.id + '\n' + d : String(job.id);
  }
  var seenRenames = new Map();          // key -> the last rename (a page only)
  function one(t, name, arg) { if (typeof t[name] === 'function') { try { t[name](arg, api); } catch (e) { /* one type's fault */ } } }
  // A PAGE FILES NOTHING UNTIL IT KNOWS ITS NODE (goal/G41.28, Q10): its stream may hand jobs before node.card has
  // answered; they are kept as seen, and handed over once home() is known, as a late translator is handed them.
  function handing() { return !onPage || !!home(); }
  function translate(t) {
    if (!t || typeof t !== 'object') return function () {};
    translators.push(t);
    var release = function () { var i = translators.indexOf(t); if (i !== -1) translators.splice(i, 1); };
    if (!handing()) return release;
    seenJobs.forEach(function (job) { one(t, 'onJob', stamped(job, '')); });
    seenRenames.forEach(function (d) { one(t, 'onRename', stamped(d, '')); });
    return release;
  }
  function replay() {
    seenJobs.forEach(function (job) { each('onJob', stamped(job, '')); });
    seenRenames.forEach(function (d) { each('onRename', stamped(d, '')); });
  }
  function each(name, arg) { translators.forEach(function (t) { one(t, name, arg); }); }
  // THE NODE THAT SERVED IT, ON EVERY EVENT A TRANSLATOR IS HANDED: fromNode, in base64url. A process's appServer names
  // the sender it took the row from; a page's stream is its own node's. The event as it came is left as it was.
  function stamped(ev, from) {
    var n = from ? nodeId(from) : ev && ev.fromNode ? nodeId(ev.fromNode) : home();
    if (!onPage && n) homeNode = n;
    return Object.assign({}, ev, { fromNode: n });
  }
  // Every job is handed over, data or none: each translator reads what it needs (the jobs family keeps them whole).
  function onJob(job, from) {
    if (!job || typeof job !== 'object') return;
    if (onPage && job.id) seenJobs.set(seenKey(job), job);
    if (handing()) each('onJob', stamped(job, from));
  }
  function onRename(d, from) {
    if (!d || !d.key) return;
    if (onPage) seenRenames.set(String(d.key), d);
    if (handing()) each('onRename', stamped(d, from));
  }
  // A JOB GONE FROM THE STREAM (goal/G41.28): every translator is told { id, fromNode }, so a family that keeps the job
  // itself (the jobs family's cache manager) lets it go.
  function onGone(id, from) {
    if (id == null) return;
    if (onPage) Array.from(seenJobs.keys()).forEach(function (k) { if (k === String(id) || k.indexOf(String(id) + '\n') === 0) seenJobs.delete(k); });
    if (handing()) each('onDelete', stamped({ id: String(id) }, from));
  }
  // A SNAPSHOT IS A CONNECT (spirit.events hands one on every open of the stream, the first and each reconnect): what
  // was kept is forgotten, and the snapshot is the partner's whole push.
  function onSnapshot(jobs) {
    forget();
    seenJobs.clear();
    // Each job alone (goal/G43.18, Q27, Andy: "yes."): forEach hands its index as a second argument, which onJob took for the
    // node that served the job, so a reloaded page filed every job under a node named 0, 1, 2 and saw none of them.
    (jobs || []).forEach(function (job) { onJob(job); });
  }
  // A branch filled without telling (the file tree arriving), then one word to its watchers.
  function quietly(type, on) { quiet[type] = !!on; }
  function ready(type, now) {
    if (now === undefined) return !!readyOf[type];
    readyOf[type] = !!now;
    quiet[type] = false;
    heard(type).forEach(function (fn) { try { fn(type, undefined); } catch (e) { /* one reader's fault */ } });
  }

  // ── searchDataSet (goal/G33.7, box v9) ──────────────────────────────────────────────────────────────────────────
  //   Andy, in the item's box: "a cache-only search in the component that keeps the data set (spirit.data), so it
  //   serves the page and every server alike. It asks nobody and ranks by probability across every table it holds,
  //   returning the most relevant rows whatever table they are in, bounded like every search."
  //
  // searchAll({ text, branches?, room? }) -> { items: [{ key: '<branch>/<key>', label: <the row as JSON>, probability }],
  // more }. Every row of every branch (or of the branches named) is weighed by the desk's own ranking: the text against
  // the row's key and its fields (probabilityStringObjectMatch), seated in a probabilityBucket, best first, an equal one
  // behind those already in. Bounded like the desk's searches: the items fill one answer (room, by default the answer
  // limit less 512 bytes, as the desk's ANSWER_ROOM), and more says some were left out. It asks nobody and writes
  // nothing.
  var SEARCH_SCANNED = 1000;
  function ranking() {
    if (typeof require === 'function' && typeof module !== 'undefined' && module) {
      return { match: require('./spirit.js').require('spirit/probabilityStringObjectMatch.js').probabilityStringObjectMatch,
        bucket: require('./spirit.js').require('spirit/probabilityBucket.js').createProbabilityBucket, limits: require('./spirit.js').require('spirit/limits.js') };
    }
    var p = (root.spirit && root.spirit.probability) || {};
    return { match: p.probabilityStringObjectMatch, bucket: p.createProbabilityBucket, limits: root.spirit && root.spirit.limits };
  }
  function defaultRoom(limits) {
    // appClient.ANSWER_MAX is half a sealed packet; the desk's ANSWER_ROOM leaves 512 bytes of it for the envelope.
    return limits && limits.SEALED_MAX ? Math.floor(limits.SEALED_MAX / 2) - 512 : 7865;
  }
  // Sizes in bytes, never characters (Andy, 2026-10-10: "every size check in bytes").
  function utf8Bytes(s) { return unescape(encodeURIComponent(String(s))).length; }
  function weighed(text, key, value) {
    var fields = { key: String(key) };
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.keys(value).forEach(function (k) { fields[k] = value[k]; });
    else if (value !== undefined) fields.value = String(value);
    return fields;
  }
  function search(q) {
    var R = ranking();
    if (typeof R.match !== 'function' || typeof R.bucket !== 'function') return { items: [], more: false };
    var text = String((q && q.text) || '');
    var only = q && Array.isArray(q.branches) ? q.branches.map(String) : null;
    var room = q && Number(q.room) > 0 ? Number(q.room) : defaultRoom(R.limits);
    var bucket = R.bucket(SEARCH_SCANNED);
    var more = false;
    branches().forEach(function (type) {
      if (only && only.indexOf(type) === -1) return;
      var b = branch(type);
      Object.keys(b).forEach(function (k) {
        var label = JSON.stringify(b[k] === undefined ? null : b[k]);
        var one = { key: type + '/' + k, label: label };
        // One row too big for the room alone is left out and said by more, as the desk's ranked() does.
        if (utf8Bytes(JSON.stringify({ items: [one], more: false })) > room) { more = true; return; }
        var p = text ? R.match(text, weighed(text, k, b[k])) : 0;
        one.probability = p;
        bucket.seatFor(typeof p === 'number' && p >= 0 && p <= 1 ? p : 0, one);
      });
    });
    // The room is for the answer { items, more }: the bucket measures the items' array, so the envelope is kept aside.
    var r = bucket.serialize(null, room - utf8Bytes(JSON.stringify({ items: [], more: false })));
    return { items: r.items, more: r.more || more };
  }

  // A HELPER'S NAME HOLDS A CAPITAL, so it is no word and no family can land on it (goal/G43.7; Andy: "all the helperFunctions in
  // objects like spirit.data should potential "words" the should have a capital in it"). A view at() hands back is no such object.
  var api = { makeFamily: family, getPath: get, setPath: set, mergePath: merge, delPath: del, watchPath: watch, rowsOf: rows, seatRows: seat,
    addTranslator: translate, setQuietly: quietly, readyBranch: ready, branchAt: branch, searchAll: search, forgetAll: forget, byteCap: cap,
    recordPaths: recording, nodeId: nodeId, homeNode: home, viewAt: at, allBranches: branches,
    // For a suite: the stream's events fed by hand.
    takeJob: onJob, takeRename: onRename };

  // FED BY THE PAGE'S ONE STREAM, spirit.events.subscribe (goal/G40.6). A relay's own events go to whichever translator
  // keeps them (onRelay), as everything else on that stream does.
  var sp = root.spirit;
  function relayEvent(ev) { each('onRelay', ev); }
  if (onPage && sp.events && typeof sp.events.subscribe === 'function') {
    sp.events.subscribe({ onSnapshot: onSnapshot, onUpdate: onJob, onDelete: function (id) { onGone(id); }, onContactRename: onRename, onRelayEvent: relayEvent });
  }
  // A SERVER THAT NEEDS ITS OWN NODE'S EVENTS ASKS FOR THEM HERE (goal/G43.5; Andy: "the rule covers everything, apps,
  // element"; spirit/test/spirit-branches.js: only data.js takes the node's stream). A server is otherwise fed by its streamListener
  // (appServer) and opens nothing. follow({ onConnection(up) }): the one stream, opened at the first ask, into the same
  // translators. No snapshot: a connect forgets on a page, and here it would forget what the streamListener brought.
  var followers = [];
  var following = false;
  function follow(o) {
    if (onPage) return;
    if (o && typeof o.onConnection === 'function') followers.push(o.onConnection);
    // Asked now, not at load: this file may be required before the spirit object has its events.
    var s = root.spirit;
    if (following || !s || !s.events || typeof s.events.subscribe !== 'function') return;
    following = true;
    // A process its node did not name still keeps its rows somewhere: a level of the tree needs a name.
    if (!home()) homeNode = 'local';
    s.events.subscribe({ onUpdate: onJob, onDelete: function (id) { onGone(id); }, onContactRename: onRename, onRelayEvent: relayEvent,
      onConnection: function (up) { followers.slice().forEach(function (fn) { try { fn(up); } catch (e) { /* one reader's fault */ } }); } });
  }
  api.followStream = follow;
  (root.spirit = root.spirit || {}).data = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
