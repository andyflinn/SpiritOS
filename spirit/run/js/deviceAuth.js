'use strict';

// spirit/run/js/deviceAuth.js
// device.json is PERSONAL NODE ONLY — the password lives there and
// nowhere else. It is never written on a --relay and never put in
// mailbox.json.
//
// The MODULE is loaded on a relay too, for the two pure functions a
// mailbox needs: keysForName (is this key the owner's?) and the message
// bytes a signature is made over. Those carry no secret. The distinction
// matters because "personal node only" read as a claim about the module
// would make the relay's own require() look like a mistake.
//
// So this module:
//   - mints / stores the door password            (personal node)
//   - remembers the current device public key     (personal node)
//   - remembers whether the window is open        (personal node)
//   - names the bytes the house key must sign     (both)
//   - answers which keys are one name's           (both)
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
  return { password: null, devicePublicKey: null, listening: false };
}

function load(rootDir) {
  try {
    var parsed = JSON.parse(fs.readFileSync(devicePath(rootDir), 'utf8'));
    if (!parsed || typeof parsed !== 'object') return emptyDoc();
    return {
      password: typeof parsed.password === 'string' ? parsed.password : null,
      devicePublicKey: typeof parsed.devicePublicKey === 'string'
        ? parsed.devicePublicKey
        : null,
      // Closed unless the file says otherwise. An older device.json has
      // no such field, and a window that defaulted open would be one
      // nobody remembered opening.
      listening: parsed.listening === true
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
    devicePublicKey: doc && doc.devicePublicKey ? doc.devicePublicKey : null,
    listening: !!(doc && doc.listening)
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

// The window. Closed, the password is inert: nothing on the personal
// node is asking any mailbox what is waiting, so a stolen password buys
// a held POST that expires unanswered.
function setListening(rootDir, on) {
  var doc = ensurePassword(rootDir);
  doc.listening = !!on;
  save(rootDir, doc);
  return load(rootDir);
}

// House key signs this to install a device on a mailbox. A status
// signature must not verify as this message.
function setDeviceMessage(devicePublicKey) {
  return 'set-device\n' + String(devicePublicKey || '');
}

// House key signs this to ask a mailbox what is waiting, and to answer
// it. Its own bytes for the same reason set-device has its own: the
// owner signs `status` constantly, for every census, and a captured one
// must not be replayable as "hand me the pending device request".
//
// Reading the slot is as much a capability as writing to it — what it
// returns is a password somebody is trying, and that is not a thing to
// hand to whoever asks.
//
// The minute is the same device relayAuth.inboxMessage uses, and it is
// here for the same reason: a signature with no expiry is a standing
// licence, and this one polls every two seconds while a window is open,
// so it is written down over and over by whatever logs requests. Now a
// captured one is worthless before anybody has finished reading the line
// it landed in. `unix-minute`, decimal and unpadded.
function deviceTakeMessage(name, atMs) {
  var minute = Math.floor((atMs == null ? Date.now() : atMs) / 60000);
  return 'device-take\n' + String(name || '') + '\n' + minute;
}

// Previous, current and next, exactly as inboxSignatureOk: enough for two
// clocks a minute apart, in both directions, because the SIGNER may be
// the one running fast.
//
// relayAuth is required HERE rather than at the top of the file. It
// requires this module (for keysForName and parseKeyRow), and it assigns
// module.exports at its end — so a top-level require from this side would
// capture the half-built object and never see the finished one. Asked for
// at call time, the cache hands back the complete module.
function deviceTakeSignatureOk(publicKey, name, sig, atMs) {
  if (!publicKey || !sig) return false;
  var relayAuth = require('./relayAuth');
  var now = atMs == null ? Date.now() : atMs;
  for (var step = -1; step <= 1; step += 1) {
    if (relayAuth.verify(publicKey, deviceTakeMessage(name, now + step * 60000), sig)) {
      return true;
    }
  }
  return false;
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
  setListening: setListening,
  passwordsEqual: passwordsEqual,
  setDeviceMessage: setDeviceMessage,
  deviceTakeMessage: deviceTakeMessage,
  deviceTakeSignatureOk: deviceTakeSignatureOk,
  keysForName: keysForName,
  parseKeyRow: parseKeyRow
};
