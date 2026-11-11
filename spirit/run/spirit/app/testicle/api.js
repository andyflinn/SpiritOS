'use strict';
// spirit/run/spirit/app/testicle/: the testicle server's family interface, where spirit.familyPath('testicle') finds it (goal/G41.12)
// THE testicle SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it. Written by hand
// from the handlers in testicle.js; a verb added to the server is added here, in the same commit.
module.exports = {
  verbs: {
    // goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle. It takes nothing.
    busy: {},
    // goal/G47.1, the verbs cycle: a production file's row, made with its suite rows if it has none. name is the file,
    // scoped to run://.
    'file.get': { name: 'text' },
    // goal/G47.1, the verbs cycle: the suite rows of one production file, the words narrowing them ('' for all).
    'suite.search': { file: 'text', text: 'text' },
    // appServer's streamPublisher (spirit/appServer.js), as agent's: the caller's key subscribes to testicle's rows, sent to
    // its family of that name from its position (run, since); unsubscribe stops it. Who may is the node's grant. Declared
    // here for now (Andy, goal/G43.32: "for now, it needs to declare them in api.js").
    subscribe: { family: 'id', run: 'text?', since: 'number?' },
    unsubscribe: {},
  },
};
