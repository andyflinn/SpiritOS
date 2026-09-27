'use strict';

// spirit/test/puppetOwner.js
// LOCK PUPPET OUT OF SELF-OWNERSHIP (puppets/G6).
//
//   Andy: "the app must know who owns it, it stores the key of it's owner".
//   His title for it: "Lock puppet out of Self-Ownership". And, of what a
//   puppet is: "a puppet is owned by an owner ID ... that is what ties a
//   puppet to its owner."
//
// Built by claude-windows at edbadff; this is the tester's suite, written
// against the agreed shape: owner.json in the app's own folder, read-only
// to the puppet through the same guard allow.json uses, read on every call,
// and handed to the app as api.owner().
//
// The puppet is mounted by the REAL nodeApps.mountAll from a temporary
// root, as nodeAppsSeam.js does, so the api under test is the one a puppet
// actually gets. The owner key is planted straight on disc, the way the
// owner's node writes it — never through the puppet.
//
// ── THE LIMIT, RULED, NOT TESTED ────────────────────────────────────
//
// A puppet runs inside the node process and could require('fs') and write
// the file without touching its api. Andy, asked whether to add a check
// against that: "within loopback, trust is the responsibility of the
// box-owner." So this suite proves the door a puppet is GIVEN is locked,
// and deliberately does not police code the box owner chose to run.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const nodeApps = require('../run/js/nodeApps');
const auth = require('../run/js/relayAuth');

test.startTest('A puppet can read who owns it and can never change it');

const OWNER = 'owner.json';

function world() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-puppet-owner-'));
  const dir = path.join(root, 'app', 'ownedApp');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ownedApp.json'), JSON.stringify({ name: 'ownedApp', boots: true }));
  fs.writeFileSync(path.join(dir, 'ownedApp.js'),
    'module.exports = { mount: function (api) { global.__ownerApi = api; } };\n');
  const lines = [];
  global.__ownerApi = null;
  nodeApps.mountAll({
    rootDir: root,
    arrivals: { subscribe: function () { return function () {}; } },
    post: function () { return Promise.resolve({ ok: true }); },
    log: function (m) { lines.push(String(m)); },
  });
  return { dir: dir, api: global.__ownerApi, lines: lines,
    plant: function (text) { fs.writeFileSync(path.join(dir, OWNER), text); },
    unplant: function () { try { fs.unlinkSync(path.join(dir, OWNER)); } catch (e) { /* absent */ } },
    bytes: function () { try { return fs.readFileSync(path.join(dir, OWNER), 'utf8'); } catch (e) { return null; } } };
}

function refused(fn) {
  try { fn(); return false; } catch (e) { return /owner-only/.test(e.message); }
}

const w = world();
const KEY = auth.generateIdentity('owner').publicKey;
const KEY2 = auth.generateIdentity('new-owner').publicKey;

