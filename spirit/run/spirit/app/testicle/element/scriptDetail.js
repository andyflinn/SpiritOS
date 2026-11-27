'use strict';
// THE DATA SET AS spirit.requireScript HANDS IT BACK (goal/G49.23; goal/G49.9: a script reaches another only through what
// spirit.requireScript hands back), kept once loaded; this file's own load waits for it, being part of its tree.
var KEPT_DATA = null;
if (typeof window !== 'undefined' && window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(window.spirit.requireScript('spirit/client/script.js')).then(function (d) { KEPT_DATA = d || null; }, function () { /* not loaded: nothing kept */ });
// spirit/run/spirit/app/testicle/element/scriptDetail.js
// THE SCRIPT DETAIL, AN ELEMENT OF ITS OWN (goal/G47.1, box v134-135: "every part of testicle's face is an element of its own,
// just spirit/app/testicle/element/<element-name>.js", "element/scriptDetail.js (the script tab's file detail)"; Andy: "what
// you're doing with this monolith style of coding, your avoiding precise quality control"). It was fileDetail in
// ../element.js. Its test: ./test/scriptDetail.js.
//
//   spirit.required.spirit.app.testicle.element.scriptDetail.create(container, { script }) -> { destroy() }
//
// THE FILE DETAIL (goal/G47.1, the UI cycle). The box: "The detail shows as title row the full file name, and below it a
// standard testicle.suite.search", "The tab opens first, with its title line; then file.get runs, and below the title line it
// shows either the error file.get gives (\"not a production script\", \"no such file\") or the suite search for that file".
// THE OWN TEST, IN RED WHEN MISSING (the box: "A script tab shows, right under its title line, the name of the script's own
// test in red when that test is missing on disc: the folder test/ beside the script, the same file name", "When the own test
// is there, nothing shows in that place"), read from the fs family's mirror of the tree, and only once the tree is whole.
// Mounted with no script it draws its empty box and asks nothing.
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/app/testicle/element/search/suite.js');
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the data they
  // display"; box v140; rule 26): testicle's api.js and its cache manager, data.js, which the page's one stream feeds; mounted
  // alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(keepAnswer('spirit/app/testicle/api.js')).catch(function () {});
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the suite search and testicle's interface.
  var parts = Promise.all(['spirit/app/testicle/element/search/suite.js', 'spirit/app/testicle/api.js'].map(function (p) { return S.requireScript(p); }));
  // A NODE WITH NO TESTICLE refuses its interface: the detail says so below its title; the refusal is never left unhandled.
  parts.catch(function () {});

  function create(container, options) {
    var file = String((options && options.script) || '');
    var gone = false;
    var made = null;
    var release = null;
    // Its box keeps what it holds inside (the box: "an element container always must constrain its children's display to
    // its own size"; overflow not visible).
    container.innerHTML = '<div class="testicle-detail fill" style="overflow:auto"><div class="testicle-title"></div>' +
      '<div class="testicle-own-missing" style="color:#c00"></div><div class="testicle-below fill"></div></div>';
    container.querySelector('.testicle-title').textContent = file;
    var below = container.querySelector('.testicle-below');
    var ownLine = container.querySelector('.testicle-own-missing');
    if (file) {
      var own = file.slice(0, file.lastIndexOf('/') + 1) + 'test/' + file.slice(file.lastIndexOf('/') + 1);
      var drawOwn = function () {
        var F = KEPT_DATA && KEPT_DATA.fs && KEPT_DATA.fs.data;
        if (gone || !F) return;
        ownLine.textContent = F.ready() && !F.file(own) ? own : '';
      };
      Promise.resolve(keepAnswer('spirit/fs/script.js')).then(function () {
        if (gone) return;
        drawOwn();
        release = KEPT_DATA.fs.data.watch(function (p) { if (!p || p === own) drawOwn(); });
      }, function () {});
      parts.then(function () {
        return Promise.resolve(ANSWER['spirit/app/testicle/api.js']['script.get']({ name: file }));
      }).then(function () {
        if (gone) return;
        made = ANSWER['spirit/app/testicle/element/search/suite.js'].create(below, { script: file });
      }, function (e) {
        if (gone) return;
        below.textContent = String((e && e.message) || e || 'script.get failed');
      });
    }
    return {
      destroy: function () {
        gone = true;
        if (typeof release === 'function') release();
        release = null;
        if (made && typeof made.destroy === 'function') made.destroy();
        made = null;
        container.innerHTML = '';
      },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
