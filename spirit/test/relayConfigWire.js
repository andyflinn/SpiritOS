'use strict';

// spirit/test/relayConfigWire.js
// CYCLE 9 ON A REAL PROCESS — the half the in-process suites cannot own.
//
//   Andy, 2026-09-22: "and we test this in the harness?"
//
// `relayReconfigure.js` proves the DECISIONS with the hands injected:
// owner, ceiling, stranding, what the answer says. What it cannot prove
// is the wiring in relayServer.js — that a relay started as a process
// measures its box, writes its own config.json, clamps a figure that no
// longer fits instead of refusing to start, and that an owner's packet
// arriving over HTTP actually changes the file on disc.
//
// Both were verified by hand, twice, on two operating systems. This is
// the part that will still be true next month.
//
// NOT COVERED, and cannot be: systemd bringing the process back after an
// asked-for restart. That is the unit's job (Restart=always). What is
// asserted here is the refusal a relay gives when nothing would bring it
// back — the answer an owner must be able to trust.

const os = require('os');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const hub = require('../run/js/hub');
const plantRun = require('./plantRun');
const sseClient = require('../run/js/sseClient');
const { createRelay } = require('../run/js/relay');
const { claimOwner } = require('./ownerClaim');

const PORTS = [48741, 48742, 48743, 48744, 48745];
const kids = [];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

// A relay home with an owner already on it, and a run tree to start it
// from — the shape presenceWire and partnerWire use, because a server
// must never be started on the working directory.
function buildHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-cfgwire-'));
  const box = createRelay(home);
  const owner = auth.generateIdentity('andy');
  auth.saveIdentity(home, owner);
  claimOwner(box, owner, 'andy');

  const runDir = path.join(home, 'spirit', 'run');
  plantRun.plantRunTree(runDir);
  fs.rmSync(path.join(runDir, 'relay-state'), { recursive: true, force: true });
  fs.cpSync(path.join(home, 'relay-state'), path.join(runDir, 'relay-state'), { recursive: true });
  return { home: home, runDir: runDir, owner: owner, box: box };
}

function configPath(w) { return path.join(w.runDir, 'relay-state', 'config.json'); }

function readConfig(w) {
  try { return JSON.parse(fs.readFileSync(configPath(w), 'utf8')); }
  catch (e) { return null; }
}

// Started with its output kept, so a refusal to start is reported as a
// refusal rather than as a port that would not answer — the lesson
// presenceWire.js learned in this same cycle.
async function startRelay(w, port, args) {
  const said = [];
  const kid = spawn(process.execPath, ['js/server.js', '--port', String(port), '--relay'].concat(args || []),
    { cwd: w.runDir, stdio: ['ignore', 'pipe', 'pipe'] });
  kids.push(kid);
  kid.stdout.on('data', function (b) { said.push(String(b)); });
  kid.stderr.on('data', function (b) { said.push(String(b)); });
  const base = 'http://127.0.0.1:' + port;
  for (let n = 0; n < 60; n += 1) {
    await sleep(200);
    try {
      const r = await hub.relayRequest(base, 'GET', '/api/relay/key', null);
      if (r.status === 200) { w.base = base; w.kid = kid; w.said = said; return base; }
    } catch (e) { /* not up yet */ }
  }
  w.said = said;
  return null;
}

function stopRelay(w) {
  try { w.kid.kill(); } catch (e) { /* already gone */ }
}

// The owner asking its own relay, exactly as a node does: a signed post
// addressed to the relay's own key, answered on the stream the owner
// holds. Held FIRST, because a reply leaves down a stream the asker
// already has.
function askOwner(w, bodyObj) {
  const relayKey = w.box.relayPublicKey();
  const text = JSON.stringify({ app: 'relay', v: 1, body: bodyObj });
  const sig = auth.sign(w.owner.privateKey, auth.postMessage(w.owner.publicKey, relayKey, text));
  return new Promise(function (resolve, reject) {
    let answered = false;
    const stop = sseClient.connect({
      url: w.base + '/api/relay/stream?key=' + encodeURIComponent(w.owner.publicKey),
      headers: function () {
        return { 'X-Spirit-Sig': auth.sign(w.owner.privateKey, auth.streamMessage(w.owner.publicKey)) };
      },
      onEvent: function (msg) {
        if (answered || msg.event !== 'reply' || !msg.data) return;
        let back = null;
        try { back = JSON.parse(msg.data.text); } catch (e) { return; }
        answered = true;
        try { stop.close(); } catch (e) { /* already closed */ }
        resolve(back && back.body ? back.body : back);
      },
    });
    setTimeout(function () {
      hub.relayRequest(w.base, 'POST', '/api/relay/post',
        { from: w.owner.publicKey, to: relayKey, text: text, sig: sig }).catch(reject);
    }, 300);
    setTimeout(function () {
      if (answered) return;
      try { stop.close(); } catch (e) { /* already closed */ }
      reject(new Error('the relay did not answer within 15s'));
    }, 15000);
  });
}

test.startTest('Cycle 9 on the wire — a real relay writes, clamps and is reconfigured');

