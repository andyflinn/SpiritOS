'use strict';
// spirit/run/spirit/app/appSelector/serverDEBUG.js
// ONE SERVER'S DEBUG, A rowFormToggle (goal/G43.15). Andy, box: "when the app is NOT mountable by the node (node.mount==false) it
// hides itself", "configured text: "turn on|off DEBUG <app-label>"", "it will use the OWNER-ONLYE VERB DEBUG in the appServer",
// Q1: it hides while its server is not running. Its contract and its test: ./test/serverDEBUG.md and ./test/serverDEBUG.js.
//
//   spirit.element.spirit.app.appSelector.serverDEBUG.create(host, { key }) -> { destroy() }
//
// The state is the server's job's, data.debug, as the node streams it (appServer.js puts it there on every change), read from
// the jobs family's cache; a press asks the server's DEBUG {on}, and the job's next change redraws it.
(function () {
  window.spirit.require('spirit/app/appSelector/rowFormToggle.js');
  window.spirit.cacheManager('app');
  window.spirit.cacheManager('jobs');

  var LIVE = { running: true, pending: true };

  function create(host, options) {
    var S = window.spirit;
    var key = String((options && options.key) || '');
    var module = 'spirit.app.' + key;
    var gone = false;
    var serves = false;
    var offJobs = function () {};
    function label() { var A = S.data.app && S.data.app.data; var r = A ? A.rows()[key] : null; return (r && r.label) || key; }
    function job() {
      var J = S.data.jobs && S.data.jobs.data;
      return J ? J.find(function (j) { return !!j && j.kind === 'server' && j.module === module && LIVE[j.status] === true; }) : null;
    }
    // WHAT THE SERVER SAID WHEN ASKED (its DEBUG {}): a page opened after the server started finds no job in its cache, since the
    // stream's snapshot came before the jobs cache was loaded; the server's own answer stands in until its job next changes.
    var asked = null;
    function on() { var j = job(); return j ? !!(j.data && j.data.debug === true) : asked === true; }
    function press() {
      var want = !on();
      Promise.resolve(S.require(S.familyPath(key))).then(function (fam) { return fam.DEBUG({ on: want }); }).then(null, function () { /* the job stays */ });
    }
    var t = S.element.spirit.app.appSelector.rowFormToggle.create(host, { on: false, words: '', press: press });
    t.root.hidden = true;
    function paint() {
      if (gone) return;
      if (!serves || (!job() && asked === null)) { t.root.hidden = true; return; }
      var now = on();
      t.set(now, 'turn ' + (now ? 'off' : 'on') + ' DEBUG ' + label());
      t.root.hidden = false;
    }
    Promise.resolve(S.cacheManager('jobs')).then(function () {
      if (gone) return;
      offJobs = S.data.jobs.data.watch(function (id, j) { if (j && j.module === module) asked = null; paint(); });
      paint();
    }, function () { /* no jobs, no server to show */ });
    var offRow = S.data.app.data.watchApp(key, paint);
    S.ready.then(function (s) { return s.fs.loadFile('spirit/app/' + key + '/' + key + '.json'); }).then(function (text) {
      var j = JSON.parse(String(text));
      serves = !!(j.node && j.node.mount === true);
      paint();
      if (serves) return Promise.resolve(S.require(S.familyPath(key))).then(function (fam) { return fam.DEBUG({}); }).then(function (r) {
        if (!job()) asked = !!(r && r.debug === true);
        paint();
      }, function () { /* not running: it stays hidden */ });
    }).then(null, function () { /* a face that may not read the file: nothing to switch */ });
    return { destroy: function () { gone = true; offJobs(); offRow(); t.destroy(); } };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/appSelector/serverDEBUG.js', { create: create }); });
}());
