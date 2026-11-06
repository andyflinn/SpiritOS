// spirit/run/spirit/word.js
// THE NAMESPACE CLAIMS (goal/G43.4). Andy, the box: "i will track nameSpace claims." After this item it is his, with every
// word.json: "ANDY owns word.js and ALL word.json files." Its contract and its test: ./test/word.md and ./test/word.js.
//
//   check('path.in.words', 'Word')   the lower-case word where it is reserved on that path, else null: case-insensitive, over
//                                    the hard-coded words and the word.json of each level of the path below the root, never
//                                    a level beside it or below it. In node a plain answer; on a page a promise, since a page
//                                    asks its node for each file.
//   add('path.in.words', 'Word')     in node only (Q5, Andy: "no."): writes the lower-case word with the value true to that level's
//                                    word.json, and answers true. Answers false and writes nothing on what is no word, on what
//                                    check finds, on a word a level below holds (Andy's yes to Q4), on a level with no folder, on a path with no level
//                                    check would read, and on a word.json it cannot read back, which it will not overwrite.
//   changed(fn)                      on a page: fn() when a word.json changes on the disk; answers its release.
//
// A word is a to z.
(function () {
  // The box: "hardcoded intitialized set of keys", "(this may change)". No inherited keys: "constructor" is a to z.
  var HARD = Object.create(null);
  ['spirit', 'api', 'app', 'contact', 'data', 'element', 'job', 'node', 'state', 'search'].forEach(function (w) { HARD[w] = true; });

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
    var readOr = function (file) { try { return fs.readFileSync(file, 'utf8'); } catch (e) { return null; } };
    var check = function (at, word) {
      var w = wordOf(word);
      if (!w) return null;
      if (HARD[w]) return w;
      return levels(at).some(function (rel) {
        try { return holds(fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'), w); } catch (e) { return false; }
      }) ? w : null;
    };
    // A word.json anywhere below a folder holding the word.
    var heldBelow = function (dir, w) {
      var names = [];
      try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return false; }
      return names.some(function (e) {
        if (!e.isDirectory() || e.name === 'node_modules') return false;
        var below = path.join(dir, e.name);
        return holds(readOr(path.join(below, 'word.json')), w) || heldBelow(below, w);
      });
    };
    module.exports = {
      check: check,
      add: function (at, word) {
        var w = wordOf(word);
        var rel = levels(at)[0];
        // A path holds words, a to z, so nothing but a level of the tree is ever written.
        if (!w || !rel || !/^[a-z]+(\.[a-z]+)*$/.test(String(at)) || check(at, w)) return false;
        var file = path.join(__dirname, '..', rel);
        // Andy: "wince fucking when does add() add a MOTHERFUCKING FOLDER?" A level is a folder that stands.
        var dir = path.dirname(file);
        try { if (!fs.statSync(dir).isDirectory()) return false; } catch (e) { return false; }
        if (heldBelow(dir, w)) return false;
        var text = readOr(file);
        var o = {};
        if (text !== null) {
          try { o = JSON.parse(text); } catch (e) { return false; }
          if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
        }
        o[w] = true;
        fs.writeFileSync(file, JSON.stringify(o, null, 2) + '\n');
        return true;
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
      unwatch = window.spirit.data.fs.data.watch(function (p) {
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
