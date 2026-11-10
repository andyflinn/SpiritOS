'use strict';

// spirit/run/spirit/fs/test/api.js
// The tests of spirit/fs/api.js's kernel names, and of no other module (spec: ./api.md). This file holds goal/G41.30: a
// refusal is not "nothing there" (Andy, of a face with no star: "not found (or empty) — you can still Save to create it").

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const api = require(path.join(RUN, 'spirit', 'fs', 'api.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function refused(status, code, message) { const e = new Error(message); e.status = status; e.code = code; return e; }

test.startTest('spirit/fs/api.js: a refusal is not "nothing there" (goal/G41.30)');

(async function () {
  const names = function (answer) { return api.names(function () { return answer(); }, {}); };
  const off = refused(403, 'not-from-the-face', 'fs.load is off the face until a face can prove it is the owner');
  let got = null; let threw = null;
  try { got = await names(function () { return Promise.reject(off); }).loadFile('media/dummy.txt'); } catch (e) { threw = e; }
  ok(!!threw && threw.code === 'not-from-the-face' && /off the face/.test(threw.message), 'loadFile, refused by the face\'s gate, rejects with the node\'s own code and words', 'loadFile answered ' + JSON.stringify(got) + ', threw ' + (threw && threw.code));

  let missing = 'unset';
  try { missing = await names(function () { return Promise.reject(refused(404, 'not-found', 'no such file')); }).loadFile('media/none.txt'); } catch (e) { missing = 'threw ' + e.code; }
  ok(missing === null, 'a file that is not there still answers null', 'loadFile of a missing file: ' + String(missing));

  const text = await names(function () { return Promise.resolve({ text: 'hello' }); }).loadFile('media/a.txt');
  ok(text === 'hello', 'a file that is there answers its text', 'loadFile: ' + String(text));

  // GOAL/G43.20 (Andy: "ANNOTATIONS WILL BE NODE ONLY."): no caller reads or writes an annotation.
  test.subHeading('goal/G43.20: annotations are the node\'s only');
  ok(!('annotations' in api.verbs) && !('annotate' in api.verbs), 'the family has no fs.annotations and no fs.annotate', 'verbs: ' + JSON.stringify(Object.keys(api.verbs)));
  ok(!('getAnnotations' in names(function () { return Promise.resolve({}); })), 'and no getAnnotations among its kernel names', 'names: ' + JSON.stringify(Object.keys(names(function () { return Promise.resolve({}); }))));
}()).then(function () { test.reportSuccessFailureCount(); process.exit(0); },
  function (e) { test.fail('the test threw ' + (e && e.stack || e)); test.reportSuccessFailureCount(); process.exit(0); });
