// spirit/run/spirit/owner/api.js
// THE owner FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the owner's boxes and commands to his puppets. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.owner.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    boxSearch: { q: 'text?' },
    boxGet: { key: 'id' },
    command: { to: 'key', command: 'id', body: 'object?' },
  },
};
