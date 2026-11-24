'use strict';
// spirit/run/spirit/type/string/relay.js
// THE TYPE spirit.type.string.relay (goal/G48.4, the box: "a type identifier is ALWAYS spirit.type.*"; relay.get takes
// either, hub.js: a relay's ID or its URL): a relay, named by its key as spirit.type.string.IDNew takes it, or by its address
// as spirit.type.string.URL takes it. The same file on the node and on a page: on the node it is this module, on a page it
// stands at spirit.required.spirit.type.string.relay.
// On the node the spirit object first, as every file of the tree takes it (the general rules).
if (typeof module === 'object' && module && module.exports && typeof require === 'function') require('../../spirit.js');
(function (root) {
  // IDNew and URL, through spirit.requireScript: on the node their modules at once, on a page what spirit.required holds.
  var S0 = root && root.spirit;
  // Kept from what spirit.requireScript hands back (goal/G49.9): on the node its module at once, on a page once it is loaded.
  var loaded = { IDNew: null, URL: null };
  function keep(name, asked) {
    if (asked && typeof asked.then === 'function') asked.then(function (m) { loaded[name] = m; }, function () { /* not loaded */ }); else loaded[name] = asked;
  }
  if (S0 && typeof S0.requireScript === 'function') {
    keep('IDNew', S0.requireScript('spirit/type/string/IDNew.js'));
    keep('URL', S0.requireScript('spirit/type/string/URL.js'));
  }
  function typeOf(name) { return loaded[name] && typeof loaded[name].isValid === 'function' ? loaded[name] : null; }
  function takes(T, v) { try { return !!T && T.isValid(v) === true; } catch (e) { return false; } }
  function no(why) { throw new Error(why); }
  var T = {
    defaultValue: function () { var U = typeOf('URL'); return U ? U.defaultValue() : ''; },
    ruleDescription: function () { return 'a relay: its ID, or its http or https address'; },
    isValid: function (v) {
      var I = typeOf('IDNew');
      var U = typeOf('URL');
      if (!I || !U) no('a relay needs spirit.type.string.IDNew and spirit.type.string.URL, not loaded yet');
      if (takes(I, v) || takes(U, v)) return true;
      no('a relay is its ID or its http or https address');
    },
  };
  if (typeof module === 'object' && module && module.exports) module.exports = T;
}(typeof window !== 'undefined' ? window : globalThis));
