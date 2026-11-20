'use strict';
// spirit/run/spirit/type/string/lineFilter.js
// THE TYPE spirit.type.string.lineFilter (goal/G48.4, Q1, Andy: "a search filter for anything is a different field type, if
// it has different rules: like spirit/type/string/ID.js is not the same as spirit/type/object/IDFilter.js. it's THAT
// simple."): the words a search narrows by, a line's filter: "" for everything, else one line of text, nothing invisible, at
// most 1024 bytes as spirit.type.string.line is. The same file on the node and on a page: on the node it is this module, on a
// page it stands at spirit.required.spirit.type.string.lineFilter. Its test: ./test/lineFilter.js.
(function (root) {
  var MAX_BYTES = 1024;
  var BAD = [[0x0, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x200B, 0x200F], [0x2028, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F], [0xFEFF, 0xFEFF]];
  var INVISIBLE = { test: function (s) { for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var j = 0; j < BAD.length; j++) if (c >= BAD[j][0] && c <= BAD[j][1]) return true; } return false; } };
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return ''; },
    ruleDescription: function () { return 'the words a search narrows by: empty for everything, else one line, nothing invisible, at most 1024 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a search\'s words are a string');
      var n = v.normalize('NFC').replace(/\s+/g, ' ').trim();
      if (INVISIBLE.test(n)) no('a search\'s words have no invisible or control characters');
      if (bytes(n) > MAX_BYTES) no('a search\'s words are at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'lineFilter'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
