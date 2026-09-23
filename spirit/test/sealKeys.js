'use strict';

// spirit/test/sealKeys.js
// TWO KEYPAIRS, ONE IDENTITY, ONE FILE — cycle 10, R2.
//
//   Andy, 2026-09-23, asked where the cipher key should live: "same file".
//
// The Ed25519 pair signs; the X25519 pair seals. What this suite holds
// down is not that the keys exist — that is one line — but that **the
// migration keeps the identity**. Every node alive predates cycle 10,
// including Andy's own and both agents'. Their Ed25519 key IS their
// identity: every relay they are enrolled at knows them by it, and a
// migration that regenerated it would make them strangers to all of them
// at once, silently, on a restart nobody was watching.
//
// So most of what is below is about what must NOT change.

const os = require('os');
const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');

test.startTest('An identity signs with one key and seals with another');

function fresh() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-seal-'));
}

function identityFile(dir) {
  return path.join(dir, 'relay-state', 'identity.json');
}

const dirs = [];
function home() { const d = fresh(); dirs.push(d); return d; }

test.subHeading('A node minted today has both');

{
  const id = auth.generateIdentity('freshling');
  const has = ['publicKey', 'privateKey', 'sealPublicKey', 'sealPrivateKey']
    .filter(function (k) { return typeof id[k] === 'string' && id[k].length > 0; });
  if (has.length === 4) {
    test.check('a signing pair and a sealing pair, made together');
  } else {
    test.fail('a fresh identity is missing keys: ' + JSON.stringify(Object.keys(id)));
  }

  // The two must never be the same material. A signing key that also
  // decrypts is one theft away from being both.
  if (id.publicKey !== id.sealPublicKey && id.privateKey !== id.sealPrivateKey) {
    test.check('and they are different keys — signing and sealing never share material');
  } else {
    test.fail('the signing and sealing keys are the same');
  }

  // X25519 rather than a home-grown scheme, and it must actually agree:
  // if this were the wrong curve or a mangled encoding it would throw
  // here rather than at the first sealed message on a live box.
  const crypto = require('crypto');
  const them = auth.generateIdentity('other');
  const mine = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey({ key: Buffer.from(id.sealPrivateKey, 'base64'), format: 'der', type: 'pkcs8' }),
    publicKey: crypto.createPublicKey({ key: Buffer.from(them.sealPublicKey, 'base64'), format: 'der', type: 'spki' }),
  });
  const theirs = crypto.diffieHellman({
    privateKey: crypto.createPrivateKey({ key: Buffer.from(them.sealPrivateKey, 'base64'), format: 'der', type: 'pkcs8' }),
    publicKey: crypto.createPublicKey({ key: Buffer.from(id.sealPublicKey, 'base64'), format: 'der', type: 'spki' }),
  });
  if (mine.length === 32 && mine.equals(theirs)) {
    test.check('the sealing keys agree on a 32-byte secret from both sides — real X25519, not a stored blob');
  } else {
    test.fail('key agreement did not produce a shared secret');
  }
}

test.subHeading('ONE FILE — the ruling, and what depends on it');

{
  const dir = home();
  auth.ensureIdentity(dir, 'onefile');
  const saved = JSON.parse(fs.readFileSync(identityFile(dir), 'utf8'));
  if (saved.privateKey && saved.sealPrivateKey) {
    test.check('both pairs are in identity.json — one thing to protect, back up, and lose');
  } else {
    test.fail('the seal key was not written beside the signing key');
  }

  const strays = fs.readdirSync(path.join(dir, 'relay-state'))
    .filter(function (f) { return /seal|cipher|box/i.test(f); });
  if (!strays.length) {
    test.check('and no second key file was made — half an identity is a state nothing here knows how to be');
  } else {
    test.fail('a separate key file appeared: ' + strays.join(', '));
  }
}

test.subHeading('THE MIGRATION: an old node stays itself');

{
  // A node exactly as it was before this cycle: signing pair, no seal.
  const dir = home();
  const old = auth.generateIdentity('veteran');
  delete old.sealPublicKey;
  delete old.sealPrivateKey;
  old.description = 'enrolled at three relays under this key';
  auth.saveIdentity(dir, old);

  const grown = auth.ensureIdentity(dir, 'ignored-name');

  if (grown.publicKey === old.publicKey && grown.privateKey === old.privateKey) {
    test.check('THE SIGNING KEY IS UNTOUCHED — every relay it is enrolled at still knows it');
  } else {
    test.fail('THE IDENTITY WAS REGENERATED — this node is now a stranger to every relay it joined');
  }
  if (grown.sealPublicKey && grown.sealPrivateKey) {
    test.check('and it gained a seal key in place');
  } else {
    test.fail('an old identity did not gain a seal key');
  }
  // The name argument is for MINTING. An existing identity must not be
  // renamed by whatever the caller happened to pass at boot.
  if (grown.name === 'veteran' && grown.description === old.description) {
    test.check('its name and description survive — the argument names a new identity, it does not rename an old one');
  } else {
    test.fail('the migration overwrote fields it had no business touching: ' + grown.name);
  }

  const onDisc = JSON.parse(fs.readFileSync(identityFile(dir), 'utf8'));
  if (onDisc.sealPrivateKey === grown.sealPrivateKey) {
    test.check('and it was saved, so the next start does not mint a second one');
  } else {
    test.fail('the grown identity was returned but not written');
  }
}

test.subHeading('It happens once, and quietly ever after');

{
  const dir = home();
  auth.ensureIdentity(dir, 'stable');
  const first = JSON.parse(fs.readFileSync(identityFile(dir), 'utf8'));
  auth.ensureIdentity(dir, 'stable');
  auth.ensureIdentity(dir, 'stable');
  const third = JSON.parse(fs.readFileSync(identityFile(dir), 'utf8'));
  if (third.sealPrivateKey === first.sealPrivateKey && third.privateKey === first.privateKey) {
    test.check('three starts, one seal key — a node does not rotate itself out of its own correspondence');
  } else {
    test.fail('a restart changed a key');
  }

  // withSealKey answers null when nothing is needed, which is how the
  // caller knows whether to save and whether to say anything. A function
  // that always returned a copy would make every boot rewrite the file.
  if (auth.withSealKey(first) === null) {
    test.check('and withSealKey says null when there is nothing to do, so a quiet start stays quiet');
  } else {
    test.fail('withSealKey offered to regenerate a key that already exists');
  }
}

test.subHeading('What it refuses to grow');

{
  // No signing key means this is not an identity to migrate — it is a
  // gap, and filling it here would mint half a node behind the back of
  // the code that mints whole ones.
  const nothings = [null, {}, { name: 'keyless' }, { publicKey: 'only-a-public-half' }];
  const grew = nothings.filter(function (n) { return auth.withSealKey(n) !== null; });
  if (!grew.length) {
    test.check('nothing without a signing key is grown a seal key');
  } else {
    test.fail('these were grown: ' + JSON.stringify(grew));
  }
}

dirs.forEach(function (d) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* leave it */ }
});

test.reportSuccessFailureCount();
