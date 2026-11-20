'use strict';
// spirit/run/spirit/type/string/commit.js
// THE TYPE spirit.type.string.commit (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*"; the rule desk's claim
// already held, nodeDesk.js: "a commit is 7 to 40 hex characters (lower case)"): a git commit, by its full or short hash.
// The same file on the node and on a page: on the node it is this module, on a page it stands at
// spirit.required.spirit.type.string.commit.
(function (root) {
  var RE = /^[0-9a-f]{7,40}$/;
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return '0000000'; },
    ruleDescription: function () { return 'a commit: 7 to 40 hex characters, lower case'; },
    isValid: function (v) {
      if (typeof v !== 'string' || !RE.test(v)) no('a commit is 7 to 40 hex characters, lower case');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'commit'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
