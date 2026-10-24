'use strict';

// spirit/test/relayRamRaise.js
// goal/G40.4: raising a running relay's RAM limit is checked against the difference, and the relay moves its own
// service cap to twice its limit. Written first, red on today's code, by wsl-claude, who does not build it. The box
// (v8), Andy's words among it: "the relay calculates if there's room for a 512MB relay, when it is supposed to
// calculate if there's room for a relay that is 256MB larger than is occupied with it running a 256MB relay right
// now. It needs to asses the difference^...."; "the relay raises its own service cap to exactly twice the amount of
// RAM it uses for itself."; "FUCK, the twice is safe. decision. period."; "we stick with our own memory calculation,
// and document what we know about the system overhead incurred, including the caddy's and we recommend the 256MB
// figure for a 1GB RAM VPS."
//
// NAMED HERE where the box names none (the builder may argue them under the item first):
//   - relayLimits.measure reports hostAvailableMB beside availableMB: what the box itself has free (MemAvailable on
//     Linux, os.freemem elsewhere), never cut by the relay's own service cap. availableMB stays the smaller figure.
//   - createRelay takes deps.setServiceCap(mb), the call that moves the relay's own service cap (systemctl
//     set-property on a relay host); the relay calls it with twice the limit on every limit change it takes.
//
// WHAT IS ASSERTED
//   1. measure: on Linux with a service cap tighter than the box, hostAvailableMB is the box's MemAvailable and
//      availableMB the cap's room; elsewhere both are os.freemem.
//   2. The owner's config verb, on a relay running at 256 MB whose own cap leaves little room: a raise to 512 passes
//      when the difference (256) fits in what the box has free less the margin; a raise whose difference does not fit
//      is refused, naming the difference; a lowering passes.
//   3. Every limit change the relay takes moves its cap to exactly twice the new limit, a lowering too.
//   4. install-units writes the cap at twice the limit (no more limit + 128).
//   5. The relay host documentation lists the overhead beside the relay (the system, Caddy, the kernel's socket
//      buffers) and recommends 256 MB for a 1 GB VPS.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const { sealFor, openReply } = require('./openReply');
const auth = require('../run/spirit/relayAuth');
const { createRelay } = require('../run/spirit/relay');
const relayLimits = require('../run/spirit/relayLimits');
const { claimOwner, ownHome } = require('./ownerClaim');

const OWED = 'OWED by goal/G40.4: ';
const REPO = path.join(__dirname, '..', '..');
const MARGIN = relayLimits.RAM_MARGIN_MB;
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
function read(rel) { try { return fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (e) { return ''; } }

// A 1 GB box running a 256 MB relay under a cap of twice that: the cap leaves 300 MB, the box has 600 MB free.
const BOX = { totalMB: 1024, availableMB: 300, hostAvailableMB: 600, discTotalMB: 20480, discFreeMB: 10240 };

function sinkFor(bag) {
  return {
    write: function (chunk) {
      const ev = /event: ([^\n]+)/.exec(chunk);
      const da = /data: ([^\n]+)/.exec(chunk);
      if (!ev || !da) return;
      try { bag.push({ event: ev[1], data: JSON.parse(da[1]) }); } catch (e) { /* not this one */ }
    },
    close: function () {},
  };
}
function relayWith(config) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-ramraise-'));
  const owner = auth.generateIdentity('owner');
  ownHome(home, owner);
  auth.saveIdentity(home, auth.generateIdentity('relay'));
  const caps = [];
  const box = createRelay(home, {
    config: config,
    measure: function () { return BOX; },
    writeConfig: function () { return true; },
    restart: function () { return { will: true }; },
    setServiceCap: function (mb) { caps.push(mb); return true; },
  });
  claimOwner(box, owner, 'owner', 'rr-owner');
  const heard = [];
  box.streamOpen(owner.publicKey, auth.sign(owner.privateKey, auth.streamMessage(owner.publicKey, box.relayPublicKey())), sinkFor(heard));
  return { home: home, box: box, owner: owner, heard: heard, caps: caps };
}
// The verb as the owner's node sends it: a signed post sealed to the relay, answered on his stream (relayReconfigure).
function ask(R, body) {
  const relayKey = R.box.relayPublicKey();
  const packet = JSON.stringify({ app: 'relay', v: 1, body: body });
  const sending = sealFor(R.owner, R.box, packet);
  const out = R.box.routePost(R.owner.publicKey, relayKey, sending, auth.sign(R.owner.privateKey, auth.postMessage(R.owner.publicKey, relayKey, sending)));
  if (!out || !out.hash) return out;
  const reply = R.heard.filter(function (m) { return m.event === 'reply' && m.data && m.data.hash === out.hash; }).pop();
  if (!reply) return out;
  try { const back = openReply(R.owner, relayKey, reply.data.text); return back && back.body ? back.body : back; } catch (e) { return reply.data; }
}

test.startTest('goal/G40.4: a RAM raise checked by the difference, the relay\'s cap at twice its limit');

