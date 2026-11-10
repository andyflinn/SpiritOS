'use strict';
// spirit/run/spirit/app/icons/data.js
// WHAT A CLIENT KNOWS OF THE ICON SET, IN THE icons FAMILY'S OWN FOLDER (goal/G43.19; the box: "it implements a
// database-table interface, also reflected in api.js and data.js"). A page loads it through spirit.cacheManager('icons').
//
// THE BRANCH IS THIS FILE'S, AND ONLY THIS FILE NAMES IT: every reader (the Icons face) asks spirit.data.icons.data.
//   icons   glyph -> { glyph, keywords }, what icon.search answered (seated by the list that is a view of it), and every
//           row a run publishes: { icons: { row } } for a row added or changed, { icons: { glyph, removed: true } } for one
//           gone, as the job's app of spirit.app.icons (the box, 10: "data.js on every open page follows that one job").
// Every event ends in set or del; it asks nothing.
(function () {
  var ICONS = 'icons';
  var D = typeof window !== 'undefined' ? window.spirit.data : require('../../spirit.js').require('spirit/data.js');
  D.makeFamily('icons', function () {
    var HOME = D.viewAt(null, 'icons');
    D.addTranslator({
      onJob: function (job) {
        var a = job && job.module === 'spirit.app.icons' && job.app && job.app.icons;
        if (!a || typeof a !== 'object') return;
        var V = D.viewAt(job.fromNode || null, 'icons');
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
  });
}());
