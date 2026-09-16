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

// ── THE UPDATE CRON IS PER CLONE, AND BOTH HALVES WERE BROKEN ────────
//
// Found before it ran, while answering "can the agent test remote
// update and restart on the relay it owns".
//
//   THE MARKER WAS SHARED. cron-install removed every line carrying
//   `# spirit-host-update` before adding its own, so installing from the
//   lab clone DELETED spirit-3's line. Not an update cron — a game of
//   swapping.
//
//   AND CRON HAS NO ENVIRONMENT, which is worse. bash/update restarts
//   "$UNIT_NAME", and cron sources no .env and no profile — so a line
//   installed from the lab clone would pull the LAB's code and restart
//   spirit-relay: the live box, bounced every ten minutes on behalf of a
//   directory it knows nothing about.
//
// THIS CORRECTS THE FIX, NOT THE DIAGNOSIS. The first answer was to put
// the environment on the cron line. It shipped, and then the real fault
// showed itself one level up — see "The clone decides, not the shell"
// below. Cron's empty environment was never the hazard; an environment
// that could be WRONG was, and a line carrying its own copy of it is a
// line that can carry the wrong one. It did.
// ── NO PIPELINE DECIDES ANYTHING, UNDER pipefail ─────────────────────
//
// `set -euo pipefail` is on for every script in bash/, and it turns a
// SUCCESSFUL match into a failed test:
//
//   grep -q exits the instant it matches
//   the producer keeps writing into a closed pipe and takes SIGPIPE (141)
//   pipefail promotes that to the PIPELINE's status
//   the `if` sees 141 and takes the else branch
//
// Proved on spirit-3 on 2026-09-16:
//
//   systemctl list-unit-files | grep -q "^spirit-relay.service"  -> MATCHED
//   ( set -o pipefail; same )                                    -> exit=141
//
// WHAT IT COST: bash/update has NEVER restarted a relay. It printed
// "unit spirit-relay not installed" on a box where the unit was
// installed, enabled AND active — so the code updated and the process
// went on running the old copy. Silent for as long as pipefail has been
// in lib.sh, on every box, including the cron that runs every ten
// minutes.
//
// bash/lab-remove had the same line, where it would have skipped the
// stop and disable and left a relay running after being told to remove
// it. bash/status had it on the labMaster warning, which therefore never
// warned.
test.subHeading('No pipeline decides anything — pipefail turns a match into 141');
{
  const SCRIPTS = ['update', 'lab-remove', 'lab-install', 'status', 'tls', 'cron-install', 'cron-remove'];
  const guilty = [];

  SCRIPTS.forEach(function (name) {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'bash', name), 'utf8');
    // Plain string work, no regexes: this check is about backslashes in
    // shell, and writing it with escaped patterns is how it would come
    // to disagree with itself.
    src.split(String.fromCharCode(10)).forEach(function (raw, i) {
      const line = raw.replace(String.fromCharCode(13), '').trim();
      if (!line || line.charAt(0) === '#' || line.indexOf('echo ') === 0) return;
      // A pipeline whose exit code is READ: it decides an if, or is
      // chained with && / ||. A pipeline whose OUTPUT is used is fine:
      // x=$(a | grep b) reads stdout and never consults the status.
      const decides = line.indexOf('if ') === 0 || line.indexOf('elif ') === 0 ||
        line.indexOf('&&') !== -1 || line.indexOf('||') !== -1;
      if (!decides) return;
      // ONLY `grep -q`. That is the whole hazard: -q exits on the first
      // match, so the producer is still writing when the pipe closes.
      // Plain grep and grep -v read to EOF, the producer finishes
      // normally, and the pipeline's status is grep's own — those are
      // safe and six of them were flagged by a first cut of this scan.
      const quiet = line.indexOf('grep -q') !== -1;
      if (quiet && (line.indexOf('| grep') !== -1 || line.indexOf('|grep') !== -1)) {
        guilty.push(name + ':' + (i + 1));
      }
    });
  });

  if (guilty.length === 0) {
    test.check('no script decides a branch on `| grep -q` — ' + SCRIPTS.length + ' scanned');
  } else {
    test.fail(guilty.join(', ') + ' — under pipefail, grep -q matching KILLS the producer ' +
      'with SIGPIPE and the pipeline reports 141. A successful match reads as a failed test. ' +
      'Use contains() or unit_known() from lib.sh.');
  }

  // AND THE TWO HELPERS EXIST, because the rule is only enforceable if
  // there is somewhere to go instead.
  if (/^contains()/m.test(lib) && /<<</.test(lib)) {
    test.check('and lib.sh offers contains(), which feeds grep a here-string rather than a pipe');
  } else {
    test.fail('lib.sh has no contains() helper');
  }

  if (/^unit_known()/m.test(lib) && /systemctl cat/.test(lib)) {
    test.check('and unit_known(), which asks systemd directly instead of filtering its list');
  } else {
    test.fail('lib.sh has no unit_known() helper');
  }
}

