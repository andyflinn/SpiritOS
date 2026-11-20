'use strict';
// spirit/run/spirit/type/string/ID.js
// THE TYPE spirit.type.string.ID (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): an ID, a public key (the box: "spirit/type/string/ID.js (public keys)"): an Ed25519 key in its SPKI form, base64, as every key on this network is written, always 60 characters.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.ID.
// Its test: ./test/ID.js.
(function (root) {
  var KEY = /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/;
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '='; },
    isValid: function (v) {
      if (typeof v !== 'string') no('an ID is a string');
      if (!KEY.test(v)) no('an ID is a public key: MCowBQYDK2VwAyEA, 43 more base64 characters, then =');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "string", "ID"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
