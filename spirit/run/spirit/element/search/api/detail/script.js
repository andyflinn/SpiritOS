'use strict';
// spirit/run/spirit/element/search/api/detail/script.js
// ONE FAMILY'S VERBS, THE API SEARCH'S DETAIL (goal/G43.32; Andy: "uniformity, in the search elements and their folders,
// contain list, row an detail elements."): what a family is, read from the api tree its list was painted from: each verb it
// serves and the fields its request takes. It shows; it asks nothing and changes nothing. The owner's DEBUG is no verb
// offered (spirit/fuckingGarbage/apiTreeIndex.js verbs), so it is not shown. Its contract and its test: ./test/script.md
// and ./test/detail.js.
//
//   spirit.required.spirit.element.search.api.detail.create(host, { family, tree }) -> { destroy() }
//     family   the family's name
//     tree     the api tree the list holds (root.tree): { <family>: { <verb>: { request, ... } } }
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the reader of the api tree.
  var parts = Promise.resolve(keepAnswer('spirit/fuckingGarbage/apiTreeIndex.js'));

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  function create(host, options) {
    var o = options || {};
    var family = String(o.family || '');
    var tree = o.tree && typeof o.tree === 'object' ? o.tree : null;
    var gone = false;
    var box = document.createElement('div');
    box.className = 'api-family-detail fill';
    // Its box declares its constraint (goal/G47.1, -browser): what it holds stays inside; a dropdown's list is a popover, above it.
    // IT SCROLLS ITS OWN BODY, filling its host under the panel's title bar, which stays (Q21, Andy: the panel itself scrolling
    // is "the wrong spot"); it has no toolbar of its own, so the whole of it scrolls.
    if (box.style) box.style.overflow = 'auto';
    host.appendChild(box);
    parts.then(function () {
      if (gone) return;
      var verbs = tree ? ANSWER['spirit/fuckingGarbage/apiTreeIndex.js'].verbs(tree, family) : [];
      box.innerHTML = '<div class="api-family-detail-name">' + esc(family) + '</div>' + (verbs.length ? verbs.map(function (v) {
        var spec = tree[family][v];
        var req = spec && spec.request && typeof spec.request === 'object' ? Object.keys(spec.request) : [];
        return '<div class="api-family-detail-verb" data-verb="' + esc(v) + '"><span class="api-family-detail-path">' + esc(family + '.' + v) + '</span> ' +
          '<span class="api-family-detail-request">' + esc(req.length ? '{ ' + req.join(', ') + ' }' : '{}') + '</span></div>';
      }).join('') : '<div class="job-log-empty">no verbs</div>');
    }, function () { if (!gone) box.textContent = 'The api tree could not be read.'; });
    return {
      destroy: function () {
        gone = true;
        if (box.parentNode) box.parentNode.removeChild(box);
      },
    };
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
