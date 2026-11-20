'use strict';
// spirit/run/spirit/type/string/fileContent.js
// THE TYPE spirit.type.string.fileContent (goal/G48.4, Q2, Andy: "make a field type spirit/type/string/fileContent.js that
// allows this.", to "fs save takes a file's whole content, any text up to the node's payload limit"): a file's whole content,
// any text, empty too, at most the node's payload limit, spirit/limits.js PAYLOAD_MAX, in bytes. The same file on the node
// and on a page: on the node it is this module, on a page it stands at spirit.required.spirit.type.string.fileContent.
// Its test: ./test/fileContent.js.
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
    defaultValue: function () { return ''; },
    ruleDescription: function () { return 'a file\'s content: any text, empty too, at most the node\'s payload limit in bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a file\'s content is a string');
      if (bytes(v) > T.MAX_BYTES) no('a file\'s content is at most ' + T.MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'fileContent'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
