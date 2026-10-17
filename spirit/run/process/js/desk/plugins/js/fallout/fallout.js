'use strict';

// spirit/run/process/js/desk/plugins/js/fallout/fallout.js
// THE FALLOUT PLUGIN (goal/G27.14), in its reduced scope: its own goal, plugin/fallout, and its Fallout tab under Apps.
//
// DECIDED BY ANDY, 2026-10-17, in goal/G27.14's box: "I just want a Fallout app, that searches "reds" in verifier, and
// shows me a table of test items that match the search term."
//
// IT ADDS NO VERB TO THE DESK (goal/G29.5; Andy: "correct. fallout talks to deskVerify only."). Its tab asks this
// node's deskVerify search itself, through the shared list (shell/shared/js/listSearch.js); the wrapper verbs it held
// here, fallout.reds, fallout.summary and fallout.history, are deleted. The plugin stays for its goal and its tab.

module.exports = function () {
  return { verbs: {} };
};
