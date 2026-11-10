'use strict';
// spirit/run/spirit/node/api.js
// THE node FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the node itself: its card, its name, its description. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.node.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    card: {},
    debug: { debug: 'object' },
    setName: { name: 'name' },
    setDescription: { description: 'description' },
    rotateCipher: {},
    // goal/G43.18, box v29: "The verb is node.shell", reviewed by wsl, Andy's "box it.": the shell the node names, at home or face.
    shell: { at: 'text', name: 'text?' },
  },
};
