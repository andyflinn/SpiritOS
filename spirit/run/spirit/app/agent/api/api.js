// spirit/run/process/js/agent/: the agent server's family interface, where spirit.familyPath('agent') finds it (goal/G41.12)
// THE agent SERVER'S INTERFACE (goal/G41.1): every verb it serves, each argument with its rule (spirit.js's standard).
// A verb added to the server is added here, in the same commit. DEBUG is appServer's, not listed here.
module.exports = {
  verbs: {
    // Sets the server's DEBUG state, the one appServer's DEBUG switches, and keeps it across restarts (Andy, Q3 and Q4).
    debug: { on: 'bool' },
    // THE DATA SET OF agent.db (goal/G41.4): one flat verb per table, op one of add, set, delete, get and search
    // (table/rowTable.js). Which arguments an op takes the server checks per op: id for set,
    // delete and get, text for search, the fields for add and set. A secret (apiKey) goes in and never comes out. Every
    // row has an icon, a glyph.
    // The provider verb also takes op ask, with id (goal/G41.18; Andy, box v17: "the provider table gets a new verb:
    // \"ask\", which does the model-list fetching and model-table updating"): it answers { models, updated }. Its
    // unusable flag is the server's to set when a provider fails, so the page sends no such argument.
    provider: { op: 'id', id: 'key?', icon: 'text?', label: 'name?', url: 'url?', apiKey: 'text?', model: 'key?', text: 'text?' },
    model: { op: 'id', id: 'key?', icon: 'text?', label: 'name?', providerId: 'key?', capabilities: 'list?', text: 'text?' },
    persona: { op: 'id', id: 'key?', icon: 'text?', label: 'name?', persona: 'text?', bundle: 'text?', provider: 'key?', text: 'text?' },
    job: { op: 'id', id: 'key?', icon: 'text?', label: 'name?', loop: 'bool?', job: 'text?', bundle: 'text?', provider: 'key?', persona: 'key?', text: 'text?' },
    // A search may name one of the table's fields, narrowed to the rows holding it (goal/G41.21: providerId above).
    // No grant verb since goal/G41.21 (box v17: "agent.grant is removed altogether").
  },
};