async function run() {
  // ── FIRST START WRITES WHAT IT MEASURED ──────────────────────────
  const w = buildHome();
  if (readConfig(w) !== null) {
    test.fail('the planted home already had a config.json — this suite proves nothing');
    return;
  }
  const up = await startRelay(w, PORTS[0]);
  if (!up) {
    test.fail('the relay did not start: ' + (w.said || []).join('').slice(0, 300));
    return;
  }

  test.subHeading('A relay started with no configuration writes the one it measured');
  const written = readConfig(w);
  if (written && typeof written.ramLimitMB === 'number' && typeof written.discLimitMB === 'number') {
    test.check('relay-state/config.json now names both figures: ' +
      written.ramLimitMB + ' MB RAM, ' + written.discLimitMB + ' MB disc');
  } else {
    test.fail('no config.json was written: ' + JSON.stringify(written));
  }
  if (written && written.ramLimitMB <= 256 && written.discLimitMB <= 256) {
    test.check('and neither is more than 256 MB — Andy: "We never default to more than 256 MB"');
  } else {
    test.fail('a default took more than the cap: ' + JSON.stringify(written));
  }
  const boot = (w.said || []).join('');
  if (/RAM limit \d+ MB/.test(boot) && /disc limit \d+ MB/.test(boot)) {
    test.check('and it says both bounds at boot, where an operator over SSH will see them');
  } else {
    test.fail('the boot lines did not carry both bounds: ' + boot.slice(0, 300));
  }

  // ── THE OWNER READS IT OVER THE WIRE ─────────────────────────────
  test.subHeading('The owner reads the figures from off the box entirely');
  const readBack = await askOwner(w, { config: {} });
  if (readBack && readBack.ok && readBack.onFile.ramLimitMB === written.ramLimitMB &&
      readBack.roll.members === 1 && readBack.room.ramMaxMB > 0) {
    test.check('a signed packet answers with the file, the roll and what the box could give');
  } else {
    test.fail('the read over the wire gave: ' + JSON.stringify(readBack).slice(0, 300));
  }

  // ── AND SETS THEM, WHICH CHANGES THE FILE ON DISC ────────────────
  test.subHeading('A set over the wire changes the file, and says it applies at next start');
  const set = await askOwner(w, { config: { ramLimitMB: 32, discLimitMB: 16 } });
  const after = readConfig(w);
  if (set && set.ok && set.applies === 'next start' && after.ramLimitMB === 32 && after.discLimitMB === 16) {
    test.check('the owner\'s packet rewrote relay-state/config.json without anybody touching the box');
  } else {
    test.fail('the set did not land: ' + JSON.stringify(set).slice(0, 200) + ' file=' + JSON.stringify(after));
  }
  if (set.now.allowance === written.ramLimitMB * 16 && set.after.allowance === 32 * 16) {
    test.check('and the answer says what the allowance was and will be');
  } else {
    test.fail('the allowances were wrong: ' + JSON.stringify([set.now, set.after]));
  }

  test.subHeading('A restart it cannot promise is refused, not attempted');
  const asked = await askOwner(w, { config: { ramLimitMB: 33, restart: true } });
  if (asked && asked.ok && asked.restarting === false && /systemd/.test(asked.restartRefused || '')) {
    test.check('a relay nobody would bring back writes the figures and says so — it does not stop');
  } else {
    test.fail('a hand-started relay answered: ' + JSON.stringify(asked).slice(0, 250));
  }
  // …and it is still serving, which is the whole point of that refusal.
  const alive = await hub.relayRequest(w.base, 'GET', '/api/relay/key', null);
  if (alive.status === 200) {
    test.check('and it is still answering after the refusal');
  } else {
    test.fail('the relay went away on a refused restart');
  }

  // ── A FIGURE THAT NO LONGER FITS CLAMPS AT BOOT ──────────────────
  test.subHeading('A configuration the box can no longer honour clamps — it does not keep the relay down');
  stopRelay(w);
  await sleep(500);
  fs.writeFileSync(configPath(w), JSON.stringify({ ramLimitMB: 99999999, discLimitMB: 99999999 }, null, 2) + '\n');
  const again = await startRelay(w, PORTS[1]);
  if (again) {
    test.check('it came back up on a file asking for more memory than the machine has');
  } else {
    test.fail('a relay refused to start on an over-large figure: ' + (w.said || []).join('').slice(0, 300));
  }
  const saidAgain = (w.said || []).join('');
  if (/NOTE: config.json asks for 99999999 MB of RAM/.test(saidAgain)) {
    test.check('and it says what was asked for and what it is running on instead');
  } else {
    test.fail('the clamp was silent: ' + saidAgain.slice(0, 400));
  }
  const untouched = readConfig(w);
  if (untouched.ramLimitMB === 99999999) {
    test.check('the file is left exactly as the owner wrote it — a busy box never shrinks a configuration');
  } else {
    test.fail('the clamp was written back: ' + JSON.stringify(untouched));
  }
  stopRelay(w);

  // ── ARGUMENTS CONFIGURE A FIRST START, AND ARE KEPT ──────────────
  test.subHeading('--ram and --disc configure a first start, and outlive it');
  const v = buildHome();
  const vUp = await startRelay(v, PORTS[2], ['--ram', '64', '--disc', '32']);
  if (!vUp) {
    test.fail('the relay did not start with arguments: ' + (v.said || []).join('').slice(0, 300));
    return;
  }
  const byArgs = readConfig(v);
  if (byArgs && byArgs.ramLimitMB === 64 && byArgs.discLimitMB === 32) {
    test.check('the figures given as arguments are written, so a restart without them keeps them');
  } else {
    test.fail('arguments did not persist: ' + JSON.stringify(byArgs));
  }
  if (/\(argument\)/.test((v.said || []).join(''))) {
    test.check('and the boot line says they came from an argument, not from a file that did not exist');
  } else {
    test.fail('the source label lied: ' + (v.said || []).join('').slice(0, 200));
  }
  stopRelay(v);

  test.reportSuccessFailureCount();
}

run().catch(function (e) {
  test.fail(String(e && e.stack ? e.stack : e));
  test.reportSuccessFailureCount();
}).then(function () {
  kids.forEach(function (k) { try { k.kill(); } catch (e) { /* gone */ } });
});
