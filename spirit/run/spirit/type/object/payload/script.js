'use strict';
// spirit/run/spirit/type/object/payload/script.js
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
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
