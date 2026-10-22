// spirit/run/js/node/api.js
// THE node FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the node itself: its card, its name, its description. Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.node.<verb>(args). A verb added to the family is added here, in the same commit.
(function (root) {
  var def = {
    family: 'node',
    verbs: {
      card: {},
      debug: { debug: 'object' },
      setName: { name: 'name' },
      setDescription: { description: 'description' },
      rotateCipher: {},
    },
  };
  ((root.spirit = root.spirit || {}).families = (root.spirit || {}).families || {})['node'] = def;
  if (typeof module === 'object' && module.exports) module.exports = def;
}(typeof window !== 'undefined' ? window : globalThis));
