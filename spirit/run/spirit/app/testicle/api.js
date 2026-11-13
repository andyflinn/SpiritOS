'use strict';
// spirit/run/spirit/app/testicle/: the testicle server's family interface, where spirit.familyPath('testicle') finds it (goal/G41.12)
// THE testicle SERVER'S INTERFACE (goal/G32.3): every verb it serves, each argument with its rule (spirit.js's
// standard, '?' optional). The node answers this text to api {family} without the server hearing of it. Written by hand
// from the handlers in testicle.js; a verb added to the server is added here, in the same commit.
module.exports = {
  verbs: {
    // goal/G47.1, the box: "busy": true if it is doing any work, false if it is idle. It takes nothing.
    busy: {},
    // goal/G47.1, box v79, 4: the preferences, got and set, multiplexed; {} answers them all. For now interactive alone.
    preferences: { interactive: 'bool?' },
    // goal/G47.1, the verbs cycle: a production script's row, made with its suite rows if it has none. name is the script,
    // scoped to run://. Named file.get until the rename of the table file to script.
    'script.get': { name: 'text' },
    // goal/G47.1, box v94, 1: the classifier's verb: a script row's two flags, browserOnly and nodeOnly, never both.
    'script.classify': { script: 'text', browserOnly: 'bool', nodeOnly: 'bool' },
    // goal/G47.1, the verbs cycle: the suite rows of one production script, the words narrowing them ('' for all).
    'suite.search': { script: 'text?', text: 'text' },
    // goal/G47.1, the test-table cycle: one test's result, by itself (no bundling); severity from 0.0 to 1.0.
    'testicle.set': { script: 'text', suite: 'text', test: 'text', verified: 'bool', severity: 'number' },
    // goal/G47.1, box v129-131: a suite's success or failure for one script, sent by the reporter once that suite is through
    // with it; the only thing that sets a suite row's outcome.
    'suite.success': { script: 'text', suite: 'text', success: 'bool' },
    // goal/G47.1: the current test rows, the failed first, then most severe first; script, suite and result (red or green)
    // each optional, the words narrowing them; from, the rows already held, asks the following answer.
    // Given a test with its script and suite, that test's every row, the newest flip first (its history).
    'testicle.search': { script: 'text?', suite: 'text?', test: 'text?', result: 'text?', from: 'number?', text: 'text' },
    // goal/G47.1, G45: every failed current test, most severe first. It takes nothing.
    red: {},
    // goal/G47.1, the run cycle: one suite run for one script, testicle (a test's title) to run up to it; answered at once.
    run: { script: 'text', suite: 'text', testicle: 'text?' },
    // appServer's streamPublisher (spirit/appServer.js), as agent's: the caller's key subscribes to testicle's rows, sent to
    // its family of that name from its position (run, since); unsubscribe stops it. Who may is the node's grant. Declared
    // here for now (Andy, goal/G43.32: "for now, it needs to declare them in api.js").
    subscribe: { family: 'id', run: 'text?', since: 'number?' },
    unsubscribe: {},
  },
};
