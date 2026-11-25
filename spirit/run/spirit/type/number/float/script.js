'use strict';
// spirit/run/spirit/type/number/float/script.js
// THE TYPE spirit.type.number.float (goal/G48.4, Q23; Andy: "spirit.type.number.float", to "The relay detail's disc field
// takes gigabytes with two decimals, and no type holds a decimal"): a number that may have a fractional part, any finite
// number, such as a disc size of 1.5 gigabytes. The same file on the node and on a page: on the node it is this module, on
// a page it stands at spirit.required.spirit.type.number.float. Its test: ./test/float.js.
(function (root) {
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return 0; },
    ruleDescription: function () { return 'a float: a finite number, with or without a fractional part'; },
    isValid: function (v) {
      if (typeof v !== 'number') no('a float is a number');
      if (!isFinite(v)) no('a float is finite');
      return true;
    },
  };
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
