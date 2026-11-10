'use strict';
// spirit/run/spirit/app/file/element.js
// FILES, AN ELEMENT (goal/G43.17; Andy: "file should be the same as files is. i don't want to loose all the nice stuff files
// has..."). The old shell's Files app, moved. Its contract and its test: ./test/file.md and ./test/file.js.
//
//   spirit.element.spirit.app.file.element.create(container, { open }) -> { destroy() }
//     open(key, spec): the stack file was opened in, handed by its mounter, so a file covers ALL of file, its bar too (Andy:
//     "when a file is clicked on on "file", then the file viewer pops up overtop of ALL the "file" app...."). Without one,
//     file keeps a stack over its own list.
//
// The list of files as a pane, where every app shares it (Q8): its Name, Size and Changed columns, search in names or in
// contents, the folder tree, and the toggle to tiles. A press opens the file over the list, through panel (Q2): text for text,
// media for video, image and audio, fstat alone for anything else (Q1: "file really just has two "openers", text and media").
// A contents match opens text at its line, the words marked. Its ✕ hides the file, so pressing it again shows it as it was.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/search/file.js'), S.require('spirit/element/search/file/detailElement.js'), S.require('spirit/element/fstat.js'), S.require('spirit/element/panel.js'), S.cacheManager('app')]);
  var OPENERS = { code: 'text', image: 'media', audio: 'media', video: 'media' };

  function create(container, opts) {
    var o = opts || {};
    var gone = false;
    var mine = [];   // the layers file opened, let go with it
    var list = null;
    var stack = null;
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fill';
    var listBox = document.createElement('div');
    listBox.className = 'fill';
    box.appendChild(listBox);
    container.appendChild(box);

    // THE BAR OF AN OPENED FILE (Andy: "title row: [✏️] "Text Editor:" + file-name", and for media "the medias own icon"): the
    // opener app's icon, its label, a colon and the file's name, from what the node says of that app; a ❔ file, which only
    // fstat shows, its icon and its name.
    function barOf(opener, name, t) {
      var app = (S.data && S.data.app && S.data.app.data ? S.data.app.data.rows()[opener] : null) || {};
      return { icon: (t && t.icon) || app.icon || '', label: (app.label ? app.label + ': ' : '') + name };
    }
    function open(key, words, line) {
      var FS = S.element.spirit.element.fstat;
      var name = String(key).split('/').pop();
      var opener = OPENERS[FS.kindOf(FS.mimeOf(key))];
      var layer = null;
      var told = null;
      function title(t) { told = t; if (layer) layer.set(barOf(opener, name, told)); }
      var look = opener ? barOf(opener, name, null) : { icon: FS.iconOf(key), label: name };
      var into = typeof o.open === 'function' ? o.open : function (k, spec) { return stack.open(k, spec); };
      Promise.resolve(into(key, { icon: look.icon, label: look.label, fill: function (pane, closed) {
        // fstat only for a file neither opener takes (Andy: "let fstat pop up for unknows file types (❔) only"), through the
        // file search's detail, which draws it (goal/G43.32).
        if (!opener) return S.element.spirit.element.search.file.detailElement.create(pane, { path: key });
        return S.require('spirit/app/' + opener + '/element.js').then(function () {
          if (closed()) return null;
          // The opener's main element at the place of the file just loaded (goal/G43.32, rule 4).
          return S.element.spirit.app[opener].element.create(pane, { path: key, words: words, line: line, title: title });
        });
      } })).then(function (l) {
        layer = l;
        if (!layer) return;
        if (mine.indexOf(layer) === -1) mine.push(layer);
        if (opener) layer.set(barOf(opener, name, told));
      });
    }

    parts.then(function () {
      if (gone) return;
      stack = S.element.spirit.element.panel.create(box, listBox);
      list = S.element.spirit.element.search.file.create(listBox, {
        face: 'pane',
        toggle: true,
        pick: function (row, key) {
          if (!row || row.kind !== 'file') return;
          var hit = row.line > 0;
          open(key, hit ? list.words() : '', hit ? row.line : 0);
        },
      });
    }, function () { listBox.textContent = 'Files could not be loaded.'; });

    return {
      destroy: function () {
        gone = true;
        mine.forEach(function (l) { l.destroy(); });
        mine = [];
        if (stack) stack.destroy();
        if (list) list.destroy();
        stack = null;
        list = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/file/element.js', { create: create }); });
}());
