'use strict';

// spirit/test/deviceAuth.js
// Cycle 1. Fails on an unpatched relayAuth until loadAllow fills deviceByName
// and checkOwner accepts either key. Node-only. No browser. No spirit-3.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const deviceAuth = require('../run/js/deviceAuth');
const relayAuth = require('../run/js/relayAuth');

let passed = 0;
function ok(name, cond) {
  assert(cond, name);
  passed += 1;
  console.log('***   SUCCESS ' + name + ' ✅');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-device-'));

function writeAllow(root, keys) {
  const dir = path.join(root, 'relay-state');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'allow.json'), JSON.stringify({ keys: keys }, null, 2));
}

try {
  console.log('**************************************************************************');
  console.log('************   #1 Owner device slot (password + pair)   ***********');
  console.log('**************************************************************************');

  ok('#1.1 empty load', deviceAuth.load(tmp).password === null
    && deviceAuth.load(tmp).devicePublicKey === null);

  const first = deviceAuth.ensurePassword(tmp);
  ok('#1.2 password length 128', first.password && first.password.length === deviceAuth.PASSWORD_HEX_LEN);
  ok('#1.3 hex only', /^[0-9a-f]+$/.test(first.password));
  ok('#1.4 ensure is stable', deviceAuth.ensurePassword(tmp).password === first.password);

  const house = relayAuth.generateIdentity('andy');
  const phone = relayAuth.generateIdentity('device');
  deviceAuth.setDevicePublicKey(tmp, phone.publicKey);
  ok('#1.5 slot stored', deviceAuth.load(tmp).devicePublicKey === phone.publicKey);
  ok('#1.6 password kept', deviceAuth.load(tmp).password === first.password);

  ok('#1.7 password match', deviceAuth.passwordsEqual(first.password, first.password));
  ok('#1.8 password reject', !deviceAuth.passwordsEqual(first.password, first.password.slice(0, -1) + '0'));

  const msg = deviceAuth.setDeviceMessage(phone.publicKey);
  ok('#1.9 set-device bytes', msg === 'set-device\n' + phone.publicKey);
  const good = relayAuth.sign(house.privateKey, msg);
  const statusSig = relayAuth.sign(house.privateKey, relayAuth.statusMessage('andy'));
  ok('#1.10 house signs set-device', relayAuth.verify(house.publicKey, msg, good));
  ok('#1.11 status sig is not set-device', !relayAuth.verify(house.publicKey, msg, statusSig));

  const oldRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-allow-old-'));
  writeAllow(oldRoot, [{ name: 'andy', publicKey: house.publicKey }]);
  const oldAllow = relayAuth.loadAllow(oldRoot);
  ok('#1.12 old allow still keys', oldAllow.mode === 'keys');
  ok('#1.13 byName owner string kept', oldAllow.byName.andy === house.publicKey);
  ok('#1.14 deviceByName present', oldAllow.deviceByName && oldAllow.deviceByName.andy == null);

  const pairRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-allow-pair-'));
  writeAllow(pairRoot, [{
    name: 'andy',
    publicKey: house.publicKey,
    devicePublicKey: phone.publicKey
  }]);
  const pair = relayAuth.loadAllow(pairRoot);
  ok('#1.15 deviceByName filled', pair.deviceByName.andy === phone.publicKey);
  const both = deviceAuth.keysForName(pair, 'andy');
  ok('#1.16 keysForName both', both.length === 2
    && both.indexOf(house.publicKey) !== -1
    && both.indexOf(phone.publicKey) !== -1);

  const ownerStatus = relayAuth.sign(house.privateKey, relayAuth.statusMessage('andy'));
  const deviceStatus = relayAuth.sign(phone.privateKey, relayAuth.statusMessage('andy'));
  const stranger = relayAuth.generateIdentity('nope');
  const strangerStatus = relayAuth.sign(stranger.privateKey, relayAuth.statusMessage('andy'));
  ok('#1.17 owner still owner', relayAuth.checkOwner(pair, 'andy', ownerStatus).ok === true);
  ok('#1.18 device is owner too', relayAuth.checkOwner(pair, 'andy', deviceStatus).ok === true);
  ok('#1.19 stranger is not', relayAuth.checkOwner(pair, 'andy', strangerStatus).ok !== true);

  const parsed = deviceAuth.parseKeyRow({
    name: 'andy',
    publicKey: house.publicKey,
    devicePublicKey: phone.publicKey
  });
  ok('#1.20 parse row', parsed.publicKey === house.publicKey
    && parsed.devicePublicKey === phone.publicKey);

  console.log('************************   Test completed.  ✅:' + passed + '   ***********************');
} catch (e) {
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
}
