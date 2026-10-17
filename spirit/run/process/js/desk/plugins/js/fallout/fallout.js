'use strict';

// spirit/run/process/js/desk/plugins/js/fallout/fallout.js
// THE FALLOUT PLUGIN (goal/G27.14), in its reduced scope.
//
// DECIDED BY ANDY, 2026-10-17, in goal/G27.14's box (F1 to F4), not this file's to widen: "I just want a Fallout app,
// that searches "reds" in verifier, and shows me a table of test items that match the search term." So for now:
//   F1. a standard desk plugin with its own goal, plugin/fallout (the desk makes it at first mount), and its tab.
//   F3. the search is this verb, fallout.reds {text}, which asks this node's deskVerify search over the tests that are
//       red now (outcome red, each test's newest record): words are matched against the tests' names; a suite's file
//       name (<name>.js) asks for that suite's reds. The answer is deskVerify's, bucket-bound as every search.
// The full design (the Items tab, the item form, items code by default, the chat) stays in the box, for later.

module.exports = function (desk) {
  function reds(a) {
    const text = String(a.text || '').trim();
    if (typeof desk.verify !== 'function') throw desk.refused('bad-request', 'this desk hands its plugins no deskVerify to search');
    const ask = { over: 'tests', outcome: 'red' };
    if (/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/.test(text)) ask.suite = text;
    else if (text) ask.test = text;
    return desk.verify('search', ask).then(function (r) {
      return { items: (r && Array.isArray(r.items) ? r.items : []).map(function (i) { return { key: String(i.key || ''), label: String(i.label || '') }; }), more: !!(r && r.more) };
    });
  }
  return {
    verbs: {
      // goal/G27.14, F3: the verifier's red tests matching the text, as deskVerify ranks them.
      'fallout.reds': { request: { text: '' }, reply: { items: [{ key: '', label: '' }], more: false }, handler: reds },
    },
  };
};
