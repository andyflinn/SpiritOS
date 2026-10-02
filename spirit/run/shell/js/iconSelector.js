// spirit/run/shell/js/iconSelector.js
// ONE SHELL ELEMENT: the icon selector, a factory apps build their screens with.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spiritElements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// Loaded by index.html before the shell, on the globals every shell script
// has (spirit, document, window.spiritIconIndex, window.spiritApiTreeIndex)
// and nothing inside shell.js. Its root element is the control: it carries
// .value and fires one bubbling `change` when the value is set.

(function () {
  var escapeHtml = spirit.core.util.escapeHtml;

  // A dropdown for choosing one icon out of the ICON pool, offered to
  // apps as api.ui.elements.createIconSelector.
  //
  // `excludeGlyphs` is an array of GLYPHS already spoken for. Glyphs, not
  // keys: what makes two apps collide is the picture they paint, and
  // aliases mean one picture answers to several names — Contacts and
  // Groups both showed 👥 while holding different keys. Striking a name
  // would leave its aliases to carry the collision back in.
  //
  // Every line is the glyph followed by every name it is keyed under
  // ("❌  Delete, Error, No"), which is Andy's format and the reason this
  // is not a native <select>: native type-ahead matches a prefix of the
  // whole option text, and with the glyph in front, the only typeable
  // prefix would have been the emoji. Owning the widget buys a filter
  // that reads every name on every line instead — `del` finds ❌ through
  // an alias that is not even at the head of its line. The cost is that
  // arrow keys, Enter, Escape and click-outside are ours now.
  //
  // The value is the GLYPH, not the key, because the one consumer today
  // is setAppOverride, which stores a literal glyph in
  // preferences.appOverrides. Anything that ever writes a MANIFEST needs
  // a key instead (kernel.js resolves manifest icons through ICON[...]) —
  // that is what iconIndex.keyFor is for.
  //
  // The root element is the control: it carries .value, it fires a
  // bubbling `change` when a row is picked, and the caller may set an id
  // and data-* on it. So a panel that used to delegate on an <input> keeps
  // working with no change to its handler.
  function createIconSelector(excludeGlyphs, options) {
    options = options || {};
    var iconIndex = window.spiritIconIndex;
    var choices = iconIndex.choices(spirit.core.const.ICON, excludeGlyphs);

    var root = document.createElement('div');
    root.className = 'icon-selector';

    var value = options.value || '';
    var activeIndex = -1;
    var visible = choices;

    // The current glyph is shown even when it is not on the list — a
    // shipped default need not be an ICON member (Relay Chat's manifest
    // carries a literal ☀️ that resolves to 📄), and a field that blanked
    // itself rather than showing what is actually set would be lying.
    function labelFor(glyph) {
      var found = choices.filter(function (c) { return c.glyph === glyph; })[0];
      return found ? found.label : '';
    }

    function paintField() {
      field.innerHTML =
        '<span class="icon-selector-glyph">' + escapeHtml(value) + '</span>' +
        '<span class="icon-selector-name">' + escapeHtml(labelFor(value)) + '</span>' +
        '<span class="icon-selector-caret">' + escapeHtml(spirit.core.const.ICON.POINTDOWN) + '</span>';
    }

    function paintRows() {
      visible = choices.filter(function (c) { return iconIndex.matches(c, filter.value); });
      rows.innerHTML = visible.map(function (c, i) {
        return '<button type="button" class="icon-selector-row' +
          (i === activeIndex ? ' is-active' : '') +
          '" data-glyph="' + escapeHtml(c.glyph) + '">' +
          '<span class="icon-selector-glyph">' + escapeHtml(c.glyph) + '</span>' +
          '<span class="icon-selector-name">' + escapeHtml(c.label) + '</span>' +
          '</button>';
      }).join('') || '<div class="job-log-empty">no icon answers to that</div>';
    }

    var field = document.createElement('button');
    field.type = 'button';
    field.className = 'icon-selector-field';

    var list = document.createElement('div');
    list.className = 'icon-selector-list';
    list.hidden = true;

    var filter = document.createElement('input');
    filter.type = 'text';
    filter.className = 'icon-selector-filter';
    filter.placeholder = 'type a name — delete, folder, arrow';

    var rows = document.createElement('div');
    rows.className = 'icon-selector-rows';

    list.appendChild(filter);
    list.appendChild(rows);
    root.appendChild(field);
    root.appendChild(list);

    // Closing on a click anywhere else is the one behaviour that cannot
    // live on this element, so the listener goes on the document and is
    // taken off again the moment the list shuts. A picker that left one
    // behind would keep answering clicks after the panel that made it had
    // been thrown away by the next render.
    function onDocumentClick(event) {
      if (!root.contains(event.target)) close();
    }

    function open() {
      if (!list.hidden) return;
      list.hidden = false;
      root.setAttribute('data-open', '');
      filter.value = '';
      activeIndex = -1;
      paintRows();
      filter.focus();
      document.addEventListener('click', onDocumentClick);
    }

    function close() {
      if (list.hidden) return;
      list.hidden = true;
      root.removeAttribute('data-open');
      document.removeEventListener('click', onDocumentClick);
    }

    function choose(glyph) {
      value = glyph;
      root.value = glyph;
      paintField();
      close();
      // A real bubbling change, so a delegated handler listening on the
      // table above sees exactly what it saw from the <input> this
      // replaced: event.target with .value and the caller's data-*.
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function move(step) {
      if (!visible.length) return;
      activeIndex = (activeIndex + step + visible.length) % visible.length;
      paintRows();
    }

    field.addEventListener('click', function (event) {
      event.stopPropagation(); // or onDocumentClick would shut it in the same click
      if (list.hidden) open(); else close();
    });

    filter.addEventListener('input', function () {
      activeIndex = -1;
      paintRows();
    });

    rows.addEventListener('click', function (event) {
      var row = event.target.closest('[data-glyph]');
      if (row) choose(row.getAttribute('data-glyph'));
    });

    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') { close(); field.focus(); return; }
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); return; }
      if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); return; }
      if (event.key === 'Enter') {
        event.preventDefault();
        // Enter with nothing highlighted takes the only line left, which
        // is what filtering down to one and pressing Enter obviously
        // means. With more than one still showing it means nothing, so it
        // does nothing.
        var pick = activeIndex >= 0 ? visible[activeIndex] : (visible.length === 1 ? visible[0] : null);
        if (pick) choose(pick.glyph);
      }
    });

    root.value = value;
    paintField();
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createIconSelector = createIconSelector;
})();
