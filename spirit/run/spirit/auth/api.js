'use strict';
// spirit/run/spirit/auth/api.js
// THE auth FAMILY ON THE SPIRIT OBJECT (goal/G32.1): who may call what on this node: the grants. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.auth.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../spirit.js').require('spirit/auth/data.js'); else window.spirit.require('spirit/auth/data.js');
module.exports = {
  verbs: {
    query: { key: 'spirit.type.string.IDNew', path: 'text' },
    search: { text: 'spirit.type.string.descriptionSelect?' },
    peer: { key: 'spirit.type.string.IDNew' },
    grant: { key: 'spirit.type.string.IDNew', path: 'text' },
    revoke: { key: 'spirit.type.string.ID', path: 'text' },
    relabel: { key: 'spirit.type.string.ID', label: 'spirit.type.string.label' },
    // goal/G41.14: the node's bundles and their branches, one flat verb per table as the agent tables' are, op one of
    // add, set, delete, get and search; which arguments an op takes the node checks per op (apiAuth.js).
    // goal/G41.25: its owner, given at the add and narrowing a search; one that is not valid the node reads as "node", so
    // the rule here takes any text (Andy, box: "changes to the auth.bundle verb for the addition of the \"owner\" field
    // are approved by andy and need no review.").
    bundle: { op: 'spirit.type.string.tableOp', id: 'spirit.type.number.integer?', label: 'spirit.type.string.label?', text: 'spirit.type.string.descriptionSelect?', owner: 'text?' },
    branch: { op: 'spirit.type.string.tableOp', id: 'spirit.type.number.integer?', bundle: 'spirit.type.number.integer?', family: 'text?', verb: 'text?', text: 'spirit.type.string.descriptionSelect?' },
  },
};
