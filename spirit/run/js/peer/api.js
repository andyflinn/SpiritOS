// spirit/run/js/peer/api.js
// THE peer FAMILY ON THE SPIRIT OBJECT (goal/G32.1): packets to peers, and acquiring one. Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.peer.<verb>(args). A verb added to the family is added here, in the same commit.
(function (root) {
  var def = {
    family: 'peer',
    verbs: {
      post: { to: 'key', text: 'text', via: 'text?', patienceMs: 'number?', kind: 'text?' },
      acquire: { publicKey: 'key', publicLabel: 'name?', url: 'url?', via: 'text?' },
    },
  };
  ((root.spirit = root.spirit || {}).families = (root.spirit || {}).families || {})['peer'] = def;
  if (typeof module === 'object' && module.exports) module.exports = def;
}(typeof window !== 'undefined' ? window : globalThis));
