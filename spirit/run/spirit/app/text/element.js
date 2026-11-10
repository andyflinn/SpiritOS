'use strict';
// spirit/run/spirit/app/text/element.js
// TEXT, AN ELEMENT (goal/G43.17; the box: "Four elements: file, fstat, text and media", and "text and media take a file when
// mounted"; Andy, since: "please show the full media viewer or text editor (including the file picker) even when launched from
// files."). A text file, edited on the codeMirror element's edit mode, and saved. Its contract and its test: ./test/text.md and ./test/text.js.
//
//   spirit.element.spirit.app.text.element.create(container, { path, words, line, title }) -> { destroy() }
//     words, line: a file found by its contents opens with the words marked, at that line.
//     title({ file }): told the name of the file shown, for the title bar of whoever mounts it ("[✏️] "Text Editor:" +
//     file-name").
//
// NOT ON fstat (Andy: "separate fstat from file and text"): no name line and no facts. ONE ROW (Andy: "in text AND file, all the
// file-picker, load, save shit, in the same row. and drop the file name from that row"): rowForm's bubble, the picker in it,
// Save last; what a press did on the line below it, as rowForm's own rule says. A row is inline
// and folds when the width gets smaller (Andy: "row elements are 'inline', those are not "boxes""); the text under it is a
// fill box, scrolling inside itself (rule/16).
//
// WHAT THE NODE SAYS, AND ONLY THAT (rule/19): a refused load is no empty file, and a refused save says the node's words.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26). fstat for reading a file only.
  var parts = Promise.all([S.require('spirit/element/fstat.js'), S.require('spirit/element/rowForm.js'), S.require('spirit/element/search/file.js'),
    S.require('spirit/element/codeMirror.js'), S.cacheManager('fs')]);

  function create(container, opts) {
    var o = opts || {};
    var gone = false;
    var picker = null;
    var shown = null;
    var off = function () {};
    var saving = false;
    var title = typeof o.title === 'function' ? o.title : function () {};
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fill';
    container.appendChild(box);

    parts.then(function () {
      if (gone) return;
      var E = S.element;
      // The row's icon is the editor's, until Andy names another.
      var row = E.spirit.element.rowForm.create(box, { icon: '✏️', button: 'Save' });
      var status = document.createElement('div');
      status.className = 'job-manifest-note';
      status.setAttribute('data-text', 'status');
      box.appendChild(status);
      var place = document.createElement('div');
      place.className = 'text-view fill';
      place.setAttribute('data-text', 'view');
      box.appendChild(place);
      row.button.setAttribute('data-text', 'save');

      // ONE FILE: its text in the codeMirror element, under the row.
      function edit(path, words, line) {
        off();
        if (shown) shown.destroy();
        shown = null;
        place.innerHTML = '';
        status.textContent = '';
        title({ file: path.split('/').pop() });
        var mine = {};
        // WHAT IT SAVES, IT LISTENS FOR (goal/G41.27, as the old editor did): the file's row in the node's tree, as the fs
        // family's cache keeps it. Its own save is "saved" once the tree has it; any other change of the file is "changed on
        // disk".
        // Asked of the fs family's cache, which alone names its addresses: the tree's watch(path, fn) (spirit/fs/data.js).
        off = S.data && S.data.fs && S.data.fs.data ? S.data.fs.data.watch(path, function (r) {
          if (!r || gone || shown !== mine) return;
          status.textContent = saving ? 'saved' : 'changed on disk';
          saving = false;
        }) : function () {};
        shown = mine;
        mine.path = path;
        mine.destroy = function () { if (mine.view && typeof mine.view.destroy === 'function') mine.view.destroy(); };
        E.spirit.element.fstat.read(path).then(function (r) {
          if (gone || shown !== mine) return null;
          if (r.status !== 200) { status.textContent = 'not loaded: ' + r.status; return null; }
          return E.spirit.element.codeMirror.create(place, { mode: 'edit', text: new TextDecoder().decode(r.bytes), words: words || '', line: line || 0, path: path });
        }).then(function (v) { if (v && shown === mine) { mine.view = v; status.textContent = 'loaded'; } }, function (e) {
          status.textContent = 'not loaded: ' + ((e && e.message) || e);
        });
      }

      row.button.addEventListener('click', function () {
        if (!shown || !shown.view) return;
        status.textContent = 'saving…';
        saving = true;
        Promise.resolve(S.fs.saveFile(shown.path, shown.view.value())).then(function (r) { if (r && r.ok === false) { saving = false; status.textContent = 'save failed: ' + (r.reason || 'refused'); } },
          function (e) { saving = false; status.textContent = 'save failed: ' + ((e && e.message) || e); });
      });

      // THE PICKER in the row, the files list as a dropdown showing only text. Its field names no file: the title bar does.
      // ALWAYS WHOLE (Andy: "i changed my mind. please show the full media viewer or text editor (including the file picker) even when
      // launched from files."): the picker shows with a file handed in too, and that file is shown under it.
      var placeholder = 'open a file…';
      picker = S.element.spirit.element.search.file.create(row.span, {
        face: 'dropdown',
        placeholder: placeholder,
        name: function () { return placeholder; },
        accept: ['text/', 'application/json', 'application/javascript', '.md'],
        pick: function (r, key) {
          if (!r || r.kind !== 'file') return;
          // Found by its contents: opened marked with the picker's words, at its line.
          var hit = r.line > 0;
          edit(key, hit ? picker.words() : '', hit ? r.line : 0);
        },
      });
      if (o.path) edit(String(o.path), o.words, o.line);
    }, function () { box.textContent = 'Text could not be loaded.'; });

    return {
      destroy: function () {
        gone = true;
        off();
        if (shown) shown.destroy();
        if (picker) picker.destroy();
        shown = null;
        picker = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/app/text/element.js', { create: create }); });
}());
