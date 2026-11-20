'use strict';
// spirit/run/spirit/type/boolean.js
// THE TYPE spirit.type.boolean (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a boolean, true or false and nothing else (the box: "still have to make sure it's actually a fucking boolean"; "\"flags\" must be booleans").
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.boolean.
// Its test: ./test/boolean.js.
(function (root) {
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return false; },
    isValid: function (v) {
      if (v !== true && v !== false) no('a boolean is true or false');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "boolean"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
