'use strict';
// spirit/run/spirit/type/string/signature/script.js
// THE TYPE spirit.type.string.signature (goal/G49.25, Q13; Andy: "i agree to a signature type.", and of it being the relay's only: "does
// not the node also check signatures for incoming peer requests?"): a signature, an Ed25519 signature in base64, as every signature on
// this network is written (spirit/relayAuth/script.js): 64 bytes, 88 characters, the last two '='. For node and relay alike, wherever
// a call takes one as an argument; whether it is the right one is the signature check's, never the type's.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.type.string.signature.
// Its test: ./test/script.js.
(function (root) {
  // Its limit in bytes, as every limited string's (Andy: "ALL LIMITED STRING MUST BE LIMITED BY BYTES"): 88.
  var MAX_BYTES = 88;
  var FORM = /^[A-Za-z0-9+/]{86}==$/;
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: MAX_BYTES,
    FORM: FORM,
    // The signature of all zero bytes: of the form, and nobody's.
    defaultValue: function () { return 'A'.repeat(86) + '=='; },
    ruleDescription: function () { return 'a signature: 64 bytes in base64, 86 base64 characters and =='; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a signature is a string');
      if (!FORM.test(v)) no('a signature is 64 bytes in base64: 86 base64 characters, then ==');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
