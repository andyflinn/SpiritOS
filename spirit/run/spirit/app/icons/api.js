'use strict';
// spirit/run/spirit/app/icons/api.js: the icons family's interface, at the top of the app folder (goal/G43.19, Q5), where the
// node and a page ask it by this path. Every verb icons/server/server.js serves, each argument with its rule (spirit.js's
// standard); a verb added there is added here, in the same commit. DEBUG is appServer's, not listed here.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../../script.js').requireScript('spirit/app/icons/data.js'); else window.spirit.requireScript('spirit/app/icons/data.js');
module.exports = {
  verbs: {
    // THE ICON SET, ONE TABLE (the box: "it implements a database-table interface, also reflected in api.js and data.js"):
    // op one of search, get, add, set and delete. The glyph is the row's key; the keywords are what it is found by. search
    // takes text, get and delete a glyph, add and set a glyph and its keywords, a list in JSON (goal/G48.4, Q6).
    icon: { op: 'spirit.type.string.tableOp', glyph: 'spirit.type.string.glyph?', keywords: 'spirit.type.string.json?', text: 'spirit.type.string.descriptionSelect?' },
  },
};
