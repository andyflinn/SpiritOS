'use strict';
// spirit/run/spirit/element/search/app/serverDEBUG.js
// ONE SERVER'S DEBUG, A rowFormToggle (goal/G43.15). Andy, box: "when the app is NOT mountable by the node (node.mount==false) it
// hides itself", "configured text: "turn on|off DEBUG <app-label>"", "it will use the OWNER-ONLYE VERB DEBUG in the appServer",
// Q1: it hides while its server is not running. Its contract and its test: ./test/serverDEBUG.md and ./test/serverDEBUG.js.
//
//   spirit.required.spirit.element.search.app.serverDEBUG.create(host, { key }) -> { destroy() }
//
// The state is the server's job's, data.debug, as the node streams it (appServer.js puts it there on every change), read from
// the jobs family's cache; a press asks the server's DEBUG {on}, and the job's next change redraws it.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/fs/api.js','spirit/app/api.js','spirit/job/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  window.spirit.requireScript('spirit/element/search/app/rowFormToggle.js');
  window.spirit.requireScript('spirit/app/api.js');
  window.spirit.requireScript('spirit/job/api.js');

  var LIVE = { running: true, pending: true };

  function create(host, options) {
    var S = window.spirit;
    var key = String((options && options.key) || '');
    var module = 'spirit.app.' + key;
    var gone = false;
    var serves = false;
    var offJobs = function () {};
    function label() { var A = S.required.spirit.data.app && S.required.spirit.data.app.data; var r = A ? A.rows()[key] : null; return (r && r.label) || key; }
    function job() {
      var J = S.required.spirit.data.job && S.required.spirit.data.job.data;
      return J ? J.find(function (j) { return !!j && j.kind === 'server' && j.module === module && LIVE[j.status] === true; }) : null;
    }
    // WHAT THE SERVER SAID WHEN ASKED (its DEBUG {}): a page opened after the server started finds no job in its cache, since the
    // stream's snapshot came before the jobs cache was loaded; the server's own answer stands in until its job next changes.
    var asked = null;
    function on() { var j = job(); return j ? !!(j.data && j.data.debug === true) : asked === true; }
    function press() {
      var want = !on();
      // Its answer is the toggle's to wait on, busy (goal/G47.1, Q20).
      return Promise.resolve(S.requireScript('spirit/app/' + key + '/api.js')).then(function (fam) { return fam.DEBUG({ on: want }); }).then(null, function () { /* the job stays */ });
    }
    var t = S.required.spirit.element.search.app.rowFormToggle.create(host, { on: false, words: '', press: press });
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
    Promise.resolve(S.requireScript('spirit/job/api.js')).then(function () {
      if (gone) return;
      offJobs = S.required.spirit.data.job.data.watch(function (id, j) { if (j && j.module === module) asked = null; paint(); });
      paint();
    }, function () { /* no jobs, no server to show */ });
    var offRow = S.required.spirit.data.app.data.watch(key, paint);
    S.readyPromise.then(function () { return S.requireScript('spirit/fs/api.js'); }).then(function (s) { return s.loadFile('spirit/app/' + key + '/' + key + '.json'); }).then(function (text) {
      var j = JSON.parse(String(text));
      serves = !!(j.node && j.node.mount === true);
      paint();
      if (serves) return Promise.resolve(S.requireScript('spirit/app/' + key + '/api.js')).then(function (fam) { return fam.DEBUG({}); }).then(function (r) {
        if (!job()) asked = !!(r && r.debug === true);
        paint();
      }, function () { /* not running: it stays hidden */ });
    }).then(null, function () { /* a face that may not read the file: nothing to switch */ });
    return { destroy: function () { gone = true; offJobs(); offRow(); t.destroy(); } };
  }

  window.spirit.requireScript('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/app/serverDEBUG.js', { create: create }); });
}());
