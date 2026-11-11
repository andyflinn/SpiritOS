'use strict';

// spirit/run/spirit/app/deskVerify/test/api.js
// deskVerify RECORDS NO STACKS DOOR VERDICT (goal/G43.22, Q3; spec: ./api.md): spirit/app/deskVerify/api.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". "the verifier stuff can stay for now", its recording of the Stacks door verdicts not. The tree read as it is, comments left out.

const fs = require('fs');
const path = require('path');
const RUN = path.resolve(__dirname, '..', '..', '..', '..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));

function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

// Andy: "the verifier stuff can stay for now", the Stacks verdicts not.
test.run('deskVerify records no Stacks door verdict', 0.2, function () {
  const verifyApi = code(path.join(RUN, 'spirit', 'app', 'deskVerify', 'api.js'));
  return (!!verifyApi && !/door\.record/.test(verifyApi)) || 'deskVerify\'s api still has door.record';
}, test.limit.quick);
