'use strict';
// spirit/run/spirit/type/string/description/script.js
// THE TYPE spirit.type.string.description (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a description, a sentence, never empty, nothing invisible, at most 128 bytes (fieldRules.js DESCRIPTION_MAX_BYTES).
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.description.
// Its test: ./test/description.js.
(function (root) {
  var MAX_BYTES = 128;
  var BAD = [[0x0, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x200B, 0x200F], [0x2028, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F], [0xFEFF, 0xFEFF]];
  var INVISIBLE = { test: function (s) { for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var j = 0; j < BAD.length; j++) if (c >= BAD[j][0] && c <= BAD[j][1]) return true; } return false; } };
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function words(v) { return v.normalize('NFC').replace(/\s+/g, ' ').trim(); }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return "not described yet"; },
    ruleDescription: function () { return 'a description: a sentence, not empty, nothing invisible, at most 128 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a description is a string');
      var n = words(v);
      if (!n) no('a description is not empty');
      if (INVISIBLE.test(n)) no('a description has no invisible or control characters');
      if (bytes(n) > MAX_BYTES) no('a description is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
