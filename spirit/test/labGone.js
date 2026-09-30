'use strict';

// lab.andyflinn.com is gone, and nothing outside design/ names it (Desk: cleanup/G1.8).

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const test = require('./testSupport.js');

const REPO = path.join(__dirname, '..', '..');
const OWED = 'OWED by cleanup/G1.8: ';
const NAMES = /lab\.andyflinn\.com|SPIRIT_LAB_|lab-install|lab-remove/;

test.startTest('cleanup/G1.8: the lab relay and everything that names it are gone');

test.subHeading('the lab scripts are gone');
['bash/lab-install', 'bash/lab-remove'].forEach(function (rel) {
  if (!fs.existsSync(path.join(REPO, rel))) test.check(rel + ' is gone');
  else test.fail(OWED + rel + ' is still there');
});

test.subHeading('no tracked file outside design/ names the lab');
const tracked = execSync('git ls-files', { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean)
  .filter(function (rel) { return rel.indexOf('design/') !== 0 && rel !== 'spirit/test/labGone.js'; });
const naming = tracked.filter(function (rel) {
  let text = '';
  try { text = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (e) { return false; }
  return NAMES.test(text);
});
if (tracked.length > 100 && !naming.length) test.check('none of ' + tracked.length + ' tracked files names lab.andyflinn.com, SPIRIT_LAB_ or the lab scripts');
else test.fail(OWED + (tracked.length > 100 ? naming.length + ' file(s) still name it: ' + naming.slice(0, 12).join(', ') : 'git ls-files listed only ' + tracked.length + ' files'));

test.reportSuccessFailureCount();
