'use strict';
// goal/G50.1, test data, not a test: the script spirit.requireScript('spirit/test/files/exampleScript.js') places at
// spirit.test.files.exampleScript. It exports a function, so a function must appear there (Andy: "if
// spirit/test/files/exampleScript.js export a function, factory, object, string.. it must appear as that type").
module.exports = function exampleScript() { return 'exampleScript answers'; };
