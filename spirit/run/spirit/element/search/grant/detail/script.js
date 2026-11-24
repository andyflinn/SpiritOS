'use strict';
// spirit/run/spirit/element/search/grant/detail/script.js
// ONE GRANT, ITS DETAIL (goal/G43.32, the box: "every branch's search is search/<branch>.js, the selector, and its folder
// holds list.js, row.js and detail.js"), OF WHICHEVER GRANTS TABLE ITS CALLER HANDS IT, as the list and
// the row take it (goal/G41.16): it names no table. A grant is an ID and a path; its detail says whose it is and which path,
// as it is, served today or not (goal/G47.4), and its Revoke, an armingButton (Andy, on G41.13: "a
// armingButton [Revoke], which must revoke/delete that grant in the database"), in one rowForm. Its test:
// ./test/detail.js.
//
//   spirit.required.spirit.element.search.grant.detail.create(host, { row, grants }) -> { destroy() }
//     row      the grant row, its id and whose grant it is in the fields its table names
//     grants   the grants table, as the list takes it: { key, label, revoke(id, path), watch(fn(id + newline + path, row)) }
// What a press did is said below the bubble, the mounter's line (rowForm). Unconfigured, it draws a note and throws nothing.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/rowForm/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/armingButton/script.js');
  var parts = Promise.all(['spirit/element/rowForm/script.js', 'spirit/element/armingButton/script.js'].map(function (p) { return window.spirit.requireScript(p); }));
  function create(host, opts) {
    var o = opts || {};
    var g = o.grants;
    var r = o.row || {};
    var gone = false;
    var box = document.createElement('div');
    // IT SCROLLS ITS OWN BODY, filling the panel under the panel's title bar, which stays (Q21, Andy: the panel itself scrolling
    // is "the wrong spot, any content then would have a hard time making its toolbar stick to the top"): a grant has no toolbar
    // of its own, so the whole of it scrolls.
    box.className = 'fill';
    if (box.style) box.style.overflow = 'auto';
    host.appendChild(box);
    if (!g || !g.key || !g.label || typeof g.revoke !== 'function' || !o.row) {
      box.className = 'job-manifest-note';
      // A note, not a body: it keeps its words inside and scrolls nothing.
      if (box.style) box.style.overflow = 'hidden';
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
      form.span.textContent = label + ' · ' + path;
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
      // ONE ROW, as every rowForm: the icon, whose grant and its path, and Revoke the last.
      form = ANSWER['spirit/element/rowForm/script.js'].create(box, { icon: '🔒', button: 'Revoke' });
      paint();
      said = document.createElement('div');
      box.appendChild(said);
      ANSWER['spirit/element/armingButton/script.js'].attach(form.button, { label: 'Revoke', run: function () {
        said.textContent = '';
        return Promise.resolve(g.revoke(id, path)).then(function () { if (!gone) said.textContent = 'revoked'; },
          function (e) { if (!gone) said.textContent = String((e && e.message) || e); });
      } });
    });
    // Destroy leaves its host empty, as every element.
    return { destroy: function () { gone = true; if (typeof off === 'function') off(); host.innerHTML = ''; } };
  }
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
