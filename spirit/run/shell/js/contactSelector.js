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

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createContactSelector = createContactSelector;
})();
