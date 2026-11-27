'use strict';
// spirit/run/spirit/fuckingGarbage/factRow/script.js
// THE OLD SHELL'S FACT ROW, HELD HERE UNTIL IT FINDS ITS HOME (goal/G49.23, box v22 Part 1: "factRow to
// spirit/fuckingGarbage/factRow/script.js, the contact detail requiring it by that path"): it stood on the shell's hand-made object,
// put there by the shell's boot; a required script hands it out instead.
//
//   factRow(pairs)  pairs of [label, value], escaped, drawn as the old shell drew its fact row (Relay Details, Contact)
//
// Its test: ./test/script.js.
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../script.js');
(function (root) {
  function esc(s) {
    var S = root && root.spirit;
    if (S && typeof S.escapeHtml === 'function') return S.escapeHtml(s);
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function factRow(pairs) {
    return '<div class="fact-row">' + (pairs || []).map(function (pair) {
      return '<div class="fact">' +
        '<span class="fact-label">' + esc(String(pair[0])) + '</span>' +
        '<span class="fact-value">' + esc(String(pair[1])) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }
  // What it hands out goes through the loader's module box, on a page as in node (goal/G49.9): an object holding the function.
  if (typeof module !== 'undefined' && module) module.exports = { factRow: factRow };
}(typeof window !== 'undefined' ? window : globalThis));
