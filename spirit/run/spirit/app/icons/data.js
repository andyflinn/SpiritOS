'use strict';
// spirit/run/spirit/app/icons/data.js
// WHAT A CLIENT KNOWS OF THE ICON SET, IN THE icons FAMILY'S OWN FOLDER (goal/G43.19; the box: "it implements a
// database-table interface, also reflected in api.js and data.js"). A page loads it through its api.js (spirit/app/icons/api.js), the one file that requires it.
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the Icons face) asks spirit.required.spirit.data['spirit.app.icons'].data.
//   icons   glyph -> { glyph, keywords }, what icon.search answered (seated by the list that is a view of it), and every
//           row a run publishes: { icons: { row } } for a row added or changed, { icons: { glyph, removed: true } } for one
//           gone, as the job's app of spirit.app.icons (the box, 10: "data.js on every open page follows that one job").
// Every event ends in set or del; it asks nothing.
(function family(given, out) {
  // WHAT IT PUTS OUT, ITS READS (goal/G49.23, box v22 Part 1: "they stand at <branch path>.client, where the loader puts the
  // branch's client/script.js by its path"; an old-shape data.js at <its folder>.data): the object is put out as the file runs, so
  // the loader places it, and filled with what the store made once it has come back.
  var OUT = out || {};
  if (!out && typeof module !== 'undefined' && module) module.exports = OUT;
  var ICONS = 'icons';
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/client/script.js') : given;
  // ON A PAGE, THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23; goal/G49.9: never read at its place): this file runs
  // again with it once it has loaded.
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/client/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/client/script.js').then(function (got) { if (got) family(got, OUT); }); return; }
  D.handOut(OUT, D.makeFamily('spirit.app.icons', function () {
    var HOME = D.viewAt(null, 'spirit.app.icons');
    D.addTranslator({
      onJob: function (job) {
        var a = job && job.module === 'spirit.app.icons' && job.app && job.app.icons;
        if (!a || typeof a !== 'object') return;
        var V = D.viewAt(job.fromNode || null, 'spirit.app.icons');
        if (a.removed) { if (a.glyph) V.del(ICONS + '/' + String(a.glyph)); return; }
        var r = a.row;
        if (r && typeof r === 'object' && r.glyph) V.set(ICONS + '/' + String(r.glyph), { glyph: String(r.glyph), keywords: Array.isArray(r.keywords) ? r.keywords.map(String) : [] });
      },
    });
    // THE READS, ANSWERED HERE:
    //   rows()        every icon kept, glyph -> row
    //   row(glyph)    one icon, or null
    //   watch(fn)     fn(glyph, row) on every change, row undefined once it is gone; answers its release
    //   branch        the icons' whole path, for a list that is a view of it (probabilitySearch's data)
    return {
      rows: function () { return HOME.branch(ICONS); },
      row: function (glyph) { return glyph ? HOME.get(ICONS + '/' + glyph) || null : null; },
      watch: function (fn) { return HOME.watch(ICONS, function (whole, v) { if (typeof fn === 'function') fn(HOME.row(whole, ICONS), v); }); },
      get branch() { return HOME.path(ICONS); },
    };
  }));
}());
