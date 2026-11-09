// spirit/run/spirit/app/icons/browserIcons.js
// THE ICONS FACE (goal/G43.19, box v16; Q6: icons gets nodeIcons.js and browserIcons.js, as desk has them). Its contract and
// its test: ./test/icons.md and ./test/icons.js.
//
//   spirit.elements.icons.create(container) -> { destroy() }
//
// The app's own icon set (the box: "the page asks icons through its api branch; only ./nodeIcons.js writes the table, the
// page writes no file of its own"): listed from the icons family's cache (./data.js), which a search fills and every run's
// publish keeps current, so a change on one page shows on every open page with no reload. On top Andy's add row (G41.27:
// "[➕] [an icon:paste] [keywords, comma separated][Add]"); a press on an icon opens it below the add row, its keywords
// edited or the icon removed. It mounts as an app of spirit/app/ does, by the app selector's tile: no old shell's
// activateApp any more (the box: "its tile opens no face").
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all(['spirit/element/search.js', 'spirit/element/search/icon/rowElement.js', 'spirit/element/rowForm.js',
    // Its own cache manager by its own path, beside it: asked by name, a page whose app list has not yet reached icons (or
    // holds it switched off) looks for spirit/icons/data.js, which is no file (wsl's verify, the general rules' page).
    'spirit/element/fieldInput.js', 'spirit/element/icon.js', 'spirit/app/icons/data.js'].map(function (p) { return S.require(p); }));

  function esc(s) { return S.escapeHtml ? S.escapeHtml(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function words(text) { return String(text || '').split(',').map(function (w) { return w.trim(); }).filter(Boolean); }
  // THE ONE VERB (./api.js): the icons branch, bound by its name on what spirit.ready answers (the node finds the folder).
  function icon(args) { return Promise.resolve(S.ready).then(function (s) { return s.icons.icon(args); }); }

  function create(container) {
    var gone = false;
    var list = null;
    container.innerHTML =
      // Its list column takes its pane: the add row fixed on top, what a press said, an opened icon, the list's box the rest.
      '<div data-icons="list" class="fill">' +
        '<div data-icons="form"></div>' +
        '<div data-icons="added" class="job-manifest-note"></div>' +
        '<div data-icons="detail"></div>' +
        '<div data-icons="pane" class="fill"></div>' +
      '</div>';
    function part(n) { return container.querySelector('[data-icons="' + n + '"]'); }
    function say(text) { var s = part('added'); if (s) s.textContent = text; }

    // AN ICON OPENED: its keywords, saved as they change, and Remove (goal/G40.8's detail, in the face's own column). What it
    // shows follows the icons family's cache: a change confirmed there repaints the keywords, the icon gone closes it.
    var closeDetail = function () {};
    function openIcon(glyph) {
      closeDetail();
      var host = part('detail');
      if (!host) return;
      var row = S.data.icons.data.row(glyph) || { glyph: glyph, keywords: [] };
      host.innerHTML =
        '<div class="stat-tile wide"><div class="panel-heading" data-icons="glyph" style="font-size:2em">' + esc(glyph) + '</div>' +
        '<label class="field-label">Keywords <input type="text" data-icons="keywords" value="' + esc((row.keywords || []).join(', ')) + '"></label>' +
        '<button type="button" data-icons="remove">Remove this icon</button> <button type="button" data-icons="close">Close</button>' +
        '<div data-icons="said" class="job-manifest-note"></div></div>';
      var said = host.querySelector('[data-icons="said"]');
      var field = host.querySelector('[data-icons="keywords"]');
      S.element.fieldInput.attach(field, 'description');
      var off = S.data.icons.data.watch(function (g, v) {
        if (g !== glyph) return;
        if (!v) { closeDetail(); return; }
        if (document.activeElement !== field) field.value = (v.keywords || []).join(', ');
      });
      closeDetail = function () { if (typeof off === 'function') off(); off = null; host.innerHTML = ''; closeDetail = function () {}; };
      field.addEventListener('change', function () {
        icon({ op: 'set', glyph: glyph, keywords: words(field.value) }).then(function (r) { said.textContent = r && r.changed ? 'saved' : 'not saved'; },
          function (e) { said.textContent = 'not saved: ' + ((e && e.message) || e); });
      });
      host.querySelector('[data-icons="remove"]').addEventListener('click', function () {
        icon({ op: 'delete', glyph: glyph }).then(function (r) { if (r && r.deleted) closeDetail(); else said.textContent = 'not removed'; },
          function (e) { said.textContent = 'not removed: ' + ((e && e.message) || e); });
      });
      host.querySelector('[data-icons="close"]').addEventListener('click', function () { closeDetail(); });
    }

    parts.then(function () {
      if (gone) return;
      var E = S.element;
      // THE ADD ROW IS A ROWFORM (goal/G41.27; Andy: "icons app:\n[➕] [an icon:paste] [keywords, comma separated][Add]").
      var form = E.rowForm.create(part('form'), { icon: '➕', button: 'Add' });
      form.span.innerHTML =
        '<input type="text" data-icons="new-glyph" placeholder="an icon (paste it)" style="width:8em">' +
        '<input type="text" data-icons="new-keywords" placeholder="keywords, comma separated" style="flex:1">';
      form.button.setAttribute('data-icons', 'add');
      form.button.addEventListener('click', add);
      // The keywords to the description rule, the glyph to the glyph rule (goal/G41.27; Andy: "icon text follows description
      // rules.", "glyph field rule: max 1 char/glyph, 8-bytes maximum.").
      E.fieldInput.attach(part('new-keywords') || container.querySelector('[data-icons="new-keywords"]'), 'description');
      E.fieldInput.attach(container.querySelector('[data-icons="new-glyph"]'), 'glyph');
      list = E.search.create(part('pane'), {
        // Its own data source: icon.search on its branch, the rows seated into the icons family's cache it is a view of.
        search: function (args) {
          return icon({ op: 'search', text: String((args && args.text) || '') }).then(function (b) {
            return { status: 200, body: { ok: true, items: (b && b.items) || [], more: !!(b && b.more) } };
          }, function (e) { return { status: (e && e.status) || 500, body: { ok: false, error: String((e && e.message) || e) } }; });
        },
        data: S.data.icons.data.branch,
        server: 'icons',
        verb: 'icon',
        face: 'pane',
        placeholder: 'choose an icon…',
        args: function (text) { return { text: text }; },
        name: function (row) { return String(row.glyph || '') + ' ' + String((row.keywords || [])[0] || ''); },
        columns: [{ field: 'glyph', label: '' }, { field: 'keywords', label: 'Keywords' }],
        element: function (row, key) { return E.search.icon.rowElement.create(Object.assign({ glyph: key }, row)); },
        details: function (row, key) { openIcon(String(key || (row && row.glyph) || '')); },
        empty: 'No icon matches.',
      });
      list.refresh();
    }, function () { if (part('pane')) part('pane').textContent = 'Icons could not be loaded.'; });

    function add() {
      var glyph = String((container.querySelector('[data-icons="new-glyph"]') || {}).value || '').trim();
      var kw = words((container.querySelector('[data-icons="new-keywords"]') || {}).value);
      if (!glyph) { say('paste an icon first'); return; }
      if (!S.element.fieldInput.fits(kw.join(', '), 'description')) { say('too many keywords'); return; }
      icon({ op: 'add', glyph: glyph, keywords: kw }).then(function (r) {
        if (gone) return;
        // A DUPLICATE IS REFUSED (Andy: "the icon app allowed me to add a duplicate icon.... that shouldn't work"), AND IT OPENS
        // THAT ICON (goal/G40.5; Andy: "if add icon cannot add because the icon already exists, the open the edit dialog for
        // the existing icon."): nothing is written.
        if (r && r.added === false) { say(r.known + ' is in the set already: opened it'); openIcon(r.known); return; }
        say(r && r.added ? 'added ' + glyph : 'not added');
      }, function (e) { say('not added: ' + ((e && e.message) || e)); });
    }

    return {
      destroy: function () {
        gone = true;
        closeDetail();
        if (list && typeof list.destroy === 'function') list.destroy();
        container.innerHTML = '';
      },
    };
  }

  S.elements = S.elements || {};
  S.elements.icons = { create: create };
}());
