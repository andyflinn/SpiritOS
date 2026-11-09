// spirit/run/spirit/app/icons/api.js: the icons family's interface, at the top of the app folder (goal/G43.19, Q5), where the
// node and a page find it (spirit.familyPath). Every verb nodeIcons.js serves, each argument with its rule (spirit.js's
// standard); a verb added there is added here, in the same commit. DEBUG is appServer's, not listed here.
module.exports = {
  verbs: {
    // THE ICON SET, ONE TABLE (the box: "it implements a database-table interface, also reflected in api.js and data.js"):
    // op one of search, get, add, set and delete. The glyph is the row's key; the keywords are what it is found by. search
    // takes text, get and delete a glyph, add and set a glyph and its keywords.
    icon: { op: 'id', glyph: 'text?', keywords: 'list?', text: 'text?' },
  },
};
