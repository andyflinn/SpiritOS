'use strict';
// spirit/run/spirit/type/string/json.js
// THE TYPE spirit.type.string.json (goal/G48.4, Q3, Andy: "make spirit/type/string/json.js and set the limit same as payload,
// but verify parsing...."): JSON carried inside a string, valid only when it parses, at most the node's payload limit,
// spirit/limits/script.js PAYLOAD_MAX, in bytes. The same file on the node and on a page: on the node it is this module, on a page
// it stands at spirit.required.spirit.type.string.json. Its test: ./test/json.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../script.js');
(function (root) {
  // The node's own limit, read where it is defined, through spirit.requireScript: on the node its module, on a page what
  // spirit.required holds once it is in.
  var S0 = root && root.spirit;
  // Kept from what spirit.requireScript hands back (goal/G49.9): on the node its module at once, on a page once it is loaded.
  var L = null;
  var askedL = S0 && typeof S0.requireScript === 'function' ? S0.requireScript('spirit/limits/script.js') : null;
  if (askedL && typeof askedL.then === 'function') askedL.then(function (m) { L = m; }, function () { /* not loaded */ }); else L = askedL;
  function limit() {
    var at = L;
    return at && typeof at.PAYLOAD_MAX === 'number' ? at.PAYLOAD_MAX : 22528;
  }
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: limit(),
    defaultValue: function () { return '{}'; },
    ruleDescription: function () { return 'JSON in a string: it must parse, and fit in the node\'s payload limit'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('JSON in a string is a string');
      if (bytes(v) > T.MAX_BYTES) no('JSON in a string is at most ' + T.MAX_BYTES + ' bytes');
      try { JSON.parse(v); } catch (e) { no('JSON in a string must parse: ' + ((e && e.message) || 'it does not')); }
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
