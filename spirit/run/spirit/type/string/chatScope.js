'use strict';
// spirit/run/spirit/type/string/chatScope.js
// THE TYPE spirit.type.string.chatScope (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script
// file for each field type that has its own options"): how wide desk's chat.search looks, one of its OPTIONS: '' or goal the
// id's own chat, items on a goal its chat and every item's in it (desk/server/server.js chat.search). The same file on the node and on a page: on
// the node it is this module, on a page it stands at spirit.required.spirit.type.string.chatScope.
(function (root) {
  var OPTIONS = ['', 'goal', 'items'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    ruleDescription: function () { return 'one of \'\', goal, items'; },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('the scope of a Desk chat search is one of \'\', goal, items');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'chatScope'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
