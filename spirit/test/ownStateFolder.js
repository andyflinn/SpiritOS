'use strict';

// desk/G2.4: a process's own state folder.
// Andy: "server by design get the whole spirit/run/ scope minus !fileServable()", "an easier fix would be in the
// exclusion rules for fileServable() and fileWritable() to give processes their writable space", and on keying it
// by env: "that scared me" -> the name comes from where the running script lives ("good. accepted.").
// The contract the builder follows:
//   In a process whose main script is process/js/<name>/<name>.js, spirit.core.fs.fileServable and fileWritable
//   allow relay-state/process/<name>/ and nothing else under relay-state.
//   Anywhere else (the node, a test, a script outside process/js) nothing under relay-state is allowed.
//   No environment variable plays a part.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const spirit = require('../run/js/kernel.js');
const test = require('./testSupport.js');

const OWED = 'OWED by desk/G2.4: ';
const RUN = path.join(__dirname, '..', 'run');
const NAME = 'g24probe' + process.pid;
const DIR = path.join(RUN, 'process', 'js', NAME);
const PROBE = path.join(DIR, NAME + '.js');

const PATHS = {
  own: 'relay-state/process/' + NAME + '/state.db',
  other: 'relay-state/process/desk/desk.db',
  identity: 'relay-state/identity.json',
  nodeDb: 'relay-state/node.db',
};

test.startTest('desk/G2.4: a process reaches its own state folder, and nothing else in relay-state');

fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(PROBE, [
  "const spirit = require('../../../js/kernel.js');",
  'const P = ' + JSON.stringify(PATHS) + ';',
  'const out = {};',
  "Object.keys(P).forEach(function (k) { out[k] = { servable: !!spirit.core.fs.fileServable(P[k]), writable: !!spirit.core.fs.fileWritable(P[k]) }; });",
  "out.env = Object.keys(process.env).filter(function (k) { return /^SPIRIT_/.test(k); });",
  'process.stdout.write(JSON.stringify(out));',
].join('\n'));

try {
  let seen = null;
  try { seen = JSON.parse(execFileSync(process.execPath, [PROBE], { encoding: 'utf8', env: {} })); } catch (e) { seen = null; }
  if (!seen) {
    test.fail('the probe process did not run');
  } else {
    test.subHeading('in a process at process/js/<name>/<name>.js');
    if (seen.own.servable && seen.own.writable) test.check('its own relay-state/process/<name>/ is readable and writable');
    else test.fail(OWED + 'its own state folder is refused: ' + JSON.stringify(seen.own));
    ['other', 'identity', 'nodeDb'].forEach(function (k) {
      if (!seen[k].servable && !seen[k].writable) test.check(PATHS[k] + ' stays refused');
      else test.fail(PATHS[k] + ' is reachable from a process: ' + JSON.stringify(seen[k]));
    });
    if (!seen.env.length) test.check('it ran with no SPIRIT_ variables, so the name came from the script\'s place');
    else test.fail('the probe was given ' + seen.env.join(', '));
  }

  test.subHeading('anywhere else, nothing under relay-state');
  const here = { servable: !!spirit.core.fs.fileServable(PATHS.own), writable: !!spirit.core.fs.fileWritable(PATHS.own) };
  if (!here.servable && !here.writable) test.check('from a script outside process/js (this suite, like the node), a process folder is refused');
  else test.fail('outside a process, ' + PATHS.own + ' is reachable: ' + JSON.stringify(here));
} finally {
  fs.rmSync(DIR, { recursive: true, force: true });
}

test.reportSuccessFailureCount();
