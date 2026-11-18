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
  return !!threw && threw.code === 'not-from-the-face' && /off the face/.test(threw.message) ? true : false;
}, test.limit.quick);
test.run('loading a file that is not there still answers null', 0.2, async function () {
  let missing = 'unset';
  try { missing = await names(function () { return Promise.reject(refused(404, 'not-found', 'no such file')); }).loadFile('media/none.txt'); } catch (e) { /* a throw leaves it unset */ }
  return missing === null ? true : false;
}, test.limit.quick);
test.run('loading a file that is there answers its text', 0.2, async function () {
  const text = await names(function () { return Promise.resolve({ text: 'hello' }); }).loadFile('media/a.txt');
  return text === 'hello' ? true : false;
}, test.limit.quick);

// GOAL/G43.20 (Andy: "ANNOTATIONS WILL BE NODE ONLY."): no caller reads or writes an annotation.
test.run('the family has no fs.annotations and no fs.annotate', 0.2, function () {
  return !('annotations' in api.verbs) && !('annotate' in api.verbs) ? true : false;
}, test.limit.quick);
test.run('the family has no getAnnotations among its kernel names', 0.2, function () {
  return !('getAnnotations' in names(function () { return Promise.resolve({}); })) ? true : false;
}, test.limit.quick);

// A FILE VERB NEVER CLIMBS OUT OF THE RUN FOLDER (goal/G47.6, box: "a peer asking a file verb for ../, a full path or a drive
// letter is refused by the spirit object's path rule at the door"). The node checks every call against the verbs declared
// here with spirit.check; each file verb's path, asked as one of these, is refused there and never reaches the disc.
const spirit = require(path.join(RUN, 'spirit', 'spirit.js'));
const CLIMBS = ['../x', 'a/../../x', '..\\x', '/etc/passwd', '\\x', 'C:/x', 'c:\\x', 'a\u0000b'];
const FILE_VERBS = ['stat', 'load', 'save', 'delete'];
test.run('every file verb asked for a path that climbs out, starts at the top or names a drive is refused by the path rule', 0.8, function () {
  const bad = [];
  FILE_VERBS.forEach(function (v) {
    CLIMBS.forEach(function (p) {
      const args = v === 'save' ? { path: p, content: 'x' } : { path: p };
      const r = spirit.check('fs.' + v, api.verbs[v], args);
      if (!r || !r.code) bad.push(v + ' ' + JSON.stringify(p));
    });
  });
  return bad.length === 0;
}, test.limit.quick);
test.run('a file verb asked for a plain path inside the run folder passes the path rule', 0.2, function () {
  return FILE_VERBS.every(function (v) { return !spirit.check('fs.' + v, api.verbs[v], v === 'save' ? { path: 'media/a.txt', content: 'x' } : { path: 'media/a.txt' }); });
}, test.limit.quick);
