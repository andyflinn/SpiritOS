'use strict';
// spirit/run/spirit/type/object/payload.js
// THE TYPE spirit.type.object.payload (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a payload, a plain object, never a list or null.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.object.payload.
// Its test: ./test/payload.js.
(function (root) {
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return {}; },
    ruleDescription: function () { return 'a payload: an object, never a list or null'; },
    isValid: function (v) {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) no('a payload is an object');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "object", "payload"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
