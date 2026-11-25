'use strict';
// spirit/run/spirit/auth/api.js
// THE auth FAMILY ON THE SPIRIT OBJECT (goal/G32.1): who may call what on this node: the grants. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.auth.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../script.js').requireScript('spirit/auth/data.js'); else window.spirit.requireScript('spirit/auth/data.js');
module.exports = {
  verbs: {
    query: { key: 'spirit/type/string/IDNew/script.js', path: 'spirit/type/string/word/script.js' },
    search: { text: 'spirit/type/string/descriptionSelect/script.js?' },
    peer: { key: 'spirit/type/string/IDNew/script.js' },
    grant: { key: 'spirit/type/string/IDNew/script.js', path: 'spirit/type/string/word/script.js' },
    revoke: { key: 'spirit/type/string/ID/script.js', path: 'spirit/type/string/word/script.js' },
    relabel: { key: 'spirit/type/string/ID/script.js', label: 'spirit/type/string/label/script.js' },
    // goal/G41.14: the node's bundles and their branches, one flat verb per table as the agent tables' are, op one of
    // add, set, delete, get and search; which arguments an op takes the node checks per op (apiAuth.js).
    // goal/G41.25: its owner, given at the add and narrowing a search; one that is not valid the node reads as "node", so
    // the rule here takes any text (Andy, box: "changes to the auth.bundle verb for the addition of the \"owner\" field
    // are approved by andy and need no review.").
    bundle: { op: 'spirit/type/string/tableOp/script.js', id: 'spirit/type/number/integer/script.js?', label: 'spirit/type/string/label/script.js?', text: 'spirit/type/string/descriptionSelect/script.js?', owner: 'spirit/type/string/word/script.js?' },
    branch: { op: 'spirit/type/string/tableOp/script.js', id: 'spirit/type/number/integer/script.js?', bundle: 'spirit/type/number/integer/script.js?', family: 'spirit/type/string/word/script.js?', verb: 'spirit/type/string/wordSelect/script.js?', text: 'spirit/type/string/descriptionSelect/script.js?' },
  },
};
