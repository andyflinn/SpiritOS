'use strict';

// spirit/run/spirit/fs/test/api.js
// The tests of spirit/fs/api.js's kernel names, and of no other module (spec: ./api.md). This file holds goal/G41.30: a
// refusal is not "nothing there" (Andy, of a face with no star: "not found (or empty) — you can still Save to create it").
// One test.run per test (goal/G47.2).

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const api = require(path.join(RUN, 'spirit', 'fs', 'api.js'));

function refused(status, code, message) { const e = new Error(message); e.status = status; e.code = code; return e; }
const names = function (answer) { return api.names(function () { return answer(); }, {}); };

// spirit/fs/api.js: a refusal is not "nothing there" (goal/G41.30)
test.run('loadFile, refused by the face\'s gate, rejects with the node\'s own code and words', 0.2, async function () {
  const off = refused(403, 'not-from-the-face', 'fs.load is off the face until a face can prove it is the owner');
  let got = null; let threw = null;
  try { got = await names(function () { return Promise.reject(off); }).loadFile('media/dummy.txt'); } catch (e) { threw = e; }
  return !!threw && threw.code === 'not-from-the-face' && /off the face/.test(threw.message) ? true : 'loadFile answered ' + JSON.stringify(got) + ', threw ' + (threw && threw.code);
}, test.limit.quick);
test.run('a file that is not there still answers null', 0.2, async function () {
  let missing = 'unset';
  try { missing = await names(function () { return Promise.reject(refused(404, 'not-found', 'no such file')); }).loadFile('media/none.txt'); } catch (e) { missing = 'threw ' + e.code; }
  return missing === null ? true : 'loadFile of a missing file: ' + String(missing);
}, test.limit.quick);
test.run('a file that is there answers its text', 0.2, async function () {
  const text = await names(function () { return Promise.resolve({ text: 'hello' }); }).loadFile('media/a.txt');
  return text === 'hello' ? true : 'loadFile: ' + String(text);
}, test.limit.quick);

// GOAL/G43.20 (Andy: "ANNOTATIONS WILL BE NODE ONLY."): no caller reads or writes an annotation.
test.run('the family has no fs.annotations and no fs.annotate', 0.2, function () {
  return !('annotations' in api.verbs) && !('annotate' in api.verbs) ? true : 'verbs: ' + JSON.stringify(Object.keys(api.verbs));
}, test.limit.quick);
test.run('and no getAnnotations among its kernel names', 0.2, function () {
  return !('getAnnotations' in names(function () { return Promise.resolve({}); })) ? true : 'names: ' + JSON.stringify(Object.keys(names(function () { return Promise.resolve({}); })));
}, test.limit.quick);
