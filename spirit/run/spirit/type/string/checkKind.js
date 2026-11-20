'use strict';
// spirit/run/spirit/type/string/checkKind.js
// THE TYPE spirit.type.string.checkKind (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// the kind of a Desk check, one of its OPTIONS (nodeDesk.js check.add: "a check is C, T, G or Q"). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.checkKind. Its test: ./test/checkKind.js.
(function (root) {
  var OPTIONS = ['C', 'T', 'G', 'Q'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    ruleDescription: function () { return 'one of ' + OPTIONS.join(', '); },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('the kind of a Desk check is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'checkKind'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
