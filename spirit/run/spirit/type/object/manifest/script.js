'use strict';
// spirit/run/spirit/type/object/manifest/script.js
// THE TYPE spirit.type.object.manifest (goal/G49.20, box v31: "A new type manifest type checks the actual manifest files in app
// for validity"): a new-style app's <name>/manifest.json, as JSON.parse makes it. Valid when "at least one of the following is
// true shell:mount:true|false, node:mount:true|false or node:run:true|false, where node:mount:true and node:run:true are
// mutually exclusive". What else an app's folder must hold for each (a server, a client, an element) is the file cache's check
// (spirit/fs/filter/app/script.js), not this type's: a type sees the manifest alone.
// A type script.js is an object of static functions (goal/G48.4): defaultValue() passes its own check, isValid(v) answers true
// or throws. The same file on the node and on a page. Its test: ./test/script.js.
(function () {
  function no(why) { throw new Error(why); }
  function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function on(block, key) { return isObject(block) && block[key] === true; }
  var T = {
    defaultValue: function () { return { shell: { mount: true } }; },
    ruleDescription: function () { return 'an app\'s manifest: an object where shell mount, node mount or node run is true, and node mount and node run are never both true'; },
    isValid: function (v) {
      if (!isObject(v)) no('a manifest is an object');
      var shellMount = on(v.shell, 'mount');
      var nodeMount = on(v.node, 'mount');
      var nodeRun = on(v.node, 'run');
      if (!shellMount && !nodeMount && !nodeRun) no('a manifest says shell mount, node mount or node run true');
      if (nodeMount && nodeRun) no('a manifest says node mount or node run true, never both');
      return true;
    },
  };
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = T;
}());
