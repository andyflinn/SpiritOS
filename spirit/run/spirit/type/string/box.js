'use strict';
// spirit/run/spirit/type/string/box.js
// THE TYPE spirit.type.string.box (goal/G48.4, the box: "\"text\" dies. unlimited strings are forbidden in SpiritOS."; Andy:
// "fix them all!"): the text of a Desk item's box, empty too ("An empty box is a box", desk's api.js), at most the node's
// payload limit, spirit/limits.js PAYLOAD_MAX, in bytes, what one message carries. The same file on the node and on a page:
// on the node it is this module, on a page it stands at spirit.required.spirit.type.string.box.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../spirit.js');
(function (root) {
  // The node's own limit, read where it is defined, through spirit.requireScript: on the node its module, on a page what
  // spirit.required holds once it is in.
  var S0 = root && root.spirit;
  // Kept from what spirit.requireScript hands back (goal/G49.9): on the node its module at once, on a page once it is loaded.
  var L = null;
  var askedL = S0 && typeof S0.requireScript === 'function' ? S0.requireScript('spirit/limits.js') : null;
  if (askedL && typeof askedL.then === 'function') askedL.then(function (m) { L = m; }, function () { /* not loaded */ }); else L = askedL;
  function limit() {
    var at = L;
    return at && typeof at.PAYLOAD_MAX === 'number' ? at.PAYLOAD_MAX : 22528;
  }
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: limit(),
    defaultValue: function () { return ''; },
    ruleDescription: function () { return 'a box: any text, empty too, at most the node\'s payload limit'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a box is a string');
      if (bytes(v) > T.MAX_BYTES) no('a box is at most ' + T.MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
