'use strict';

// spirit/test/ownerToken.js
// A RELAY THAT REFUSES TO START WHEN ITS OWNER IS LOST (cycle 3, Part B).
//
//   Andy: "if allow.json is trashed, there is no way of proving ownership
//   other than ssh" — a relay with members but no owner "refuse[s] to
//   start, forcing the owner to ssh and investigate."
//
// THE OWNER'S FIRST-CLAIM TOKEN STOOD HERE: install.js, which minted an
// owner invite over SSH, asserted to print it once, replace it on a second
// run, and refuse an owned or broken relay. goal/G16.8 deleted install.js
// and the owner invite with it. Andy: "the invite path to ownership MUST be
// gone. it is a security gap, from the time of install until the time of
// first claim." The owner is now written by bash/install-units from an
// OWNER_KEY (ownerAtInstall.js asserts that); what is left here is the
// relay's own refusal to start, which did not change.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('./testSupport.js');
const relayStore = require('../run/js/relayStore');

const REPO = path.join(__dirname, '..', '..');
const REPO_RUN = path.join(REPO, 'spirit', 'run');

// A repo-shaped copy: spirit/run with no relay-state — a relay nobody has
// installed.
function freshRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-install-'));
  const run = path.join(root, 'spirit', 'run');
  fs.cpSync(REPO_RUN, run, { recursive: true });
  fs.rmSync(path.join(run, 'relay-state'), { recursive: true, force: true });
  return { root: root, run: run };
}

test.startTest('A relay that will not start ownerless');

test.subHeading('A relay with members and no owner refuses to start');

// Members on the roll, owner.json gone: a lost owner, not a new relay.
const B = freshRepo();
const store = relayStore.open(B.run);
store.members.put({ publicKey: 'K1', publicLabel: 'andy', claimedAt: '2026-09-19', owner: true });
store.members.put({ publicKey: 'K2', publicLabel: 'bert', claimedAt: '2026-09-19' });
relayStore.closeAll();

const refused = spawnSync(process.execPath, ['js/relayServer.js', '--port', '0'],
  { cwd: B.run, encoding: 'utf8', timeout: 20000 });
const said = (refused.stderr || '') + (refused.stdout || '');
if (refused.status === 78 && /2 member\(s\) but relay-state\/owner\.json names no owner/.test(said)) {
  test.check('it exits 78 and says why: ' + said.trim().split('\n')[0].slice(0, 120));
} else {
  test.fail('relay start with members and no owner: status=' + refused.status + ' out=' + said.slice(0, 400));
}
relayStore.closeAll();

[B.root].forEach(function (d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* windows */ }
});

test.reportSuccessFailureCount();
