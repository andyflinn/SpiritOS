'use strict';
// spirit/run/spirit/type/string/paragraph.js
// THE TYPE spirit.type.string.paragraph (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a paragraph, text with its line breaks and tabs kept, never empty, nothing else invisible, at most 2048 bytes (fieldRules.js PARAGRAPH_MAX_BYTES).
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.paragraph.
// Its test: ./test/paragraph.js.
(function (root) {
  var MAX_BYTES = 2048;
  var BAD = [[0x0, 0x8], [0xB, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x200B, 0x200F], [0x2028, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F], [0xFEFF, 0xFEFF]];
  var INVISIBLE = { test: function (s) { for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var j = 0; j < BAD.length; j++) if (c >= BAD[j][0] && c <= BAD[j][1]) return true; } return false; } };
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return 'nothing written yet'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a paragraph is a string');
      var n = v.normalize('NFC').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
      if (!n.trim()) no('a paragraph is not empty');
      if (INVISIBLE.test(n)) no('a paragraph has no invisible or control characters');
      if (bytes(n) > MAX_BYTES) no('a paragraph is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "string", "paragraph"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