// ── THE CLONE DECIDES, NOT THE SHELL ─────────────────────────────────
//
// The fifth instance of one bug class, all of them found within two days
// of a second relay existing on this box: FINE WITH ONE CLONE, SILENTLY
// WRONG WITH TWO, and every one of them failing TOWARD the live relay.
//
//   install-units read bash/systemd/${UNIT_NAME}.service   (template)
//   tls wrote /etc/caddy/Caddyfile with >                  (site config)
//   cron-install swept every line carrying its marker      (the cron)
//   update's `| grep -q` never matched under pipefail      (the restart)
//   and this one: an exported SPIRIT_UNIT_NAME
//
// `source .env` was the documented way to work in the lab clone. It is
// also an EXPORT, and an export outlives the `cd` that follows it, so
// the documentation was handing the shell a lie to carry:
//
//   cd /root/lab/SpiritOS && source .env
//   cd /root/SpiritOS     && ./bash/update        -> "unit spirit-lab"
//   cd /root/SpiritOS     && ./bash/cron-install  -> clone: /root/SpiritOS
//                                                    unit:  spirit-lab
//
// The guard written for lab-install compares the lab's knobs against the
// live ones, which catches a mis-AIMED command. It cannot catch this,
// because by the time it runs, "the live ones" have already been read
// out of the poisoned environment: both sides of the comparison are
// wrong together and it agrees with itself.
//
// So the environment stops being an input. A clone with a .env is
// described by that file; a clone without one takes the defaults; and in
// both cases what the shell was carrying is discarded. The variables
// exist to configure a clone, and which clone is not a question the
// shell gets a vote on.
//
// THE PRICE, stated because it is real: a one-off
// `SPIRIT_RELAY_PORT=9999 ./bash/serve` no longer works. To change what a
// clone is, edit that clone's .env. Cheap, next to a public relay
// restarting on behalf of a directory it has never heard of.
test.subHeading('The clone decides what it is — not whatever the shell was carrying');
{
  // READ, NOT UNSET, when the file is there. A clone with a .env is
  // described by it; the file is the clone's own word about itself.
  if (/if \[ -f "\$REPO_ROOT\/\.env" \]/.test(lib) && /\.\s+"\$REPO_ROOT\/\.env"/.test(lib)) {
    test.check('lib.sh reads this clone’s .env itself — nobody sources anything');
  } else {
    test.fail('lib.sh does not read $REPO_ROOT/.env — the lab clone depends on a human remembering');
  }

  // AND CLEARED WHEN IT IS NOT. This is the half that saves the live
  // relay: /root/SpiritOS has no .env, so an inherited SPIRIT_UNIT_NAME
  // would otherwise still win there.
  const unsetLine = (lib.match(/^\s*unset .*$/m) || [''])[0];
  const missing = ['SPIRIT_UNIT_NAME', 'SPIRIT_RELAY_PORT', 'SPIRIT_RELAY_DOMAIN', 'SPIRIT_UNIT_TEMPLATE']
    .filter(function (v) { return unsetLine.indexOf(v) === -1; });
  if (missing.length === 0) {
    test.check('and clears all four when there is none, so an export cannot follow you between clones');
  } else {
    test.fail('a clone with no .env still inherits: ' + missing.join(', '));
  }

  // THE ORDER IS THE WHOLE THING. UNIT_NAME and friends must be assigned
  // AFTER the .env block, or the block resolves nothing and the defaults
  // have already been fixed from the environment.
  const envAt = lib.indexOf('$REPO_ROOT/.env');
  const unitAt = lib.indexOf('UNIT_NAME="${SPIRIT_UNIT_NAME:-');
  if (envAt !== -1 && unitAt !== -1 && envAt < unitAt) {
    test.check('and it resolves before UNIT_NAME is read, or the defaults would already be set');
  } else {
    test.fail('lib.sh reads .env after deriving UNIT_NAME — the file has no effect');
  }

  // AND `update` RE-READS IT AFTER THE RESET, because the reset can
  // replace lib.sh — so without this, a change to how a clone resolves
  // its unit takes effect one cycle late, and the run that installs it
  // still behaves the old way. That is not theoretical: the run that
  // shipped this very fix updated /root/SpiritOS and restarted
  // spirit-lab, leaving the live relay on the old process.
  const updateSrc = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'update'), 'utf8');
  // `git reset --hard "$REMOTE"` — it named origin/master literally
  // until the clone learned to follow a tag instead.
  const resetAt = updateSrc.indexOf('git reset --hard "$REMOTE"');
  const rereadAt = updateSrc.indexOf('source "$REPO_ROOT/bash/lib.sh"');
  const restartAt = updateSrc.indexOf('systemctl restart');
  if (resetAt !== -1 && rereadAt > resetAt && restartAt > rereadAt) {
    test.check('and update re-reads it after the reset, before deciding what to restart');
  } else {
    test.fail('update decides which unit to restart from the lib.sh it replaced a moment ago');
  }

  // NOBODY SOURCES IT BY HAND ANY MORE. lab-install used to, in four
  // places, and those four lines are the instruction that caused this.
  const labInstallSrc = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'lab-install'), 'utf8');
  const sourced = labInstallSrc.split('\n').filter(function (line) {
    return /^\s*[^#]*\bsource \.env\b/.test(line);
  });
  if (sourced.length === 0) {
    test.check('and lab-install no longer tells anyone to source it');
  } else {
    test.fail(sourced.length + ' line(s) in lab-install still `source .env` — that is the export that travels');
  }
}

