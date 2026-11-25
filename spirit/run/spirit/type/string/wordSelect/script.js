'use strict';
// spirit/run/spirit/type/string/wordSelect/script.js
// THE TYPE spirit.type.string.wordSelect (goal/G48.4; Andy: "<type>Select.js requires <type>.js, when validating
// <type>Select.js FIRST checks for \"\", and returns true if the value is \"\", it otherwise it lets <type>.js handle the
// check"): a word that may be left empty, as desk's nick or a search's by, "" for none, else a word as spirit.type.string.word is. The same file on the node and on a
// page: on the node it is this module, on a page it stands at spirit.required.spirit.type.string.wordSelect.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../../script.js');
(function (root) {
  // spirit.type.string.word, through spirit.requireScript: on the node its module at once, on a page what spirit.required
  // holds.
  var S0 = root && root.spirit;
  // Kept from what spirit.requireScript hands back (goal/G49.9): on the node its module at once, on a page once it is loaded.
  var DESC = null;
  var asked = S0 && typeof S0.requireScript === 'function' ? S0.requireScript('spirit/type/string/word/script.js') : null;
  if (asked && typeof asked.then === 'function') asked.then(function (m) { DESC = m; }, function () { /* not loaded: no base type */ }); else DESC = asked;
  function baseType() { return DESC && typeof DESC.isValid === 'function' ? DESC : null; }
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return ''; },
    ruleDescription: function () { var D = baseType(); return 'empty for none, else ' + (D ? D.ruleDescription() : 'a word'); },
    isValid: function (v) {
      if (v === '') return true;
      var D = baseType();
      if (!D) no('a word select needs spirit.type.string.word, not loaded yet');
      return D.isValid(v);
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
