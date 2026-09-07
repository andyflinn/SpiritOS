'use strict';

// One peer, one file, named by the peer's whole public key
// (CYCLE-CHAT-5.1.md).
//
// Three properties, and the third is the one that decides the encoding:
//
//   1. Injective — two keys never name one file.
//   2. Reversible — a filename says whose it is.
//   3. Windows-safe — no + / = in a path, and NTFS folds case, so any
//      scheme that leaves letters as letters is injective on Linux and
//      lossy on the laptop this is developed on.
//
// The predecessor took a TAIL of the key and called a caption `relay`.
// Both are tested against here on purpose.

const test = require('./testSupport.js');
const auth = require('../run/js/relayAuth');
const peerFile = require('../run/js/peerFile.js');

const SAFE = /^[A-Za-z0-9._-]+$/;

test.startTest('peerFile — a filename that is the whole key, and only the key');

test.subHeading('Safe on the disks this runs on');

{
  const key = auth.generateIdentity('andy').publicKey;
  const name = peerFile.nameFromKey(key);

  if (SAFE.test(name)) {
    test.check('a name uses only A-Za-z0-9._- , whatever the key contained');
  } else {
    test.fail('unsafe name: ' + name);
  }

  // The three characters base64 has that a path must not.
  if (key.indexOf('+') !== -1 || key.indexOf('/') !== -1 || key.indexOf('=') !== -1) {
    if (name.indexOf('+') === -1 && name.indexOf('/') === -1 && name.indexOf('=') === -1) {
      test.check('+ / and = are gone — a key is not a path');
    } else {
      test.fail('base64 punctuation survived into: ' + name);
    }
  } else {
    test.fail('this key has no + / or = in it; pick another to prove the point');
  }

  const file = peerFile.fileName(key);
  if (file === 'peerfile-' + name + '.json' && !/[\\/]/.test(file)) {
    test.check('fileName is one segment, prefixed peerfile-, carrying no directory');
  } else {
    test.fail('fileName: ' + file);
  }

  // The prefix is what lets one .gitignore line (**/peerfile-*.json)
  // cover every per-peer file an app ever keeps, wherever it keeps them.
  if (file.indexOf(peerFile.PREFIX) === 0 && SAFE.test(file)) {
    test.check('and the prefix is on the front, where a glob can see it');
  } else {
    test.fail('prefix missing from ' + file);
  }

  // Windows device names are letters. This encoding has none, but the
  // check is what stops a later "make it readable" change from
  // reintroducing them.
  const reserved = ['con', 'prn', 'aux', 'nul', 'com1', 'lpt1'];
  if (reserved.indexOf(name.toLowerCase()) === -1) {
    test.check('and it is not a Windows device name');
  } else {
    test.fail('name collides with a reserved device: ' + name);
  }
}

test.subHeading('Injective — including where the filesystem folds case');

{
  const a = auth.generateIdentity('john').publicKey;
  const b = auth.generateIdentity('john').publicKey;

  if (peerFile.nameFromKey(a) !== peerFile.nameFromKey(b)) {
    test.check('two keys are two names');
  } else {
    test.fail('two keys collapsed to ' + peerFile.nameFromKey(a));
  }

  // The bug the old scheme had: every Ed25519 SPKI key opens with the
  // same header, so a prefix names one file for the whole mailbox, and a
  // tail is a bet that the ends differ.
  if (a.slice(0, 12) === b.slice(0, 12)) {
    test.check('and they share a long prefix, which is why no prefix or tail is used');
  } else {
    test.fail('keys no longer share a prefix — this check needs rethinking');
  }

  if (peerFile.nameFromKey(a).indexOf(peerFile.nameFromKey(a).slice(-8)) !== -1 &&
      peerFile.nameFromKey(a).length >= a.length) {
    test.check('a name is at least as long as the key — nothing was abbreviated away');
  } else {
    test.fail('name is shorter than the key it encodes');
  }

  // NTFS is case-insensitive. Two keys differing only in case are two
  // peers and would be one file under any scheme that keeps letters.
  const upper = peerFile.nameFromKey('aB');
  const lower = peerFile.nameFromKey('Ab');
  if (upper !== lower && upper.toLowerCase() !== lower.toLowerCase()) {
    test.check('keys differing only in case still name different files, case-folded');
  } else {
    test.fail('case-folding collision: ' + upper + ' vs ' + lower);
  }

  // A thousand real keys, no collisions.
  const seen = Object.create(null);
  let clash = '';
  for (let i = 0; i < 200; i++) {
    const k = auth.generateIdentity('peer' + i).publicKey;
    const n = peerFile.nameFromKey(k).toLowerCase();
    if (seen[n]) clash = n;
    seen[n] = true;
  }
  if (!clash) {
    test.check('two hundred keys, two hundred names');
  } else {
    test.fail('collision at ' + clash);
  }
}

test.subHeading('Reversible — a folder of files can say whose they are');

{
  const key = auth.generateIdentity('bert').publicKey;

  if (peerFile.keyFromName(peerFile.nameFromKey(key)) === key) {
    test.check('a name decodes back to the exact key');
  } else {
    test.fail('round trip failed for ' + key);
  }

  if (peerFile.keyFromFileName(peerFile.fileName(key)) === key) {
    test.check('and so does a whole filename, prefix and extension and all');
  } else {
    test.fail('filename round trip failed');
  }

  // The prefix is optional on the way back in, so a file written before
  // it existed is not orphaned by the change that added it.
  if (peerFile.keyFromFileName(peerFile.nameFromKey(key) + '.json') === key) {
    test.check('a name written without the prefix still decodes');
  } else {
    test.fail('unprefixed name no longer decodes');
  }

  // A name written by something else is not a key, and saying so beats
  // decoding half of it.
  const nonsense = ['relay.json', 'k-KsoBSOllzvZhd0Rr6fOfXD0c', 'andy', '', 'zz', '4d4', 'peerfile-zz.json', 'peerfile-.json'];
  const refused = nonsense.filter(function (n) { return peerFile.keyFromFileName(n) === ''; });
  if (refused.length === nonsense.length) {
    test.check('a name this module did not write decodes to nothing, not to a guess');
  } else {
    test.fail('accepted: ' + JSON.stringify(nonsense.filter(function (n) { return peerFile.keyFromFileName(n) !== ''; })));
  }

  if (peerFile.nameFromKey('') === '' && peerFile.fileName('') === '' && peerFile.nameFromKey(null) === '') {
    test.check('no key is no name — never a file called nothing.json');
  } else {
    test.fail('empty key produced a name');
  }
}

test.subHeading('Long enough to be safe, short enough to be written');

{
  const key = auth.generateIdentity('andy').publicKey;
  // The deepest this project goes on Andy's laptop: a OneDrive clone,
  // spirit/run/app/relayChat/logs/. Windows' limit is 260.
  const deepest = 'C:\\Users\\Andre\\OneDrive\\repo\\SpiritOS\\spirit\\run\\app\\relayChat\\logs\\';
  const full = deepest + peerFile.fileName(key);
  if (full.length < 260) {
    test.check('a full path on the deepest folder is ' + full.length + ' characters, inside the Windows limit');
  } else {
    test.fail('path too long: ' + full.length);
  }
}

test.reportSuccessFailureCount();
