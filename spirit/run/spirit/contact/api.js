// spirit/run/spirit/contact/api.js
// THE contact FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the node's book of peers. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.contact.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    // The one table, people and relays (goal/G40.11): a yes-filter per flag.
    search: { q: 'text?', keep: 'flag?', mine: 'flag?', relay: 'flag?', seated: 'flag?', held: 'flag?', blocked: 'flag?' },
    get: { key: 'key' },
    block: { publicKey: 'key', publicLabel: 'name?' },
    unblock: { publicKey: 'key' },
    accept: { publicKey: 'key' },
    label: { publicKey: 'key', myLabel: 'name' },
    forget: { publicKey: 'key' },
    senders: {},
    setSenders: { policy: 'id' },
  },
};
