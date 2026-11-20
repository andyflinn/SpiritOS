'use strict';
// spirit/run/spirit/type/string/lineSelect.js
// THE TYPE spirit.type.string.lineSelect (goal/G48.4, Andy: "<type>Select.js requires <type>.js, when validating
// <type>Select.js FIRST checks for \"\", and returns true if the value is \"\", it otherwise it lets <type>.js handle the
// check", and "<type>Select.js has it's own ruleDescription() and defaultValue() which is usually \"\""): the words a search
// narrows by, "" for all, else a line as spirit.type.string.line is. The same file on the node and on a page: on the node it
// is this module, on a page it stands at spirit.required.spirit.type.string.lineSelect. Its test: ./test/lineSelect.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../spirit.js');
(function (root) {
  // spirit.type.string.line, through spirit.require: on the node its module at once, on a page what spirit.required holds.
  var S0 = root && root.spirit;
  var LINE = S0 && typeof S0.require === 'function' ? S0.require('spirit/type/string/line.js') : null;
  function line() {
    if (LINE && typeof LINE.isValid === 'function') return LINE;
    var r = S0 && S0.required && S0.required.spirit && S0.required.spirit.type && S0.required.spirit.type.string;
    return (r && r.line) || null;
  }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: 1024,
    defaultValue: function () { return ''; },
    ruleDescription: function () { var L = line(); return 'empty for all, else ' + (L ? L.ruleDescription() : 'a line'); },
    isValid: function (v) {
      if (v === '') return true;
      var L = line();
      if (!L) no('a line select needs spirit.type.string.line, not loaded yet');
      return L.isValid(v);
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'lineSelect'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
