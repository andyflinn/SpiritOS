'use strict';
// spirit/run/spirit/type/number/UTC.js
// THE TYPE spirit.type.number.UTC (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a date as a number (the box: "YES, DATE IS A FUCKING NUMBER"): whole milliseconds since 1970-01-01 UTC, as Date.now() answers it.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.number.UTC.
// Its test: ./test/UTC.js.
(function (root) {
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return 0; },
    ruleDescription: function () { return 'a UTC date: whole milliseconds since 1970'; },
    isValid: function (v) {
      if (typeof v !== 'number' || !isFinite(v)) no('a UTC date is a number, milliseconds since 1970');
      if (Math.floor(v) !== v) no('a UTC date is whole milliseconds');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "number", "UTC"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
