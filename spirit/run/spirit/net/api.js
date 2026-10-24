// spirit/run/spirit/net/api.js
// THE net FAMILY ON THE SPIRIT OBJECT (goal/G32.1): a fetch the node makes for the page. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.net.<verb>(args). A verb added to the family is added here, in the same commit.
// It names no family of its own: the node maps it (goal/G32.3), answering this text to api {family}.
module.exports = {
  verbs: {
    fetch: { url: 'url', method: 'text?', headers: 'object?', body: 'text?', timeoutMs: 'number?' },
  },
};
