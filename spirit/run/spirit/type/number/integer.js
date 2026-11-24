'use strict';
// spirit/run/spirit/type/number/integer.js
// THE TYPE spirit.type.number.integer (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): an integer, a whole number.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.number.integer.
// Its test: ./test/integer.js.
(function (root) {
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return 0; },
    ruleDescription: function () { return 'an integer: a whole number'; },
    isValid: function (v) {
      if (typeof v !== 'number' || !isFinite(v)) no('an integer is a number');
      if (Math.floor(v) !== v) no('an integer is a whole number');
      return true;
    },
  };
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
