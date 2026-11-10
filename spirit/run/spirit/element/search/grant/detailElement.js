'use strict';
// spirit/run/spirit/element/search/grant/detailElement.js
// ONE GRANT, ITS DETAIL (goal/G43.32, the box: "every branch's search is search/<branch>.js, the selector, and its folder
// holds listElement.js, rowElement.js and detailElement.js"), OF WHICHEVER GRANTS TABLE ITS CALLER HANDS IT, as the list and
// the row take it (goal/G41.16): it names no table. A grant is an ID and a path; its detail says whose it is and which path,
// the path marked deprecated when no server serves it today, and its Revoke, an armingButton (Andy, on G41.13: "a
// armingButton [Revoke], which must revoke/delete that grant in the database"), in one rowForm. Its test:
// ./test/detailElement.js.
//
//   spirit.element.spirit.element.search.grant.detailElement.create(host, { row, grants, serves }) -> { destroy() }
//     row      the grant row, its id and whose grant it is in the fields its table names
//     grants   the grants table, as the list takes it: { key, label, revoke(id, path), watch(fn(id + newline + path, row)) }
//     serves(path)  whether a server serves that path today
// What a press did is said below the bubble, the mounter's line (rowForm). Unconfigured, it draws a note and throws nothing.
(function () {
  var parts = Promise.all(['spirit/element/rowForm.js', 'spirit/element/armingButton.js'].map(function (p) { return window.spirit.require(p); }));
  function create(host, opts) {
    var o = opts || {};
    var g = o.grants;
    var r = o.row || {};
    var gone = false;
    var box = document.createElement('div');
    host.appendChild(box);
    if (!g || !g.key || !g.label || typeof g.revoke !== 'function' || !o.row) {
      box.className = 'job-manifest-note';
      box.textContent = 'not configured: a grant row and its grants table are required ({ row, grants: { key, label, revoke } })';
      return { destroy: function () { host.innerHTML = ''; } };
    }
    var id = String(r[g.key] || '');
    var path = String(r.path || '');
    var form = null;
    var said = null;
    var label = String(r[g.label] || id);
    function paint() {
      if (!form) return;
      var deprecated = typeof o.serves === 'function' && !o.serves(path);
      form.span.textContent = label + ' · ' + path + (deprecated ? ' (deprecated: no server serves this path today)' : '');
    }
    // WHO PAINTS, LISTENS (Andy, G41.32): its row as its table's watch hands it, keyed <id>\n<path> as the grant row keys it; a
    // new label repaints, and a grant gone, revoked here or anywhere, says so.
    var off = typeof g.watch === 'function' ? g.watch(function (key, v) {
      if (gone || key !== id + '\n' + path) return;
      if (!v) { if (said) said.textContent = 'revoked'; return; }
      label = String(v[g.label] || id);
      paint();
    }) : null;
    parts.then(function () {
      if (gone) return;
      var E = window.spirit.element.spirit.element;
      // ONE ROW, as every rowForm: the icon, whose grant and its path, and Revoke the last.
      form = E.rowForm.create(box, { icon: '🔒', button: 'Revoke' });
      paint();
      said = document.createElement('div');
      box.appendChild(said);
      E.armingButton.attach(form.button, { label: 'Revoke', run: function () {
        said.textContent = '';
        return Promise.resolve(g.revoke(id, path)).then(function () { if (!gone) said.textContent = 'revoked'; },
          function (e) { if (!gone) said.textContent = String((e && e.message) || e); });
      } });
    });
    // Destroy leaves its host empty, as every element.
    return { destroy: function () { gone = true; if (typeof off === 'function') off(); host.innerHTML = ''; } };
  }
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/grant/detailElement.js', { create: create }); });
}());
