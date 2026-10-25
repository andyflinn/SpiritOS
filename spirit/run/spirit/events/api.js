// spirit/run/spirit/events/api.js
// THE events FAMILY ON THE SPIRIT OBJECT (goal/G40.6): the node's one dispatcher of events. Written to spirit.js's
// standard: every verb the node mounts for this family, each argument with its rule ('?' optional). spirit.js holds the
// two members itself, spirit.events.subscribe(handlers) on the page's one stream and spirit.events.publish(obj) on this
// process's job, and these declarations under them say what the node takes.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    subscribe: {},
    publish: { id: 'id', status: 'text?', data: 'object?', logMessage: 'text?', app: 'object?' },
  },
};
