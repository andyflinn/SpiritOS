// spirit/run/js/auth/api.js
// THE auth FAMILY ON THE SPIRIT OBJECT (goal/G32.1): who may call what on this node: the grants. Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.auth.<verb>(args). A verb added to the family is added here, in the same commit.
(function (root) {
  var def = {
    family: 'auth',
    verbs: {
      query: { key: 'key', path: 'text' },
      search: { text: 'text?' },
      peer: { key: 'key' },
      grant: { key: 'key', path: 'text' },
      revoke: { key: 'key', path: 'text' },
      relabel: { key: 'key', label: 'name' },
    },
  };
  (root.spiritFamilies = root.spiritFamilies || {})['auth'] = def;
  if (typeof module === 'object' && module.exports) module.exports = def;
}(typeof window !== 'undefined' ? window : globalThis));
