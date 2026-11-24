'use strict';
// spirit/run/spirit/element/search/app/detail/script.js
// ONE APP'S DETAIL (goal/G43.2). Its contract and its test: ./test/script.md and ./test/detail.js.
//
//   spirit.required.spirit.element.search.app.detail.create(host, { row, panel }) -> { destroy() }
//     panel true: the form under a title bar, which says the icon and label already.
//
// Its icon and label, the same row element a list row is, so nothing has to keep the two in sync (G30.18), and its
// (de)activate button (goal/G43.9, Q2: "in the detail as well.").
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  keepAnswer('spirit/element/search/app/row/script.js');
  keepAnswer('spirit/element/appInstaller/script.js');
  // goal/G43.15: the switches are elements of their own, each hiding itself where it does not apply.
  keepAnswer('spirit/element/search/app/rowFormAppActive/script.js');
  keepAnswer('spirit/element/search/app/serverDEBUG/script.js');
  keepAnswer('spirit/element/search/app/changeAppIcon/script.js');
  keepAnswer('spirit/element/search/app/changeAppLabel/script.js');
  // goal/G43.21, goal/G47.1: the Run row is the task row.
  keepAnswer('spirit/element/monitor/task/script.js');

  // THE PANEL'S FORM (goal/G43.9, as Andy drew it), rowForms under the title bar. What the node chose comes on the row, and follows
  // it; what <name>.json describes, whether it mounts a face or a server, is read by the switch from the file, again each time its row changes, so it stays off the rows.
  function createPanel(host, row) {
    var S = window.spirit;
    var key = String(row.key || '');
    var box = document.createElement('div');
    // IT SCROLLS ITS OWN BODY, filling its host under the panel's title bar, which stays (Q21, Andy: the panel itself scrolling
    // is "the wrong spot, any content then would have a hard time making its toolbar stick to the top"); it has no toolbar of
    // its own, so the whole of it scrolls.
    box.className = 'app-detail fill';
    if (box.style) box.style.overflow = 'auto';
    var iconBox = document.createElement('div');
    var labelBox = document.createElement('div');
    var activeBox = document.createElement('div');
    var debugBox = document.createElement('div');
    var runBox = document.createElement('div');
    // rule/2: every block carries a leading 1em: a rowForm carries its own since goal/G43.15, so a hidden one takes it along.
    box.appendChild(iconBox);
    box.appendChild(labelBox);
    box.appendChild(activeBox);
    box.appendChild(debugBox);
    box.appendChild(runBox);
    host.appendChild(box);
    // THE ICON AND THE LABEL (goal/G43.15, Q4): elements of their own, so an app's own face can show them too.
    var icon = ANSWER['spirit/element/search/app/changeAppIcon/script.js'].create(iconBox, { key: key });
    var label = ANSWER['spirit/element/search/app/changeAppLabel/script.js'].create(labelBox, { key: key });
    // THE SWITCHES (goal/G43.15): Activate/Deactivate, DEBUG right after it (Q1); each hides itself. The allow-as-shell row went
    // (goal/G43.18, box v29: its element is deleted, <name>.json alone says whether an app may be a shell).
    var active = ANSWER['spirit/element/search/app/rowFormAppActive/script.js'].create(activeBox, { key: key });
    var debug = ANSWER['spirit/element/search/app/serverDEBUG/script.js'].create(debugBox, { key: key });
    // RUN IS THE TASK ROW (goal/G43.21; Andy, the box: "the app detail will show a run button."; goal/G47.1: "yes make it an
    // improvement on the current run-rowForm in app and isolate it as spirit/element/monitor/task/script.js"): it shows only for an app
    // whose <name>.json says node.run, and offers Run, Cancel or Delete as its job stands.
    var task = ANSWER['spirit/element/monitor/task/script.js'].create(runBox, { id: 'spirit.app.' + key });
    return { destroy: function () { task.destroy(); icon.destroy(); label.destroy(); active.destroy(); debug.destroy(); host.innerHTML = ''; } };
  }

  function create(host, opts) {
    // No app, no detail, and nothing to listen for.
    if (!opts || !opts.row) return { destroy: function () { host.innerHTML = ''; } };
    if (opts.panel) return createPanel(host, opts.row);
    var row = ANSWER['spirit/element/search/app/row/script.js'].create(opts.row);
    var box = document.createElement('div');
    box.className = 'app-detail';
    var hosts = {};
    row.cells().forEach(function (c) {
      var cell = document.createElement('span');
      if (c.name !== 'icon') cell.style.marginLeft = '0.5em';
      box.appendChild(cell);
      hosts[c.name] = cell;
    });
    row.mount(hosts);
    var key = String(opts.row.key || '');
    var button = document.createElement('span');
    button.style.marginLeft = '0.5em';
    box.appendChild(button);
    var installer = ANSWER['spirit/element/appInstaller/script.js'].create(button, { path: 'spirit/app/' + key + '/' + key + '.js' });
    host.appendChild(box);
    return {
      destroy: function () { installer.destroy(); row.destroy(); host.innerHTML = ''; },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
