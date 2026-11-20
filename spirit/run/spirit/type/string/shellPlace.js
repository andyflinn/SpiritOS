'use strict';
// spirit/run/spirit/type/string/shellPlace.js
// THE TYPE spirit.type.string.shellPlace (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// where a node names its shell, one of its OPTIONS (shell.json: "at, home or face"; Andy: "{ \"at\":\"face|home\"}"). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.shellPlace. Its test: ./test/shellPlace.js.
(function (root) {
  var OPTIONS = ['home', 'face'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('where a node names its shell is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'shellPlace'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
