// spirit/run/js/relay/api.js
// THE relay FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the relays this node is a member of. Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.relay.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    claim: { url: 'url', name: 'name', invite: 'text?', inviteLabel: 'name?' },
    partnerCheck: { publicKey: 'key', url: 'url' },
    search: { q: 'text?', name: 'text?' },
    get: { key: 'text' },
    remove: { key: 'text' },
    add: { url: 'url', label: 'name?' },
    face: { url: 'url', name: 'name' },
    join: { url: 'url', email: 'text', code: 'text?' },
    record: { relay: 'text', from: 'number?', to: 'number?' },
  },
};
