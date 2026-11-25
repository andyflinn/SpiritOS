'use strict';
// spirit/run/spirit/type/string/file/script.js
// THE TYPE spirit.type.string.file (goal/G48.4, the box: "spirit/type/string/file/script.js (one string value!)"; Q7, Andy: "yes.",
// to "is that the whole path with slashes, as the file verbs take it today, spirit/app/desk/item.get.json?"): a file, one
// string, its whole path from the run folder with slashes: names joined by /, never one that leaves the run folder (no
// leading /, no drive, no .. and no . part, no backslash), nothing invisible, at most 1024 bytes. The same file on the node
// and on a page: on the node it is this module, on a page it stands at spirit.required.spirit.type.string.file.
// Its test: ./test/file.js.
(function (root) {
  var MAX_BYTES = 1024;
  var BAD = [[0x0, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x200B, 0x200F], [0x2028, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F], [0xFEFF, 0xFEFF]];
  var INVISIBLE = { test: function (s) { for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var j = 0; j < BAD.length; j++) if (c >= BAD[j][0] && c <= BAD[j][1]) return true; } return false; } };
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return 'untitled'; },
    ruleDescription: function () { return 'a file: its path from the run folder, names joined by /, never leaving it, at most 1024 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a file is a string');
      if (!v) no('a file has a name');
      if (v.indexOf(String.fromCharCode(92)) !== -1) no('a file\'s path uses /, never a backslash');
      if (v.charAt(0) === '/' || /^[A-Za-z]:/.test(v)) no('a file\'s path starts in the run folder');
      if (v.split('/').some(function (p) { return !p || p === '.' || p === '..'; })) no('a file\'s path has a name between each /, never . or ..');
      if (INVISIBLE.test(v)) no('a file has no invisible or control characters');
      if (bytes(v) > MAX_BYTES) no('a file is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
