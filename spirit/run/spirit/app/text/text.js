// spirit/run/spirit/app/text/text.js
// TEXT, AN ELEMENT (goal/G43.17; the box: "Four elements: file, fstat, text and media", and "text and media take a file when
// mounted: with one they show no file picker, without one they show it"). A text file, edited on the codeMirror element's edit
// mode in fstat's pane, and saved. Its contract and its test: ./test/text.md and ./test/text.js.
//
//   spirit.elements.text.create(container, { path, words, line }) -> { destroy() }
//     words, line: a file found by its contents opens with the words marked, at that line.
//
// WHAT THE NODE SAYS, AND ONLY THAT (rule/19): a refused load is no empty file, and a refused save says the node's words.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all([S.require('spirit/element/fstat.js'), S.require('spirit/element/files/listElement.js'), S.require('spirit/element/codeMirror.js')]);

  // ONE FILE, IN fstat'S PANE: Save and what it says above the text, the text below, scrolling inside itself (rule/16).
  function edit(host, path, words, line) {
    var FS = S.element.fstat;
    var frame = FS.create(host, { path: path });
    var body = frame.slot('body');
    body.innerHTML = '<div class="start-job-form" style="flex-wrap:nowrap;align-items:center;white-space:nowrap">' +
      '<button type="button" data-text="save">Save</button><span data-text="status"></span></div>' +
      '<div class="text-view fill" data-text="view"></div>';
    var status = body.querySelector('[data-text="status"]');
    var place = body.querySelector('[data-text="view"]');
    var view = null;
    var live = true;
    FS.read(path).then(function (r) {
      if (!live) return null;
      if (r.status !== 200) { status.textContent = 'not loaded: ' + r.status; return null; }
      return S.element.codeMirror.create(place, { mode: 'edit', text: new TextDecoder().decode(r.bytes), words: words || '', line: line || 0, path: path });
    }).then(function (v) { if (v && live) { view = v; status.textContent = 'loaded'; } }, function (e) {
      status.textContent = 'not loaded: ' + ((e && e.message) || e);
    });
    body.querySelector('[data-text="save"]').addEventListener('click', function () {
      if (!view) return;
      status.textContent = 'saving…';
      Promise.resolve(S.fs.saveFile(path, view.value())).then(function (r) { status.textContent = r && r.ok === false ? 'save failed: ' + (r.reason || 'refused') : 'saved'; },
        function (e) { status.textContent = 'save failed: ' + ((e && e.message) || e); });
    });
    return { destroy: function () { live = false; host.innerHTML = ''; } };
  }

  function create(container, opts) {
    var o = opts || {};
    var gone = false;
    var shown = null;
    var picker = null;
    container.innerHTML = '';
    var box = document.createElement('div');
    box.className = 'fill';
    container.appendChild(box);
    parts.then(function () {
      if (gone) return;
      if (o.path) { shown = edit(box, String(o.path), o.words, o.line); return; }
      // NO FILE HANDED IN: the file picker, the files list as a dropdown showing only text, and under it the file picked.
      var pick = document.createElement('div');
      var area = document.createElement('div');
      area.className = 'fill';
      area.style.marginTop = '1em';
      box.appendChild(pick);
      box.appendChild(area);
      picker = S.element.fileList.create(pick, {
        face: 'dropdown',
        placeholder: 'open a file…',
        accept: ['text/', 'application/json', 'application/javascript', '.md'],
        pick: function (row, key) {
          if (!row || row.kind !== 'file') return;
          if (shown) shown.destroy();
          // Found by its contents: opened marked with the picker's words, at its line.
          var hit = row.line > 0;
          shown = edit(area, key, hit ? picker.words() : '', hit ? row.line : 0);
        },
      });
    }, function () { box.textContent = 'Text could not be loaded.'; });
    return {
      destroy: function () {
        gone = true;
        if (shown) shown.destroy();
        if (picker) picker.destroy();
        shown = null;
        picker = null;
        container.innerHTML = '';
      },
    };
  }

  S.elements = S.elements || {};
  S.elements.text = { create: create };
}());
