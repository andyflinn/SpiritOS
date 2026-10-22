// spirit/run/process/js/deskClient/deskClient.family/api.js
// THE deskClient SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (face/spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. The rules are written by hand from the handlers in deskClient.js, not
// from the request shapes: an argument a handler cannot do without is required, and each carries the tightest rule
// every value the handler takes still passes. The server checks everything again. A verb added to the server is added
// here, in the same commit.
module.exports = {
  verbs: {
    // The desk's nudge; the caller is the desk's key, checked by the handler.
    changed: {},
    // agent names the persona the desk lifts or gives the signoff for; the handler keeps one state, whoever is named.
    clearSignoff: { agent: 'text?' },
    // One ask of the desk: name the desk verb, json its arguments as a JSON object ('{}' when left out).
    desk: { name: 'id', json: 'text?' },
    'history.search': { text: 'text?' },
    next: {},
    // The key of the node that runs the desk.
    setDesk: { key: 'key' },
    signoff: { agent: 'text?' },
  },
};
