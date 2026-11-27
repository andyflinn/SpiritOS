'use strict';
// spirit/run/spirit/fuckingGarbage/joinLink/script.js
// THE CALLER'S JOIN LINK, HELD HERE UNTIL IT FINDS ITS HOME (goal/G49.23, box v22 Part 1: "joinLink to
// spirit/fuckingGarbage/joinLink/script.js, the join form requiring it by that path"; goal/G40.10, box v25, Andy: "the join-app-link,
// which only the shell really knows"): it stood on the shell's hand-made object, put there by the shell's boot; a required
// script hands it out instead.
//
//   joinLink()  this page opening Join: its origin and path, then ?app=join; the relay adds its code and key to it and mails it.
//               At home the node's /, on a relay this face.
//
// Its test: ./test/script.js.
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../script.js');
(function (root) {
  function joinLink() {
    var loc = (root && root.location) || {};
    return String(loc.origin || '') + String(loc.pathname || '') + '?app=join';
  }
  // What it hands out goes through the loader's module box, on a page as in node (goal/G49.9): an object holding the function.
  if (typeof module !== 'undefined' && module) module.exports = { joinLink: joinLink };
}(typeof window !== 'undefined' ? window : globalThis));
