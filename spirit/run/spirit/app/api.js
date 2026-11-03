// spirit/run/spirit/app/api.js
// THE app FAMILY ON THE SPIRIT OBJECT (goal/G43.2): the node's apps. Written to spirit.js's standard: every verb the node
// mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked async
// call, spirit.app.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    // Andy, box: "it's minimum, no filters, just a search string."
    search: { q: 'text?' },
  },
};
