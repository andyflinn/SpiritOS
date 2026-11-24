'use strict';
// spirit/run/spirit/type/string/glyph.js
// THE TYPE spirit.type.string.glyph (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a glyph, one character as a reader sees one, at most 32 bytes, so an emoji joined from parts fits too (Andy: "glyphs are capped at 32 bytes, one character.").
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.glyph.
// Its test: ./test/glyph.js.
(function (root) {
  var MAX_BYTES = 32;
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  function count(s) {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') { var n = 0; var it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s)[Symbol.iterator](); while (!it.next().done) n += 1; return n; }
    return Array.from(s).length;
  }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return '?'; },
    ruleDescription: function () { return 'a glyph: one character, at most 32 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string' || !v.trim()) no('a glyph is needed');
      var s = v.trim();
      if (count(s) > 1) no('a glyph is one character');
      if (bytes(s) > MAX_BYTES) no('a glyph is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
