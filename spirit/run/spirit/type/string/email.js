'use strict';
// spirit/run/spirit/type/string/email.js
// THE TYPE spirit.type.string.email (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): an email address: no spaces, one @ with something on each side, at most 254 bytes, the mail standard's own maximum (fieldRules.js emailProblem).
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.email.
// Its test: ./test/email.js.
(function (root) {
  var MAX_BYTES = 254;
  function bytes(s) { return new TextEncoder().encode(s).length; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    defaultValue: function () { return 'nobody@example.com'; },
    ruleDescription: function () { return 'an email address: one @ with something on each side, no spaces, at most 254 bytes'; },
    isValid: function (v) {
      if (typeof v !== 'string' || !v.trim()) no('an email address is needed');
      var s = v.trim();
      if (/\s/.test(s)) no('an email address has no spaces');
      var at = s.split('@').length - 1;
      if (at !== 1) no('an email address has one @');
      if (s.charAt(0) === '@' || s.charAt(s.length - 1) === '@') no('an email address has something on each side of its @');
      if (bytes(s) > MAX_BYTES) no('an email address is at most ' + MAX_BYTES + ' bytes');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "string", "email"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
