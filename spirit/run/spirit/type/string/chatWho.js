'use strict';
// spirit/run/spirit/type/string/chatWho.js
// THE TYPE spirit.type.string.chatWho (goal/G48.4, the box: "options for a multiple-choice will be held in a separate script
// file for each field type that has its own options"): whose lines the chat app's chat.search keeps, one of its OPTIONS: '' both
// sides, me the caller's own, them the peer's (nodeChat.js chat.search). The same file on the node and on a page: on
// the node it is this module, on a page it stands at spirit.required.spirit.type.string.chatWho.
(function (root) {
  var OPTIONS = ['', 'me', 'them'];
  function no(why) { throw new Error(why); }
  var T = {
    OPTIONS: OPTIONS,
    defaultValue: function () { return OPTIONS[0]; },
    ruleDescription: function () { return 'one of \'\', me, them'; },
    isValid: function (v) {
      if (OPTIONS.indexOf(v) === -1) no('the side a chat search keeps is one of \'\', me, them');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'chatWho'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
