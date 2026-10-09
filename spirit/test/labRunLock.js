'use strict';

// goal/G8.9: test runs that cannot collide. Red on today's tree; wsl-claude wrote it from G8.9's box and does not
// build it.
//   Andy, 2026-10-09, of two full runs sharing one machine's localhost: "This one is REAL. would it mean that:
//   labMaster needs an upgrade, where multiple desk nodes must be able to have their very own range of ports and
//   test-world-instances?", and then "so this goal needs an item that cleans up those specific suites that cause
//   problems, before the rest of this goal becomes clearer?"
//
// WHAT IS TRUE TODAY (measured at c1fb4c77): most suites take a port from the OS (net.createServer().listen(0)).
// Twenty-two files hold a literal port instead: the lab range 65400-65429 (labWorld 65425-65428, labLifecycle 65410,
// labPersistence 65419, labServableStatic 65421, appServerWorlds 65422-65424 and their neighbours), hintWire's
// 48761-48762, and the relay default 65430. Two runs on one host collide on exactly those, and WSL forwards its ports
// onto Windows localhost, so one host means one machine whichever side a run is started from.
//
// THE SHAPE ASSERTED, from the box, with the names named by wsl-claude so the builder has something to hold:
//   1  A PER-RUN BASE. labPaths gains a port base, read from the environment as LAB_MASTER_PORT already is
//      (labPaths.js: "LAB_MASTER_PORT (default 65420) lets a clone run its own labMaster"), so a second run shifts
//      the whole lab range instead of fighting over it. No suite holds a literal lab port any more: each asks
//      labPaths for it.
//   2  THE OS WHERE NOTHING NEEDS A FIXED PORT. hintWire's pair is the only non-lab case left.
//   3  ONE RUN AT A TIME PER HOST. labMaster answers a claim for the run lock, holds it for one caller, refuses a
//      second while it stands, and frees it when the holder says so.
// The names (LAB_PORT_BASE, labPaths.portBase, /api/run/lock) are the red writer's, not Andy's; the builder may
// argue them, and the assertions below hold the behaviour, not the spelling, wherever that was possible.
// NOT ASSERTED: that two whole runs are started at once and neither fails. That is the goal of the item, not a unit
// a suite can hold in a few seconds; the lock and the base are what make it true, and they are asserted here.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G8.9: ';
const TEST_DIR = __dirname;
const LAB_PATHS = path.join(TEST_DIR, 'labMaster', 'labPaths.js');
const MASTER = path.join(TEST_DIR, 'labMaster', 'labMaster.js');
// The lab's own range, as labPaths and labWorld describe it, plus hintWire's pair.
const LAB_RANGE = /\b654(?:0\d|1\d|2\d)\b/;
const HINT_PORTS = /\b4876[0-9]\b/;
// Files that may name the range because they define or document it, not because they bind it.
const ALLOWED = ['labPaths.js', 'labRunLock.js'];

