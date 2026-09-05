'use strict';

// Exercises the relay host's systemd unit template
// (bash/systemd/spirit-relay.service).
//
// Unlike every other file in here this asserts CONFIGURATION, not
// behaviour — there is no Linux box to start a unit on, and a test that
// spawned systemd would only run on the relay itself. What it can do is
// stop the unit quietly regressing: the relay answers unauthenticated
// requests from the open internet, and bash/cron-install hard-resets it to
// origin/master every ten minutes, so "runs as root" meant anything
// reaching that branch was root on the box inside ten minutes. Nothing the
// process does needs privilege — it binds a port above 1024, reads its own
// code, and writes one directory.
//
// The placeholder check matters as much as the hardening one: install-units
// fills these in from the clone's own location, so a name that drifts on
// one side and not the other produces a unit systemd refuses, or worse, one
// that starts with a stale path.
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO_ROOT = path.join(__dirname, '..', '..');
const UNIT_PATH = path.join(REPO_ROOT, 'bash', 'systemd', 'spirit-relay.service');
const INSTALLER_PATH = path.join(REPO_ROOT, 'bash', 'install-units');

test.startTest('Relay host hardening (bash/systemd/spirit-relay.service)');

const unit = fs.readFileSync(UNIT_PATH, 'utf8');
const installer = fs.readFileSync(INSTALLER_PATH, 'utf8');

function directive(name) {
  const match = unit.match(new RegExp('^' + name + '=(.*)$', 'm'));
  return match ? match[1].trim() : null;
}

test.subHeading('The relay does not run as root');
{
  const user = directive('User');
  if (user && user !== 'root') {
    test.check('User=' + user + ' (not root)');
  } else {
    test.fail('the unit runs as ' + (user === null ? 'whatever systemd defaults to, which is root' : user) +
      ' — nothing this process does needs privilege');
  }
}

test.subHeading('Confinement directives are present');
[
  ['NoNewPrivileges', 'yes', 'a compromised relay cannot gain privileges it was not given'],
  ['PrivateTmp', 'yes', 'no shared /tmp with the rest of the box'],
  ['ProtectSystem', 'strict', 'the filesystem is read-only except for ReadWritePaths'],
  ['ProtectHome', 'yes', '/root and /home stay invisible'],
  ['ProtectKernelTunables', 'yes', 'no writes to /proc/sys'],
  ['RestrictSUIDSGID', 'yes', 'cannot create setuid binaries'],
].forEach(function (row) {
  const name = row[0];
  const expected = row[1];
  const why = row[2];
  const actual = directive(name);
  if (actual === expected) {
    test.check(name + '=' + expected + ' — ' + why);
  } else {
    test.fail(name + ' is ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected) +
      ' — ' + why);
  }
});

test.subHeading('The one writable path is named, and is only relay-state');
{
  const rw = directive('ReadWritePaths');
  if (rw === null) {
    test.fail('ProtectSystem=strict with no ReadWritePaths — the relay cannot write its own mailbox');
  } else if (/relay-state|__STATE_DIR__/.test(rw)) {
    test.check('ReadWritePaths=' + rw + ' — mailbox, allow list and identity only');
  } else {
    test.fail('ReadWritePaths=' + rw + ' does not look like relay-state/');
  }
}

// V8 needs writable+executable pages to JIT. A well-meaning "add all the
// Protect* knobs" pass would stop the relay booting at all, with a failure
// that reads like a Node problem rather than a unit problem.
if (!/^MemoryDenyWriteExecute=/m.test(unit)) {
  test.check('MemoryDenyWriteExecute is absent — V8 could not JIT with it set');
} else {
  test.fail('MemoryDenyWriteExecute is set; node will not start under it');
}

test.subHeading('It is still the relay this repo means to run');
{
  const exec = directive('ExecStart');
  if (exec && exec.indexOf('--relay') !== -1) {
    test.check('ExecStart passes --relay');
  } else {
    test.fail('ExecStart does not pass --relay: ' + JSON.stringify(exec) +
      ' — a personal node must never be what this unit starts');
  }
}

test.subHeading('Every placeholder is one install-units fills in');
{
  const placeholders = Array.from(new Set(unit.match(/__[A-Z_]+__/g) || []));
  if (placeholders.length === 0) {
    test.fail('the unit has no placeholders — install-units substitutes this clone\'s own paths, ' +
      'so a hardcoded path would point at whichever box it was written on');
  }
  placeholders.forEach(function (token) {
    if (installer.indexOf(token) !== -1) {
      test.check(token + ' is substituted by install-units');
    } else {
      test.fail(token + ' appears in the unit but install-units never fills it in — ' +
        'systemd would get a literal ' + token);
    }
  });
}

test.reportSuccessFailureCount();
