'use strict';
// spirit/run/spirit/app/agent/data.js
// WHAT A CLIENT KNOWS OF THE AGENT SERVER'S TABLES, IN THE agent FAMILY'S OWN FOLDER (goal/G41.28). Andy: "We're not done
// until every family of the API tree as a clientCacheManager, and clients can use that to organize their spirit.required.spirit.data". A
// page loads it through its api.js (spirit/app/agent/api.js), the one file that requires it; it runs the translator into that page's spirit.required.spirit.data, under the
// node that served the rows.
//
// THE BRANCHES ARE THIS FILE'S, AND ONLY THIS FILE NAMES THEM: every reader (the agent tables' lists and editors) asks
// spirit.required.spirit.data['spirit.app.agent'].data (below), never a branch by name.
//   job, model, persona, provider   id -> the row, one branch per table of the agent server
// The agent server publishes each row as it changes, its job's app { agent: { table, row } }, or { agent: { table, id,
// removed } } for one gone (./table/rowTable.js), moved here from the four tables' row elements (goal/G41.16): the row is
// merged into its table's branch, so the table's list and editors, views of that branch, follow it. Another table's
// rows, another module's, or a row with no id write nothing. It asks nothing.
(function family() {
  var TABLES = ['job', 'model', 'persona', 'provider'];
  var D = typeof require === 'function' ? require('../../script.js').requireScript('spirit/data/script.js') : window.spirit.required.spirit.data;
  // THE DATA SET IT FILES INTO, REQUIRED BY ITSELF (goal/G47.1, box v182: "It is loaded by that path with spirit.requireScript,
  // data.js exactly as api.js"): on a page that has not loaded spirit/data/script.js yet, this file loads it and runs again.
  if (!D) { window.spirit.requireScript('spirit/data/script.js').then(function () { if (window.spirit.required.spirit.data) family(); }); return; }
  D.makeFamily('spirit.app.agent', function () {
    var HOME = D.viewAt(null, 'spirit.app.agent');
    D.addTranslator({
      onJob: function (job) {
        var a = job && job.module === 'spirit.app.agent' && job.app && job.app.agent;
        if (!a || TABLES.indexOf(a.table) === -1) return;
        var V = D.viewAt(job.fromNode || null, 'spirit.app.agent');
        if (a.removed) { if (a.id) V.del(a.table + '/' + String(a.id)); return; }
        if (a.row && typeof a.row === 'object' && a.row.id) V.merge(a.table + '/' + String(a.row.id), a.row);
      },
    });
    // THE READS, ANSWERED HERE:
    //   branch(table)    a table's whole path, for a list that is a view of it (probabilitySearch's data) and for an
    //                    editor's row (branch + '/' + id); '' for a table the agent server has not
    //   row(table, id)   a row, or null
    //   job, model, persona, provider   each table its own branch: watch(fn) fn(id, row) on every change of it,
    //                    watch(id, fn) fn(row) each time that row is written, undefined once it is gone; each answers its
    //                    release (an editor, a tab following its row). A branch's watch is watch, the branch implied by the
    //                    object it is on (Andy, goal/G43.32: "that's a decision: a BRANCHE's what is called \"watch\"",
    //                    "the branch is already implied in it's containing object.")
    var agentReads = {
      tables: TABLES.slice(),
      branch: function (table) { return TABLES.indexOf(String(table)) === -1 ? '' : HOME.path(String(table)); },
      row: function (table, id) { return TABLES.indexOf(String(table)) !== -1 && id ? HOME.get(String(table) + '/' + id) || null : null; },
    };
    TABLES.forEach(function (t) {
      agentReads[t] = {
        watch: function (id, fn) {
          if (typeof id === 'function') { var all = id; return HOME.watch(t, function (whole, v) { all(HOME.row(whole, t), v); }); }
          if (!id) return function () {};
          return HOME.watch(t + '/' + id, function (whole, v) { if (typeof fn === 'function') fn(v); });
        },
      };
    });
    return agentReads;
  });
}());
