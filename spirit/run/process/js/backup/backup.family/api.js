// spirit/run/process/js/backup/backup.family/api.js
// THE backup SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. The rules are written by hand from the handlers in backup.js, not from
// the request shapes: an argument a handler cannot do without is required, and each carries the tightest rule every
// value the handler takes still passes. The server checks everything again. A verb added to the server is added here,
// in the same commit.
module.exports = {
  verbs: {
    // The last check, copy and error; it takes nothing.
    'status.get': {},
  },
};
