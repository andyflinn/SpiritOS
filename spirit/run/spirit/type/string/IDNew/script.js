'use strict';
// spirit/run/spirit/type/string/IDNew/script.js
// THE TYPE spirit.type.string.IDNew (goal/G48.4, Q12; Andy: "similar to <type>Select.js <type>New.js expands to allowable
// values."): the key an argument brings in to be added, a contact, a peer, a grant: every key spirit.type.string.ID takes,
// and a well-formed key nobody here has seen yet. The same file on the node and on a page: on the node it is this module,
// on a page it stands at spirit.required.spirit.type.string.IDNew. Its test: ./test/IDNew.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../../script.js');
(function (root) {
  // spirit.type.string.ID, through spirit.requireScript: on the node its module at once, on a page what spirit.required holds.
  var S0 = root && root.spirit;
  // Kept from what spirit.requireScript hands back (goal/G49.9): on the node its module at once, on a page once it is loaded.
  var IDT = null;
  var askedIDT = S0 && typeof S0.requireScript === 'function' ? S0.requireScript('spirit/type/string/ID/script.js') : null;
  if (askedIDT && typeof askedIDT.then === 'function') askedIDT.then(function (m) { IDT = m; }, function () { /* not loaded */ }); else IDT = askedIDT;
  function id() { return IDT && typeof IDT.isValid === 'function' ? IDT : null; }
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
}(typeof window !== 'undefined' ? window : globalThis));
