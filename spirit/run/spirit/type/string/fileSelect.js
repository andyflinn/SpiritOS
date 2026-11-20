'use strict';
// spirit/run/spirit/type/string/fileSelect.js
// THE TYPE spirit.type.string.fileSelect (goal/G48.4, Andy: "<type>Select.js requires <type>.js, when validating
// <type>Select.js FIRST checks for \"\", and returns true if the value is \"\", it otherwise it lets <type>.js handle the
// check", and "<type>Select.js has it's own ruleDescription() and defaultValue() which is usually \"\""): the file a search
// narrows to, "" for all, else a file as spirit.type.string.file is. The same file on the node and on a page: on the node it
// is this module, on a page it stands at spirit.required.spirit.type.string.fileSelect. Its test: ./test/fileSelect.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../spirit.js');
(function (root) {
  // spirit.type.string.file, through spirit.require: on the node its module at once, on a page what spirit.required holds.
  var S0 = root && root.spirit;
  var FILE = S0 && typeof S0.require === 'function' ? S0.require('spirit/type/string/file.js') : null;
  function file() {
    if (FILE && typeof FILE.isValid === 'function') return FILE;
    var r = S0 && S0.required && S0.required.spirit && S0.required.spirit.type && S0.required.spirit.type.string;
    return (r && r.file) || null;
  }
  function no(why) { throw new Error(why); }
  var T = {
    MAX_BYTES: 1024,
    defaultValue: function () { return ''; },
    ruleDescription: function () { var F = file(); return 'empty for all, else ' + (F ? F.ruleDescription() : 'a file'); },
    isValid: function (v) {
      if (v === '') return true;
      var F = file();
      if (!F) no('a file select needs spirit.type.string.file, not loaded yet');
      return F.isValid(v);
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'fileSelect'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
