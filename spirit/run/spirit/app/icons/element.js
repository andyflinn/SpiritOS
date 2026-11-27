'use strict';
// THE BRANCHES IT READS, AS spirit.requireScript HANDS THEM BACK (goal/G49.23, box v22 Part 1: "an element reads a branch's rows from
// the branch spirit.requireScript hands back; it asks for no client"): each kept once loaded, its rows on it, a new-shape branch's
// as client, an old-shape branch's as data.
var KEPT_BRANCHES = {};
if (typeof window !== 'undefined' && window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/app/icons/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).then(function (b) { KEPT_BRANCHES[p] = b || null; }, function () { /* not there: no rows */ }); });
// A new-shape branch carries its rows as client, an old-shape one as data.
function keptRows(p) { var b = KEPT_BRANCHES[p]; return b ? b.client || b.data || null : null; }
// spirit/run/spirit/app/icons/element.js
// THE ICONS FACE (goal/G43.19, box v16; Q6: icons gets icons/server/server.js and browserIcons.js, as desk has them). Its contract and
// its test: ./test/icons.md and ./test/icons.js.
//
//   spirit.required.spirit.app.icons.icons.create(container, { open }) -> { destroy() }; also spirit.elements.iconsFace, which icons.js's
//   stand-in calls while it waited for this file
//
// The app's own icon set (the box: "the page asks icons through its api branch; only ./server/server.js writes the table, the
// page writes no file of its own"): listed from the icons family's cache (./data.js), which a search fills and every run's
// publish keeps current, so a change on one page shows on every open page with no reload. On top Andy's add row (G41.27:
// "[➕] [an icon:paste] [keywords, comma separated][Add]"); a press on an icon opens it OVER THE APP (Andy: "the icon detail
// panel is supposed to open overtop of the icon app..... like contact detail etc..."), in the stack the mounter hands (the
// app selector's open, its ✕ back to the list) or in one of its own, its keywords edited or the icon removed. It mounts as an app of spirit/app/ does, by the app selector's tile: no old shell's
// activateApp any more (the box: "its tile opens no face").
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/fieldInput/script.js');
  // ITS FIELDS' TYPES, REQUIRED HERE BY THEIR FULL PATHS (goal/G49.13; Andy: "The UI elements need to know which spirit/type
  // their fields are and require that type"): the types fieldInput holds its fields to.
  if (window.spirit && typeof window.spirit.requireScript === 'function') { window.spirit.requireScript('spirit/type/string/description/script.js'); window.spirit.requireScript('spirit/type/string/glyph/script.js'); }
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/armingButton/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/panel/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/rowForm/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/icon/row/script.js');
  // ITS APP'S INTERFACE AND DATA, IT LOADS ITSELF (goal/G47.1, box v142: "all of testicle's elements must subscribe to the
  // data they display", and spirit/test/app-child-browser.js for every element under spirit/app/; rule/26): icons's api.js and its
  // cache manager, data.js, which the page's one stream feeds; mounted alone, on a page nothing else loaded them on, it has them.
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(window.spirit.requireScript('spirit/app/icons/api.js')).catch(function () {});
  if (window.spirit && typeof window.spirit.requireScript === 'function') Promise.resolve(window.spirit.requireScript('spirit/app/icons/api.js')).catch(function () {});
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26).
  var parts = Promise.all(['spirit/element/search/script.js', 'spirit/element/search/icon/row/script.js', 'spirit/element/rowForm/script.js',
    // Its own cache manager by its own path, beside it: asked by name, a page whose app list has not yet reached icons (or
    // holds it switched off) looks for spirit/icons/data.js, which is no file (wsl's verify, the general rules' page).
    'spirit/element/fieldInput/script.js', 'spirit/element/icon/script.js', 'spirit/element/panel/script.js', 'spirit/element/armingButton/script.js', 'spirit/app/icons/data.js'].map(function (p) { return S.requireScript(p); }));

  function esc(s) { return S.escapeHtml ? S.escapeHtml(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function words(text) { return String(text || '').split(',').map(function (w) { return w.trim(); }).filter(Boolean); }
  // THE ONE VERB (./api.js): the icons branch, required by its api.js path.
  function icon(args) { return Promise.resolve(S.readyPromise).then(function () { return S.requireScript('spirit/app/icons/api.js'); }).then(function (s) { return s.icon(args); }); }

  function create(container, options) {
    var gone = false;
    var list = null;
    var o = options || {};
    // WHERE AN ICON OPENS (as contact.js): over Icons, in the mounter's stack, or in one of its own over its page.
    var stack = null;
    var openOver = typeof o.open === 'function' ? o.open : function (k, spec) { return stack ? stack.open(k, spec) : Promise.resolve(null); };
    container.innerHTML =
      // Its list column takes its pane: the add row fixed on top, what a press said, an opened icon, the list's box the rest.
      // ITS BOX KEEPS WHAT IT HOLDS INSIDE IT (goal/G47.1, -browser: the box declares overflow not visible).
      '<div data-icons="list" class="fill" style="overflow:hidden">' +
        '<div data-icons="form"></div>' +
        '<div data-icons="added" class="job-manifest-note"></div>' +
        '<div data-icons="pane" class="fill"></div>' +
      '</div>';
    function part(n) { return container.querySelector('[data-icons="' + n + '"]'); }
    function say(text) { var s = part('added'); if (s) s.textContent = text; }

    // AN ICON OPENED, OVER THE APP: its keywords, saved as they change, and Remove (goal/G40.8's detail). What it shows
    // follows the icons family's cache: a change confirmed there repaints the keywords, the icon gone closes its layer.
    function openIcon(glyph) {
      var layer = null;
      Promise.resolve(openOver('icon/' + glyph, { icon: glyph, label: 'Icon', fill: function (host) {
        var row = keptRows('spirit/app/icons/api.js').row(glyph) || { glyph: glyph, keywords: [] };
        host.innerHTML =
          '<div class="stat-tile wide"><div class="panel-heading" data-icons="glyph" style="font-size:2em">' + esc(glyph) + '</div>' +
          '<label class="field-label">Keywords <input type="text" data-icons="keywords" value="' + esc((row.keywords || []).join(', ')) + '"></label>' +
          '<button type="button" data-icons="remove">Remove this icon</button>' +
          '<div data-icons="said" class="job-manifest-note"></div></div>';
        var said = host.querySelector('[data-icons="said"]');
        var field = host.querySelector('[data-icons="keywords"]');
        ANSWER['spirit/element/fieldInput/script.js'].attach(field, 'spirit/type/string/description/script.js');
        var close = function () { if (layer) layer.hide(); };
        var off = keptRows('spirit/app/icons/api.js').watch(function (g, v) {
          if (g !== glyph) return;
          if (!v) { close(); return; }
          if (document.activeElement !== field) field.value = (v.keywords || []).join(', ');
        });
        field.addEventListener('change', function () {
          icon({ op: 'set', glyph: glyph, keywords: JSON.stringify(words(field.value)) }).then(function (r) { said.textContent = r && r.changed ? 'saved' : 'not saved'; },
            function (e) { said.textContent = 'not saved: ' + ((e && e.message) || e); });
        });
        // REMOVE ARMS FIRST (Andy: "icon detail, delete should be an armingButton."): the first press arms it and writes
        // nothing, the second removes the icon, a click elsewhere disarms it (spirit/element/armingButton/script.js).
        ANSWER['spirit/element/armingButton/script.js'].attach(host.querySelector('[data-icons="remove"]'), { label: 'Remove this icon', run: function () {
          icon({ op: 'delete', glyph: glyph }).then(function (r) { if (r && r.deleted) close(); else said.textContent = 'not removed'; },
            function (e) { said.textContent = 'not removed: ' + ((e && e.message) || e); });
        } });
        return { destroy: function () { if (typeof off === 'function') off(); off = null; } };
      } })).then(function (l) { layer = l; });
    }

    parts.then(function () {
      if (gone) return;
      // ITS OWN STACK when the mounter hands none, over its page (as contact.js).
      if (typeof o.open !== 'function') stack = ANSWER['spirit/element/panel/script.js'].create(container, container.firstElementChild);
      // THE ADD ROW IS A ROWFORM (goal/G41.27; Andy: "icons app:\n[➕] [an icon:paste] [keywords, comma separated][Add]").
      // ITS PRESS IS ROWFORM'S (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer comes"):
      // add is handed as press, so Add is busy until the node answers; a listener of its own met a disabled button.
      var form = ANSWER['spirit/element/rowForm/script.js'].create(part('form'), { icon: '➕', button: 'Add', press: add });
      form.span.innerHTML =
        '<input type="text" data-icons="new-glyph" placeholder="an icon (paste it)" style="width:8em">' +
        '<input type="text" data-icons="new-keywords" placeholder="keywords, comma separated" style="flex:1">';
      form.button.setAttribute('data-icons', 'add');
      // The keywords to the description rule, the glyph to the glyph rule (goal/G41.27; Andy: "icon text follows description
      // rules.", "glyph field rule: max 1 char/glyph, 8-bytes maximum.").
      ANSWER['spirit/element/fieldInput/script.js'].attach(part('new-keywords') || container.querySelector('[data-icons="new-keywords"]'), 'spirit/type/string/description/script.js');
      ANSWER['spirit/element/fieldInput/script.js'].attach(container.querySelector('[data-icons="new-glyph"]'), 'spirit/type/string/glyph/script.js');
      list = ANSWER['spirit/element/search/script.js'].create(part('pane'), {
        // Its own data source: icon.search on its branch, the rows seated into the icons family's cache it is a view of.
        search: function (args) {
          return icon({ op: 'search', text: String((args && args.text) || '') }).then(function (b) {
            return { status: 200, body: { ok: true, items: (b && b.items) || [], more: !!(b && b.more) } };
          }, function (e) { return { status: (e && e.status) || 500, body: { ok: false, error: String((e && e.message) || e) } }; });
        },
        data: keptRows('spirit/app/icons/api.js').handle('icons'),
        api: 'spirit/app/icons/api.js',
        verb: 'icon',
        face: 'pane',
        placeholder: 'choose an icon…',
        args: function (text) { return { text: text }; },
        name: function (row) { return String(row.glyph || '') + ' ' + String((row.keywords || [])[0] || ''); },
        columns: [{ field: 'glyph', label: '' }, { field: 'keywords', label: 'Keywords' }],
        element: function (row, key) { return ANSWER['spirit/element/search/icon/row/script.js'].create(Object.assign({ glyph: key }, row)); },
        details: function (row, key) { openIcon(String(key || (row && row.glyph) || '')); },
        empty: 'No icon matches.',
      });
      list.refresh();
    }, function () { if (part('pane')) part('pane').textContent = 'Icons could not be loaded.'; });

    function add() {
      var glyph = String((container.querySelector('[data-icons="new-glyph"]') || {}).value || '').trim();
      var kw = words((container.querySelector('[data-icons="new-keywords"]') || {}).value);
      if (!glyph) { say('paste an icon first'); return; }
      if (!ANSWER['spirit/element/fieldInput/script.js'].fits(kw.join(', '), 'spirit/type/string/description/script.js')) { say('too many keywords'); return; }
      // Its answer is rowForm's to wait for (the button busy until then).
      return icon({ op: 'add', glyph: glyph, keywords: JSON.stringify(kw) }).then(function (r) {
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
        if (stack) { stack.destroy(); stack = null; }
        if (list && typeof list.destroy === 'function') list.destroy();
        container.innerHTML = '';
      },
    };
  }

  // Under both names: icons.js stands spirit.required.spirit.app.icons.icons up at once and waits for this file; once here, the face itself.
  // At its own path (goal/G43.32): icons.js, the app's element, draws through it from there.
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
