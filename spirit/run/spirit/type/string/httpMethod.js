'use strict';
// spirit/run/spirit/type/string/httpMethod.js
// THE TYPE spirit.type.string.httpMethod (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// an HTTP method, one of its OPTIONS (net.fetch, which sends the method upper-cased). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.httpMethod. Its test: ./test/httpMethod.js.
(function (root) {
  var OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    ruleDescription: function () { return 'one of ' + OPTIONS.join(', '); },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('an HTTP method is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'httpMethod'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