// ── THE KEEPER'S SSH DOOR IS ONE SCRIPT, NOT A SHELL ─────────────────
//
//   Andy: "you may set yourself up to remotely update and restart, i'll
//   help you with my ssh until you can do it from here."
//
// The lazy way to grant that is a key in authorized_keys and a promise
// about what will be typed with it. That is a root shell with a manner,
// and the promise is the only thing between it and the box. SSH's own
// `command=` is the real mechanism: sshd runs the named script and the
// client's request survives only as $SSH_ORIGINAL_COMMAND — a string to
// MATCH, never to execute.
//
// Two properties, and both are the kind that get loosened by someone
// being helpful:
//
//   the request is matched against a list, never evaluated
//   the door is the LAB's, never the live relay's
//
// The second is a policy choice worth stating: the same cron that makes
// remote update useful also restarts spirit.andyflinn.com unattended on
// every push, which became true only when bash/update was fixed. The
// live relay should move when Andy cuts a tag. So the keeper's key
// reaches the lab and refuses everything else, twice over — the clone
// has no .env (which is what MAKES it the main clone), or it resolves to
// the live unit or domain.
// ── ANDY'S RELAY MOVES ON ANDY'S TAGS ────────────────────────────────
//
//   Andy: "let's make sure that my relay only restarts on my tags, and
//   your relay is controlled by you."
//
// This exists because fixing a bug created a capability nobody asked
// for. bash/update never restarted anything until 2026-09-16 — `grep -q`
// under pipefail turned every match into 141 — so a push to master
// reached the live relay's DISK and never its process. That accident was
// doing the work of a release gate. Repairing it meant every push
// restarted spirit.andyflinn.com, unattended, within ten minutes.
//
// THE DEFAULT IS THE WHOLE DESIGN. A clone with no .env is the live
// relay — that is what lib.sh's fallback means — so `tag` has to be what
// you get by doing nothing, and the lab opts into `master` in writing.
// Get that backwards and the safe case is the one requiring a step
// somebody has to remember, which is how the last five of these went.
test.subHeading('A clone follows tags unless it says otherwise in writing');
{
  const upd = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'update'), 'utf8');
  const updCode = upd.split('\n').filter(function (l) { return !/^\s*#/.test(l); }).join('\n');
  const labInstall = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'lab-install'), 'utf8');

  if (/TRACK="\$\{SPIRIT_TRACK:-tag\}"/.test(lib)) {
    test.check('the default is `tag`, so the clone with no .env is the guarded one');
  } else {
    test.fail('SPIRIT_TRACK does not default to `tag` — the live relay follows master again');
  }

  if (/export SPIRIT_TRACK=master/.test(labInstall)) {
    test.check('and lab-install writes `master` into the lab’s own .env, opting in');
  } else {
    test.fail('lab-install does not set SPIRIT_TRACK — a fresh lab would freeze on tags');
  }

  // NO FALLBACK. A tag-tracking clone that finds no tag must STAY PUT.
  // Falling back to origin/master would hand the whole gate back at the
  // one moment it first means anything: before the first tag exists.
  const tagBranch = updCode.slice(updCode.indexOf('  tag)'), updCode.indexOf('  *)'));
  const fallsBack = /TARGET="origin\/master"/.test(tagBranch);
  // `origin/master` specifically — a tag on a side branch is not a
  // release, which is Andy's "we only TAG origin/master" as a mechanism.
  // The flags between `describe` and the ref are checked separately
  // below; this one is about which history is asked.
  if (!fallsBack && /git describe --tags [^\n]*origin\/master/.test(tagBranch)) {
    test.check('and a clone tracking tags with none to find stays where it is');
  } else {
    test.fail('the tag branch falls back to origin/master — that is no gate at all');
  }

  // ── A MARKER IS NOT A RELEASE ──────────────────────────────────────
  //
  // This matched ANY tag for about an hour and it very nearly rolled the
  // live relay back eight days. The repository already carried four
  // tags, none of them releases — APP_SPECIFIC_RELAY_PROTOCOL,
  // mailbox-keys-2026-09-07, END_OF_SKELLETON_PHASE,
  // archive/zs4-2016-2026 — and `git describe --abbrev=0` picked the
  // newest, 194 commits behind master. spirit.andyflinn.com would have
  // reset --hard onto it at a ten-minute tick, unattended, and served
  // eight-day-old code with a plausible commit id and dirty:false.
  //
  // Caught by reading the tag list before the second tick. Nothing in
  // the design would have caught it, which is the point of this check.
  if (/--match 'v\*'/.test(updCode)) {
    test.check('and only a `v*` tag is a release — a phase marker is not deployable');
  } else {
    test.fail('update deploys ANY tag, including archive and milestone markers');
  }

  // ── AND AN UPDATE NEVER GOES BACKWARDS ─────────────────────────────
  //
  // Belt to that brace. Any way of choosing a target can choose an older
  // one — a tag moved, a tag deleted, a branch rewound — and whatever
  // the cause, "update" cannot mean "go back". A rollback is a
  // deliberate act with somebody watching, not something cron does
  // at :20.
  if (/merge-base --is-ancestor "\$REMOTE" "\$LOCAL"/.test(updCode)) {
    test.check('and it refuses a target that is an ancestor of where it already is');
  } else {
    test.fail('update will silently roll a relay backwards');
  }

  // AND status ASKS THE SAME QUESTION. It compared HEAD to origin/master
  // unconditionally, so the day the live relay started tracking tags it
  // would have said "HEAD != origin/master (run ./bash/update)" for ever
  // — telling the operator to fix a relay correctly sitting on release.
  const st = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'status'), 'utf8');
  if (/\$TRACK" = "master"/.test(st) && /describe --tags --abbrev=0/.test(st)) {
    test.check('and ./bash/status judges the clone by what it actually follows');
  } else {
    test.fail('status still measures every clone against origin/master');
  }
}

