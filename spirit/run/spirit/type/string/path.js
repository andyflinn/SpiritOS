'use strict';
// spirit/run/spirit/type/string/path.js
// THE TYPE spirit.type.string.path (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a path, which designates a folder, a container, and always starts with spirit (the box: "a path designates a folder, it always designates a container"; "must always start with spirit"): names joined by dots, at most 1024 bytes.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.path.
// Its test: ./test/path.js.
(function (root) {
  var MAX_BYTES = 1024;
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return 'spirit'; },
    ruleDescription: function () { return 'a path: spirit, then folders joined by dots, at most 1024 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a path is a string');
      if (!/^spirit(\.[A-Za-z0-9_-]+)*$/.test(v)) no('a path starts with spirit, its folders joined by dots: spirit.app.desk');
      if (bytes(v) > MAX_BYTES) no('a path is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