function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }
// Code only: a comment naming a port is not a port bound.
function code(s) { return String(s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1'); }

test.startTest('goal/G8.9: test runs that cannot collide - a per-run port base and one run per host');

const suites = fs.readdirSync(TEST_DIR).filter(function (f) { return /\.js$/.test(f) && ALLOWED.indexOf(f) === -1; });

// THE WORLD, so six reds cannot come from a broken suite: the files are there, and the OS-port habit this item
// extends is already the majority habit.
test.subHeading('0. the world');
if (suites.length > 300 && read(LAB_PATHS) && read(MASTER)) test.check('the world: ' + suites.length + ' suites read, labPaths.js and labMaster.js in place');
else { test.fail('the world: ' + short({ suites: suites.length, labPaths: !!read(LAB_PATHS), master: !!read(MASTER) })); }
const osPort = suites.filter(function (f) { return /listen\(0/.test(code(read(path.join(TEST_DIR, f)))); });
if (osPort.length > 20) test.check('the world: ' + osPort.length + ' suites already take a port from the OS');
else test.fail('the world: only ' + osPort.length + ' suites take an OS port, so the premise of this item is wrong');

test.subHeading('1. no suite holds a literal lab port: the base comes from labPaths');
const holders = suites.filter(function (f) { return LAB_RANGE.test(code(read(path.join(TEST_DIR, f)))); });
if (!holders.length) test.check('no suite in spirit/test holds a port of the lab range in its code');
else test.fail(OWED + holders.length + ' suites still hold one: ' + short(holders.slice(0, 8)));

const labPaths = read(LAB_PATHS);
if (labPaths && /portBase/.test(labPaths) && /LAB_PORT_BASE/.test(labPaths)) {
  test.check('labPaths offers a port base, read from LAB_PORT_BASE as LAB_MASTER_PORT is read');
} else test.fail(OWED + 'labPaths.js has no port base read from the environment');

// The base must actually move the ports: with LAB_PORT_BASE set, what labPaths answers is not the default range.
if (labPaths && /portBase/.test(labPaths)) {
  const sub = {};
  try {
    delete require.cache[require.resolve(LAB_PATHS)];
    process.env.LAB_PORT_BASE = '45400';
    sub.shifted = require(LAB_PATHS).portBase;
    delete process.env.LAB_PORT_BASE;
    delete require.cache[require.resolve(LAB_PATHS)];
    sub.plain = require(LAB_PATHS).portBase;
  } catch (e) { sub.threw = (e && e.message) || String(e); }
  const shifted = typeof sub.shifted === 'function' ? sub.shifted() : sub.shifted;
  const plain = typeof sub.plain === 'function' ? sub.plain() : sub.plain;
  if (Number(shifted) === 45400 && Number(plain) === 65400) test.check('LAB_PORT_BASE moves the whole range: 45400 set, 65400 by default');
  else test.fail(OWED + 'the base reads ' + short({ withEnv: shifted, without: plain, threw: sub.threw }));
} else test.fail(OWED + 'no port base to move the range with');

test.subHeading('2. the one non-lab case takes its port from the OS');
const hint = code(read(path.join(TEST_DIR, 'hintWire.js')));
if (hint === null) test.fail('the world: spirit/test/hintWire.js is gone');
else if (!HINT_PORTS.test(hint) && /listen\(0/.test(hint)) test.check('hintWire asks the OS for its ports, holding no 4876x literal');
else test.fail(OWED + 'hintWire still holds ' + short((hint.match(HINT_PORTS) || []).slice(0, 4)));

test.subHeading('3. labMaster holds one run at a time per host');
const master = code(read(MASTER));
if (master === null) { test.fail('the world: labMaster.js is gone'); }
else if (/\/api\/run\/lock/.test(master)) test.check('labMaster answers /api/run/lock');
else test.fail(OWED + 'labMaster answers no run lock: nothing in it names /api/run/lock');
// Claimed, a second claim is refused and the holder can free it. Asserted against the running master the harness
// spawns for every suite (labPaths.MASTER), so it is the real server and not a fake.
const labPathsMod = (function () { try { return require(LAB_PATHS); } catch (e) { return null; } })();
const url = labPathsMod ? labPathsMod.MASTER : '';
(async function () {
  if (!/\/api\/run\/lock/.test(master || '') || !url) { test.fail(OWED + 'no lock to claim, so its behaviour is owed with it'); return; }
  const post = function (body) {
    return fetch(url + '/api/run/lock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }, function () { return { status: r.status, body: {} }; }); },
        function (e) { return { status: 0, body: { error: (e && e.message) || String(e) } }; });
  };
  const mine = await post({ claim: 'wsl-claude' });
  if (mine.status === 200 && mine.body && mine.body.held === true) test.check('a claim is granted');
  else { test.fail(OWED + 'the claim answered ' + short(mine)); return; }
  const theirs = await post({ claim: 'claude-windows' });
  if (theirs.body && theirs.body.held === false) test.check('a second claim while it stands is refused');
  else test.fail(OWED + 'the second claim answered ' + short(theirs));
  const freed = await post({ free: 'wsl-claude' });
  const again = await post({ claim: 'claude-windows' });
  if (freed.status === 200 && again.body && again.body.held === true) test.check('the holder frees it and the next claim is granted');
  else test.fail(OWED + 'free answered ' + short(freed) + ', the next claim ' + short(again));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
});
