'use strict';
// spirit/run/spirit/type/string/tableOp.js
// THE TYPE spirit.type.string.tableOp (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// an operation on a table verb's one row or its search, one of its OPTIONS (the agent app's model, persona and job verbs, the icons verb, auth's bundle and branch verbs). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.tableOp. Its test: ./test/tableOp.js.
(function (root) {
  var OPTIONS = ['add', 'set', 'delete', 'get', 'search'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('an operation on a table verb\'s one row or its search is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'tableOp'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
