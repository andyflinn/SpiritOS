'use strict';
// spirit/run/spirit/app/testicle/element/search/suite/rowElement.js
// A SUITE ROW, AN ELEMENT (goal/G47.1, the UI cycle): one suite row of testicle's suite table as ./listElement.js draws it, on
// the shared row element (spirit/element/rowElement.js). Its fields: the suite's filename, and its status, "needs running"
// while the row is flagged, shown red (the box: "the filename AND its status \"needs running\", which will be shown as red
// in the UI").
//
// ITS 🏃‍♂️ (goal/G47.1, the run cycle, the box: "The 🏃‍♂️ column is on every row of the script detail tab, the first column,
// each row's button running its own suite", "The button is the busy button exactly as it is"): the first field, a busy button
// in its cell asking testicle.run {script, suite} for the row's own script and suite; busy until run answers, nothing after.
//
//   spirit.element.spirit.app.testicle.element.search.suite.rowElement.create(row) -> the row element
(function () {
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the data they
  // display"; box v140; rule 26): testicle's api.js and its cache manager, data.js, which the page's one stream feeds; mounted
  // alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.require === 'function') Promise.resolve(window.spirit.require('spirit/app/testicle/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.cacheManager === 'function') Promise.resolve(window.spirit.cacheManager('testicle')).catch(function () {});
  var S = window.spirit = window.spirit || {};
  S.require('spirit/element/rowElement.js');
  S.require('spirit/element/busyButton.js');
  // A node with no testicle refuses its interface: the row draws no run button (below); the refusal is never left unhandled.
  Promise.resolve(S.require('spirit/app/testicle/api.js')).catch(function () {});

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  var index = null;
  function create(row) {
    var R = S.element.spirit.element.rowElement;
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
        var made = Promise.all([S.require('spirit/element/busyButton.js'), S.require('spirit/app/testicle/api.js')]).then(function () {
          if (button !== made) return;
          button = S.element.spirit.element.busyButton.create(cell, { label: '🏃‍♂️', title: 'run this suite', className: 'suite-run',
            run: function () { return S.testicle.run({ script: String(r.script || ''), suite: String(r.suite || '') }); } });
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

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/testicle/element/search/suite/rowElement.js', { create: create }); });
}());
