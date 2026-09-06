'use strict';

// Exercises the relay host unit + installer against the one-operator
// policy: root is spirit. See bash/ONE-OPERATOR.md.
//
// This asserts CONFIGURATION, not a live systemd. It must not demand a
// second Unix user that the host is forbidden to grow.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const REPO_ROOT = path.join(__dirname, '..', '..');
const UNIT_PATH = path.join(REPO_ROOT, 'bash', 'systemd', 'spirit-relay.service');
const INSTALLER_PATH = path.join(REPO_ROOT, 'bash', 'install-units');
const LIB_PATH = path.join(REPO_ROOT, 'bash', 'lib.sh');
const POLICY_PATH = path.join(REPO_ROOT, 'bash', 'ONE-OPERATOR.md');

test.startTest('Relay host one-operator policy (root is spirit)');

const unit = fs.readFileSync(UNIT_PATH, 'utf8');
const installer = fs.readFileSync(INSTALLER_PATH, 'utf8');
const lib = fs.readFileSync(LIB_PATH, 'utf8');

function directive(name) {
  const match = unit.match(new RegExp('^' + name + '=(.*)$', 'm'));
  return match ? match[1].trim() : null;
}

test.subHeading('Policy document exists');
if (fs.existsSync(POLICY_PATH)) {
  test.check('bash/ONE-OPERATOR.md is present');
} else {
  test.fail('bash/ONE-OPERATOR.md missing — the policy has to live next to the unit');
}

test.subHeading('The unit does not invent a second Unix user');
{
  const user = directive('User');
  const group = directive('Group');
  if (user === null && group === null) {
    test.check('no User= / Group= — systemd default is root, which is spirit');
  } else {
    test.fail('User=' + JSON.stringify(user) + ' Group=' + JSON.stringify(group) +
      ' — one-operator policy forbids a second account');
  }
}

test.subHeading('Installer does not create or require a spirit user');
{
  if (/useradd/.test(installer) || /RELAY_USER/.test(installer)) {
    test.fail('install-units still creates or names RELAY_USER / useradd');
  } else {
    test.check('install-units has no useradd and no RELAY_USER');
  }
  if (/\/root\|\/root\/\*/.test(installer) && /die/.test(installer)) {
    // coarse: refuse-block for /root
    if (/this clone lives at/.test(installer)) {
      test.fail('install-units still refuses a clone under /root');
    } else {
      test.check('no /root refuse text in install-units');
    }
  } else {
    test.check('install-units does not refuse /root');
  }
}

test.subHeading('lib.sh default clone is the live path');
{
  if (/CLONE_DIR="\$\{SPIRIT_CLONE_DIR:-\/root\/SpiritOS\}"/.test(lib) ||
      /CLONE_DIR=.*\/root\/SpiritOS/.test(lib)) {
    test.check('CLONE_DIR defaults to /root/SpiritOS');
  } else {
    test.fail('CLONE_DIR does not default to /root/SpiritOS');
  }
  if (/RELAY_USER/.test(lib)) {
    test.fail('lib.sh still defines RELAY_USER');
  } else {
    test.check('lib.sh has no RELAY_USER');
  }
}

test.subHeading('It is still the relay this repo means to run');
{
  const exec = directive('ExecStart');
  if (exec && exec.indexOf('--relay') !== -1) {
    test.check('ExecStart passes --relay');
  } else {
    test.fail('ExecStart does not pass --relay: ' + JSON.stringify(exec));
  }
  if (exec && exec.indexOf('js/server.js') !== -1) {
    test.check('ExecStart is js/server.js from WorkingDirectory');
  } else {
    test.fail('ExecStart is not js/server.js: ' + JSON.stringify(exec));
  }
}

test.subHeading('Soft sandbox that does not fight /root');
{
  if (directive('NoNewPrivileges') === 'yes') {
    test.check('NoNewPrivileges=yes');
  } else {
    test.fail('NoNewPrivileges missing');
  }
  if (directive('PrivateTmp') === 'yes') {
    test.check('PrivateTmp=yes');
  } else {
    test.fail('PrivateTmp missing');
  }
  if (directive('ProtectSystem') === 'strict') {
    test.fail('ProtectSystem=strict fights a clone under /root — drop it');
  } else {
    test.check('ProtectSystem is not strict');
  }
  if (!/^MemoryDenyWriteExecute=/m.test(unit)) {
    test.check('MemoryDenyWriteExecute is absent — V8 needs JIT');
  } else {
    test.fail('MemoryDenyWriteExecute is set; node will not start');
  }
}

test.subHeading('Every placeholder is one install-units fills in');
{
  const placeholders = Array.from(new Set(unit.match(/__[A-Z_]+__/g) || []));
  if (placeholders.length === 0) {
    test.fail('the unit has no placeholders — install-units must stamp this clone\'s paths');
  }
  placeholders.forEach(function (token) {
    if (installer.indexOf(token) !== -1) {
      test.check(token + ' is substituted by install-units');
    } else {
      test.fail(token + ' appears in the unit but install-units never fills it in');
    }
  });
}

test.reportSuccessFailureCount();
