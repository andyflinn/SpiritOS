'use strict';
// spirit/run/spirit/grant/script.js
// THE spirit.grant BRANCH (goal/G49.21, box v24: "the grant table, a new branch", "spirit/grant/script.js (the spirit.grant branch,
// a table interface)", "verbs: search, get, add, delete"; the same four on every auth table, Andy: "i would hope that your table
// interfaces show some orthogonality"): who may call what on this node, one row per key and path. Every argument is checked by
// its spirit.type (Andy, box v25: "a branche's script.js file must use spirit.type.* for ALL argument validation"). The node
// mounts it as spirit.grant (spirit/server/script.js), its handlers spirit/grant/auth/script.js's.
//   search {text?}       the grants whose key, label or path hold the words
//   get {key, path}      whether that key holds that path: { allowed }
//   add {key, path}      gives the key that path, a path the live tree serves
//   delete {key, path}   takes that one grant back
// ITS CLIENT, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1): whoever requires this branch has its rows with it.
if (typeof require === 'function') require('../script.js').requireScript('spirit/grant/client/script.js'); else window.spirit.requireScript('spirit/grant/client/script.js');
module.exports = {
  verbs: {
    search: { text: 'spirit/type/string/descriptionSelect/script.js?' },
    get: { key: 'spirit/type/string/IDNew/script.js', path: 'spirit/type/string/word/script.js' },
    add: { key: 'spirit/type/string/IDNew/script.js', path: 'spirit/type/string/word/script.js' },
    delete: { key: 'spirit/type/string/ID/script.js', path: 'spirit/type/string/word/script.js' },
  },
};
