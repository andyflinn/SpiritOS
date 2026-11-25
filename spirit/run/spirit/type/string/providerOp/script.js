'use strict';
// spirit/run/spirit/type/string/providerOp/script.js
// THE TYPE spirit.type.string.providerOp (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// an operation on the agent app's provider table, one of its OPTIONS (the agent app's provider verb). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.providerOp. Its test: ./test/providerOp.js.
(function (root) {
  var OPTIONS = ['add', 'set', 'delete', 'get', 'search', 'ask'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    ruleDescription: function () { return 'one of ' + OPTIONS.join(', '); },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('an operation on the agent app\'s provider table is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
