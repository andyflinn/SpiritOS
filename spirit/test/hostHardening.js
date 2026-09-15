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

// ── TWO RELAYS ON ONE BOX, AND THE TWO WAYS IT USED TO EAT ITSELF ────
//
//   Andy: "we'll need to fake multiple public relays without me shelling
//   out another bunch of bucks per month for that test environment."
//   Andy: "i could just make a new subdirectory on /root/lab/ and clone
//   this repo from there, configure it to a separate port, and off we
//   go... the cheapest in effort."
//
// It is the cheapest, and two constants stood in the way. Both failures
// were SILENT and both took down the live relay rather than the new one,
// which is why they are asserted rather than remembered.
test.subHeading('A second clone cannot eat the first');
{
  // THE UNIT NAME. `install-units` from a second clone wrote
  // /etc/systemd/system/spirit-relay.service — the LIVE unit — pointing
  // it at the lab's directory and port. Nothing failed until the next
  // restart, and then spirit-3 came back as the lab.
  if (/UNIT_NAME="\$\{SPIRIT_UNIT_NAME:-/.test(lib)) {
    test.check('the unit name is an env override, so two clones install two units');
  } else {
    test.fail('UNIT_NAME is a constant — a second clone overwrites the live unit');
  }

  // THE CADDYFILE. `./bash/tls` wrote /etc/caddy/Caddyfile with `>` from
  // a one-site template, so running it from the lab clone DELETED the
  // public relay's config. No error; the first sign is a certificate for
  // the wrong name.
  const tls = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'tls'), 'utf8');

  // WHAT IT DOES, NOT WHAT IT PRINTS. The script ECHOES the migration
  // for the operator to type, and that text contains the very
  // redirection this forbids — so a scan of the whole file failed on its
  // own instructions. Same rule protocolSurface follows for the
  // register: a name in a cell is an entry, a name in a paragraph is a
  // mention.
  const tlsRuns = tls.split('\n')
    .filter(function (line) { return !/^\s*(#|echo\b|warn\b|say\b|ok\b|die\b)/.test(line); })
    .join('\n');

  if (!/>\s*\/etc\/caddy\/Caddyfile/.test(tlsRuns)) {
    test.check('and tls never writes the main Caddyfile, which is the operator’s');
  } else {
    test.fail('tls still overwrites /etc/caddy/Caddyfile — that is the live relay’s config');
  }

  if (/\/etc\/caddy\/sites/.test(tls) && /import sites\//.test(tls)) {
    test.check('it writes one file per domain and asks for an import, which is additive');
  } else {
    test.fail('tls does not write a per-domain site file');
  }

  // VALIDATED BEFORE RELOADING. A bad config rejected is a message; a
  // bad config reloaded is a box off the internet.
  const reloadAt = tls.indexOf('systemctl reload caddy');
  const validateAt = tls.indexOf('caddy validate');
  if (validateAt !== -1 && validateAt < reloadAt) {
    test.check('and validates before it reloads, so a broken file costs a message');
  } else {
    test.fail('tls reloads caddy without validating first');
  }

  // AND THE POLICY IS UNCHANGED. A second RELAY is a second clone with
  // its own key; it is not a second Unix user, which is the split
  // ONE-OPERATOR.md exists to refuse.
  if (!/useradd|RELAY_USER|User=/.test(lib)) {
    test.check('while none of it invents a second Unix account — root is still spirit');
  } else {
    test.fail('a second user crept into lib.sh');
  }
}

test.reportSuccessFailureCount();
