'use strict';
// spirit/run/spirit/app/testicle/element/search/suite/row.js
// A SUITE ROW, AN ELEMENT (goal/G47.1, the UI cycle): one suite row of testicle's suite table as ./list.js draws it, on
// the shared row element (spirit/element/row/script.js). Its fields: the suite's filename, and its status, "needs running"
// while the row is flagged, shown red (the box: "the filename AND its status \"needs running\", which will be shown as red
// in the UI").
//
// ITS 🏃‍♂️ (goal/G47.1, the run cycle, the box: "The 🏃‍♂️ column is on every row of the script detail tab, the first column,
// each row's button running its own suite", "The button is the busy button exactly as it is"): the first field, a busy button
// in its cell asking testicle.run {script, suite} for the row's own script and suite; busy until run answers, nothing after.
//
//   spirit.required.spirit.app.testicle.element.search.suite.row.create(row) -> the row element
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the data they
  // display"; box v140; rule 26): testicle's api.js and its cache manager, data.js, which the page's one stream feeds; mounted
  // alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});
  var S = window.spirit = window.spirit || {};
  keepAnswer('spirit/element/row/script.js');
  keepAnswer('spirit/element/busyButton/script.js');
  // A node with no testicle refuses its interface: the row draws no run button (below); the refusal is never left unhandled.
  Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  var index = null;
  function create(row) {
    var R = ANSWER['spirit/element/row/script.js'];
    var r = row || {};
    index = index || R.index(function () {});
    var el = R.create({
      kind: 'suite',
      key: String(r.key || ''),
      index: index,
      row: r,
      fields: [
        { name: 'run', paint: function () { return ''; } },
        { name: 'suite', paint: function (v) { return esc(v.suite); } },
        // goal/G47.1, the box: "needs running", "still red" or "green", the server's word; green shown green, the others red.
        { name: 'status', paint: function (v) { return v.status ? '<span class="suite-status" style="color:' + (v.status === 'green' ? '#080' : '#c00') + '">' + esc(v.status) + '</span>' : ''; } },
      ],
      actions: [],
    });
    // THE BUTTON, made anew in its cell at each draw; a press on it is its own, never the row's pick.
    var button = null;
    var mount = el.mount;
    el.mount = function (hosts) {
      mount(hosts);
      var cell = hosts && hosts.run;
      // A row of every suite, no script (the testicle search's suite selector with all scripts): nothing to run it for, no button.
      if (cell && !r.script) cell.innerHTML = '';
      if (cell && r.script) {
        cell.innerHTML = '';
        cell.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('button')) e.stopPropagation(); });
        // It may still be loading: made once it is in, unless the row was drawn again meanwhile.
        var made = Promise.all([keepAnswer('spirit/element/busyButton/script.js'), keepAnswer('spirit/app/testicle/api.js')]).then(function () {
          if (button !== made) return;
          button = ANSWER['spirit/element/busyButton/script.js'].create(cell, { label: '🏃‍♂️', title: 'run this suite', className: 'suite-run',
            run: function () { return ANSWER['spirit/app/testicle/api.js'].run({ script: String(r.script || ''), suite: String(r.suite || '') }); } });
        }, function () {
          // A node with no testicle refuses its interface: nothing to run the suite with, so no button.
          if (button === made) button = null;
        });
        button = made;
      }
      return el;
    };
    return el;
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
