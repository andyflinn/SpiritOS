// spirit/run/face/seal.js
// THE NODE'S SEAL, IN THE BROWSER (goal/G30.11). Andy's box: "The seal is the node's own (X25519, HKDF-SHA256,
// AES-256-GCM), done in the browser with WebCrypto." Byte for byte js/seal.js: ephemeral-static X25519, HKDF-SHA256
// salted with the ephemeral and the recipient's keys and bound to the pair (from, to) under the label, AES-256-GCM with
// the same pair as associated data, the plaintext { at, text }, the tag after the ciphertext. What one seals the other
// opens; the keys are SPKI DER in base64, as the node's are.
//
// The face makes one key for its session (newKey) and keeps the private half in memory only, so it is lost with the
// session. A browser whose WebCrypto lacks X25519 answers supported() false and the face runs unsealed, warned.
//
// Every call is a promise (WebCrypto is asynchronous). Served by the relay beside face.html and loaded by the face shell
// through spirit.require onto spirit.seal; also a module, so the suites can hold it against js/seal.js.

(function (root) {
  'use strict';
  var LABEL = 'spirit-seal-v1';
  var subtle = root.crypto && root.crypto.subtle;
  var X = { name: 'X25519' };

  function toB64(bytes) {
    var u = new Uint8Array(bytes);
    if (typeof Buffer !== 'undefined') return Buffer.from(u).toString('base64');
    var s = '';
    for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(text) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(String(text || ''), 'base64'));
    var s = atob(String(text || ''));
    var u = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return u;
  }
  function utf8(text) { return new TextEncoder().encode(String(text)); }
  function associated(fromKey, toKey) { return utf8(LABEL + '\n' + String(fromKey || '') + '\n' + String(toKey || '')); }
  function joined(a, b) { var u = new Uint8Array(a.length + b.length); u.set(a, 0); u.set(b, a.length); return u; }

  function supported() {
    if (!subtle) return Promise.resolve(false);
    return subtle.generateKey(X, false, ['deriveBits']).then(function () { return true; }, function () { return false; });
  }

  function newKey() {
    return subtle.generateKey(X, true, ['deriveBits']).then(function (pair) {
      return subtle.exportKey('spki', pair.publicKey).then(function (spki) {
        return { publicKey: toB64(spki), privateKey: pair.privateKey };
      });
    });
  }

  function aesKey(privateKey, otherPublicB64, ephemeralB64, recipientB64, fromKey, toKey) {
    return subtle.importKey('spki', fromB64(otherPublicB64), X, false, []).then(function (other) {
      return subtle.deriveBits({ name: 'X25519', public: other }, privateKey, 256);
    }).then(function (secret) {
      return subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    }).then(function (ikm) {
      return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: joined(fromB64(ephemeralB64), fromB64(recipientB64)), info: associated(fromKey, toKey) },
        ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }

  // Sealed to the recipient's seal key, as js/seal.js seal(toSealKey, fromKey, toKey, text).
  function seal(toSealKey, fromKey, toKey, text) {
    return subtle.generateKey(X, true, ['deriveBits']).then(function (eph) {
      return subtle.exportKey('spki', eph.publicKey).then(function (spki) {
        var e = toB64(spki);
        return aesKey(eph.privateKey, toSealKey, e, toSealKey, fromKey, toKey).then(function (key) {
          var nonce = root.crypto.getRandomValues(new Uint8Array(12));
          var doc = JSON.stringify({ at: new Date().toISOString(), text: String(text) });
          return subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: associated(fromKey, toKey) }, key, utf8(doc)).then(function (c) {
            return { sealed: 1, e: e, n: toB64(nonce), c: toB64(c) };
          });
        });
      });
    });
  }

  // Opened with the face's own key, as js/seal.js open(mySealPrivate, fromKey, toKey, value); null when it does not open.
  function open(myPrivate, myPublicB64, fromKey, toKey, value) {
    var v = value;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return Promise.resolve(null); } }
    if (!v || v.sealed !== 1 || !v.e || !v.n || !v.c) return Promise.resolve(null);
    return aesKey(myPrivate, v.e, v.e, myPublicB64, fromKey, toKey).then(function (key) {
      return subtle.decrypt({ name: 'AES-GCM', iv: fromB64(v.n), additionalData: associated(fromKey, toKey) }, key, fromB64(v.c));
    }).then(function (plain) {
      var doc = JSON.parse(new TextDecoder().decode(plain));
      return doc && typeof doc.text === 'string' ? { at: String(doc.at || ''), text: doc.text } : null;
    }).catch(function () { return null; });
  }

  var api = { LABEL: LABEL, supported: supported, newKey: newKey, seal: seal, open: open, toB64: toB64, fromB64: fromB64 };
  // On the one spirit object (goal/G40.7), nothing on window: spirit.seal.
  (root.spirit = root.spirit || {}).seal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
}(typeof window !== 'undefined' ? window : globalThis));
