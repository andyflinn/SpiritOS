'use strict';
// goal/G50.1, test data of spirit/test/placesExampleScript/, never run as a test (box v24: "test data lives in a test's
// files/"). It exports a function, so a function must appear where requireScript places it (Andy: "if
// spirit/test/files/exampleScript.js export a function, factory, object, string.. it must appear as that type").
module.exports = function exampleScript() { return 'exampleScript answers'; };
