'use strict';

// spirit/test/ownerToken.js
// THE OWNER'S FIRST-CLAIM TOKEN: install.js, and a relay that refuses to
// start when its owner is lost (cycle 3, Part B).
//
//   Andy: "Ideally there is an install.js console program that guides the
//   owner-on-ssh through defining first claim name with a sufficiently
//   complex token." — and: "if allow.json is trashed, there is no way of
//   proving ownership other than ssh" — a relay with members but no owner
//   "refuse[s] to start, forcing the owner to ssh and investigate."
//
// The claim rules themselves are firstOwner.js's, in process. This is the
// two processes around them: the installer an owner runs over SSH, and the
// relay's own refusal to start.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const invites = require('../run/js/invites');
const relayStore = require('../run/js/relayStore');

const REPO = path.join(__dirname, '..', '..');
const REPO_RUN = path.join(REPO, 'spirit', 'run');

// A repo-shaped copy: install.js at the root, spirit/run beside it, no
// relay-state — a relay nobody has claimed.
function freshRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-install-'));
  fs.copyFileSync(path.join(REPO, 'install.js'), path.join(root, 'install.js'));
  const run = path.join(root, 'spirit', 'run');
  fs.cpSync(REPO_RUN, run, { recursive: true });
  fs.rmSync(path.join(run, 'relay-state'), { recursive: true, force: true });
  return { root: root, run: run };
}

function install(repo, args) {
  return spawnSync(process.execPath, ['install.js'].concat(args || []),
    { cwd: repo.root, encoding: 'utf8', input: '' });
}

test.startTest('The owner\'s token — install.js, and a relay that will not start ownerless');

test.subHeading('install.js mints one owner invite, and shows it once');

const A = freshRepo();
const first = install(A, ['andy']);
const tokenLine = /token:\s+([0-9a-f]+)/.exec(first.stdout || '');
if (first.status === 0 && /name:\s+andy/.test(first.stdout) && tokenLine) {
  test.check('it prints the name and a token to copy');
} else {
  test.fail('install.js andy: status=' + first.status + ' out=' + first.stdout + ' err=' + first.stderr);
}

const rows = invites.load(A.run);
const row = rows[0];
if (rows.length === 1 && row && invites.isOwnerInvite(row) && tokenLine && row.token === tokenLine[1]) {
  test.check('the relay\'s store holds exactly that token, marked as the owner invite');
} else {
  test.fail('store after install: ' + JSON.stringify(rows));
}
if (tokenLine && tokenLine[1].length >= 32) {
  test.check('a long random token (' + tokenLine[1].length + ' hex characters), not a word');
} else {
  test.fail('token: ' + (tokenLine && tokenLine[1]));
}
relayStore.closeAll();

const again = install(A, ['andy']);
const rowsAgain = invites.load(A.run);
relayStore.closeAll();
if (again.status === 0 && rowsAgain.length === 1 && rowsAgain[0].token !== row.token) {
  test.check('run again, it replaces the token — one live owner invite, never two');
} else {
  test.fail('second install: status=' + again.status + ' rows=' + JSON.stringify(rowsAgain));
}

const badName = install(A, ['not a name']);
if (badName.status === 78 && /not a valid invite name/.test(badName.stderr)) {
  test.check('a name that cannot be spoken is refused, exit 78');
} else {
  test.fail('bad name: status=' + badName.status + ' err=' + badName.stderr);
}

test.subHeading('install.js refuses a relay that already has an owner');

auth.writeAllowKeys(A.run, [{ name: 'andy', publicKey: auth.generateIdentity('andy').publicKey }]);
const claimed = install(A, ['eve']);
if (claimed.status === 78 && /already has an owner \(andy\)/.test(claimed.stderr)) {
  test.check('a claimed relay gets no second owner invite — owners change over SSH, in allow.json');
} else {
  test.fail('install on a claimed relay: status=' + claimed.status + ' err=' + claimed.stderr);
}

test.subHeading('A relay with members and no owner refuses to start');

// Members on the roll, allow.json gone: a lost owner, not a new relay.
const B = freshRepo();
const store = relayStore.open(B.run);
store.members.put({ publicKey: 'K1', publicLabel: 'andy', claimedAt: '2026-09-19', owner: true });
store.members.put({ publicKey: 'K2', publicLabel: 'bert', claimedAt: '2026-09-19' });
relayStore.closeAll();

const refused = spawnSync(process.execPath, ['js/relayServer.js', '--port', '0'],
  { cwd: B.run, encoding: 'utf8', timeout: 20000 });
const said = (refused.stderr || '') + (refused.stdout || '');
if (refused.status === 78 && /2 member\(s\) but relay-state\/allow\.json names no owner/.test(said)) {
  test.check('it exits 78 and says why: ' + said.trim().split('\n')[0].slice(0, 120));
} else {
  test.fail('relay start with members and no owner: status=' + refused.status + ' out=' + said.slice(0, 400));
}

const installB = install(B, ['thief']);
relayStore.closeAll();
if (installB.status === 78 && /lost allow\.json/.test(installB.stderr) &&
    invites.load(B.run).length === 0) {
  test.check('and install.js will not mint an owner invite for it either');
} else {
  test.fail('install on members-no-owner: status=' + installB.status + ' err=' + installB.stderr);
}
relayStore.closeAll();

[A.root, B.root].forEach(function (d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* windows */ }
});

test.reportSuccessFailureCount();
