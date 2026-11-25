'use strict';
// spirit/run/spirit/type/string/fileSelect/script.js
// THE TYPE spirit.type.string.fileSelect (goal/G48.4, Andy: "<type>Select.js requires <type>.js, when validating
// <type>Select.js FIRST checks for \"\", and returns true if the value is \"\", it otherwise it lets <type>.js handle the
// check", and "<type>Select.js has it's own ruleDescription() and defaultValue() which is usually \"\""): the file a search
// narrows to, "" for all, else a file as spirit.type.string.file is. The same file on the node and on a page: on the node it
// is this module, on a page it stands at spirit.required.spirit.type.string.fileSelect. Its test: ./test/fileSelect.js.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../../script.js');
(function (root) {
  // spirit.type.string.file, through spirit.requireScript: on the node its module at once, on a page what spirit.required holds.
  var S0 = root && root.spirit;
  // Kept from what spirit.requireScript hands back (goal/G49.9): on the node its module at once, on a page once it is loaded.
  var FILE = null;
  var askedFILE = S0 && typeof S0.requireScript === 'function' ? S0.requireScript('spirit/type/string/file/script.js') : null;
  if (askedFILE && typeof askedFILE.then === 'function') askedFILE.then(function (m) { FILE = m; }, function () { /* not loaded */ }); else FILE = askedFILE;
  function file() { return FILE && typeof FILE.isValid === 'function' ? FILE : null; }
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
}(typeof window !== 'undefined' ? window : globalThis));
