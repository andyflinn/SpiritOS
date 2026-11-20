'use strict';
// spirit/run/spirit/type/string/deskPress.js
// THE TYPE spirit.type.string.deskPress (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// a button pressed on a Desk item, one of its OPTIONS (nodeDesk.js press: every what it answers). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.deskPress. Its test: ./test/deskPress.js.
(function (root) {
  var OPTIONS = ['abandon', 'bring-back', 'claim-done', 'close', 'code', 'design-complete', 'done', 'end-design', 'go', 'go-all', 'make-current', 'reopen', 'seen', 'start-design', 'waive'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    // Its fifteen choices are too many for a short description; OPTIONS holds them all.
    ruleDescription: function () { return 'a button pressed on a Desk item: one of its OPTIONS, claim-done, go, done, reopen and the others'; },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('a button pressed on a Desk item is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'deskPress'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
