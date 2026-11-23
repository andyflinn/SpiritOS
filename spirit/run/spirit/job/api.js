'use strict';
// spirit/run/spirit/job/api.js
// THE jobs FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the node's jobs and the servers it runs. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.processJob.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../spirit.js').requireScript('spirit/job/data.js'); else window.spirit.requireScript('spirit/job/data.js');
module.exports = {
  verbs: {
    search: { q: 'spirit.type.string.descriptionSelect?' },
    get: { key: 'spirit.type.string.path' },
    create: { command: 'spirit.type.string.description', args: 'spirit.type.string.json?', type: 'spirit.type.string.word?' },
    cancel: { id: 'spirit.type.string.path' },
    delete: { id: 'spirit.type.string.path' },
  },
};
