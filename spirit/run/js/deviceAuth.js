'use strict';

// spirit/run/js/deviceAuth.js
// Personal node only. Password + the one device public key.
// Never written on a --relay. Never put in mailbox.json.
//
// allow.json on a mailbox is a different file. This module only:
//   - mints / stores the door password
//   - remembers the current device public key locally
//   - names the bytes the house key must sign to install that device
//
// Key encoding matches relayAuth.generateIdentity (SPKI / PKCS8 base64).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PASSWORD_HEX_LEN = 128;

function devicePath(rootDir) {
  return path.join(rootDir, 'relay-state', 'device.json');
}

function emptyDoc() {
  return { password: null, devicePublicKey: null };
}

function load(rootDir) {
  try {
    var parsed = JSON.parse(fs.readFileSync(devicePath(rootDir), 'utf8'));
    if (!parsed || typeof parsed !== 'object') return emptyDoc();
    return {
      password: typeof parsed.password === 'string' ? parsed.password : null,
      devicePublicKey: typeof parsed.devicePublicKey === 'string'
        ? parsed.devicePublicKey
        : null
    };
  } catch (e) {
    return emptyDoc();
  }
}

function save(rootDir, doc) {
  fs.mkdirSync(path.join(rootDir, 'relay-state'), { recursive: true });
  var file = devicePath(rootDir);
  var tmp = file + '.tmp';
  var body = {
    password: doc && doc.password ? doc.password : null,
    devicePublicKey: doc && doc.devicePublicKey ? doc.devicePublicKey : null
  };
  fs.writeFileSync(tmp, JSON.stringify(body, null, 2));
  fs.renameSync(tmp, file);
}

function generatePassword() {
  return crypto.randomBytes(PASSWORD_HEX_LEN / 2).toString('hex');
}

function ensurePassword(rootDir) {
  var doc = load(rootDir);
  if (doc.password && doc.password.length === PASSWORD_HEX_LEN) return doc;
  doc.password = generatePassword();
  save(rootDir, doc);
  return load(rootDir);
}

function setDevicePublicKey(rootDir, publicKey) {
  var doc = ensurePassword(rootDir);
  doc.devicePublicKey = publicKey ? String(publicKey) : null;
  save(rootDir, doc);
  return load(rootDir);
}

function passwordsEqual(stored, given) {
  if (typeof stored !== 'string' || typeof given !== 'string') return false;
  if (stored.length !== given.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(given));
  } catch (e) {
    return false;
  }
}

// House key signs this to install a device on a mailbox. A status
// signature must not verify as this message.
function setDeviceMessage(devicePublicKey) {
  return 'set-device\n' + String(devicePublicKey || '');
}

// allow.byName stays the owner string. Extra device key is sibling field.
function keysForName(allow, name) {
  if (!allow || allow.mode !== 'keys' || !name) return [];
  var owner = allow.byName && allow.byName[name];
  var device = allow.deviceByName && allow.deviceByName[name];
  var out = [];
  if (typeof owner === 'string' && owner) out.push(owner);
  if (typeof device === 'string' && device && device !== owner) out.push(device);
  return out;
}

function parseKeyRow(row) {
  if (!row || typeof row !== 'object') return null;
  if (typeof row.name !== 'string' || !row.name.trim()) return null;
  var owner = row.publicKey || row.owner;
  if (typeof owner !== 'string' || !owner) return null;
  var device = row.devicePublicKey || row.device || null;
  if (typeof device !== 'string' || !device) device = null;
  return { name: row.name.trim(), publicKey: owner, devicePublicKey: device };
}

module.exports = {
  PASSWORD_HEX_LEN: PASSWORD_HEX_LEN,
  devicePath: devicePath,
  load: load,
  save: save,
  generatePassword: generatePassword,
  ensurePassword: ensurePassword,
  setDevicePublicKey: setDevicePublicKey,
  passwordsEqual: passwordsEqual,
  setDeviceMessage: setDeviceMessage,
  keysForName: keysForName,
  parseKeyRow: parseKeyRow
};
