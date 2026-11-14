'use strict';
// spirit/run/spirit/app/testicle/element/scriptDetail.js
// THE SCRIPT DETAIL, AN ELEMENT OF ITS OWN (goal/G47.1, box v134-135: "every part of testicle's face is an element of its own,
// just spirit/app/testicle/element/<element-name>.js", "element/scriptDetail.js (the script tab's file detail)"; Andy: "what
// you're doing with this monolith style of coding, your avoiding precise quality control"). It was fileDetail in
// ../element.js. Its test: ./test/scriptDetail.js.
//
//   spirit.element.spirit.app.testicle.element.scriptDetail.create(container, { script }) -> { destroy() }
//
// THE FILE DETAIL (goal/G47.1, the UI cycle). The box: "The detail shows as title row the full file name, and below it a
// standard testicle.suite.search", "The tab opens first, with its title line; then file.get runs, and below the title line it
// shows either the error file.get gives (\"not a production script\", \"no such file\") or the suite search for that file".
// THE OWN TEST, IN RED WHEN MISSING (the box: "A script tab shows, right under its title line, the name of the script's own
// test in red when that test is missing on disc: the folder test/ beside the script, the same file name", "When the own test
// is there, nothing shows in that place"), read from the fs family's mirror of the tree, and only once the tree is whole.
// Mounted with no script it draws its empty box and asks nothing.
(function () {
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the data they
  // display"; box v140; rule 26): testicle's api.js and its cache manager, data.js, which the page's one stream feeds; mounted
  // alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.require === 'function') Promise.resolve(window.spirit.require('spirit/app/testicle/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.cacheManager === 'function') Promise.resolve(window.spirit.cacheManager('testicle')).catch(function () {});
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): the suite search and testicle's interface.
  var parts = Promise.all(['spirit/app/testicle/element/search/suite.js', 'spirit/app/testicle/api.js'].map(function (p) { return S.require(p); }));
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
        var F = S.data && S.data.fs && S.data.fs.data;
        if (gone || !F) return;
        ownLine.textContent = F.ready() && !F.file(own) ? own : '';
      };
      Promise.resolve(S.cacheManager('fs')).then(function () {
        if (gone) return;
        drawOwn();
        release = S.data.fs.data.watch(function (p) { if (!p || p === own) drawOwn(); });
      }, function () {});
      parts.then(function () {
        return Promise.resolve(S.testicle['script.get']({ name: file }));
      }).then(function () {
        if (gone) return;
        made = S.element.spirit.app.testicle.element.search.suite.create(below, { script: file });
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

  S.require('spirit/element/installSpiritElement.js').then(function () { S.required.spirit.element.installSpiritElement(S, 'spirit/app/testicle/element/scriptDetail.js', { create: create }); });
}());
