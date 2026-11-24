'use strict';
// spirit/run/spirit/type/number/probability.js
// THE TYPE spirit.type.number.probability (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a probability, a number from 0 to 1.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.number.probability.
// Its test: ./test/probability.js.
(function (root) {
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return 0; },
    ruleDescription: function () { return 'a probability: a number from 0 to 1'; },
    isValid: function (v) {
      if (typeof v !== 'number' || !isFinite(v)) no('a probability is a number');
      if (v < 0 || v > 1) no('a probability is from 0 to 1');
      return true;
    },
  };
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
