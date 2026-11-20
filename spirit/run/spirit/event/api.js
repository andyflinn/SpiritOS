'use strict';
// spirit/run/spirit/event/api.js
// THE events FAMILY ON THE SPIRIT OBJECT (goal/G40.6): the node's one dispatcher of events. Written to spirit.js's
// standard: every verb the node mounts for this family, each argument with its rule ('?' optional). spirit.js holds the
// two members itself, spirit.event.subscribe(handlers) on the page's one stream and spirit.event.publish(obj) on this
// process's job, and these declarations under them say what the node takes.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../spirit.js').require('spirit/event/data.js'); else window.spirit.require('spirit/event/data.js');
module.exports = {
  verbs: {
    subscribe: {},
    publish: { id: 'id', status: 'text?', data: 'spirit.type.object.payload?', logMessage: 'text?', app: 'spirit.type.object.payload?' },
  },
};
