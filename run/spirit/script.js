'use strict';
// run/spirit/script.js
// THE SPIRIT OBJECT OF THE NEXT TREE (goal/G50.1, box v9: "repo://run/spirit/script.js", "server requires http and
// spirit/script.js"): one file, the same in node and on a page. In node it is what server/script.js requires; on a page
// index.html loads it with a script tag and it stands at window.spirit (Andy: "in the browser, /spirit/script.js will
// create an empty global object window.spirit"; "no spirit.name nothing, no bells, no whistles").
//
// ITS FIRST FUNCTION, spirit.requireScript(path) (goal/G50.1, box v21): "loads scripts scoped to repo run into their proper
// spot in the spirit object"; "spirit.requireScript('spirit/test/files/exampleScript.js') must place
// spirit/test/files/exampleScript.js exacty at spirit.test.files.exampleScript, both in the browser and node.js"; "if
// spirit/test/files/exampleScript.js export a function, factory, object, string.. it must appear as that type"; Andy: "no
// invisibility, no special handling".
//   - the path is relative to repo://run/ and begins with spirit/; the first folder is the spirit object itself, every
//     folder after it a level, the file's name without .js the key
//   - every folder and file name is a JS name (camelCase), so each level is reachable by a dot
//   - one loader on both sides: the file's text is read (fs in node, fetch on a page), run with a module object, and what
//     it leaves in module.exports is placed as it is
//   - it answers a promise on both sides, resolving to what it placed; a path asked again answers what was placed
(function (root) {
  var spirit = {};
  var inNode = typeof module !== 'undefined' && !!module.exports && typeof require === 'function';
  var NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  var placed = Object.create(null);

  // The levels a path names under the spirit object, or null when it is no path of the tree.
  function levelsOf(p) {
    var parts = String(p || '').split('/');
    if (parts.length < 2 || parts[0] !== 'spirit') return null;
    var file = parts[parts.length - 1];
    if (!/\.js$/.test(file)) return null;
    parts[parts.length - 1] = file.slice(0, -3);
    var levels = parts.slice(1);
    return levels.every(function (n) { return NAME.test(n); }) ? levels : null;
  }

  function textOf(p) {
    if (inNode) {
      var fs = require('fs');
      var path = require('path');
      // This file stands in repo://run/spirit/, so repo://run/ is one folder up.
      return new Promise(function (ok, no) {
        fs.readFile(path.join(__dirname, '..', p), 'utf8', function (err, text) { if (err) no(err); else ok(text); });
      });
    }
    return fetch('/' + p).then(function (r) {
      if (!r.ok) throw new Error('requireScript: ' + p + ' answered ' + r.status);
      return r.text();
    });
  }

  function place(levels, value) {
    var at = spirit;
    for (var i = 0; i < levels.length - 1; i++) {
      var k = levels[i];
      if (at[k] === undefined) at[k] = {};
      else if (at[k] === null || (typeof at[k] !== 'object' && typeof at[k] !== 'function')) {
        throw new Error('requireScript: spirit.' + levels.slice(0, i + 1).join('.') + ' already holds a ' + typeof at[k]);
      }
      at = at[k];
    }
    at[levels[levels.length - 1]] = value;
    return value;
  }

  spirit.requireScript = function (p) {
    var levels = levelsOf(p);
    if (!levels) return Promise.reject(new Error('requireScript: ' + p + ' is no script of the tree (spirit/<camelCase names>.js)'));
    if (placed[p]) return placed[p];
    placed[p] = textOf(p).then(function (text) {
      var mod = { exports: {} };
      // The same four names on both sides; a page has no require, so it is undefined there.
      new Function('module', 'exports', 'spirit', 'require', text)(mod, mod.exports, spirit, inNode ? require : undefined);
      return place(levels, mod.exports);
    });
    placed[p].then(null, function () { delete placed[p]; });
    return placed[p];
  };

  if (inNode) module.exports = spirit;
  else root.spirit = spirit;
}(typeof window !== 'undefined' ? window : globalThis));
