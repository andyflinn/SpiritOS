// spirit/run/shell/js/contactSelector.js
// ONE SHELL ELEMENT: the contact selector, a factory apps build their screens with.
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

  // ── THE CONTACT SELECTOR (apiAuth/G1.7), NOW TWO FACES (goal/G4.14) ──
  //
  //   Andy: "the other dropdown selector uses in the app will be the
  //   shell-element called contactSelector", "these all will be
  //   shell-elements invisible to the user on the shell surface."
  //   Andy, 2026-10-03: "dropDown and pane element for the same object type
  //   may share the same element file.js" / "The dropDowns should present
  //   like the panes." / "the dropdown may even use a pane" / "the pane
  //   usually has a \"current\" which is the equivalent of selected in the
  //   drop-box".
  //
  // ONE LIST, TWO FACES. options.face 'pane' is the list itself, always
  // shown; the default face is the same list under a button, shown when
  // the button is pressed and closed by a pick, so the users from before
  // (grants.js, natterDetails.js) change nothing.
  //
  // A contact is its KEY (contacts.js): root.value is the chosen key, and
  // root.row the whole row chosen (a caller's own rows may carry more,
  // natterDetails' relay URL among them). Rows come from a bounded search,
  // never a list of everybody: options.search(text) -> {items: [{key,
  // label}], more}, or the node's contact.search {q} when none is given;
  // a caller that already holds its rows hands them in as options.contacts.
  // Every list is a search with an empty query; nothing pages, a cut answer
  // says so.
  //
  // THE STATUS COLUMN is always there, blank or not (Andy: "the presence
  // is always a column and the status icon is configurable with a little
  // list. [{status,iconKey}, status IconKey], where the first pair is the
  // default and can have no icon."). root.mark(key, status) sets a row's
  // status by name; the element counts nothing and knows no chats.
  //
  // A ROW IS NAMED BY THE CONTACT LABEL ELEMENT (goal/G4.13) when it is
  // loaded, by its label text until then.
  function createContactSelector(options) {
    options = options || {};
    var isPane = options.face === 'pane';
    var ICON = (spirit.core.const && spirit.core.const.ICON) || {};
    var statuses = (Array.isArray(options.statuses) && options.statuses.length)
      ? options.statuses : [{ status: 'none' }];
    var statusOf = {};
    var rows = [];
    var cells = {};
    var asked = 0;

    var root = document.createElement('div');
    root.className = 'contact-selector ' + (isPane ? 'contact-selector-face-pane' : 'contact-selector-face-dropdown') +
      (options.className ? ' ' + options.className : '');
    root.value = '';
    root.row = null;

    var field = null;
    if (!isPane) {
      field = document.createElement('button');
      field.type = 'button';
      field.className = 'contact-selector-field';
      root.appendChild(field);
    }

    var pane = document.createElement('div');
    pane.className = 'contact-selector-pane';
    var box = document.createElement('input');
    box.type = 'text';
    box.className = 'contact-selector-search';
    box.setAttribute('placeholder', options.searchPlaceholder || 'search…');
    var list = document.createElement('div');
    list.className = 'contact-selector-rows';
    var more = document.createElement('div');
    more.className = 'contact-selector-more';
    pane.appendChild(box);
    pane.appendChild(list);
    pane.appendChild(more);
    root.appendChild(pane);

    function glyphFor(key) {
      var want = statusOf[key];
      var pair = statuses.filter(function (s) { return s && s.status === want; })[0] || statuses[0];
      return (pair && pair.iconKey && ICON[pair.iconKey]) || '';
    }

    function paintField() {
      if (!field) return;
      var label = root.row ? ((typeof root.row.label === 'string' && root.row.label) || root.row.key) : (options.placeholder || 'choose a contact…');
      field.innerHTML = '<span class="contact-selector-name">' + escapeHtml(label) + '</span>' +
        '<span class="contact-selector-caret">▾</span>';
    }

    function setOpen(open) {
      if (isPane) return;
      pane.hidden = !open;
      if (open) { box.value = ''; run(''); if (box.focus) box.focus(); }
    }

    function pick(row) {
      root.value = row.key;
      root.row = row;
      rows.forEach(function (r) {
        if (cells[r.key]) cells[r.key].row.className = 'contact-selector-row' + (r.key === root.value ? ' current' : '');
      });
      paintField();
      setOpen(false);
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function paint(answer) {
      rows = ((answer && answer.items) || []).filter(function (r) { return r && r.key; });
      cells = {};
      list.innerHTML = '';
      rows.forEach(function (r) {
        var row = document.createElement('div');
        row.className = 'contact-selector-row' + (r.key === root.value ? ' current' : '');
        row.setAttribute('data-key', r.key);
        var status = document.createElement('span');
        status.className = 'contact-selector-status';
        status.textContent = glyphFor(r.key);
        row.appendChild(status);
        // Only a string is a name: chatter's peers.search hands a whole
        // row as label, which is the caller's to mark, not to show.
        var caption = typeof r.label === 'string' && r.label ? r.label : undefined;
        var make = window.spiritElements && window.spiritElements.createContactLabel;
        if (typeof make === 'function') {
          row.appendChild(make({ key: r.key, caption: caption }));
        } else {
          var name = document.createElement('span');
          name.className = 'contact-selector-label';
          name.textContent = caption || r.key;
          row.appendChild(name);
        }
        // On the row itself, so a click anywhere inside it, the label
        // element included, is a pick of this row.
        row.addEventListener('click', function () { pick(r); });
        list.appendChild(row);
        cells[r.key] = { row: row, status: status };
      });
      more.textContent = (answer && answer.more) ? 'more… type to narrow' : '';
    }

    function searchFor(text) {
      if (typeof options.search === 'function') return Promise.resolve(options.search(text));
      if (Array.isArray(options.contacts)) {
        var t = String(text || '').toLowerCase();
        return Promise.resolve({
          items: options.contacts.filter(function (r) {
            return r && r.key && (!t || String(r.label || '').toLowerCase().indexOf(t) !== -1 || String(r.key).toLowerCase().indexOf(t) !== -1);
          }),
          more: false,
        });
      }
      return spirit.core.ask('contact.search', { q: String(text || '') }).then(function (a) {
        var body = (a && a.body) || {};
        return { items: (body.items || []).map(function (it) { return { key: it.key, label: it.label }; }), more: !!body.more };
      });
    }

    // The newest ask wins: an answer to text since retyped is dropped.
    function run(text) {
      var mine = ++asked;
      searchFor(text).then(function (answer) { if (mine === asked) paint(answer); },
        function () { /* the list stays as it was; the node says why elsewhere */ });
    }

    box.addEventListener('input', function () { run(box.value); });
    // The root speaks for the element: the search box's own change is not
    // a pick, so it goes no further than here.
    box.addEventListener('change', function (event) { if (event.stopPropagation) event.stopPropagation(); });

    if (field) {
      field.addEventListener('click', function () { setOpen(pane.hidden); });
      document.addEventListener('click', function (event) {
        if (!pane.hidden && event && event.target && root.contains && !root.contains(event.target)) setOpen(false);
      });
    }

    // Ask the same search again, with what is typed: for a caller whose
    // rows changed under it (chatter, when a line arrives).
    root.refresh = function () { run(box.value); };

    root.mark = function (key, status) {
      statusOf[key] = status;
      if (cells[key]) cells[key].status.textContent = glyphFor(key);
    };

    paintField();
    if (!isPane) pane.hidden = true;
    run(String(options.query || ''));
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createContactSelector = createContactSelector;
})();
