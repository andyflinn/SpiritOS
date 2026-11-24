'use strict';
// spirit/run/spirit/type/string/fileContent.js
// THE TYPE spirit.type.string.fileContent (goal/G48.4, Q2, Andy: "make a field type spirit/type/string/fileContent.js that
// allows this.", then "i allow no limit for spirit/type/string/fileContent.js"): a file's whole content, any text, empty too,
// of any length. What one message may carry is the transport's limit, not this type's. The same file on the node and on a
// page: on the node it is this module, on a page it stands at spirit.required.spirit.type.string.fileContent.
// Its test: ./test/fileContent.js.
(function (root) {
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { return ''; },
    ruleDescription: function () { return 'a file\'s content: any text, empty too, of any length'; },
    isValid: function (v) {
      if (typeof v !== 'string') no('a file\'s content is a string');
      return true;
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
