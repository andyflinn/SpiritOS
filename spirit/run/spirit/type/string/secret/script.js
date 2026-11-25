'use strict';
// spirit/run/spirit/type/string/secret/script.js
// THE TYPE spirit.type.string.secret (goal/G48.4, Q4, Andy: "spirit/type/string/secret/script.js", to "a secret that goes in and
// never comes out ... a line of up to 1024 bytes with no spaces?"): a secret such as a provider's API key: no spaces,
// nothing invisible, at most 1024 bytes. Empty is no secret at all: a provider on this machine takes none (the agent app's
// openai.js: "with none, no Authorization header (a local server takes none)"), and its form sends "" for none. The same file on the node and on a page: on the node it is this module, on a
// page it stands at spirit.required.spirit.type.string.secret. Its test: ./test/secret.js.
(function (root) {
  var MAX_BYTES = 1024;
  var BAD = [[0x0, 0x1F], [0x7F, 0x9F], [0xAD, 0xAD], [0x200B, 0x200F], [0x2028, 0x202E], [0x2060, 0x2064], [0x2066, 0x206F], [0xFEFF, 0xFEFF]];
  var INVISIBLE = { test: function (s) { for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); for (var j = 0; j < BAD.length; j++) if (c >= BAD[j][0] && c <= BAD[j][1]) return true; } return false; } };
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return 'secret'; },
    ruleDescription: function () { return 'a secret: empty for none, else no spaces, nothing invisible, at most 1024 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a secret is a string');
      if (/\s/.test(v)) no('a secret has no spaces');
      if (INVISIBLE.test(v)) no('a secret has no invisible or control characters');
      if (bytes(v) > MAX_BYTES) no('a secret is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
