'use strict';
// spirit/run/spirit/app/api.js
// THE app FAMILY ON THE SPIRIT OBJECT (goal/G43.2): the node's apps. Written to spirit.js's standard: every verb the node
// mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked async
// call, spirit.app.<function>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../spirit.js').require('spirit/app/data.js'); else window.spirit.require('spirit/app/data.js');
module.exports = {
  verbs: {
    // Andy, box: "it's minimum, no filters, just a search string."
    search: { q: 'text?' },
    // goal/G43.9, peer review wsl, yes, Andy's yes on Q1: "spirit.app gains a verb: "active"."
    active: { key: 'text', active: 'spirit.type.boolean' },
    // Q4, Andy: "yes.": the node's choices, over what <name>.json says.
    label: { key: 'text', label: 'spirit.type.string.label' },
    icon: { key: 'text', icon: 'spirit.type.string.glyph' },
  },
  // THE PAGE'S FUNCTION IS NOT THE VERB (goal/G43.7; Andy: "spirit.app.searchApp() which IMPLEMENTS the verb search, but isn't the
  // verb itself."): the verb stays a word on the wire, and spirit.app holds no word of its own.
  functions: { search: 'searchApp', active: 'activeApp', label: 'labelApp', icon: 'iconApp' },
};
