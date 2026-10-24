// spirit/run/js/auth/api.js
// THE auth FAMILY ON THE SPIRIT OBJECT (goal/G32.1): who may call what on this node: the grants. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.auth.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    query: { key: 'key', path: 'text' },
    search: { text: 'text?' },
    peer: { key: 'key' },
    grant: { key: 'key', path: 'text' },
    revoke: { key: 'key', path: 'text' },
    relabel: { key: 'key', label: 'name' },
  },
};
