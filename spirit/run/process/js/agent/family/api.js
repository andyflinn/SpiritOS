// spirit/run/process/js/agent/: the agent server's family interface, where spirit.familyPath('agent') finds it (goal/G41.12)
// THE agent SERVER'S INTERFACE (goal/G41.1): every verb it serves, each argument with its rule (spirit.js's standard).
// A verb added to the server is added here, in the same commit. DEBUG and DEPENDENCIES are appServer's, not listed here.
module.exports = {
  verbs: {
    // Sets the server's DEBUG state, the one appServer's DEBUG switches, and keeps it across restarts (Andy, Q3 and Q4).
    debug: { on: 'bool' },
  },
};
