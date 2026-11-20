'use strict';
// spirit/run/spirit/type/string/json.js
// THE TYPE spirit.type.string.json (goal/G48.4, Q3, Andy: "make spirit/type/string/json.js and set the limit same as payload,
// but verify parsing...."): JSON carried inside a string, valid only when it parses, at most the node's payload limit,
// spirit/limits.js PAYLOAD_MAX, in bytes. The same file on the node and on a page: on the node it is this module, on a page
// it stands at spirit.required.spirit.type.string.json. Its test: ./test/json.js.
(function (root) {
  // The node's own limit, read where it is defined: required on the node, what spirit.required holds on a page.
  function limit() {
    var L = null;
    if (typeof module === 'object' && module && module.exports && typeof require === 'function') { try { L = require('../../limits.js'); } catch (e) { L = null; } }
    else L = root && root.spirit && root.spirit.required && root.spirit.required.spirit && root.spirit.required.spirit.limits;
    return L && typeof L.PAYLOAD_MAX === 'number' ? L.PAYLOAD_MAX : 22528;
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
