'use strict';
// spirit/run/spirit/app/testicle/: the testicle server's family interface, where 'spirit/app/testicle/api.js' finds it (goal/G41.12)
// THE testicle SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it. Written by hand
// from the handlers in testicle.js; a verb added to the server is added here, in the same commit.
// ITS COMPANION data.js, REQUIRED HERE AND NOWHERE ELSE (goal/G47.1; Andy's rule: "every api.js requires it's companion
// data.js, and is the only script to require that data.js"): whoever requires this branch has its data with it, on a page
// (spirit.js runs this file there, with no require of its own, and waits for what it asks) and in node.
if (typeof require === 'function') require('../../script.js').requireScript('spirit/app/testicle/data.js'); else window.spirit.requireScript('spirit/app/testicle/data.js');
module.exports = {
  verbs: {
    // goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle. It takes nothing.
    busy: {},
    // goal/G47.1, box v79, 4: the preferences, got and set, multiplexed; {} answers them all. For now interactive alone.
    preferences: { interactive: 'spirit/type/boolean/script.js?' },
    // goal/G47.1, the verbs cycle: a production script's row, made with its suite rows if it has none. name is the script,
    // scoped to run://. Named file.get until the rename of the table file to script.
    'script.get': { name: 'spirit/type/string/file/script.js' },
    // goal/G47.1, box v94, 1: the classifier's verb: a script row's two flags, browserOnly and nodeOnly, never both.
    'script.classify': { script: 'spirit/type/string/file/script.js', browserOnly: 'spirit/type/boolean/script.js', nodeOnly: 'spirit/type/boolean/script.js', requires: 'spirit/type/string/json/script.js?' },
    // goal/G47.1, the verbs cycle: the suite rows of one production script, the words narrowing them ('' for all).
    'suite.search': { script: 'spirit/type/string/fileSelect/script.js?', text: 'spirit/type/string/descriptionSelect/script.js' },
    // goal/G47.1, the test-table cycle: one test's result, by itself (no bundling); severity from 0.0 to 1.0.
    // testHash, the hash of the test's own block (goal/G49.6, box v18; Andy: "yes for testicle.set arg", wsl reviewed it).
    'testicle.set': { script: 'spirit/type/string/file/script.js', suite: 'spirit/type/string/file/script.js', test: 'spirit/type/string/description/script.js', verified: 'spirit/type/boolean/script.js', severity: 'spirit/type/number/probability/script.js', testHash: 'spirit/type/string/word/script.js?' },
    // goal/G47.4, the box: "a new verb testicle.title will change a testicle title, the script, suite AND oldTitle arguments
    // must match an existing row exactly" (Andy: "GO!"; wsl reviewed it): the title replaced in its suite file, committed and
    // pushed, then every row of that suite and title renamed.
    'testicle.title': { script: 'spirit/type/string/file/script.js', suite: 'spirit/type/string/file/script.js', oldTitle: 'spirit/type/string/description/script.js', title: 'spirit/type/string/description/script.js' },
    // goal/G47.1, box v129-131: a suite's success or failure for one script, sent by the reporter once that suite is through
    // with it; the only thing that sets a suite row's outcome.
    'suite.success': { script: 'spirit/type/string/file/script.js', suite: 'spirit/type/string/file/script.js', success: 'spirit/type/boolean/script.js', reason: 'spirit/type/string/word/script.js?', requires: 'spirit/type/string/json/script.js?' },
    // goal/G47.1: the current test rows, the failed first, then most severe first; script, suite and result (red or green)
    // each optional, the words narrowing them; from, the rows already held, asks the following answer.
    // Given a test with its script and suite, that test's every row, the newest flip first (its history).
    'testicle.search': { script: 'spirit/type/string/fileSelect/script.js?', suite: 'spirit/type/string/fileSelect/script.js?', test: 'spirit/type/string/description/script.js?', result: 'spirit/type/string/testResult/script.js?', text: 'spirit/type/string/descriptionSelect/script.js' },
    // goal/G47.1, G45: every failed current test, most severe first. It takes nothing.
    red: {},
    // goal/G49.7, box v6 (Andy: "green from me. verb approved. GO!"; wsl reviewed it): a red held by the one fixing it, by the
    // testicle key; holder, the asker's own ID, holds it, without it the verb asks (and the holder asking lets it go).
    hold: { script: 'spirit/type/string/file/script.js', suite: 'spirit/type/string/file/script.js', test: 'spirit/type/string/description/script.js', holder: 'spirit/type/string/IDNew/script.js?' },
    // goal/G47.1, the run cycle: one suite run for one script, testicle (a test's title) to run up to it; answered at once.
    run: { script: 'spirit/type/string/file/script.js', suite: 'spirit/type/string/file/script.js', testicle: 'spirit/type/string/description/script.js?' },
    // appServer's streamPublisher (spirit/server/app/script.js), as agent's: the caller's key subscribes to testicle's rows, sent to
    // its family of that name from its position (run, since); unsubscribe stops it. Who may is the node's grant. Declared
    // here for now (Andy, goal/G43.32: "for now, it needs to declare them in api.js").
    subscribe: { branch: 'spirit/type/string/word/script.js', run: 'spirit/type/string/word/script.js?', since: 'spirit/type/number/integer/script.js?' },
    unsubscribe: {},
  },
};
