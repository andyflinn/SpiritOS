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
  // WHAT STANDS NOW, AND HOW MANY (goal/G27.14). Andy, 2026-10-17: "is this really showing just reds? how many red? it's
  // shows items that we just closed? do i get a filter for ✅ or ❌?". So deskVerify is asked for current tests only (the
  // suite's latest run), its total comes back with the bucket, and outcome is red (the default), green, or '' for both.
  function reds(a) {
    const text = String(a.text || '').trim();
    if (typeof desk.verify !== 'function') throw desk.refused('bad-request', 'this desk hands its plugins no deskVerify to search');
    const outcome = a.outcome === undefined ? 'red' : String(a.outcome);
    if (outcome && outcome !== 'red' && outcome !== 'green') throw desk.refused('bad-request', 'an outcome is red, green, or empty for both');
    const ask = { over: 'tests', current: 'yes' };
    if (outcome) ask.outcome = outcome;
    if (/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/.test(text)) ask.suite = text;
    else if (text) ask.test = text;
    return desk.verify('search', ask).then(function (r) {
      return { items: (r && Array.isArray(r.items) ? r.items : []).map(function (i) { return { key: String(i.key || ''), label: String(i.label || '') }; }),
        more: !!(r && r.more), total: Number(r && r.total) || 0 };
    });
  }
  // F6, A TESTED THING'S HISTORY (Andy, 2026-10-17: "so we'll add a dialog for test-history, that shows us the flips."):
  // every flip of every check under one sub-heading of one suite, newest first, for the dialog shell/falloutHistory.
  function history(a) {
    const suite = String(a.suite || '').trim();
    const heading = String(a.heading || '').trim();
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.js$/.test(suite)) throw desk.refused('bad-request', 'a suite is its file name, <name>.js');
    if (!heading) throw desk.refused('bad-request', 'a heading is needed: the sub-heading the checks stand under');
    if (typeof desk.verify !== 'function') throw desk.refused('bad-request', 'this desk hands its plugins no deskVerify to search');
    return desk.verify('search', { over: 'tests', suite: suite, heading: heading, history: 'yes' }).then(function (r) {
      return { items: (r && Array.isArray(r.items) ? r.items : []).map(function (i) { return { key: String(i.key || ''), label: String(i.label || '') }; }),
        more: !!(r && r.more), total: Number(r && r.total) || 0 };
    });
  }
  return {
    verbs: {
      'fallout.history': { request: { suite: '', heading: '' }, reply: { items: [{ key: '', label: '' }], more: false, total: 0 }, handler: history },
      // goal/G27.14, F3: the verifier's tests that stand now and match the text, as deskVerify ranks them.
      'fallout.reds': { request: { text: '', outcome: '' }, reply: { items: [{ key: '', label: '' }], more: false, total: 0 }, handler: reds,
        // text and outcome are each optional; nothing else is taken.
        accepts: function (x) {
          return !!x && typeof x === 'object' && !Array.isArray(x) && Object.keys(x).every(function (k) { return (k === 'text' || k === 'outcome') && typeof x[k] === 'string'; });
        } },
    },
  };
};
