// spirit/run/shell/js/contactLabel.js
// ONE SHELL ELEMENT: the contact label, a contact's name by key.
//
//   Andy, 2026-10-02 (goal/G2.14): "i can guarantee you: there will be many" —
//   so one file per element, each adding itself to window.spiritElements,
//   which the shell hands to apps at mount as api.ui.elements.
//
// ── WHAT IT SHOWS IS THE NODE'S, NOT ITS OWN (goal/G4.13) ─────────────
//
// The caption the contact book gives a key: your own name for them if you
// set one, theirs otherwise, the key's tail where two read alike (hub.js,
// contactLabel). It names no rule of its own; given no caption it asks
// contact.get for it.
//
//   Andy, 2026-10-03: "the element has two modes, and it follows the style
//   of its container / 1. display only, for insertion in a text flow, or
//   labeling in a table, etc... it cannot be clicked on or modified. / 2. in
//   headings for panes and dialogs dedicated to that peer, when clicked, it
//   offers a text input with label-constraints which updates, if return is
//   hit on the keyboard, and the string is not empty."
//   Andy: "the label listens to changes in both modes."
//
// Mode 2 checks what is typed with js/fieldRules.js before it asks; the
// node checks again (contact.label, goal/G4.16). Every label hears a
// rename from anywhere: the node writes contact.rename {key, caption} on
// its stream and the shell says it once on document (js/client/shell.js,
// onContactRename) — the node owns that event (Andy: "so node owns
// contact.rename").

(function () {
  // ONE NAME PER KEY FOR THE PAGE (Andy, goal/G4.10: "the pane and dropdown seem to still initialize with keys. this
  // makes the keys flashing briefly every time an update occurs"). A list redrawn makes new labels; a name already
  // known draws at once, and one key is asked of the node once, however many labels wait for it.
  var known = Object.create(null);
  var asking = Object.create(null);
  function nameFor(key) {
    if (!asking[key]) {
      asking[key] = spirit.core.ask('contact.get', { key: key }).then(function (a) {
        var person = a && a.body && a.body.person;
        if (person && typeof person.caption === 'string') known[key] = person.caption;
        return known[key] || '';
      }, function () { return ''; }).then(function (name) { delete asking[key]; return name; });
    }
    return asking[key];
  }

  function createContactLabel(options) {
    options = options || {};
    var key = String(options.key || '');
    var editable = options.editable === true;
    var caption = typeof options.caption === 'string' ? options.caption : '';
    if (caption) known[key] = caption;
    else if (known[key]) caption = known[key];
    // Unknown and not yet asked: blank, never the key, until the book answers (the key shows only if it cannot).
    var unanswered = !caption;
    var editing = null;

    // A span, and nothing set on its font or colour: it takes the style of
    // its container, in a sentence, a table cell or a heading alike.
    var root = document.createElement('span');
    root.className = 'contact-label' + (editable ? ' contact-label-editable' : '') +
      (options.className ? ' ' + options.className : '');
    var text = document.createElement('span');
    text.className = 'contact-label-text';
    root.appendChild(text);
    var why = document.createElement('span');
    why.className = 'contact-label-error';
    root.appendChild(why);

    function draw() {
      text.textContent = caption || (unanswered ? '' : key);
    }

    function close() {
      if (!editing) return;
      if (editing.parentNode) editing.parentNode.removeChild(editing);
      editing = null;
      text.hidden = false;
      why.textContent = '';
    }

    function save(typed) {
      var name = String(typed || '').trim();
      if (!name) return;
      var rule = window.spiritFieldRules || null;
      var bad = rule ? rule.problem(name) : '';
      if (bad) { why.textContent = bad; return; }
      spirit.core.ask('contact.label', { publicKey: key, myLabel: name }).then(function (a) {
        if (!a || a.status !== 200) {
          why.textContent = (a && a.body && (a.body.error || a.body.message)) || 'not renamed';
          return;
        }
        caption = (a.body && typeof a.body.caption === 'string') ? a.body.caption : name;
        known[key] = caption;
        close();
        draw();
      }, function () { why.textContent = 'not renamed'; });
    }

    function open() {
      if (editing) return;
      editing = document.createElement('input');
      editing.type = 'text';
      editing.className = 'contact-label-input';
      editing.value = caption;
      editing.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          if (event.preventDefault) event.preventDefault();
          save(editing.value);
        } else if (event.key === 'Escape') {
          close();
        }
      });
      // A click in the box is typing, not a second open.
      editing.addEventListener('click', function (event) { if (event.stopPropagation) event.stopPropagation(); });
      text.hidden = true;
      root.insertBefore ? root.insertBefore(editing, why) : root.appendChild(editing);
      if (editing.focus) editing.focus();
      if (editing.select) editing.select();
    }

    if (editable) root.addEventListener('click', open);

    // Both modes listen. A label that was on a page and has left it lets go
    // of document the first time a rename reaches it; one made but not yet
    // placed (a row before its list is appended) keeps listening.
    var placed = false;
    function onRename(event) {
      if (root.isConnected === true) placed = true;
      else if (root.isConnected === false && placed) {
        document.removeEventListener('contact.rename', onRename);
        return;
      }
      var d = (event && event.detail) || {};
      if (d.key !== key || typeof d.caption !== 'string') return;
      known[key] = d.caption;
      caption = d.caption;
      draw();
    }
    document.addEventListener('contact.rename', onRename);

    draw();
    if (!caption && key) {
      nameFor(key).then(function (name) {
        unanswered = false;
        if (!caption) caption = name;
        draw();
      });
    }
    return root;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.createContactLabel = createContactLabel;
})();
