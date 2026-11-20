'use strict';
// spirit/run/spirit/type/string/fileFilter.js
// THE TYPE spirit.type.string.fileFilter (goal/G48.4, Q1, Andy: "a search filter for anything is a different field type, if
// it has different rules"): the file a search narrows to, "" for every file, else a file as spirit.type.string.file is, its
// path from the run folder with slashes. The same file on the node and on a page: on the node it is this module, on a page it
// stands at spirit.required.spirit.type.string.fileFilter. Its test: ./test/fileFilter.js.
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
    ruleDescription: function () { return 'the file a search narrows to: empty for every file, else its path from the run folder'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a file filter is a string');
      if (v === '') return true;
      var F = file();
      if (!F) no('a file filter needs spirit.type.string.file, not loaded yet');
      return F.isValid(v);
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
  var S = root && root.spirit;
  if (S && S.required) ['spirit', 'type', 'string', 'fileFilter'].reduce(function (o, k, i, all) { if (i === all.length - 1) { if (o[k] === undefined) o[k] = T; return o[k]; } return (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}); }, S.required);
}(typeof window !== 'undefined' ? window : globalThis));
