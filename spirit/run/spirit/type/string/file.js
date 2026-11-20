'use strict';
// spirit/run/spirit/type/string/file.js
// THE TYPE spirit.type.string.file (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a file, one string value (the box: "spirit/type/string/file.js (one string value!)"): a file name alone, no folder in it, since a path never holds a file; nothing invisible, at most 255 bytes, a file system's own limit for one name.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.file.
// Its test: ./test/file.js.
(function (root) {
  var MAX_BYTES = 255;
  var BAD = [[0x0, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x200B, 0x200F], [0x2028, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F], [0xFEFF, 0xFEFF]];
  var INVISIBLE = { test: function (s) { for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var j = 0; j < BAD.length; j++) if (c >= BAD[j][0] && c <= BAD[j][1]) return true; } return false; } };
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return 'untitled'; },
    ruleDescription: function () { return 'a file: a name alone, no folder in it, nothing invisible, at most 255 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a file is a string');
      if (!v || v === '.' || v === '..') no('a file has a name');
      if (v.indexOf('/') !== -1 || v.indexOf(String.fromCharCode(92)) !== -1) no('a file is a name alone, no folder in it');
      if (INVISIBLE.test(v)) no('a file has no invisible or control characters');
      if (bytes(v) > MAX_BYTES) no('a file is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "string", "file"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
