'use strict';
// spirit/run/spirit/type/string/word.js
// THE TYPE spirit.type.string.word (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a word, one word that survives being read aloud: 1 to 32 letters, digits, dots, underscores or dashes (fieldRules.js spokenOk).
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.word.
// Its test: ./test/word.js.
(function (root) {
  var WORD = /^[A-Za-z0-9._-]{1,32}$/;
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return 'word'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a word is a string');
      if (!WORD.test(v)) no('a word is 1 to 32 letters, digits, dots, underscores or dashes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "string", "word"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
