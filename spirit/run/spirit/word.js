// spirit/run/spirit/word.js
// THE NAMESPACE CLAIMS (goal/G43.4). Andy, the box: "i will track nameSpace claims." After this item it is his, with every
// word.json: "ANDY owns word.js and ALL word.json files." Its contract and its test: ./test/word.md and ./test/word.js.
//
//   check('path.in.words', 'Word')   the lower-case word where it is reserved on that path, else null: case-insensitive, over
//                                    the hard-coded words and the word.json of each level of the path below the root, never
//                                    a level beside it or below it. In node a plain answer; on a page a promise, since a page
//                                    asks its node for each file.
//   changed(fn)                      on a page: fn() when a word.json changes on the disk; answers its release.
//
// A word is a to z. add() is conceptual, and not implemented here (the box).
(function () {
  // The box: "hardcoded intitialized set of keys", "(this may change)". No inherited keys: "constructor" is a to z.
  var HARD = Object.create(null);
  ['spirit', 'app', 'element', 'contact', 'job'].forEach(function (w) { HARD[w] = true; });

  function wordOf(word) { var w = String(word == null ? '' : word); return /^[A-Za-z]+$/.test(w) ? w.toLowerCase() : ''; }
  // The word.json of each level on the path, below the root: the box's "it would NOT check" run://spirit/word.json.
  function levels(path) {
    var parts = String(path || '').split('.');
    var out = [];
    for (var i = parts.length; i > 1; i--) out.push(parts.slice(0, i).join('/') + '/word.json');
    return parts[0] === 'spirit' ? out : [];
  }
  function holds(text, w) {
    var o = null;
    try { o = JSON.parse(String(text)); } catch (e) { return false; }
    return !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, w) && o[w] === true;
  }

  if (typeof module === 'object' && module && module.exports) {
    // The spirit object first (goal/G40.1).
    require('../spirit.js');
    var fs = require('fs');
    var path = require('path');
    module.exports = {
      check: function (at, word) {
        var w = wordOf(word);
        if (!w) return null;
        if (HARD[w]) return w;
        return levels(at).some(function (rel) {
          try { return holds(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), w); } catch (e) { return false; }
        }) ? w : null;
      },
    };
    return;
  }

  // ON A PAGE: a file that is not there is empty. While someone listens, the node's file stream is watched, and each word.json
  // is asked once and kept until the stream says it changed. With nobody listening nothing is watched, nor kept.
  var kept = Object.create(null);
  var told = [];
  var unwatch = null;
  var watching = 0;
  function ask(rel) { return window.spirit.ready.then(function (s) { return s.fs.loadFile(rel); }).then(null, function () { return null; }); }
  function read(rel) {
    if (!unwatch) return ask(rel);
    if (!kept[rel]) kept[rel] = ask(rel);
    return kept[rel];
  }
  function watch() {
    var turn = ++watching;
    Promise.resolve(window.spirit.cacheManager('fs')).then(function () {
      if (turn !== watching || !told.length) return;
      unwatch = window.spirit.fsData.watch(function (p) {
        if (!/(^|\/)word\.json$/.test(String(p || ''))) return;
        delete kept[p];
        told.slice().forEach(function (fn) { try { fn(); } catch (e) { /* one listener's fault */ } });
      });
    });
  }
  window.spirit.word = {
    check: function (at, word) {
      var w = wordOf(word);
      if (!w) return Promise.resolve(null);
      if (HARD[w]) return Promise.resolve(w);
      return Promise.all(levels(at).map(read)).then(function (texts) {
        return texts.some(function (t) { return t != null && holds(t, w); }) ? w : null;
      });
    },
    changed: function (fn) {
      told.push(fn);
      if (told.length === 1) watch();
      return function () {
        told = told.filter(function (x) { return x !== fn; });
        if (told.length) return;
        watching++;
        if (unwatch) { unwatch(); unwatch = null; }
        kept = Object.create(null);
      };
    },
  };
}());
