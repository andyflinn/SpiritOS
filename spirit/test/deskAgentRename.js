'use strict';

// spirit/test/deskAgentRename.js
// goal/G27.13: RENAME deskUnsloth to deskAgent, deskUnslothRemote to deskAgentRemote, and every module that starts with
// deskUnsloth to start with deskAgent; deskEar becomes deskAgentEar. Andy, 2026-10-16: "this one includes exactly 2
// rename operations" and "rename first. all other items blocked until this is done."
//
// WHAT IS ASSERTED (red on today's code)
//   1. no file or folder anywhere in the tree is named deskUnsloth* (brains, media and published excluded).
//   2. the renamed folder spirit/run/process/js/deskAgent exists, with deskAgent.js in it.
//   3. the renamed remote app folder spirit/run/shell/deskAgentRemote exists, with deskAgentRemote.js in it.
//   4. the ear is spirit/run/process/js/desk/deskAgentEar.js, and deskEar.js is gone.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G27.13: ';
const SPIRIT = path.join(__dirname, '..');
const RUN = path.join(SPIRIT, 'run');
const SKIP = new Set(['node_modules', '.git', 'brains', 'media', 'published']);

function walkNames(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  entries.forEach(function (e) {
    if (SKIP.has(e.name)) return;
    const p = path.join(dir, e.name);
    out.push({ name: e.name, path: p });
    if (e.isDirectory()) walkNames(p, out);
  });
  return out;
}

test.startTest('goal/G27.13: deskUnsloth is renamed deskAgent');

test.subHeading('1. no file or folder is named deskUnsloth');
{
  const left = walkNames(SPIRIT, []).filter(function (e) { return /^deskUnsloth/.test(e.name); })
    .map(function (e) { return path.relative(SPIRIT, e.path).replace(/\\/g, '/'); });
  if (!left.length) test.check('nothing in spirit is named deskUnsloth*');
  else test.fail(OWED + left.length + ' name(s) still start with deskUnsloth, first: ' + left.slice(0, 4).join(', '));
}

test.subHeading('2. the agent folder is deskAgent');
{
  const dir = path.join(RUN, 'process', 'js', 'deskAgent');
  if (fs.existsSync(path.join(dir, 'deskAgent.js'))) test.check('spirit/run/process/js/deskAgent/deskAgent.js exists');
  else test.fail(OWED + 'spirit/run/process/js/deskAgent/deskAgent.js is missing');
}

test.subHeading('3. the remote app is deskAgentRemote');
{
  const dir = path.join(RUN, 'shell', 'deskAgentRemote');
  if (fs.existsSync(path.join(dir, 'deskAgentRemote.js'))) test.check('spirit/run/shell/deskAgentRemote/deskAgentRemote.js exists');
  else test.fail(OWED + 'spirit/run/shell/deskAgentRemote/deskAgentRemote.js is missing');
}

test.subHeading('4. the ear is deskAgentEar');
{
  const ear = path.join(RUN, 'process', 'js', 'desk', 'deskAgentEar.js');
  const old = path.join(RUN, 'process', 'js', 'desk', 'deskEar.js');
  if (fs.existsSync(ear) && !fs.existsSync(old)) test.check('deskAgentEar.js exists and deskEar.js is gone');
  else test.fail(OWED + 'ear: deskAgentEar.js present ' + fs.existsSync(ear) + ', deskEar.js present ' + fs.existsSync(old));
}

test.reportSuccessFailureCount();

module.exports = test;
