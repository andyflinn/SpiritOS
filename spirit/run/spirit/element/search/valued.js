// spirit/run/spirit/element/search/valued.js
// LABEL AND VALUE ROWS, SEARCHABLE (goal/G43.6). Andy, box: "It will be spirit.element.valued, on disc and in spirit", "a list of
// a name and a value, one per line, with an optional group", "It is searchable (probabilitySearch), over rows it already holds,
// with no node verb." Since goal/G43.18 (Q5) it is spirit/element/search/valued.js on disc and spirit.element.search.valued in
// spirit. Its contract and its test: ./test/valued.md and ./test/valued.js.
//
//   spirit.element.search.valued.create(container, { rows(), columns }) -> { redraw(), destroy() }
//     rows()     the rows as they stand now, each { group, name, value }; a row with no key is known by its group and name
//     columns    the columns, as probabilitySearch takes them; the caller names them
//     redraw()   what rows() says now; the search words and the scroll stay
//
// Rule/16: its container states its size; the list scrolls inside it.
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.resolve(window.spirit.require('spirit/element/search.js'));

  function keyed(row) {
    return row && row.key == null ? Object.assign({ key: String(row.group || '') + '/' + String(row.name) }, row) : row;
  }

  function create(container, options) {
    var o = options || {};
    var gone = false;
    var list = null;
    var root = document.createElement('div');
    root.className = 'fill';
    container.appendChild(root);
    parts.then(function () {
      if (gone) return;
      list = E.search.create(root, {
        columns: o.columns,
        rows: function () { return (typeof o.rows === 'function' ? o.rows() : []).map(keyed); },
      });
    });
    return {
      redraw: function () {
        if (!list) return;
        // A list that was searched goes to its top when it draws; a repaint is no search, so the scroll stays where it was.
        var at = root.querySelector('[id^="probsearch-"][id$="-list"]');
        var top = at ? at.scrollTop : 0;
        list.redraw();
        if (at) at.scrollTop = top;
      },
      destroy: function () {
        gone = true;
        if (list) list.destroy();
        list = null;
        if (root.parentNode === container) container.removeChild(root);
      },
    };
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  Object.assign(['search', 'valued'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, E), { create: create });
}());