// ── 1. THE MEASURE ─────────────────────────────────────────────────────
test.subHeading('1. measure reports what the box has free, apart from the relay\'s own cap');
{
  const files = {
    '/proc/meminfo': 'MemTotal: 1048576 kB\nMemFree: 102400 kB\nMemAvailable: 614400 kB\n',
    '/proc/self/cgroup': '0::/system.slice/spirit-relay.service\n',
    '/sys/fs/cgroup/system.slice/spirit-relay.service/memory.max': String(512 * 1048576) + '\n',
    '/sys/fs/cgroup/system.slice/spirit-relay.service/memory.current': String(212 * 1048576) + '\n',
  };
  const linux = relayLimits.measure('/', {
    platform: 'linux', totalmem: function () { return 1024 * 1048576; }, freemem: function () { return 100 * 1048576; },
    readFileSync: function (p) { if (p in files) return files[p]; const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
    statfsSync: function () { return { bsize: 4096, blocks: 5242880, bfree: 2621440, bavail: 2621440 }; },
  });
  if (Math.round(linux.hostAvailableMB) === 600 && Math.round(linux.availableMB) === 300)
    test.check('on Linux under a tight service cap: hostAvailableMB 600 (the box), availableMB 300 (the cap\'s room)');
  else test.fail(OWED + 'measure on Linux gave hostAvailableMB ' + short(linux.hostAvailableMB) + ', availableMB ' + short(linux.availableMB));
  const win = relayLimits.measure('C:\\', {
    platform: 'win32', totalmem: function () { return 1024 * 1048576; }, freemem: function () { return 700 * 1048576; },
    readFileSync: function () { const e = new Error('ENOENT'); e.code = 'ENOENT'; throw e; },
    statfsSync: function () { return { bsize: 4096, blocks: 5242880, bfree: 2621440, bavail: 2621440 }; },
  });
  if (Math.round(win.hostAvailableMB) === 700 && Math.round(win.availableMB) === 700) test.check('elsewhere both are os.freemem (700)');
  else test.fail(OWED + 'measure on Windows gave hostAvailableMB ' + short(win.hostAvailableMB) + ', availableMB ' + short(win.availableMB));
}

// ── 2. THE RAISE CHECKED BY THE DIFFERENCE ─────────────────────────────
test.subHeading('2. the owner\'s raise is checked by the difference against what the box has free');
{
  const R = relayWith({ ramLimitMB: 256, discLimitMB: 32, source: 'file' });
  const up = ask(R, { config: { ramLimitMB: 512 } });
  if (up && up.ok) test.check('256 to 512 passes: the difference, 256, fits in the box\'s 600 less the ' + MARGIN + ' MB margin, though the cap leaves only 300');
  else test.fail(OWED + 'the raise 256 to 512 answered ' + short(up));
  const R2 = relayWith({ ramLimitMB: 256, discLimitMB: 32, source: 'file' });
  const tooFar = ask(R2, { config: { ramLimitMB: 900 } });
  if (tooFar && tooFar.ok === false && /644/.test(String(tooFar.error || ''))) test.check('256 to 900 is refused, naming the difference (644): ' + short(tooFar.error));
  else test.fail(OWED + 'the raise 256 to 900 (a difference of 644 against ' + (600 - MARGIN) + ' free) answered ' + short(tooFar));
  const R3 = relayWith({ ramLimitMB: 256, discLimitMB: 32, source: 'file' });
  const down = ask(R3, { config: { ramLimitMB: 128 } });
  if (down && down.ok) test.check('a lowering passes');
  else test.fail(OWED + 'the lowering 256 to 128 answered ' + short(down));

  // ── 3. THE CAP FOLLOWS ─────────────────────────────────────────────────
  test.subHeading('3. every limit change moves the relay\'s own cap to exactly twice the new limit');
  if (R.caps.length && R.caps[R.caps.length - 1] === 1024) test.check('the raise to 512 moved the cap to 1024');
  else test.fail(OWED + 'after the raise to 512 the cap was set to ' + short(R.caps));
  if (R3.caps.length && R3.caps[R3.caps.length - 1] === 256) test.check('the lowering to 128 moved the cap to 256');
  else test.fail(OWED + 'after the lowering to 128 the cap was set to ' + short(R3.caps));
  if (!R2.caps.length) test.check('a refused raise moves nothing');
  else test.fail(OWED + 'a refused raise set the cap to ' + short(R2.caps));
}

// ── 4. INSTALL ─────────────────────────────────────────────────────────
test.subHeading('4. install-units writes the cap at twice the limit');
{
  const iu = read('bash/install-units');
  const line = (/^MEMORY_MAX=.*$/m.exec(iu) || [''])[0];
  if (/\$\(\(\s*RAM_MB\s*\*\s*2\s*\)\)M/.test(line)) test.check('install-units: ' + line);
  else test.fail(OWED + 'install-units writes ' + short(line));
}

// ── 5. THE DOCUMENTATION ───────────────────────────────────────────────
test.subHeading('5. the relay host documentation lists the overhead and recommends 256 MB for 1 GB');
{
  const doc = read('bash/RELAY-HOST.md');
  const parts = { Caddy: /Caddy[\s\S]{0,400}(memory|MB)/i, 'socket buffers': /socket buffer/i, 'the system': /(system|OS)[^\n]{0,80}(memory|MB)/i, '256 MB for 1 GB': /256\s*MB[^\n]{0,120}1\s*GB|1\s*GB[^\n]{0,120}256\s*MB/i, 'twice the limit': /twice/i };
  const missing = Object.keys(parts).filter(function (k) { return !parts[k].test(doc); });
  if (!missing.length) test.check('RELAY-HOST.md names Caddy, the socket buffers, the system, the cap at twice, and 256 MB for 1 GB');
  else test.fail(OWED + 'RELAY-HOST.md does not say: ' + missing.join(', '));
}

test.reportSuccessFailureCount();
process.exit(0);
