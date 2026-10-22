// spirit/run/js/owner/api.js
// THE owner FAMILY ON THE SPIRIT OBJECT (goal/G32.1): the owner's boxes and commands to his puppets. Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.owner.<verb>(args). A verb added to the family is added here, in the same commit.
(function (root) {
  var def = {
    family: 'owner',
    verbs: {
      boxSearch: { q: 'text?' },
      boxGet: { key: 'id' },
      command: { to: 'key', command: 'id', body: 'object?' },
    },
  };
  (root.spiritFamilies = root.spiritFamilies || {})['owner'] = def;
  if (typeof module === 'object' && module.exports) module.exports = def;
}(typeof window !== 'undefined' ? window : globalThis));
