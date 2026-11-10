'use strict';
// spirit/run/spirit/app/appSelector/changeAppIcon.js
// ONE APP'S ICON, ONE rowForm (goal/G43.15; Andy: "i thought you'd make the changeAppLabel and changeAppIcon form elements as
// well, in spirit/app/ then i can re-use them as is in the config right side panel of agent", Q4: "yes."). Its row as Andy drew
// it for the detail: "row 0: rowForm: [✏️] "Icon" [iconSelector:dropdown] [Change]".
//
//   spirit.elements.changeAppIcon.create(host, { key }) -> { destroy() }
//
// It shows the row's icon in spirit.data.app and follows it; a pick is held until Change, which asks the node, spirit.app.iconApp,
// and the row the stream then brings redraws it.
(function () {
  window.spirit.require('spirit/element/rowForm.js');
  window.spirit.require('spirit/element/icon.js');
  window.spirit.require('spirit/element/search/icon/listElement.js');
  window.spirit.cacheManager('app');

  function create(host, options) {
    var S = window.spirit;
    var E = S.element;
    var key = String((options && options.key) || '');
    var gone = false;
    var picked = '';
    // NO APP NAMED, NOTHING TO FOLLOW (goal/G41.19, box v23: an element missing its options "mounts and says it is not
    // configured"): it watches no row and asks nothing.
    if (!key) { host.textContent = 'No app named: not configured.'; return { destroy: function () { host.innerHTML = ''; } }; }
    function row() { var A = S.data.app && S.data.app.data; return A ? A.rows()[key] || null : null; }
    var form = E.spirit.element.rowForm.create(host, { icon: '✏️', button: 'Change' });
    form.span.appendChild(document.createTextNode('Icon '));
    var shown = document.createElement('span');
    form.span.appendChild(shown);
    var listHost = document.createElement('span');
    form.span.appendChild(listHost);
    var list = E.spirit.element.search.icon.listElement.create(listHost, { face: 'dropdown', pick: function (r, glyph) { picked = glyph || ''; } });
    form.button.addEventListener('click', function () {
      if (!picked) return;
      S.ready.then(function (s) { return s.app.iconApp({ key: key, icon: picked }); }).then(null, function () { /* the row stays */ });
    });
    function paint() {
      if (gone) return;
      var r = row();
      shown.innerHTML = '';
      if (r) E.spirit.element.icon.create(shown, { glyph: r.icon });
    }
    function ask() {
      S.ready.then(function (s) { return s.app.searchApp({ q: '' }); }).then(function (got) {
        if (!gone) S.data.seatRows(S.data.app.data.branch, got.items);
      }, function () { /* the row comes with the stream */ });
    }
    var offRow = S.data.app.data.watchApp(key, paint);
    var offAll = S.data.app.data.watch(function (k) { if (!k) ask(); });
    if (!row()) ask();
    paint();
    return { destroy: function () { gone = true; offRow(); offAll(); list.destroy(); host.innerHTML = ''; } };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/appSelector/changeAppIcon.js', { create: create }); });
}());
