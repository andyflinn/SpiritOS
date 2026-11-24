'use strict';
// spirit/run/spirit/type/string/statusTone.js
// THE TYPE spirit.type.string.statusTone (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// the tone of a Desk item's status word, one of its OPTIONS (item.status.json: "'test' or 'code' when the word is a file your checkout changed"). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.statusTone. Its test: ./test/statusTone.js.
(function (root) {
  var OPTIONS = ['test', 'code'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    ruleDescription: function () { return 'one of ' + OPTIONS.join(', '); },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('the tone of a Desk item\'s status word is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
