// spirit/run/shell/js/spiritData.js
// THE FACELESS LAYER (goal/G30.16, box v14-v16). Andy: "we need to view the shell like a transient version of a node. it
// needs a 100% faceless layer", "accurately mirror the exact state of the node that is its partner", "the shell stores
// all data in one central location". The UI is a fast reading of this; nothing here touches the page, so it runs and
// tests in node.
//
//   data            one tree, a branch per type: data.files (path -> { kind, size, modified }), data.contacts
//                   (key -> the contact row), data.preferences; a branch is key -> value
//   set(path, v)    the one write: path is '<type>/<key>' (a key may hold slashes, a file's path does)
//   merge(path, f)  set(path, the value there with f's fields over it)
//   del(path)       the other write
//   watch(path, fn) the only event handling: fn(path, value) when that path is written, and for a '<type>' watch when
//                   any key of it is; value undefined on a delete. Answers the unwatch.
//   rows(type)      the branch as [{ key, ...value }], what a list draws (a view: ranking is the list's)
//   ready(type)     true once the stream has handed the whole branch over (files: the watcher's treeComplete)
//   seat(type, items)  a search answer's items ({ key, label: json }) merged into the tree like any event
//
//   translate(t)    a type's translator, registered by its data.js (goal/G30.20): t.onJob(job, D), t.onRename(d, D);
//                   every one ends in set, merge or del. This file knows no type.
//
// NO CAP (box v17; Andy: "the browsers side will flush on every page-refresh, so we'll avoid the complication of bounding
// those browser site caches completely. no cache bounding on the browser side.").
(function (root) {
  var data = Object.create(null);
  var watchers = Object.create(null);   // path -> [fn]
  var readyOf = Object.create(null);
  var quiet = Object.create(null);      // a type being filled without telling (the tree arriving)

  function split(path) {
    var p = String(path || '');
    var cut = p.indexOf('/');
    return cut < 0 ? { type: p, key: '' } : { type: p.slice(0, cut), key: p.slice(cut + 1) };
  }
  function branch(type) { return data[type] || (data[type] = Object.create(null)); }
  function tell(type, key, value) {
    if (quiet[type]) return;
    (watchers[type + '/' + key] || []).slice().forEach(function (fn) { try { fn(type + '/' + key, value); } catch (e) { /* one reader's fault */ } });
    (watchers[type] || []).slice().forEach(function (fn) { try { fn(type + '/' + key, value); } catch (e) { /* one reader's fault */ } });
  }
  function get(path) { var s = split(path); return s.key ? branch(s.type)[s.key] : branch(s.type); }
  function set(path, value) {
    var s = split(path);
    if (!s.type || !s.key) return;
    branch(s.type)[s.key] = value;
    tell(s.type, s.key, value);
  }
  function merge(path, fields) { set(path, Object.assign({}, get(path) || {}, fields || {})); }
  function del(path) {
    var s = split(path);
    var b = branch(s.type);
    if (!(s.key in b)) return;
    delete b[s.key];
    tell(s.type, s.key, undefined);
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

  // ── THE TRANSLATORS ARE THE TYPES' (goal/G30.20) ─────────────────────────────────────────────────────────────
  // Each type's folder has its data.js (shell/js/files/data.js, shell/js/contacts/data.js), which registers here what it
  // makes of the stream's events: translate({ onJob(job, D), onRename(d, D) }). This file knows no type.
  var translators = [];
  function translate(t) { if (t && typeof t === 'object') translators.push(t); }
  function each(name, arg) {
    translators.forEach(function (t) { if (typeof t[name] === 'function') { try { t[name](arg, api); } catch (e) { /* one type's fault */ } } });
  }
  function onJob(job) { if (job && job.data) each('onJob', job); }
  function onRename(d) { if (d && d.key) each('onRename', d); }
  // A branch filled without telling (the file tree arriving), then one word to its watchers.
  function quietly(type, on) { quiet[type] = !!on; }
  function ready(type, now) {
    if (now === undefined) return !!readyOf[type];
    readyOf[type] = !!now;
    quiet[type] = false;
    (watchers[type] || []).slice().forEach(function (fn) { try { fn(type, undefined); } catch (e) { /* one reader's fault */ } });
  }

  // ── searchDataSet (goal/G33.7, box v9) ──────────────────────────────────────────────────────────────────────────
  //   Andy, in the item's box: "a cache-only search in the component that keeps the data set (spirit.data), so it
  //   serves the page and every server alike. It asks nobody and ranks by probability across every table it holds,
  //   returning the most relevant rows whatever table they are in, bounded like every search."
  //
  // search({ text, branches?, room? }) -> { items: [{ key: '<branch>/<key>', label: <the row as JSON>, probability }],
  // more }. Every row of every branch (or of the branches named) is weighed by the desk's own ranking: the text against
  // the row's key and its fields (probabilityStringObjectMatch), seated in a probabilityBucket, best first, an equal one
  // behind those already in. Bounded like the desk's searches: the items fill one answer (room, by default the answer
  // limit less 512 bytes, as the desk's ANSWER_ROOM), and more says some were left out. It asks nobody and writes
  // nothing.
  var SEARCH_SCANNED = 1000;
  function ranking() {
    if (typeof require === 'function' && typeof module !== 'undefined' && module) {
      return { match: require('../../js/probabilityStringObjectMatch.js').probabilityStringObjectMatch,
        bucket: require('../../js/probabilityBucket.js').createProbabilityBucket, limits: require('../../js/limits.js') };
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
    Object.keys(data).forEach(function (type) {
      if (only && only.indexOf(type) === -1) return;
      var b = data[type];
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

  var api = { data: data, get: get, set: set, merge: merge, del: del, watch: watch, rows: rows, seat: seat,
    translate: translate, quietly: quietly, ready: ready, branch: branch, search: search,
    // For a suite: the stream's events fed by hand.
    take: onJob, rename: onRename };

  var core = root.spirit && root.spirit.core;
  if (core && core.jobs && typeof core.jobs.subscribe === 'function') {
    core.jobs.subscribe({ onSnapshot: function (jobs) { (jobs || []).forEach(onJob); }, onUpdate: onJob, onContactRename: onRename });
  }
  (root.spirit = root.spirit || {}).data = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
