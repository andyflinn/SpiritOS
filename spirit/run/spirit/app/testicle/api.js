'use strict';
// spirit/run/spirit/app/testicle/: the testicle server's family interface, where spirit.familyPath('testicle') finds it (goal/G41.12)
// THE testicle SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it. Written by hand
// from the handlers in testicle.js; a verb added to the server is added here, in the same commit.
module.exports = {
  verbs: {
    // goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle. It takes nothing.
    busy: {},
  },
};
