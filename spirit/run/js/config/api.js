// spirit/run/js/config/api.js
// THE config FAMILY ON THE SPIRIT OBJECT (goal/G32.1): kept empty for later use (goal/G30.20). Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.config.<verb>(args). A verb added to the family is added here, in the same commit.
(function (root) {
  var def = {
    family: 'config',
    verbs: {
      // none yet
    },
  };
  ((root.spirit = root.spirit || {}).families = (root.spirit || {}).families || {})['config'] = def;
  if (typeof module === 'object' && module.exports) module.exports = def;
}(typeof window !== 'undefined' ? window : globalThis));
