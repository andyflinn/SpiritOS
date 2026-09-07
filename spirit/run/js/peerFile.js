'use strict';

// One peer, one file, named by the peer's WHOLE public key.
//
// Anything that keeps a file per peer goes through here — chat logs
// today, whoBook sidecars later — so that "which file is this peer's" has
// exactly one answer in the tree.
//
// The rules this has to satisfy, in the order they bite:
//
//   1. Injective. Two keys must never name one file. A tail, a prefix or
//      a hash is not a peer id: Ed25519 keys in base64 SPKI all begin
//      "MCowBQYDK2VwAyEA", so a prefix names one file for everybody, and
//      a tail is a bet that the ends differ.
//   2. Reversible. Given a filename, the key comes back. A folder of
//      files that cannot say whose they are is a folder of orphans.
//   3. Windows-safe. Base64 contains + / =, none of which belong in a
//      path, and NTFS is CASE-INSENSITIVE — so "Ab" and "aB" are two
//      keys but one file. That last one is why this encodes rather than
//      escapes: any scheme that leaves letters as letters is injective
//      on Linux and lossy on Andy's laptop.
//
// So: the key's UTF-8 bytes, in lowercase hex. Unreadable as a name and
// deliberately so — the file says whose it is in its own header, and the
// name only has to be unmistakable. `A-Za-z0-9` only, no case to fold,
// no reserved device name (CON, PRN, NUL and friends are letters), no
// dot, no separator.
//
// Cost: a 44-character key becomes an 88-character name. On the deepest
// path this project has (a OneDrive clone, app/relayChat/logs/) that is
// still comfortably inside Windows' 260-character limit.

var PEER_FILE_HEX = '0123456789abcdef';

function peerFileNameFromKey(publicKey) {
  var key = String(publicKey == null ? '' : publicKey);
  if (!key) return '';
  var out = '';
  for (var i = 0; i < key.length; i++) {
    var code = key.charCodeAt(i);
    // Above the ASCII range a char is more than one byte; keys are
    // base64 and never get here, but a caller passing something else
    // must still round-trip rather than silently truncate.
    if (code > 0xff) {
      out += 'ff' +
        PEER_FILE_HEX.charAt((code >> 12) & 0xf) + PEER_FILE_HEX.charAt((code >> 8) & 0xf) +
        PEER_FILE_HEX.charAt((code >> 4) & 0xf) + PEER_FILE_HEX.charAt(code & 0xf);
      continue;
    }
    out += PEER_FILE_HEX.charAt((code >> 4) & 0xf) + PEER_FILE_HEX.charAt(code & 0xf);
  }
  return out;
}

function peerFileKeyFromName(name) {
  var n = String(name == null ? '' : name).trim().toLowerCase();
  if (!n) return '';
  // A name this module did not write is not a key. Say so rather than
  // decoding half of it.
  if (!/^[0-9a-f]+$/.test(n) || n.length % 2 !== 0) return '';
  var out = '';
  for (var i = 0; i < n.length; i += 2) {
    var byte = parseInt(n.substr(i, 2), 16);
    if (byte === 0xff) {
      if (i + 6 > n.length) return '';
      out += String.fromCharCode(parseInt(n.substr(i + 2, 4), 16));
      i += 4;
      continue;
    }
    out += String.fromCharCode(byte);
  }
  return out;
}

// A single path segment. No directory: the caller owns the folder, so
// nothing here can be talked into writing outside it.
function peerFileFileName(publicKey, extension) {
  var name = peerFileNameFromKey(publicKey);
  if (!name) return '';
  var ext = extension === undefined ? '.json' : String(extension || '');
  return name + ext;
}

function peerFileKeyFromFileName(fileName, extension) {
  var f = String(fileName == null ? '' : fileName);
  var ext = extension === undefined ? '.json' : String(extension || '');
  if (ext && f.slice(-ext.length).toLowerCase() === ext.toLowerCase()) {
    f = f.slice(0, f.length - ext.length);
  }
  return peerFileKeyFromName(f);
}

if (typeof process !== 'undefined' && process.versions && process.versions.node) {
  module.exports = {
    nameFromKey: peerFileNameFromKey,
    keyFromName: peerFileKeyFromName,
    fileName: peerFileFileName,
    keyFromFileName: peerFileKeyFromFileName,
  };
} else if (typeof window !== 'undefined') {
  window.spiritPeerFile = {
    nameFromKey: peerFileNameFromKey,
    keyFromName: peerFileKeyFromName,
    fileName: peerFileFileName,
    keyFromFileName: peerFileKeyFromFileName,
  };
}
