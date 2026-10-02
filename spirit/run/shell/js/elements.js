// spirit/run/shell/js/elements.js
// THE SHELL'S ELEMENT FACTORIES — what an app builds its screen from.
//
//   Andy, 2026-10-02 (goal/G2.12): "i want them to be available in the
//   interface object that the shell passes to apps, as tools to build their
//   interfaces, as element-factories.", and "the shell-elements are better
//   of being in 'spirit/run/shell/js/' since they should be
//   UI-component-factories supplied in the interface passed to shell-apps
//   during mount."
//
// They stood inside the shell program (js/client/shell.js) and are here
// now, beside the apps that use them. An app never loads this file: the
// shell hands the four out at mount as api.ui.elements, exactly as before.
//
// LOADED BY index.html BEFORE THE SHELL, on the globals every shell script
// has and nothing else: `spirit` (kernel.js), `document`,
// window.spiritIconIndex and window.spiritApiTreeIndex. Nothing here reaches
// into shell.js, so the shell program can change without this file knowing.
// It asks the node the way everything does, spirit.core.ask.
//
// Each factory answers ONE ELEMENT THAT IS THE CONTROL: its root carries
// .value, fires a bubbling `change` when the value is set, and takes the
// caller's id and data-* — so a panel that delegates on `change` keeps
// working across repaints.

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

  // ── THE CONTACT SELECTOR (apiAuth/G1.7) ────────────────────────────
  //
  //   Andy: "the other dropdown selector uses in the app will be the
  //   shell-element called contactSelector", "these all will be
  //   shell-elements invisible to the user on the shell surface."
  //
  // A contact is its KEY (contacts.js): root.value is the chosen key, and
  // root.row the whole row chosen (a caller's own rows may carry more,
  // natterDetails' relay URL among them). Rows come from the node's
  // bounded search, contact.search, never a list of everybody; a caller
  // that already holds its rows hands them in as options.contacts
  // [{ key, label }]. The root fires a bubbling `change` once value is set,
  // so a panel that delegates `change` keeps working across repaints.
  function createContactSelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'contact-selector' + (options.className ? ' ' + options.className : '');
    var select = document.createElement('select');
    root.appendChild(select);
    var rows = [];
    root.value = '';
    root.row = null;

    function paint(list) {
      rows = (list || []).filter(function (r) { return r && r.key; });
      select.innerHTML = '<option value="">' + escapeHtml(options.placeholder || 'choose a contact…') + '</option>' +
        rows.map(function (r, i) { return '<option value="' + i + '">' + escapeHtml(r.label || r.key) + '</option>'; }).join('');
    }
    select.addEventListener('change', function (event) {
      // The root speaks for the element: its own change, once value is set.
      if (event.stopPropagation) event.stopPropagation();
      var r = rows[Number(select.value)];
      root.value = r && select.value !== '' ? r.key : '';
      root.row = r && select.value !== '' ? r : null;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    });

    if (Array.isArray(options.contacts)) paint(options.contacts);
    else {
      paint([]);
      spirit.core.ask('contact.search', { q: String(options.query || '') }).then(function (a) {
        var items = (a && a.body && a.body.items) || [];
        paint(items.map(function (it) { return { key: it.key, label: it.label }; }));
      }, function () { /* the empty choice stays; the node says why elsewhere */ });
    }
    return root;
  }

  // ── THE APPSERVER SELECTOR (apiAuth/G1.8) ──────────────────────────
  //
  //   Andy: "the appServer selector (a subComponent of the api-path
  //   selector)", and the tree it reads: "the shell's api tree is a
  //   straight copy of the node's owner-api-tree ?" — "yes". So it fills
  //   itself from the node verb jobs.api with ask 'api', and lists
  //   spiritApiTreeIndex.servers(tree): sorted, a server that did not
  //   answer left out (apiTreeIndex.js decides; this paints).
  //
  // root.value is the chosen server's name; root.tree the 'api' answer
  // it was painted from, so the api-branch selector (G1.9) can read one
  // server's verbs without asking again. The root fires a bubbling
  // `change` once value is set, as the other selectors do.
  function createAppServerSelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'app-server-selector' + (options.className ? ' ' + options.className : '');
    var select = document.createElement('select');
    root.appendChild(select);
    root.value = '';
    root.tree = null;

    function paint(names) {
      select.innerHTML = '<option value="">' + escapeHtml(options.placeholder || 'choose a server…') + '</option>' +
        names.map(function (name) { return '<option value="' + escapeHtml(name) + '">' + escapeHtml(name) + '</option>'; }).join('');
    }
    paint([]);
    select.addEventListener('change', function (event) {
      // The root speaks for the element: its own change, once value is set.
      if (event.stopPropagation) event.stopPropagation();
      root.value = select.value || '';
      root.dispatchEvent(new Event('change', { bubbles: true }));
    });

    spirit.core.ask('jobs.api', { ask: 'api' }).then(function (a) {
      root.tree = (a && a.body) || null;
      paint(window.spiritApiTreeIndex.servers(root.tree));
    }, function () { /* the empty choice stays; the node says why elsewhere */ });
    return root;
  }

  // ── THE API-BRANCH SELECTOR (apiAuth/G1.9) ─────────────────────────
  //
  //   Andy: "api-graph-selector [appServer-dropdown] [verb-dropdown] the
  //   verb-dropdown selection chances automatically depending on the
  //   selection in the appServer-dropdown", and "the verb dropdown will have
  //   an option ( ** all verbs **)".
  //
  // The appServer selector (G1.8) inside it; the verbs of the chosen server
  // from spiritApiTreeIndex.verbs, refilled when the server changes. root.value
  // is the PATH a grant takes: 'app' when all verbs is chosen, 'app.verb'
  // otherwise, '' until both are chosen. It fires a bubbling change once set.
  function createApiBranchSelector(options) {
    options = options || {};
    var root = document.createElement('div');
    root.className = 'api-branch-selector' + (options.className ? ' ' + options.className : '');
    var servers = createAppServerSelector({ placeholder: options.serverPlaceholder });
    var verbSelect = document.createElement('select');
    root.appendChild(servers);
    root.appendChild(verbSelect);
    root.value = '';
    var ALL = '** all verbs **';

    function paintVerbs() {
      var server = servers.value;
      var verbs = server ? window.spiritApiTreeIndex.verbs(servers.tree, server) : [];
      verbSelect.innerHTML = server
        ? '<option value="">choose a verb…</option><option value="*">' + escapeHtml('( ' + ALL + ' )') + '</option>' +
          verbs.map(function (v) { return '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + '</option>'; }).join('')
        : '<option value="">choose a server first</option>';
    }
    function settle() {
      var server = servers.value;
      var verb = verbSelect.value;
      root.value = !server || !verb ? '' : verb === '*' ? server : server + '.' + verb;
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // The inner elements' changes stop here; the root speaks for the whole.
    servers.addEventListener('change', function (event) {
      if (event.stopPropagation) event.stopPropagation();
      paintVerbs();
      settle();
    });
    verbSelect.addEventListener('change', function (event) {
      if (event.stopPropagation) event.stopPropagation();
      settle();
    });
    paintVerbs();
    return root;
  }

  window.spiritElements = {
    createIconSelector: createIconSelector,
    createContactSelector: createContactSelector,
    createAppServerSelector: createAppServerSelector,
    createApiBranchSelector: createApiBranchSelector,
  };
})();
