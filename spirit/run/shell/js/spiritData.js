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

  var api = { data: data, get: get, set: set, merge: merge, del: del, watch: watch, rows: rows, seat: seat,
    translate: translate, quietly: quietly, ready: ready, branch: branch,
    // For a suite: the stream's events fed by hand.
    take: onJob, rename: onRename };

  var core = root.spirit && root.spirit.core;
  if (core && core.jobs && typeof core.jobs.subscribe === 'function') {
    core.jobs.subscribe({ onSnapshot: function (jobs) { (jobs || []).forEach(onJob); }, onUpdate: onJob, onContactRename: onRename });
  }
  (root.spirit = root.spirit || {}).data = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
