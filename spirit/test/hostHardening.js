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

// ── THE LAB SCRIPTS REFUSE TO TOUCH THE LIVE RELAY ───────────────────
//
//   Andy: "my ./batch tools need to give me the option to install/remove
//   the clone that sits there (/root/lab/)."
//
// A command named `lab-remove` that stops `spirit-relay` is the whole
// hazard here, and it is not hypothetical: every knob it reads has a
// default, and a default that happens to match the live one turns a
// tidy-up into an outage. So both scripts compare all four — directory,
// unit, port, domain — against the live values and refuse rather than
// guess.
//
// Asserted by reading the source, the way the rest of this file does:
// these scripts need root and a relay host to run, so the harness
// cannot execute them. What it CAN hold is that the refusals are still
// written.
// ── THE TEMPLATE IS NOT THE UNIT NAME ────────────────────────────────
//
// FOUND BY RUNNING IT, which is the part worth recording. `lab-install`
// cloned, wrote .env, and died on:
//
//   ERROR: missing /root/lab/SpiritOS/bash/systemd/spirit-lab.service
//
// install-units read `bash/systemd/${UNIT_NAME}.service`, so the moment
// UNIT_NAME became an override it started looking for a template nobody
// wrote. One file in this repo describes how to run a relay and it is
// the same file for every relay — it is all placeholders. What varies
// is the name systemd knows the installed copy by.
//
// The check above ("every placeholder is one install-units fills in")
// could not see this: it reads the template and the installer, and both
// were fine. What was wrong was which FILE the installer opened.
test.subHeading('The unit template is one file, however many relays use it');
{
  if (/UNIT_TEMPLATE="\$\{SPIRIT_UNIT_TEMPLATE:-/.test(lib)) {
    test.check('the template name is its own variable, not the unit name');
  } else {
    test.fail('UNIT_TEMPLATE is missing — install-units derives the template from UNIT_NAME again');
  }

  if (/systemd\/\$\{UNIT_TEMPLATE\}\.service/.test(installer)) {
    test.check('and install-units reads the template by that name');
  } else {
    test.fail('install-units still opens bash/systemd/${UNIT_NAME}.service');
  }

  // AND INSTALLS UNDER THE OTHER ONE. Both halves, because reading the
  // right file and writing the wrong name is the same bug reversed —
  // two clones would install one unit again.
  if (/etc\/systemd\/system\/\$\{UNIT_NAME\}\.service/.test(installer)) {
    test.check('while the installed unit takes the name this clone runs under');
  } else {
    test.fail('install-units does not install as ${UNIT_NAME}');
  }

  // THE TEMPLATE IT NAMES MUST EXIST. The failure Andy hit was a missing
  // file, and a default that points at nothing is the same outage.
  const templatePath = path.join(REPO_ROOT, 'bash', 'systemd', 'spirit-relay.service');
  if (fs.existsSync(templatePath)) {
    test.check('and the default template is a file that is actually here');
  } else {
    test.fail('bash/systemd/spirit-relay.service is missing');
  }
}

test.subHeading('lab-install and lab-remove cannot be aimed at the live relay');
{
  const labInstall = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'lab-install'), 'utf8');
  const labRemove = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'lab-remove'), 'utf8');

  // Four knobs, four ways to be pointed at the wrong thing. `lab-remove`
  // does not read a port — it never starts anything — so three there.
  [
    ['lab-install', labInstall, ['$REPO_ROOT', '$UNIT_NAME', '$NODE_PORT', '$DOMAIN']],
    ['lab-remove', labRemove, ['$REPO_ROOT', '$UNIT_NAME', '$DOMAIN']],
  ].forEach(function (row) {
    const name = row[0];
    const src = row[1];
    const missing = row[2].filter(function (live) {
      // A refusal is a comparison against the live value followed by
      // `die`. Both halves, because a comparison that only warns is a
      // pause on the way to the same outage.
      return src.indexOf(live) === -1;
    });
    if (missing.length === 0 && /\|\| die/.test(src)) {
      test.check(name + ' compares every knob against the live relay and dies rather than guessing');
    } else {
      test.fail(name + ' does not guard: ' + (missing.join(', ') || 'no die'));
    }
  });

  // THE DEFAULT KEEPS THE DISK. A relay's identity is what its members
  // PINNED — relayKeys.json refuses a relay answering with a different
  // key — so deleting relay-state makes the lab a stranger to everybody
  // that ever spoke to it. That is the damage `recycle` used to do, and
  // the reason `refresh` exists.
  if (/--purge/.test(labRemove) && /PURGE=no/.test(labRemove)) {
    test.check('and removal keeps the clone by default — the key survives unless --purge is asked for');
  } else {
    test.fail('lab-remove deletes the clone without being asked');
  }

  // `rm -rf` ON A VARIABLE is how a script deletes something nobody
  // asked it to. Two more refusals before it runs.
  if (/refusing to purge inside/.test(labRemove) && /not a git clone/.test(labRemove)) {
    test.check('and a purge refuses a path that is not a clone under a lab root');
  } else {
    test.fail('lab-remove purges without checking the path it was handed');
  }

  // NEITHER WRITES THE MAIN CADDYFILE. Same rule as bash/tls, and the
  // same reason: it once held the live relay's only config.
  const writesMain = [labInstall, labRemove].filter(function (src) {
    return src.split('\n').some(function (line) {
      return !/^\s*(#|echo\b|warn\b|say\b|ok\b|die\b)/.test(line) &&
        />\s*\/etc\/caddy\/Caddyfile/.test(line);
    });
  });
  if (writesMain.length === 0) {
    test.check('while neither writes /etc/caddy/Caddyfile — one file per domain, the main one is the operator’s');
  } else {
    test.fail('a lab script writes the main Caddyfile');
  }
}

test.reportSuccessFailureCount();
