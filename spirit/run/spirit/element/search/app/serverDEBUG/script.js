'use strict';
// spirit/run/spirit/element/search/app/serverDEBUG/script.js
// ONE SERVER'S DEBUG, A rowFormToggle (goal/G43.15). Andy, box: "when the app is NOT mountable by the node (node.mount==false) it
// hides itself", "configured text: "turn on|off DEBUG <app-label>"", "it will use the OWNER-ONLYE VERB DEBUG in the appServer",
// Q1: it hides while its server is not running. Its contract and its test: ./test/script.md and ./test/serverDEBUG.js.
//
//   spirit.required.spirit.element.search.app.serverDEBUG.create(host, { key }) -> { destroy() }
//
// The state is the server's job's, data.debug, as the node streams it (appServer.js puts it there on every change), read from
// the jobs family's cache; a press asks the server's DEBUG {on}, and the job's next change redraws it.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/fs/script.js','spirit/app/script.js','spirit/job/script.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  keepAnswer('spirit/element/search/app/rowFormToggle/script.js');
  keepAnswer('spirit/app/script.js');
  keepAnswer('spirit/job/script.js');
  // THE DATA STORE IS spirit.dataStore (goal/G49.23; Andy: "spirit.dataStore is fine with me"), there once the page has started.
  function STORE() { return window.spirit.dataStore || {}; }

  var LIVE = { running: true, pending: true };

  function create(host, options) {
    var S = window.spirit;
    var key = String((options && options.key) || '');
    // The key is the app's id, its job's module itself (goal/G49.19).
    var module = key;
    var gone = false;
    var serves = false;
    var offJobs = function () {};
    function label() { var A = STORE().app && STORE().app.data; var r = A ? A.rows()[key] : null; return (r && r.label) || key; }
    function job() {
      var J = STORE().job && STORE().job.data;
      return J ? J.find(function (j) { return !!j && j.kind === 'server' && j.module === module && LIVE[j.status] === true; }) : null;
    }
    // WHAT THE SERVER SAID WHEN ASKED (its DEBUG {}): a page opened after the server started finds no job in its cache, since the
    // stream's snapshot came before the jobs cache was loaded; the server's own answer stands in until its job next changes.
    var asked = null;
    function on() { var j = job(); return j ? !!(j.data && j.data.debug === true) : asked === true; }
    function press() {
      var want = !on();
      // Its answer is the toggle's to wait on, busy (goal/G47.1, Q20).
      return Promise.resolve(S.requireScript(S.slashedPath(key) + '/api.js')).then(function (fam) { return fam.DEBUG({ on: want }); }).then(null, function () { /* the job stays */ });
    }
    var t = ANSWER['spirit/element/search/app/rowFormToggle/script.js'].create(host, { on: false, words: '', press: press });
    t.root.hidden = true;
    // SHOWN OR HIDDEN ONLY WHEN THAT CHANGES (the -browser test's write watch: hidden set again to what it was is still a change of
    // the attribute, and it paints on every row change).
    function shown(on) { if (t.root.hidden === on) t.root.hidden = !on; }
    function paint() {
      if (gone) return;
      if (!serves || (!job() && asked === null)) { shown(false); return; }
      var now = on();
      t.set(now, 'turn ' + (now ? 'off' : 'on') + ' DEBUG ' + label());
      shown(true);
    }
    Promise.resolve(keepAnswer('spirit/job/script.js')).then(function () {
      if (gone) return;
      offJobs = STORE().job.data.watch(function (id, j) { if (j && j.module === module) asked = null; paint(); });
      paint();
    }, function () { /* no jobs, no server to show */ });
    var offRow = STORE().app.data.watch(key, paint);
    S.readyPromise.then(function () { return keepAnswer('spirit/fs/script.js'); }).then(function (s) { return s.loadFile(S.slashedPath(key) + '/' + S.slashedPath(key).split('/').pop() + '.json'); }).then(function (text) {
      var j = JSON.parse(String(text));
      serves = !!(j.node && j.node.mount === true);
      paint();
      if (serves) return Promise.resolve(S.requireScript(S.slashedPath(key) + '/api.js')).then(function (fam) { return fam.DEBUG({}); }).then(function (r) {
        if (!job()) asked = !!(r && r.debug === true);
        paint();
      }, function () { /* not running: it stays hidden */ });
    }).then(null, function () { /* a face that may not read the file: nothing to switch */ });
    return { destroy: function () { gone = true; offJobs(); offRow(); t.destroy(); } };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
