'use strict';
// spirit/run/spirit/branch/script.js
// THE spirit.branch BRANCH (goal/G49.21, box v24: "the branch table, a new branch", "spirit/branch/script.js (the spirit.branch
// branch, a table interface)", "verbs: search, get, add, delete"): what each bundle holds, one row per branch and verb (verb ''
// for the whole branch). Every argument is checked by its spirit.type (box v25). The node mounts it as spirit.branch, its
// handlers spirit/grant/auth/script.js's branch table, one operation per verb.
//   search {text?, bundle?, family?, verb?}   the rows, narrowed by each filter given
//   get {id}                                   one row: { id, bundle, family, verb }
//   add {bundle, family, verb?}                a branch (and verb) the live tree serves, into a node-owned bundle: { id }
//   delete {id}                                that row alone: { id }
// ITS CLIENT, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1): whoever requires this branch has its rows with it.
if (typeof require === 'function') require('../script.js').requireScript('spirit/branch/client/script.js'); else window.spirit.requireScript('spirit/branch/client/script.js');
module.exports = {
  verbs: {
    search: { text: 'spirit/type/string/descriptionSelect/script.js?', bundle: 'spirit/type/number/integer/script.js?', family: 'spirit/type/string/word/script.js?', verb: 'spirit/type/string/wordSelect/script.js?' },
    get: { id: 'spirit/type/number/integer/script.js' },
    add: { bundle: 'spirit/type/number/integer/script.js', family: 'spirit/type/string/word/script.js', verb: 'spirit/type/string/wordSelect/script.js?' },
    delete: { id: 'spirit/type/number/integer/script.js' },
  },
};
