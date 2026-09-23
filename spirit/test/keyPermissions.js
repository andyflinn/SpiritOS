'use strict';

// spirit/test/keyPermissions.js
// THE PRIVATE HALF IS NOT A WORLD-READABLE FILE.
//
// `relay-state/identity.json` holds the signing key and, since cycle 10,
// the cipher key. It was written at whatever the umask gave — 644 on a
// typical box — so every account on the machine could read both.
//
// ── WHY THIS SUITE IS PLATFORM-AWARE, AND SAYS SO ────────────────────
//
// Measured 2026-09-24: `fs.chmodSync(file, 0o600)` on Windows leaves mode
// 666. It is silently inert on NTFS. So a suite that simply asserts 600
// would be RED on Windows for ever, or GREEN by being skipped and
// therefore proving nothing anywhere.
//
// Both are wrong. What is asserted instead:
//
//   on a POSIX filesystem   the mode really is 600 / 700
//   on Windows              the call is made and does not throw, and the
//                           suite says out loud that it protects nothing
//
// The second is not a pass dressed up. It is the honest statement that
// this defence belongs to the RELAY, which runs on Ubuntu, and that on a
// node — whose prime platform is Windows — it is a no-op that costs
// nothing. The Windows answer is an ACL and is deliberately not
// attempted; it is a different mechanism and would need its own
// evidence.
//
// ── WHAT IT BUYS, SO NOBODY READS MORE INTO IT ───────────────────────
//
// The realistic reader is a SERVICE ACCOUNT on the same box — www-data, a
// container user, a backup agent — not a second person at a keyboard.
// Root reads everything regardless, and on a single-tenant VPS root is
// the operator. This closes the accidental path and none of the
// deliberate ones.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');

test.startTest('An identity file is written for its owner alone');

const WINDOWS = process.platform === 'win32';
const homes = [];

function home() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-perm-'));
  homes.push(d);
  return d;
}

// Does this filesystem express modes at all? Asked rather than assumed —
// WSL's drvfs sits on NTFS and behaves like Windows while reporting
// itself as Linux, and a suite that trusted `process.platform` there
// would assert something the filesystem cannot do.
function modesWork() {
  const d = home();
  const f = path.join(d, 'probe');
  fs.writeFileSync(f, 'x');
  try { fs.chmodSync(f, 0o600); } catch (e) { return false; }
  return (fs.statSync(f).mode & 0o777) === 0o600;
}

const EXPRESSES_MODES = modesWork();

test.subHeading('The file and its directory are written tight at creation');

{
  const dir = home();
  auth.saveIdentity(dir, auth.generateIdentity('guarded'));

  const file = path.join(dir, 'relay-state', 'identity.json');
  const fileMode = fs.statSync(file).mode & 0o777;
  const dirMode = fs.statSync(path.join(dir, 'relay-state')).mode & 0o777;

  if (EXPRESSES_MODES) {
    if (fileMode === 0o600) {
      test.check('identity.json is 600 — the signing key and the cipher key are the owner\'s alone');
    } else {
      test.fail('identity.json is ' + fileMode.toString(8) + ', not 600');
    }
    if (dirMode === 0o700) {
      test.check('and relay-state/ is 700, so the file cannot be reached by listing the directory');
    } else {
      test.fail('relay-state/ is ' + dirMode.toString(8) + ', not 700');
    }
  } else {
    // NOT A SKIP. The assertion is that the identity was written and the
    // protection attempt did not break it — and the message says plainly
    // that nothing is protected here.
    if (fs.existsSync(file) && auth.loadIdentity(dir)) {
      test.check('this filesystem does not express modes (' + process.platform + ', mode ' +
        fileMode.toString(8) + ') — the identity is written and readable, and THIS DEFENCE ' +
        'PROTECTS NOTHING HERE. It is the relay\'s, and a relay runs on Ubuntu.');
    } else {
      test.fail('the identity was not written or could not be read back');
    }
  }
}

test.subHeading('And the protection never costs a node its identity');

{
  // A filesystem that refuses the mode must not stop a node writing its
  // own key. The failure is swallowed on purpose, and this is the
  // assertion that says so rather than leaving it to the comment.
  const dir = home();
  const id = auth.generateIdentity('resilient');
  auth.saveIdentity(dir, id);
  const back = auth.loadIdentity(dir);

  if (back && back.publicKey === id.publicKey && back.sealPublicKey === id.sealPublicKey) {
    test.check('the identity round-trips whatever the filesystem did with the mode — ' +
      'both keypairs intact');
  } else {
    test.fail('the identity did not survive being protected: ' + JSON.stringify(back && back.name));
  }
}

test.subHeading('THE RESIDUAL, asserted so it is not mistaken for a guarantee');

{
  // There is no start-up check and nothing refuses to run over a widened
  // mode. That is deliberate — Windows, drvfs and a deliberately widened
  // permission are where such a check produces false alarms, and a relay
  // that will not start because of a mode bit is worse than one running
  // with a known residual.
  const dir = home();
  auth.saveIdentity(dir, auth.generateIdentity('widened'));
  const file = path.join(dir, 'relay-state', 'identity.json');

  let widened = false;
  try { fs.chmodSync(file, 0o644); widened = true; } catch (e) { widened = false; }

  const stillLoads = !!auth.loadIdentity(dir);

  if (!EXPRESSES_MODES || (widened && stillLoads)) {
    test.check('a widened mode is NOT refused at start — this closes the accidental path ' +
      'and none of the deliberate ones, and root reads everything regardless');
  } else {
    test.fail('something now refuses a widened identity file, which was not the decision');
  }
}

homes.forEach(function (h) {
  try { fs.rmSync(h, { recursive: true, force: true }); } catch (e) { /* sweeper */ }
});

test.reportSuccessFailureCount();
