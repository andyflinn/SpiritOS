// spirit/run/process/js/deskClient/: the deskClient server's family interface, where spirit.familyPath('deskClient') finds it (goal/G41.12)
// THE deskClient SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. The rules are written by hand from the handlers in deskClient.js, not
// from the request shapes: an argument a handler cannot do without is required, and each carries the tightest rule
// every value the handler takes still passes. The server checks everything again. A verb added to the server is added
// here, in the same commit.
module.exports = {
  verbs: {
    // goal/G41.11: the whole cache to cache.json in its own state folder; it takes no path.
    'cache.dump': {},
    // agent names the persona the desk lifts or gives the signoff for; the handler keeps one state, whoever is named.
    clearSignoff: { agent: 'text?' },
    // One ask of the desk: name the desk verb, json its arguments as a JSON object ('{}' when left out).
    // kept (goal/G41.11): true answers from deskClient's cache alone, never asking the desk, or refuses not-kept.
    desk: { name: 'id', json: 'text?', kept: 'bool?' },
    'history.search': { text: 'text?' },
    // read (goal/G41.11): the key of the wake the agent last read; deskClient drops that wake only then.
    next: { read: 'text?' },
    // The key of the node that runs the desk.
    setDesk: { key: 'key' },
    signoff: { agent: 'text?' },
    // goal/G33.4 (box v40): the desk's stream, one row as the desk publishes it, JSON; appServer's verb for a server
    // that follows a stream (js/appServer.js withStreamListener), heard from the key setDesk named alone.
    streamListener: { json: 'text' },
  },
};
