'use strict';
// spirit/run/spirit/type/string/descriptionSelect/script.js
// THE TYPE spirit.type.string.descriptionSelect (goal/G48.4, Q22; Andy: "description, 128 bytes for a search string is
// plenty", and "<type>Select.js requires <type>.js, when validating <type>Select.js FIRST checks for \"\", and returns true
// if the value is \"\", it otherwise it lets <type>.js handle the check"): the words a search narrows by, "" for all, else a
// description as spirit.type.string.description is. The same file on the node and on a page: on the node it is this
// module, on a page it stands at spirit.required.spirit.type.string.descriptionSelect. Its test: ./test/descriptionSelect.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../../script.js');
(function (root) {
  // spirit.type.string.description, through spirit.requireScript: on the node its module at once, on a page what spirit.required
  // holds.
  var S0 = root && root.spirit;
  // Kept from what spirit.requireScript hands back (goal/G49.9): on the node its module at once, on a page once it is loaded.
  var DESC = null;
  var askedDESC = S0 && typeof S0.requireScript === 'function' ? S0.requireScript('spirit/type/string/description/script.js') : null;
  if (askedDESC && typeof askedDESC.then === 'function') askedDESC.then(function (m) { DESC = m; }, function () { /* not loaded */ }); else DESC = askedDESC;
  function description() { return DESC && typeof DESC.isValid === 'function' ? DESC : null; }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: 128,
    defaultValue: function () { return ''; },
    ruleDescription: function () { var D = description(); return 'empty for all, else ' + (D ? D.ruleDescription() : 'a description'); },
    isValid: function (v) {
      if (v === '') return true;
      var D = description();
      if (!D) no('a description select needs spirit.type.string.description, not loaded yet');
      return D.isValid(v);
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
