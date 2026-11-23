'use strict';
// spirit/run/spirit/app/backup/: the backup server's family interface, where spirit.branchPath('backup') finds it (goal/G41.12)
// THE backup SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. The rules are written by hand from the handlers in backup.js, not from
// the request shapes: an argument a handler cannot do without is required, and each carries the tightest rule every
// value the handler takes still passes. The server checks everything again. A verb added to the server is added here,
// in the same commit.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../../spirit.js').requireScript('spirit/app/backup/data.js'); else window.spirit.requireScript('spirit/app/backup/data.js');
module.exports = {
  verbs: {
    // The last check, copy and error; it takes nothing.
    'status.get': {},
  },
};
