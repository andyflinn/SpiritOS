// spirit/run/spirit/app/file/file.js
// FILES, AN ELEMENT (goal/G43.17; Andy: "file should be the same as files is. i don't want to loose all the nice stuff files
// has..."). The old shell's Files app, moved: a tile hands it only its container. Its contract and its test: ./test/file.md and
// ./test/file.js.
//
//   spirit.elements.file.create(container) -> { destroy() }
//
// The list of files as a pane, where every app shares it (Q8): its Name, Size and Changed columns, search in names or in
// contents, the folder tree, and the toggle to tiles. A press opens the file over the list, through panel (Q2): text for text,
// media for video, image and audio, fstat alone for anything else (Q1: "file really just has two "openers", text and media").
// A contents match opens text at its line, the words marked. Its ✕ hides the file, so pressing it again shows it as it was.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/files/listElement.js'), S.require('spirit/element/fstat.js'), S.require('spirit/element/panel.js')]);
  var OPENERS = { code: 'text', image: 'media', audio: 'media', video: 'media' };

  function create(container) {
    var gone = false;
    var list = null;
    var stack = null;
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fill';
    var listBox = document.createElement('div');
    listBox.className = 'fill';
    box.appendChild(listBox);
    container.appendChild(box);

    function open(key, words, line) {
      var FS = S.element.fstat;
      var name = String(key).split('/').pop();
      var opener = OPENERS[FS.kindOf(FS.mimeOf(key))];
      stack.open(key, { icon: FS.iconOf(key), label: name, fill: function (pane, closed) {
        if (!opener) { FS.create(pane, { path: key }); return { destroy: function () { pane.innerHTML = ''; } }; }
        return S.require('spirit/app/' + opener + '/' + opener + '.js').then(function () {
          if (closed()) return null;
          return S.elements[opener].create(pane, { path: key, words: words, line: line });
        });
      } });
    }

    parts.then(function () {
      if (gone) return;
      stack = S.elements.panel.create(box, listBox);
      list = S.element.fileList.create(listBox, {
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
        if (stack) stack.destroy();
        if (list) list.destroy();
        stack = null;
        list = null;
        container.innerHTML = '';
      },
    };
  }

  S.elements = S.elements || {};
  S.elements.file = { create: create };
}());
