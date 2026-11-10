'use strict';
// spirit/run/spirit/element/search/api/detailElement.js
// ONE FAMILY'S VERBS, THE API SEARCH'S DETAIL (goal/G43.32; Andy: "uniformity, in the search elements and their folders,
// contain list, row an detail elements."): what a family is, read from the api tree its list was painted from: each verb it
// serves and the fields its request takes. It shows; it asks nothing and changes nothing. The owner's DEBUG is no verb
// offered (spirit/client/apiTreeIndex.js verbs), so it is not shown. Its contract and its test: ./test/detailElement.md
// and ./test/detailElement.js.
//
//   spirit.element.spirit.element.search.api.detailElement.create(host, { family, tree }) -> { destroy() }
//     family   the family's name
//     tree     the api tree the list holds (root.tree): { <family>: { <verb>: { request, ... } } }
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the reader of the api tree.
  var parts = Promise.resolve(S.require('spirit/client/apiTreeIndex.js'));

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  function create(host, options) {
    var o = options || {};
    var family = String(o.family || '');
    var tree = o.tree && typeof o.tree === 'object' ? o.tree : null;
    var gone = false;
    var box = document.createElement('div');
    box.className = 'api-family-detail';
    host.appendChild(box);
    parts.then(function () {
      if (gone) return;
      var verbs = tree ? S.apiTreeIndex.verbs(tree, family) : [];
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
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search/api/detailElement.js', { create: create }); });
}());
