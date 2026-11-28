'use strict';
// spirit/run/spirit/peer/script.js
// THE peer FAMILY ON THE SPIRIT OBJECT (goal/G32.1): packets to peers, and acquiring one. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.peer.<verb>(args). A verb added to the family is added here, in the same commit.
// A NEW-SHAPE BRANCH (goal/G49.26, box v8): this script.js and its client/script.js, so the node mounts it as spirit.peer by its
// path and its verbs travel as spirit.peer.<verb>.
// ITS CLIENT, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion data.js, and is the only
// script to require that data.js"): whoever requires this branch has its client with it, on a page and in node.
if (typeof require === 'function') require('../script.js').requireScript('spirit/peer/client/script.js'); else window.spirit.requireScript('spirit/peer/client/script.js');
module.exports = {
  verbs: {
    post: { to: 'spirit/type/string/ID/script.js', text: 'spirit/type/string/json/script.js', via: 'spirit/type/string/URL/script.js?', patienceMs: 'spirit/type/number/integer/script.js?', kind: 'spirit/type/string/word/script.js?' },
    // No via since goal/G40.11: how a key arrived went with acquiredVia; acquiring keeps the row.
    acquire: { publicKey: 'spirit/type/string/IDNew/script.js', publicLabel: 'spirit/type/string/label/script.js?', url: 'spirit/type/string/URL/script.js?' },
  },
};