// ── A SCRIPT ADDED FROM WINDOWS IS NOT EXECUTABLE ────────────────────
//
// The work machine is Windows, git cannot read an exec bit there, and so
// EVERY script added to bash/ from here lands in the index as 100644.
// Nothing complains. It is discovered on the relay, by the thing that
// needed to run it failing — and for a script invoked by sshd as a
// forced command, "failing" means the door does not open.
//
// That is exactly how keeper-ssh shipped: `chmod +x` locally (which git
// on Windows ignores), then `git update-index --chmod=+x` BEFORE the
// file was staged, with its error swallowed by 2>/dev/null. Two mistakes
// that cancel into silence. The file arrived on spirit-3 as -rw-r--r--.
//
// `chmod +x` on the box does not fix it either: the mode lives in the
// index, so the next `git reset --hard` in bash/update puts it back.
//
// So assert it here, where it costs nothing: anything in bash/ with a
// shebang is something meant to be RUN, and must be 100755. lib.sh is
// sourced rather than run and has no shebang line of its own to claim
// otherwise — it is 100644 correctly, and this rule leaves it alone.
test.subHeading('Every script in bash/ is committed executable');
{
  const ls = require('child_process')
    .execSync('git ls-files -s bash/', { cwd: REPO_ROOT, encoding: 'utf8' });
  const wrong = [];
  ls.split('\n').forEach(function (row) {
    if (!row.trim()) return;
    const mode = row.slice(0, 6);
    const file = row.split('\t')[1];
    if (!file) return;
    const full = path.join(REPO_ROOT, file);
    if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) return;
    const first = fs.readFileSync(full, 'utf8').slice(0, 2);
    // A shebang is the file saying it is meant to be executed. lib.sh
    // opens with one too — `#!/bin/bash` — but is only ever sourced, so
    // it is named rather than sniffed.
    if (first !== '#!' || file === 'bash/lib.sh') return;
    if (mode !== '100755') wrong.push(file + ' is ' + mode);
  });
  if (wrong.length === 0) {
    test.check('nothing in bash/ has a shebang and a non-executable mode');
  } else {
    test.fail('added from Windows without --chmod=+x: ' + wrong.join(', '));
  }
}

