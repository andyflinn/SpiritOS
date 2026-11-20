'use strict';
// spirit/run/spirit/type/string/paragraphSelect.js
// THE TYPE spirit.type.string.paragraphSelect (goal/G48.4; Andy: "<type>Select.js requires <type>.js, when validating
// <type>Select.js FIRST checks for \"\", and returns true if the value is \"\", it otherwise it lets <type>.js handle the
// check"): a paragraph that may be left empty, as a check's words or a verify's why, "" for none, else a paragraph as spirit.type.string.paragraph is. The same file on the node and on a
// page: on the node it is this module, on a page it stands at spirit.required.spirit.type.string.paragraphSelect.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../spirit.js');
(function (root) {
  // spirit.type.string.paragraph, through spirit.require: on the node its module at once, on a page what spirit.required
  // holds.
  var S0 = root && root.spirit;
  var DESC = S0 && typeof S0.require === 'function' ? S0.require('spirit/type/string/paragraph.js') : null;
  function baseType() {
    if (DESC && typeof DESC.isValid === 'function') return DESC;
    var r = S0 && S0.required && S0.required.spirit && S0.required.spirit.type && S0.required.spirit.type.string;
    return (r && r.paragraph) || null;
  }
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return ''; },
    ruleDescription: function () { var D = baseType(); return 'empty for none, else ' + (D ? D.ruleDescription() : 'a paragraph'); },
    isValid: function (v) {
      if (v === '') return true;
      var D = baseType();
      if (!D) no('a paragraph select needs spirit.type.string.paragraph, not loaded yet');
      return D.isValid(v);
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'paragraphSelect'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
