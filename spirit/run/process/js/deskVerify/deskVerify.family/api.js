// spirit/run/process/js/deskVerify/deskVerify.family/api.js
// THE deskVerify SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (face/spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it, and maps it
// to its name: it names no family of its own. The rules are written by hand from the handlers in deskVerify.js, not
// from the request shapes: an argument a handler cannot do without is required, and each carries the tightest rule
// every value the handler takes still passes. The server checks everything again. A verb added to the server is added
// here, in the same commit.
module.exports = {
  verbs: {
    // The current run's console from byte `from` (0 when left out).
    console: { from: 'number?' },
    // A door run by the plugin, recorded: id the plugin's own door id (d<n>), verdict {ran, green, around, of, ...}.
    'door.record': { id: 'id', verdict: 'object' },
    // The full harness, queued; id is the goal whose chat takes the report line ('' for none).
    'full.run': { id: 'text?' },
    now: {},
    // One test's outcome, as a suite reports it: outcome 'red' or 'green'; failure the text a red printed.
    record: { suite: 'id', title: 'id', outcome: 'id', failure: 'text?' },
    // One search: over 'tests' or 'runs', every other key a filter ('' for none). current, history and slim are
    // 'yes' or '' (search.json beside this file says each).
    search: {
      over: 'id', suite: 'text?', test: 'text?', outcome: 'text?', commit: 'text?', item: 'text?', kind: 'text?', since: 'text?',
      current: 'flag?', heading: 'text?', history: 'flag?', slim: 'flag?',
    },
    stop: {},
  },
};
