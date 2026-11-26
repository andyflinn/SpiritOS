'use strict';
// spirit/run/spirit/bundle/script.js
// THE spirit.bundle BRANCH (goal/G49.21, box v24: "the bundle table, a new branch", "spirit/bundle/script.js (the spirit.bundle
// branch, a table interface)", "verbs: search, get, add, delete"): the node's bundles, a named set of branches and verbs granted
// at once. Every argument is checked by its spirit.type (box v25). The node mounts it as spirit.bundle, its handlers
// spirit/grant/auth/script.js's bundle table, one operation per verb.
//   search {text?, owner?}   the bundles whose label holds the words, an owner's alone when one is named
//   get {id}                 one bundle: { id, label, owner }
//   add {label, owner?}      a new bundle (owner "node" unless an app server's name is given, goal/G41.25): { id }
//   delete {id}              the bundle and its branches: { id }
// ITS CLIENT, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1): whoever requires this branch has its rows with it.
if (typeof require === 'function') require('../script.js').requireScript('spirit/bundle/client/script.js'); else window.spirit.requireScript('spirit/bundle/client/script.js');
module.exports = {
  verbs: {
    search: { text: 'spirit/type/string/descriptionSelect/script.js?', owner: 'spirit/type/string/word/script.js?' },
    get: { id: 'spirit/type/number/integer/script.js' },
    add: { label: 'spirit/type/string/label/script.js', owner: 'spirit/type/string/word/script.js?' },
    delete: { id: 'spirit/type/number/integer/script.js' },
  },
};
