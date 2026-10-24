// spirit/run/js/peer/api.js
// THE peer FAMILY ON THE SPIRIT OBJECT (goal/G32.1): packets to peers, and acquiring one. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.peer.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    post: { to: 'key', text: 'text', via: 'text?', patienceMs: 'number?', kind: 'text?' },
    acquire: { publicKey: 'key', publicLabel: 'name?', url: 'url?', via: 'text?' },
  },
};
