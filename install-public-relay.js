#!/usr/bin/env node
'use strict';

// One-operator public mailbox.
//   node install-public-relay.js andy
// Writes relay-state/pending-owner.json in THIS clone's spirit/run
// so the first Claim must be that name. Then run ./bash/http-to-https
// on the VPS (or this script execs it when we are root on Linux).

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const NAME_RE = /^[A-Za-z0-9._-]{1,32}$/;
const name = String(process.argv[2] || '').trim();
if (!name || name === 'relay' || !NAME_RE.test(name)) {
  console.error('Usage: node install-public-relay.js <first-claimer-name>');
  console.error('  name: 1-32 letters, digits, . _ -  and not the reserved word "relay"');
  process.exit(1);
}

const repoRoot = path.resolve(__dirname);
const runDir = path.join(repoRoot, 'spirit', 'run');
const stateDir = path.join(runDir, 'relay-state');
if (!fs.existsSync(path.join(runDir, 'js', 'server.js'))) {
  console.error('Run this from the SpiritOS repo root (spirit/run/js/server.js missing).');
  process.exit(1);
}

fs.mkdirSync(stateDir, { recursive: true });
const pending = { name: name, createdAt: new Date().toISOString() };
fs.writeFileSync(path.join(stateDir, 'pending-owner.json'), JSON.stringify(pending, null, 2));
fs.chmodSync(stateDir, 0o700);

console.log('pending owner: ' + name);
console.log('wrote ' + path.join(stateDir, 'pending-owner.json'));
console.log('Claim that name from http://127.0.0.1:65432 Relay Chat.');
console.log('A stranger who only has the IP still needs the name "' + name + '".');

if (process.platform !== 'win32' && process.getuid && process.getuid() === 0) {
  const sh = path.join(repoRoot, 'bash', 'http-to-https');
  if (fs.existsSync(sh)) {
    console.log('root on Linux: running ./bash/http-to-https');
    const r = spawnSync(sh, [], { stdio: 'inherit' });
    process.exit(r.status || 0);
  }
}
