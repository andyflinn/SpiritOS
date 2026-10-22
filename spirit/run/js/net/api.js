// spirit/run/js/net/api.js
// THE net FAMILY ON THE SPIRIT OBJECT (goal/G32.1): a fetch the node makes for the page. Written to face/spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.net.<verb>(args). A verb added to the family is added here, in the same commit.
(function (root) {
  var def = {
    family: 'net',
    verbs: {
      fetch: { url: 'url', method: 'text?', headers: 'object?', body: 'text?', timeoutMs: 'number?' },
    },
  };
  (root.spiritFamilies = root.spiritFamilies || {})['net'] = def;
  if (typeof module === 'object' && module.exports) module.exports = def;
}(typeof window !== 'undefined' ? window : globalThis));