if (!w.api || typeof w.api.owner !== 'function') {
  test.fail('the mounted puppet has no api.owner() — nothing below can be checked');
  test.reportSuccessFailureCount();
} else {
  // ── 1. IT CAN READ WHO OWNS IT ─────────────────────────────────────
  w.plant(JSON.stringify({ key: KEY }));
  if (w.api.owner() === KEY) {
    test.check('the puppet reads its owner\'s key through api.owner() — the positive, without which '
      + 'every refusal below would pass on a key that simply is not there');
  } else {
    test.fail('api.owner() gave ' + JSON.stringify(w.api.owner()) + ', wanted the planted key');
  }

  // ── 2. AND CAN NEVER WRITE IT, HOWEVER IT SPELLS THE NAME ──────────
  {
    const before = w.bytes();
    const spellings = ['owner.json', './owner.json', 'x/../owner.json', 'OWNER.JSON'];
    const leaked = spellings.filter(function (s) {
      return !refused(function () { w.api.fs.write(s, JSON.stringify({ key: KEY2 })); });
    });
    if (!leaked.length && w.bytes() === before) {
      test.check('every write to its owner file is refused — ' + spellings.join(', ')
        + ' — and the file is byte-for-byte unchanged');
    } else {
      test.fail('writes that got through: ' + JSON.stringify(leaked) + '; file now ' + JSON.stringify(w.bytes()));
    }
  }

  // THE CONTROL: the same api DOES write an ordinary file in the same
  // folder. Otherwise a write that always threw would pass the check above.
  {
    let wrote = false;
    try { w.api.fs.write('notes.json', '{"ok":true}'); wrote = w.api.fs.read('notes.json') === '{"ok":true}'; }
    catch (e) { wrote = false; }
    if (wrote) {
      test.check('and an ordinary file in the same folder IS writable — the refusal is the lock, not a broken write');
    } else {
      test.fail('the puppet could not write an ordinary file either, so the refusals prove nothing');
    }
  }

  // ── 3. THE DOOR HAS NO OTHER WAY TO CHANGE A FILE ──────────────────
  //
  // scopedFs guards `write`. A rename or a delete added later would be a
  // way round it; this pins the api so such an addition goes red here and
  // has to bring its own guard.
  {
    const keys = Object.keys(w.api.fs).sort().join(',');
    if (keys === 'exists,read,write') {
      test.check('the puppet\'s file api is exactly exists, read and write — no rename or delete to go round the lock');
    } else {
      test.fail('the puppet\'s file api is now ' + keys + '; every new way to change a file needs the owner-only guard');
    }
  }

  // ── 4. NO OWNER FILE, AND IT CANNOT PLANT ONE ──────────────────────
  {
    w.unplant();
    const empty = w.api.owner();
    const planted = !refused(function () { w.api.fs.write('owner.json', JSON.stringify({ key: KEY2 })); });
    if (empty === '' && !planted && w.bytes() === null) {
      test.check('with no owner file the puppet is owned by nobody, and it cannot write one — '
        + 'a puppet cannot make itself the owner on a fresh install');
    } else {
      test.fail('absent owner: api.owner() gave ' + JSON.stringify(empty) + ', self-plant ' + (planted ? 'SUCCEEDED' : 'refused'));
    }
  }

  // ── 5. THE OWNER'S CHANGE IS SEEN AT ONCE ──────────────────────────
  {
    w.plant(JSON.stringify({ key: KEY }));
    const first = w.api.owner();
    w.plant(JSON.stringify({ key: KEY2 }));
    const second = w.api.owner();
    if (first === KEY && second === KEY2) {
      test.check('when the owner changes the key, the very next api.owner() returns the new one — read on '
        + 'every call, never cached, no restart');
    } else {
      test.fail('after an owner edit api.owner() gave ' + JSON.stringify(second) + ' (was ' + JSON.stringify(first) + ')');
    }
  }

  // ── 6. ANYTHING THAT IS NOT A KEY MEANS NOBODY ─────────────────────
  {
    const cases = {
      'an empty file': '',
      'broken JSON': '{"key": ',
      'a key that is not Ed25519': JSON.stringify({ key: 'not-a-real-key' }),
      'no key field': JSON.stringify({ owner: KEY }),
    };
    const wrong = Object.keys(cases).filter(function (label) {
      w.plant(cases[label]);
      return w.api.owner() !== '';
    });
    if (!wrong.length) {
      test.check('an empty file, broken JSON, a non-Ed25519 key and a missing key field each give \'\' — '
        + 'owned by nobody, never by whatever the file happened to say');
    } else {
      test.fail('these gave an owner anyway: ' + wrong.join(', '));
    }
  }

  // ── 7. A BROKEN FILE IS REPORTED ONCE, NOT ON EVERY READ ───────────
  {
    w.plant('{"key": broken one');
    const at = w.lines.length;
    w.api.owner(); w.api.owner(); w.api.owner();
    const sameContent = w.lines.length - at;
    w.plant('{"key": broken two');
    w.api.owner(); w.api.owner();
    const newContent = w.lines.length - at - sameContent;
    if (sameContent === 1 && newContent === 1) {
      test.check('a broken owner file is logged once per distinct content — three reads of one broken file '
        + 'make one line, a different broken file one more');
    } else {
      test.fail('log lines: ' + sameContent + ' for three reads of one broken file, ' + newContent
        + ' for a changed one; wanted 1 and 1');
    }
  }

  test.reportSuccessFailureCount();
}
