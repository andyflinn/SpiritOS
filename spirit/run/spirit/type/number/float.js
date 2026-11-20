'use strict';
// spirit/run/spirit/type/number/float.js
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
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'number', 'float'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
