// spirit/run/spirit/app/api.js
// THE app FAMILY ON THE SPIRIT OBJECT (goal/G43.2): the node's apps. Written to spirit.js's standard: every verb the node
// mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked async
// call, spirit.app.<function>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    // Andy, box: "it's minimum, no filters, just a search string."
    search: { q: 'text?' },
    // goal/G43.9, peer review wsl, yes, Andy's yes on Q1: "spirit.app gains a verb: "active"."
    active: { key: 'text', active: 'bool' },
    // Q4, Andy: "yes.": the node's choices, over what <name>.json says.
    label: { key: 'text', label: 'text' },
    icon: { key: 'text', icon: 'text' },
  },
  // THE PAGE'S FUNCTION IS NOT THE VERB (goal/G43.7; Andy: "spirit.app.searchApp() which IMPLEMENTS the verb search, but isn't the
  // verb itself."): the verb stays a word on the wire, and spirit.app holds no word of its own.
  functions: { search: 'searchApp', active: 'activeApp', label: 'labelApp', icon: 'iconApp' },
};
