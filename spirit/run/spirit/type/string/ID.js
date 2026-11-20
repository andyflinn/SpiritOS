'use strict';
// spirit/run/spirit/type/string/ID.js
// THE TYPE spirit.type.string.ID (goal/G48.4, the box: "a type script.js is an object containing static functions ... defaultValue()
// returns a default value that passes validation, and isValid(something) return boolean true if something is valid and throws
// and error if something is NOT valid."): an ID, a public key (the box: "spirit/type/string/ID.js (public keys)"): an Ed25519 key in its SPKI form, base64, as every key on this network is written, always 60 characters.
// The same file on the node and on a page: on the node it is this module, on a page it stands at spirit.required.type.string.ID.
// Its test: ./test/ID.js.
(function (root) {
  var KEY = /^MCowBQYDK2VwAyEA[A-Za-z0-9+/]{43}=$/;
  function no(why) { throw new Error(why); }
  // Its limit in bytes, as every limited string's (Andy: "ALL LIMITED STRING MUST BE LIMITED BY BYTES"): a key is 60.
  var MAX_BYTES = 60;
  var T = {
    MAX_BYTES: MAX_BYTES,
    // ITS FORM, the one place it is written: IDNew takes a key of this form that nobody here knows yet.
    FORM: KEY,
    // ITS DEFAULT (goal/G48.4, the box v33: "default: \"the nodes own public key\""): spirit.node.key, the node's own on the
    // node and the key of the node a page came from once it has answered; until then the key of all zero bytes, which passes
    // the check and is nobody's (Andy, of that first moment: fine as long as nothing sends it).
    defaultValue: function () {
      var N = root && root.spirit && root.spirit.node;
      var own = N && typeof N.key === 'string' ? N.key : '';
      return KEY.test(own) ? own : 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '=';
    },
    ruleDescription: function () { return 'an ID: a public key, MCowBQYDK2VwAyEA then 43 base64 characters and ='; },
    isValid: function (v) {
      if (typeof v !== 'string') no('an ID is a string');
      if (!KEY.test(v)) no('an ID is a public key: MCowBQYDK2VwAyEA, 43 more base64 characters, then =');
      // A KEY THIS NODE KNOWS, WHERE THE NODE CAN SAY (goal/G48.4; Andy: "the validity check for an ID must either check in
      // the browser data, or node side the shadow roll and the own ID", and Q12: a new key is IDNew's): where spirit.knownKey
      // is given, the node's own key or one in its shadow roll, a key it does not know is refused; elsewhere the form decides.
      var known = root && root.spirit && root.spirit.knownKey;
      if (typeof known === 'function' && !known(v)) no('an ID is a key this node knows: its own, or one in its shadow roll');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ["spirit", "type", "string", "ID"].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
