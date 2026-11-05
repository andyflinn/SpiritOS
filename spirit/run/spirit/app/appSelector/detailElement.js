// spirit/run/spirit/app/appSelector/detailElement.js
// ONE APP'S DETAIL (goal/G43.2). Its contract and its test: ./test/detailElement.md and ./test/detailElement.js.
//
//   spirit.elements.appDetail.create(host, { row, panel }) -> { destroy() }
//     panel true: the bar above it already says the icon and label, so it says what spirit/app/<name>/<name>.json says instead
//     (Andy: "# info the detail panel, displayed based on spirit/app/<name>/<name>.json").
//
// Its icon and label, the same row element a list row is, so nothing has to keep the two in sync (G30.18), and its
// (de)activate button (goal/G43.9, Q2: "in the detail as well.").
(function () {
  window.spirit.require('spirit/app/appSelector/rowElement.js');
  window.spirit.require('spirit/element/appInstaller.js');

  // Read when the panel opens, so the fields stay off the rows and out of the tiles' tooltip. A face that may not read the file
  // says so, in place of an answer.
  var LINES = [
    ['mounts a face?', function (j) { return (j.shell || {}).mount; }],
    ['mounts a server?', function (j) { return (j.node || {}).mount; }],
    ['can mount as shell?', function (j) { return (j.shell || {}).true; }],
  ];
  function createPanel(host, row) {
    var key = String(row.key || '');
    var gone = false;
    var box = document.createElement('div');
    box.className = 'app-detail';
    var lines = document.createElement('div');
    var button = document.createElement('div');
    box.appendChild(lines);
    box.appendChild(button);
    host.appendChild(box);
    var installer = window.spirit.element.appInstaller.create(button, { path: 'spirit/app/' + key + '/' + key + '.js' });
    window.spirit.ready.then(function (s) { return s.fs.loadFile('spirit/app/' + key + '/' + key + '.json'); }).then(function (text) {
      return JSON.parse(String(text));
    }).then(null, function () { return null; }).then(function (j) {
      if (gone) return;
      LINES.forEach(function (l) {
        var d = document.createElement('div');
        d.textContent = l[0] + ' ' + (j ? (l[1](j) === true ? 'yes' : 'no') : 'not readable here');
        lines.appendChild(d);
      });
    });
    return { destroy: function () { gone = true; installer.destroy(); host.innerHTML = ''; } };
  }

  function create(host, opts) {
    // No app, no detail, and nothing to listen for.
    if (!opts || !opts.row) return { destroy: function () { host.innerHTML = ''; } };
    if (opts.panel) return createPanel(host, opts.row);
    var row = window.spirit.elements.appElement.create(opts.row);
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
