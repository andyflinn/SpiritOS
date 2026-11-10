'use strict';

// spirit/run/spirit/element/installSpiritElement.js
// THE ONE HELPER THAT PLACES AN ELEMENT (goal/G43.32; spec and test: ./test/installSpiritElement.md, ./test/installSpiritElement.js).
// Andy: "this can be done with ONE single helper function spirit/element/installSpiritElement(spirit,elementPath) - every
// element knows it's path, and if the helper is resident in the required they ALL autoinsert themselves without
// name-space-collision", "element scripts installed by the above logic place their element-factory at
// spirit.element.<path-of-fucking-element-script>", and on Q5: "element scripts themselves are who installs the element
// factory at spirit.element.<path-of-element-script>".
//
//   installSpiritElement(spirit, elementPath, factory) -> factory
//     elementPath   the element script's own run-root path, spirit/element/icon.js
//     factory       what it hands out, an object with a create
// The factory stands at spirit.element.<its path>: one key per folder, its name without .js the last
// (spirit/element/icon.js at spirit.element.spirit.element.icon, spirit/app/<name>/element.js at
// spirit.element.spirit.app.<name>.element). NO NAME COLLISION: x.js and x/y.js both stand, whichever is placed first; a
// folder's place made before its file holds only what was placed under it, and the file's factory takes the place and
// keeps those. Nothing that stood is overwritten.
//
// On a page an element script loads it first (spirit.require answers once it ran, the function then at
// spirit.required.spirit.element.installSpiritElement); in node spirit.require answers the function itself.
// In node it loads the spirit object first, as every module does (the spirit object is the only door); on a page spirit.js
// is there already.
if (typeof module === 'object' && module && module.exports) require('../spirit.js');
(function (root) {
  var holders = typeof WeakSet === 'function' ? new WeakSet() : null;
  function holder() { var h = {}; if (holders) holders.add(h); return h; }
  function isHolder(o) { return !!(holders && o && typeof o === 'object' && holders.has(o)); }

  function installSpiritElement(spirit, elementPath, factory) {
    var s = spirit || root.spirit;
    var keys = String(elementPath || '').replace(/^\/+/, '').replace(/\.js$/, '').split('/').filter(Boolean);
    if (!s || !keys.length) return factory;
    if (!s.element || typeof s.element !== 'object') s.element = {};
    var o = s.element;
    for (var i = 0; i < keys.length - 1; i += 1) {
      var k = keys[i];
      if (o[k] == null || (typeof o[k] !== 'object' && typeof o[k] !== 'function')) o[k] = holder();
      o = o[k];
    }
    var last = keys[keys.length - 1];
    var was = o[last];
    if (was === factory) return factory;
    if (was === undefined || isHolder(was)) {
      if (isHolder(was) && factory && (typeof factory === 'object' || typeof factory === 'function')) {
        Object.keys(was).forEach(function (k) { if (!(k in factory)) factory[k] = was[k]; });
      }
      o[last] = factory;
    }
    return factory;
  }

  // A HELPER, NOT AN ELEMENT: IT LIVES IN spirit.required (Andy: "helpers with no create are no fucking elements. they live
  // in require."). In node spirit.require places its module.exports there; on a page it puts itself there as it runs, at
  // spirit.required.spirit.element.installSpiritElement, where every element script calls it from.
  if (typeof module === 'object' && module && module.exports) module.exports = installSpiritElement;
  else if (root && root.spirit && root.spirit.required) {
    var at = root.spirit.required;
    ['spirit', 'element'].forEach(function (k) { at = at[k] = at[k] && typeof at[k] === 'object' ? at[k] : {}; });
    if (at.installSpiritElement === undefined) at.installSpiritElement = installSpiritElement;
  }
}(typeof window !== 'undefined' ? window : globalThis));
