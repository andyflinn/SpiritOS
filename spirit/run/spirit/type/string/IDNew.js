'use strict';
// spirit/run/spirit/type/string/IDNew.js
// THE TYPE spirit.type.string.IDNew (goal/G48.4, Q12; Andy: "similar to <type>Select.js <type>New.js expands to allowable
// values."): the key an argument brings in to be added, a contact, a peer, a grant: every key spirit.type.string.ID takes,
// and a well-formed key nobody here has seen yet. The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.IDNew. Its test: ./test/IDNew.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../spirit.js');
(function (root) {
  // spirit.type.string.ID, through spirit.require: on the node its module at once, on a page what spirit.required holds.
  var S0 = root && root.spirit;
  var IDT = S0 && typeof S0.require === 'function' ? S0.require('spirit/type/string/ID.js') : null;
  function id() {
    if (IDT && typeof IDT.isValid === 'function') return IDT;
    var r = S0 && S0.required && S0.required.spirit && S0.required.spirit.type && S0.required.spirit.type.string;
    return (r && r.ID) || null;
  }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: 60,
    defaultValue: function () { var I = id(); return I ? I.defaultValue() : 'MCowBQYDK2VwAyEA' + 'A'.repeat(43) + '='; },
    ruleDescription: function () { var I = id(); return 'a new ID: ' + (I ? I.ruleDescription() : 'a public key') + ', or a well-formed key nobody here knows yet'; },
    // What ID takes, it takes; a key ID refuses only for being unknown here, it takes too: the form is ID's own (FORM).
    isValid: function (v) {
      var I = id();
      if (!I) no('a new ID needs spirit.type.string.ID, not loaded yet');
      try { return I.isValid(v); } catch (e) {
        if (typeof v === 'string' && I.FORM && I.FORM.test(v)) return true;
        throw e;
      }
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'IDNew'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
