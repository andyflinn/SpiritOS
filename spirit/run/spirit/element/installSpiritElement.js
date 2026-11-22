'use strict';

// spirit/run/spirit/element/installSpiritElement.js
// THE ONE HELPER THAT PLACES AN ELEMENT (goal/G43.32; spec and test: ./test/installSpiritElement.md, ./test/installSpiritElement.js).
// Andy: "this can be done with ONE single helper function spirit/element/installSpiritElement(spirit,elementPath) - every
// element knows it's path, and if the helper is resident in the required they ALL autoinsert themselves without
// name-space-collision". WHERE IT PLACES (goal/G49.5; Andy, of his G43.32 Q5: "that ruling is reversed, since the element
// factory is fine where it is loaded"; "spirit.require() places the loaded script at the exact same motherfucking
// location/path in the spirit object"): at spirit.required.<its path>, where the loader finds it, on a page as in node.
//
//   installSpiritElement(spirit, elementPath, factory) -> factory
//     elementPath   the element script's own run-root path, spirit/element/icon.js
//     factory       what it hands out, an object with a create
// The factory stands at spirit.required.<its path>: one key per folder, its name without .js the last
// (spirit/element/icon.js at spirit.required.spirit.element.icon, spirit/app/<name>/element.js at
// spirit.required.spirit.app.<name>.element). NO NAME COLLISION: x.js and x/y.js both stand, whichever is placed first; a
// folder's place made before its file (an object with no create: a holder of this file's or of spirit.js's, or the empty
// mark the loader leaves) holds only what was placed under it, and the file's factory takes the place and keeps those.
// A factory that stood is never overwritten.
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
  // A folder's place, not a factory: no create to make an element with.
  function isFolder(o) { return isHolder(o) || (!!o && typeof o === 'object' && typeof o.create !== 'function'); }

  function installSpiritElement(spirit, elementPath, factory) {
    var s = spirit || root.spirit;
    var keys = String(elementPath || '').replace(/^\/+/, '').replace(/\.js$/, '').split('/').filter(Boolean);
    if (!s || !keys.length) return factory;
    if (!s.required || typeof s.required !== 'object') s.required = {};
    var o = s.required;
    for (var i = 0; i < keys.length - 1; i += 1) {
      var k = keys[i];
      if (o[k] == null || (typeof o[k] !== 'object' && typeof o[k] !== 'function')) o[k] = holder();
      o = o[k];
    }
    var last = keys[keys.length - 1];
    var was = o[last];
    if (was === factory) return factory;
    if (was === undefined || isFolder(was)) {
      if (isFolder(was) && factory && (typeof factory === 'object' || typeof factory === 'function')) {
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
