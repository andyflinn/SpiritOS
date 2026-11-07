// spirit/run/spirit/app/appSelector/detailElement.js
// ONE APP'S DETAIL (goal/G43.2). Its contract and its test: ./test/detailElement.md and ./test/detailElement.js.
//
//   spirit.elements.appDetail.create(host, { row, panel }) -> { destroy() }
//     panel true: the form under a title bar, which says the icon and label already.
//
// Its icon and label, the same row element a list row is, so nothing has to keep the two in sync (G30.18), and its
// (de)activate button (goal/G43.9, Q2: "in the detail as well.").
(function () {
  window.spirit.require('spirit/element/search/app/rowElement.js');
  window.spirit.require('spirit/element/appInstaller.js');
  // goal/G43.15: the switches are elements of their own, each hiding itself where it does not apply.
  window.spirit.require('spirit/app/appSelector/rowFormAppActive.js');
  window.spirit.require('spirit/app/appSelector/serverDEBUG.js');
  window.spirit.require('spirit/app/appSelector/rowFormSetShell.js');
  window.spirit.require('spirit/app/appSelector/changeAppIcon.js');
  window.spirit.require('spirit/app/appSelector/changeAppLabel.js');

  // THE PANEL'S FORM (goal/G43.9, as Andy drew it), rowForms under the title bar. What the node chose comes on the row, and follows
  // it; what <name>.json describes, whether it mounts a face or a server, is read by the switch from the file, again each time its row changes, so it stays off the rows.
  function createPanel(host, row) {
    var S = window.spirit;
    var key = String(row.key || '');
    var box = document.createElement('div');
    box.className = 'app-detail';
    var iconBox = document.createElement('div');
    var labelBox = document.createElement('div');
    var activeBox = document.createElement('div');
    var debugBox = document.createElement('div');
    var homeShellBox = document.createElement('div');
    var faceShellBox = document.createElement('div');
    // rule/2: every block carries a leading 1em: a rowForm carries its own since goal/G43.15, so a hidden one takes it along.
    box.appendChild(iconBox);
    box.appendChild(labelBox);
    box.appendChild(activeBox);
    box.appendChild(debugBox);
    box.appendChild(homeShellBox);
    box.appendChild(faceShellBox);
    host.appendChild(box);
    // THE ICON AND THE LABEL (goal/G43.15, Q4): elements of their own, so an app's own face can show them too.
    var icon = S.elements.changeAppIcon.create(iconBox, { key: key });
    var label = S.elements.changeAppLabel.create(labelBox, { key: key });
    // THE SWITCHES (goal/G43.15): Activate/Deactivate, DEBUG right after it (Q1); each hides itself. The allow-as-shell row went
    // (goal/G43.18, box v29: its element is deleted, <name>.json alone says whether an app may be a shell).
    var active = S.elements.rowFormAppActive.create(activeBox, { key: key });
    var debug = S.elements.serverDEBUG.create(debugBox, { key: key });
    // THE HOME SHELL AND THE FACE SHELL (goal/G43.18, box v29): two rows of their own, each showing only for an app whose
    // <name>.json says shell:true:true; the RULE: a shell must be able to replace itself.
    var homeShell = S.elements.rowFormSetShell.create(homeShellBox, { key: key, at: 'home' });
    var faceShell = S.elements.rowFormSetShell.create(faceShellBox, { key: key, at: 'face' });
    return { destroy: function () { icon.destroy(); label.destroy(); active.destroy(); debug.destroy(); homeShell.destroy(); faceShell.destroy(); host.innerHTML = ''; } };
  }

  function create(host, opts) {
    // No app, no detail, and nothing to listen for.
    if (!opts || !opts.row) return { destroy: function () { host.innerHTML = ''; } };
    if (opts.panel) return createPanel(host, opts.row);
    var row = window.spirit.element.search.app.rowElement.create(opts.row);
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
    var installer = window.spirit.element.appInstaller.create(button, { path: 'spirit/app/' + key + '/' + key + '.js' });
    host.appendChild(box);
    return {
      destroy: function () { installer.destroy(); row.destroy(); host.innerHTML = ''; },
    };
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.appDetail = { create: create };
}());
