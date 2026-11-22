'use strict';
// run/spirit/script.js
// THE SPIRIT OBJECT OF THE NEXT TREE (goal/G50.1, box v9: "repo://run/spirit/script.js", "server requires http and
// spirit/script.js"): one file, the same in node and on a page. In node it is what server/script.js requires; on a page
// index.html loads it with a script tag and it stands at window.spirit. It holds nothing yet but its name.
(function (root) {
  var spirit = { name: 'spirit' };
  if (typeof module !== 'undefined' && module.exports) module.exports = spirit;
  else root.spirit = spirit;
}(typeof window !== 'undefined' ? window : globalThis));
