'use strict';
// spirit/run/spirit/type/string/checkState/script.js
// THE TYPE spirit.type.string.checkState (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// the state of a Desk check, one of its OPTIONS (desk/server/server.js check.set). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.checkState. Its test: ./test/checkState.js.
(function (root) {
  var OPTIONS = ['open', 'passed', 'failed', 'granted', 'answered'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    ruleDescription: function () { return 'one of ' + OPTIONS.join(', '); },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('the state of a Desk check is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
