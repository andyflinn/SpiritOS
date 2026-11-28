'use strict';
// spirit/run/spirit/net/script.js
// THE net FAMILY ON THE SPIRIT OBJECT (goal/G32.1): a fetch the node makes for the page. Written to spirit.js's standard: every verb the
// node mounts for this family, each argument with its rule ('?' optional); the spirit object makes each one a checked
// async call, spirit.net.<verb>(args). A verb added to the family is added here, in the same commit.
// A NEW-SHAPE BRANCH (goal/G49.24, box v17): this script.js and its client/script.js, so the node mounts it as spirit.net by its path.
// ITS CLIENT, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion data.js, and is the only
// script to require that data.js"): whoever requires this branch has its client with it, on a page and in node.
if (typeof require === 'function') require('../script.js').requireScript('spirit/net/client/script.js'); else window.spirit.requireScript('spirit/net/client/script.js');
module.exports = {
  verbs: {
    fetch: { url: 'spirit/type/string/URL/script.js', method: 'spirit/type/string/httpMethod/script.js?', headers: 'spirit/type/object/payload/script.js?', body: 'spirit/type/string/fileContent/script.js?', timeoutMs: 'spirit/type/number/integer/script.js?' },
  },
};
