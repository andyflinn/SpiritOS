'use strict';
// spirit/run/spirit/type/string/phase.js
// THE TYPE spirit.type.string.phase (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// a phase of a Desk item, one of its OPTIONS (desk/server/server.js: the phases red, build, verify). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.phase. Its test: ./test/phase.js.
(function (root) {
  var OPTIONS = ['red', 'build', 'verify'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    ruleDescription: function () { return 'one of ' + OPTIONS.join(', '); },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('a phase of a Desk item is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
