// spirit/run/process/js/fileServer/fileServer.family/api.js
// THE fileServer SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. The rules are written by hand from the handlers in fileServer.js, not
// from the request shapes: an argument a handler cannot do without is required, and each carries the tightest rule
// every value the handler takes still passes. The server checks everything again. A verb added to the server is added
// here, in the same commit. Each file held is served as a verb of its own (verb-<hash>, {command, data}); those come
// and go with the store and are not listed here.
//
// The paths of push, fill and pull are the owner's files on his disk, absolute ones included, read and written as
// given: they are 'id', not 'path' (a path inside the run folder), which would refuse them.
module.exports = {
  verbs: {
    delete: { hash: 'id' },
    // A file by its id (verb- and 43 base64url characters), from the peer that holds it.
    fetch: { id: 'id', from: 'key' },
    // A reserved slot (PROFILE_PICTURE) filled with the file at path.
    fill: { slot: 'id', path: 'id' },
    pull: { hash: 'id', path: 'id' },
    push: { path: 'id' },
    status: { hash: 'id' },
  },
};
