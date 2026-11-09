'use strict';

// spirit/run/spirit/test/coreFiles-infoGrants.js
// INFO AND GRANTS ARE INTRINSIC BY THEIR OWN <name>.json, NOT BY coreFiles.js'S LIST (goal/G43.24, requirement 2; spec:
// ./coreFiles-infoGrants.md). Andy: "i just moved them, didn't fix the manifest.", "no i want those apps to basically be
// wrappers for spirit/element/ things....". coreFiles.js loaded as it is.

const path = require('path');
const RUN = path.resolve(__dirname, '..', '..');
const REPO = path.resolve(RUN, '..', '..');
const test = require(path.join(RUN, 'test', 'testReport.js'));

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

test.startTest('coreFiles-infoGrants.js: Info and Grants are intrinsic by their own <name>.json, not by coreFiles.js\'s list (goal/G43.24)');

test.subHeading('the box, 2: "both are intrinsic by their own <name>.json, as spirit/app apps say it"');
let core = null;
try { core = require(path.join(RUN, 'spirit', 'coreFiles.js')); } catch (e) { core = null; }
ok(!!core && typeof core.appIntrinsic === 'function', 'the world: coreFiles.js answers appIntrinsic', 'coreFiles.js: no appIntrinsic: nothing judged');
if (core && typeof core.appIntrinsic === 'function') {
  // No coded list names them: since goal/G43.30 there is none at all.
  ok(!('INTRINSIC' in core), 'no coded INTRINSIC list names shell/info or shell/grants: there is none (goal/G43.30)', 'coreFiles.js still answers an INTRINSIC list: ' + short(core.INTRINSIC));
  ['info', 'grants'].forEach(function (name) {
    ok(core.appIntrinsic(REPO, name) === true, 'coreFiles.appIntrinsic reads ' + name + ' intrinsic from its own ' + name + '.json', 'appIntrinsic(' + name + '): ' + short(core.appIntrinsic(REPO, name)));
  });
}

test.reportSuccessFailureCount();
process.exit(0);
