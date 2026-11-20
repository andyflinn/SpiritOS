'use strict';
// spirit/run/spirit/type/string/commitSelect.js
// THE TYPE spirit.type.string.commitSelect (goal/G48.4; Andy: "<type>Select.js requires <type>.js, when validating
// <type>Select.js FIRST checks for \"\", and returns true if the value is \"\", it otherwise it lets <type>.js handle the
// check"): the commit of a claim, empty only for a plain item's build claim, "" for none, else a commit as spirit.type.string.commit is. The same file on the node and on a
// page: on the node it is this module, on a page it stands at spirit.required.spirit.type.string.commitSelect.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../spirit.js');
(function (root) {
  // spirit.type.string.commit, through spirit.require: on the node its module at once, on a page what spirit.required
  // holds.
  var S0 = root && root.spirit;
  var DESC = S0 && typeof S0.require === 'function' ? S0.require('spirit/type/string/commit.js') : null;
  function baseType() {
    if (DESC && typeof DESC.isValid === 'function') return DESC;
    var r = S0 && S0.required && S0.required.spirit && S0.required.spirit.type && S0.required.spirit.type.string;
    return (r && r.commit) || null;
  }
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return ''; },
    ruleDescription: function () { var D = baseType(); return 'empty for none, else ' + (D ? D.ruleDescription() : 'a commit'); },
    isValid: function (v) {
      if (v === '') return true;
      var D = baseType();
      if (!D) no('a commit select needs spirit.type.string.commit, not loaded yet');
      return D.isValid(v);
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'commitSelect'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
