// spirit/run/spirit/app/appSelector/detailElement.js
// ONE APP'S DETAIL (goal/G43.2). Its contract and its test: ./test/detailElement.md and ./test/detailElement.js.
//
//   spirit.elements.appDetail.create(host, { row, panel }) -> { destroy() }
//     panel true: the form under a title bar, which says the icon and label already.
//
// Its icon and label, the same row element a list row is, so nothing has to keep the two in sync (G30.18), and its
// (de)activate button (goal/G43.9, Q2: "in the detail as well.").
(function () {
  window.spirit.require('spirit/app/appSelector/rowElement.js');
  window.spirit.require('spirit/element/appInstaller.js');
  window.spirit.require('spirit/element/rowForm.js');
  window.spirit.require('spirit/element/fieldInput.js');
  window.spirit.require('spirit/element/icons/listElement.js');

  // THE PANEL'S FORM (goal/G43.9, as Andy drew it), rowForms under the title bar. What the node chose comes on the row, and follows
  // it; what <name>.json describes, whether it mounts a face or a server, is read as the panel opens, so it stays off the rows.
  function createPanel(host, row) {
    var S = window.spirit;
    var E = S.element;
    var key = String(row.key || '');
    var gone = false;
    var mounts = { face: false, server: false };
    var box = document.createElement('div');
    box.className = 'app-detail';
    var iconBox = document.createElement('div');
    var labelBox = document.createElement('div');
    var activeBox = document.createElement('div');
    var shellBox = document.createElement('div');
    // rule/2: every block carries a leading 1em. A bubble has none of its own here.
    [iconBox, labelBox, activeBox, shellBox].forEach(function (b) { b.style.marginTop = '1em'; });
    box.appendChild(iconBox);
    box.appendChild(labelBox);
    box.appendChild(activeBox);
    box.appendChild(shellBox);
    host.appendChild(box);
    function app() { return S.ready; }
    function current() { return S.data.app.data.rows()[key] || row; }
    // Andy: "row 0: rowForm: [✏️] "Icon" [iconSelector:dropdown] [Change]". A pick is held until Change.
    var iconForm = E.rowForm.create(iconBox, { icon: '✏️', button: 'Change' });
    var picked = '';
    iconForm.span.appendChild(document.createTextNode('Icon '));
    var iconShown = document.createElement('span');
    iconForm.span.appendChild(iconShown);
    var iconHost = document.createElement('span');
    iconForm.span.appendChild(iconHost);
    var iconList = E.iconList.create(iconHost, { face: 'dropdown', pick: function (r, glyph) { picked = glyph || ''; } });
    iconForm.button.addEventListener('click', function () {
      if (!picked) return;
      app().then(function (s) { return s.app.iconApp({ key: key, icon: picked }); }).then(null, function () { /* the row stays */ });
    });
    var labelForm = E.rowForm.create(labelBox, { icon: '✏️', button: 'Change' });
    var input = document.createElement('input');
    input.type = 'text';
    labelForm.span.appendChild(document.createTextNode('Label '));
    labelForm.span.appendChild(input);
    if (E.fieldInput) E.fieldInput.attach(input, 'name');
    labelForm.button.addEventListener('click', function () {
      app().then(function (s) { return s.app.labelApp({ key: key, label: input.value }); }).then(null, function () { /* not written: the row stays as the node last said */ });
    });
    // One form redrawn whole, as a form's icon is fixed when it is made. on is the state it shows.
    function flip(into, on, words, press) {
      into.innerHTML = '';
      var f = E.rowForm.create(into, { icon: on ? '🟢' : '🔴', button: on ? '🔴' : '🟢' });
      f.span.textContent = words;
      f.button.addEventListener('click', press);
    }
    function paint() {
      if (gone) return;
      var r = current();
      iconShown.innerHTML = '';
      E.icon.create(iconShown, { glyph: r.icon });
      if (document.activeElement !== input) input.value = String(r.label || '');
      var on = r.active === true;
      var parts = (mounts.face ? ['face'] : []).concat(mounts.server ? ['server'] : []);
      flip(activeBox, on, [(on ? 'Deactivate' : 'Activate'), r.label].concat(parts.length ? [parts.join(' and ')] : []).join(' '), function () {
        app().then(function (s) { return s.app.activeApp({ key: key, active: !on }); }).then(null, function () { /* the row stays */ });
      });
      shellBox.innerHTML = '';
      if (!mounts.face) return;
      var may = r.shell === true;
      flip(shellBox, may, (may ? "Don't allow " : 'Allow ') + r.label + ' as shell', function () {
        app().then(function (s) { return s.app.shellApp({ key: key, shell: !may }); }).then(null, function () { /* the row stays */ });
      });
    }
    var off = S.data.app.data.watchApp(key, paint);
    paint();
    app().then(function (s) { return s.fs.loadFile('spirit/app/' + key + '/' + key + '.json'); }).then(function (text) {
      var j = JSON.parse(String(text));
      mounts = { face: !!(j.shell && j.shell.mount === true), server: !!(j.node && j.node.mount === true) };
      paint();
    }).then(null, function () { /* a face that may not read the file: the form says nothing of what it mounts */ });
    return { destroy: function () { gone = true; off(); iconList.destroy(); host.innerHTML = ''; } };
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
