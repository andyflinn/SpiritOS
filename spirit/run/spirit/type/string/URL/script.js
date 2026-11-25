'use strict';
// spirit/run/spirit/type/string/URL/script.js
// THE TYPE spirit.type.string.URL (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): a URL, http or https, no spaces, at most 1024 bytes.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.URL.
// Its test: ./test/URL.js.
(function (root) {
  var MAX_BYTES = 1024;
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    // ITS DEFAULT (goal/G48.4, the box v33: "default: on any face \"the pages own URL\", on a node \"the nodes loopback URL
    // with port\""): a page's own address; on the node, its loopback address at the port spirit.js read for it.
    defaultValue: function () {
      var L = root && root.location;
      if (L && /^https?:\/\//.test(String(L.href || ''))) return String(L.href);
      var N = root && root.spirit && root.spirit.nodeFacts;
      return N && Number(N.port) > 0 ? 'http://127.0.0.1:' + Number(N.port) : 'http://127.0.0.1';
    },
    ruleDescription: function () { return 'a URL: http:// or https://, no spaces, at most 1024 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a URL is a string');
      if (!/^https?:\/\/[^\s]+$/.test(v)) no('a URL starts with http:// or https:// and has no spaces');
      if (bytes(v) > MAX_BYTES) no('a URL is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
