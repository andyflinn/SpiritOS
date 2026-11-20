'use strict';
// spirit/run/spirit/type/string/agentWord.js
// THE TYPE spirit.type.string.agentWord (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script file for each
// field type that has its own options. so that interpreters of data descriptions can use the same function for validation"):
// an agent's word in Desk, one of its OPTIONS (agent.state.json: "listening when its ear arms, working when the ear hands a line over"). The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.agentWord. Its test: ./test/agentWord.js.
(function (root) {
  var OPTIONS = ['listening', 'working'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('an agent\'s word in Desk is one of ' + OPTIONS.join(', '));
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'agentWord'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
