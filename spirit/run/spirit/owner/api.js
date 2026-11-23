'use strict';
// spirit/run/spirit/owner/api.js
// THE owner FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the owner's boxes and commands to his puppets. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.owner.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../spirit.js').requireScript('spirit/owner/data.js'); else window.spirit.requireScript('spirit/owner/data.js');
module.exports = {
  verbs: {
    boxSearch: { q: 'spirit.type.string.descriptionSelect?' },
    boxGet: { key: 'spirit.type.string.description' },
    command: { to: 'spirit.type.string.ID', command: 'spirit.type.string.word', body: 'spirit.type.object.payload?' },
  },
};