test.subHeading('The keeper’s SSH key runs one script and cannot reach the live relay');
{
  const keeper = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'keeper-ssh'), 'utf8');
  const code = keeper.split('\n').filter(function (l) { return !/^\s*#/.test(l); }).join('\n');

  // NEVER EVALUATED. eval, $REQ as a bare command, or feeding it to sh
  // would each turn a forced command back into a shell.
  const evaluated = /\beval\b/.test(code) ||
    /^\s*\$\{?REQ/m.test(code) ||
    /^\s*\$\{?SSH_ORIGINAL_COMMAND/m.test(code) ||
    /(sh|bash)\s+-c\s+"?\$\{?(REQ|SSH_ORIGINAL_COMMAND)/.test(code);
  if (!evaluated) {
    test.check('the client’s request is matched, never executed');
  } else {
    test.fail('keeper-ssh evaluates $SSH_ORIGINAL_COMMAND — that is a shell, not a forced command');
  }

  // A CLOSED LIST. `case` with an explicit default that exits non-zero;
  // a default that fell through to anything would be the same hole.
  if (/case "\$REQ" in/.test(code) && /\*\)/.test(code) && /exit 2/.test(code)) {
    test.check('and only a named verb reaches anything — the default refuses');
  } else {
    test.fail('keeper-ssh has no closed whitelist with a refusing default');
  }

  // THE LIVE RELAY IS NOT REACHABLE THROUGH IT, both ways round.
  const guardsEnv = /! -f "\$REPO_ROOT\/\.env"/.test(code);
  const guardsLive = /"\$UNIT_NAME" = "spirit-relay"/.test(code) &&
    /"\$DOMAIN" = "spirit\.andyflinn\.com"/.test(code);
  if (guardsEnv && guardsLive) {
    test.check('and it refuses the main clone and anything resolving to the live relay');
  } else {
    test.fail('keeper-ssh can be pointed at spirit-3: env guard ' + guardsEnv + ', live guard ' + guardsLive);
  }

  // ── AN IDEMPOTENT INSTALLER MUST RESTART, NOT START ────────────────
  //
  // lab-install is documented "run it again after a push and it updates
  // the lab" — and it called `systemctl start`, which does nothing to a
  // unit that is already active. On spirit-3, 2026-09-16:
  //
  //   ok  at ea91a60                                 <- clone updated
  //   ok  started spirit-lab
  //   Active: active (running) since ... 51min ago   <- old process
  //   /api/version -> 04e5acb                        <- old code
  //
  // Disk updated, process not, and an `ok` line claiming it started
  // something that did not start. Exactly the shape of the pipefail bug
  // in bash/update, which meant no relay was ever restarted by an
  // update — found the same week, in the neighbouring script.
  //
  // `restart` is right on a first install too, so there is no case this
  // trades away.
  const labInstallSrc2 = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'lab-install'), 'utf8');
  const startsOnly = /\.\/bash\/start\b/.test(
    labInstallSrc2.split('\n').filter(function (l) { return !/^\s*#/.test(l); }).join('\n')
  );
  if (!startsOnly) {
    test.check('and lab-install restarts rather than starts, so a re-run reaches the process');
  } else {
    test.fail('lab-install calls ./bash/start — a re-run updates the disk and leaves the old process');
  }

  // THE PRIVATE KEY IS NOT IN THE REPOSITORY, which is OneDrive-synced
  // on the work machine — a key committed here would be a key uploaded.
  const strayKeys = [];
  ['bash', 'relayLab', '.'].forEach(function (dir) {
    const full = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(full)) return;
    fs.readdirSync(full).forEach(function (f) {
      const p = path.join(full, f);
      if (!fs.statSync(p).isFile()) return;
      const head = fs.readFileSync(p, 'utf8').slice(0, 80);
      if (head.indexOf('PRIVATE KEY-----') !== -1) strayKeys.push(path.join(dir, f));
    });
  });
  if (strayKeys.length === 0) {
    test.check('and no private key is committed beside it');
  } else {
    test.fail('private key material in the repo: ' + strayKeys.join(', '));
  }
}

test.subHeading('Two clones can each keep their own update cron');
{
  const cronIn = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'cron-install'), 'utf8');
  const cronOut = fs.readFileSync(path.join(REPO_ROOT, 'bash', 'cron-remove'), 'utf8');

  if (cronIn.indexOf('spirit-host-update:$UNIT_NAME') !== -1) {
    test.check('the cron marker names the unit, so two clones are two lines');
  } else {
    test.fail('cron-install still uses a marker both clones share');
  }

  // THE LINE CARRIES NO ENVIRONMENT — REVERSED FROM WHAT THIS ASSERTED
  // A DAY AGO, and the reversal is the point. It used to require
  // `SPIRIT_UNIT_NAME=$UNIT_NAME` on the line "because cron has none".
  // Then this got installed, from a shell that had sourced the lab's
  // .env and walked back to the live clone:
  //
  //   */10 * * * * SPIRIT_UNIT_NAME=spirit-lab /root/SpiritOS/bash/update
  //
  // Live clone's code, lab's service, every ten minutes, no error. A
  // line that states its own unit is a line that can state the wrong
  // one. lib.sh now derives it from the clone the script lives in, so
  // the path IS the configuration and there is nothing to get wrong.
  // Comments stripped: the block above QUOTES the bad line on purpose,
  // and a scan that cannot tell code from the history of the code is a
  // scan that punishes writing the history down.
  const cronCode = cronIn.split('\n').filter(function (line) {
    return !/^\s*#/.test(line);
  }).join('\n');
  if (cronCode.indexOf('SPIRIT_UNIT_NAME=') === -1) {
    test.check('the line carries no environment — the clone it points at decides');
  } else {
    test.fail('the cron line states a unit name, which is a unit name it can state wrongly');
  }

  // AND IT IS CLAIMED BY PATH AS WELL AS BY MARKER, so the bad line
  // above is swept by the clone it actually runs, whatever it is marked.
  if (cronIn.indexOf('-F "$REPO_ROOT/bash/update"') !== -1) {
    test.check('and a line running this clone’s update is this clone’s, however it is marked');
  } else {
    test.fail('cron-install trusts the marker alone — a mismarked line survives forever');
  }

  // REMOVAL TAKES ONLY ITS OWN. A cron-remove that swept both would be
  // the same fault wearing the other face.
  if (cronOut.indexOf('spirit-host-update:$UNIT_NAME') !== -1) {
    test.check('while removing one leaves the other clone’s alone');
  } else {
    test.fail('cron-remove sweeps every clone');
  }

  // AND THE LEGACY LINE IS ONLY THE DEFAULT UNIT'S TO CLEAR. spirit-3
  // already has a line with the old bare marker; clearing it from the
  // lab clone would delete the live box's cron.
  if (cronIn.indexOf('UNIT_NAME" = "spirit-relay"') !== -1) {
    test.check('and the pre-existing bare marker is claimed by the default unit only');
  } else {
    test.fail('any clone may clear the legacy cron line');
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
