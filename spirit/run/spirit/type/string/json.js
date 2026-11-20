'use strict';
// spirit/run/spirit/type/string/json.js
// THE TYPE spirit.type.string.json (goal/G48.4, Q3, Andy: "make spirit/type/string/json.js and set the limit same as payload,
// but verify parsing...."): JSON carried inside a string, valid only when it parses, at most the node's payload limit,
// spirit/limits.js PAYLOAD_MAX, in bytes. The same file on the node and on a page: on the node it is this module, on a page
// it stands at spirit.required.spirit.type.string.json. Its test: ./test/json.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../spirit.js');
(function (root) {
  // The node's own limit, read where it is defined, through spirit.require: on the node its module, on a page what
  // spirit.required holds once it is in.
  var S0 = root && root.spirit;
  var L = S0 && typeof S0.require === 'function' ? S0.require('spirit/limits.js') : null;
  function limit() {
    var at = (L && typeof L.PAYLOAD_MAX === 'number') ? L : (S0 && S0.required && S0.required.spirit && S0.required.spirit.limits);
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
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'json'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
