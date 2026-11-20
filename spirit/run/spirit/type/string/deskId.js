'use strict';
// spirit/run/spirit/type/string/deskId.js
// THE TYPE spirit.type.string.deskId (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*"; Andy: "fix them
// all!"): a Desk goal or item as the desk names it today, desk/server/server.js GOAL_RE and idOf: goal/G<goal>, or goal/G<goal>.<item>.
// Q17 (Andy: "yes.") renames them spirit.app.desk.item.<goal>.<item>; this type follows the name the desk writes, and changes
// with it. The same file on the node and on a page: on the node it is this module, on a page it stands at
// spirit.required.spirit.type.string.deskId.
(function (root) {
  var RE = /^goal\/G\d+(\.\d+)?$/;
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return 'goal/G1'; },
    ruleDescription: function () { return 'a Desk goal or item: goal/G<goal> or goal/G<goal>.<item>'; },
    isValid: function (v) {
      if (typeof v !== 'string' || !RE.test(v)) no('a Desk goal or item is goal/G<goal> or goal/G<goal>.<item>');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'deskId'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
