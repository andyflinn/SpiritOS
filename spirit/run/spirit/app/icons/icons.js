// Icons (goal/G30.21): this app's own icon set, relay-state/shell/icons/iconSet.json (below), each key a glyph (the icon itself,
// never a key into a table) and its value the keywords it is found by. A mountable wrapper over the icons list
// (spirit/element/search/icon/listElement.js) as a pane. A press opens the icon: its keywords edited, or the icon removed; a glyph
// added at the top. Every change writes the whole set at once (fs.save), and every icons list on the page reads it
// again from the Files cache's word that it changed.
//
// Its sidecar, ./icons.json, carries no intrinsic mark, so the app is switched like any other; the set it writes is data,
// out of git, and stays writable (box v22). It still mounts through spirit.shell.activateApp, the old shell's way, and
// registers no spirit.elements.icons.

var iconsList = null;
// WHERE THE SET LIVES (goal/G40.8; Andy: "all shell-app state data should go into spirit/run/relay-state/shell/<appname>/
// analogous to the process user-data. this way my icon editing doesn't constantly push into github"): the owner's own
// set in relay-state/shell/icons/, out of git; until he has one, an Add starts from the system set spirit/iconSet.json, which
// only he updates by hand (goal/G43.11). What the list shows is the system set: "then we worry about the icon app later."
var ICON_SET = 'relay-state/shell/icons/iconSet.json';
var SYSTEM_SET = 'spirit/iconSet.json';

function iconsEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function iconsWords(text) { return String(text || '').split(',').map(function (w) { return w.trim(); }).filter(Boolean); }
// The same picture under another spelling: the variation selectors (U+FE0E, U+FE0F) are invisible, so a glyph pasted
// with or without one is the same icon.
function iconsSame(a, b) { var strip = function (g) { return String(g || '').replace(/[︎️]/g, ''); }; return strip(a) === strip(b); }

// The set as it stands, changed by fn, written whole.
function iconsChange(api, fn, said) {
  // Through the spirit object (goal/G32.2).
  return spirit.ready.then(function (s) { return s.fs.loadFile(ICON_SET).then(function (own) { return own != null ? own : s.fs.loadFile(SYSTEM_SET); }); }).then(function (text) {
    var set = {};
    try { set = JSON.parse(text || '{}'); } catch (e) { set = {}; }
    // fn answers a refusal (a sentence) when nothing is to change; the set is then not written.
    var no = fn(set);
    if (typeof no === 'string') return { refused: no };
    return spirit.ready.then(function (s) { return s.fs.saveFile(ICON_SET, JSON.stringify(set, null, 2) + '\n'); });
  }).then(function (r) {
    if (r && r.refused) { if (said) said.textContent = r.refused; return false; }
    var ok = !!(r && r.ok);
    if (said) said.textContent = ok ? 'saved' : 'not saved: ' + ((r && r.reason) || 'no answer');
    if (ok && iconsList) iconsList.reload();
    return ok;
  }, function (e) { if (said) said.textContent = 'not saved: ' + ((e && e.message) || e); return false; });
}

// THE ICON DETAIL IS A PAGE (goal/G40.8; Andy: "the icons app simple uses the navigationWrapper for it's details pane"):
// pushed on the navigation, its glyph the title, back the frame's; no back row of its own. It knows its row and saves to
// the server; the file's change comes back through the file tree, and the list fetches the set again.
function iconsPanel(api, row, glyph) {
  window.spirit.elements.navigation.push({ title: glyph, mount: function (host, page) { iconsPanelDraw(host, page, api, row, glyph); } });
}
function iconsPanelDraw(host, page, api, row, glyph) {
  host.innerHTML =
    '<div class="stat-tile wide"><div class="panel-heading" data-icons="glyph" style="font-size:2em">' + iconsEsc(glyph) + '</div>' +
    '<label class="field-label">Keywords <input type="text" data-icons="keywords" value="' + iconsEsc((row.keywords || []).join(', ')) + '"></label>' +
    '<button type="button" data-icons="remove">Remove this icon</button>' +
    '<div data-icons="said" class="job-manifest-note"></div></div>';
  var said = host.querySelector('[data-icons="said"]');
  // THE ICON IT OPENS IS THE ICON ELEMENT (goal/G41.23; Andy: "this element will replace icons painting all shell
  // elements and apps."): the glyph written as text until spirit/element/icon.js is here, then made the element in its place.
  iconsParts.then(function () {
    var heading = host.querySelector('[data-icons="glyph"]');
    var I = window.spirit.element.icon;
    if (!heading || !I || heading.querySelector('.shell-icon')) return;
    heading.textContent = '';
    I.create(heading, { glyph: glyph });
  }, function () { /* the glyph stays text */ });
  function back() { page.close(); }
  // WHAT IT CHANGES, IT FOLLOWS IN spirit.data (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when it
  // changes shit it listens to fucking update via the spirit object"): the icon's row in the icon set the fs family's
  // cache keeps (spirit.data.fs.data.icons). A save confirmed there repaints the keywords, unless they are being typed; the
  // row gone, the page closes. It lets go once the page has left.
  var F = ((window.spirit.data || {}).fs || {}).data;
  var off = F ? F.icons.watch(glyph, function (v) {
    if (!host.isConnected) { if (typeof off === 'function') off(); return; }
    if (!v) { back(); return; }
    var field = host.querySelector('[data-icons="keywords"]');
    if (field && document.activeElement !== field) field.value = (v.keywords || []).join(', ');
  }) : null;
  // Saved as the field changes, no Save button (as the Apps panel).
  // The keywords stop at their limit as they are typed (spirit/element/fieldInput.js), the description rule (goal/G41.27; Andy:
  // "icon text follows description rules.").
  window.spirit.element.fieldInput.attach(host.querySelector('[data-icons="keywords"]'), 'description');
  host.querySelector('[data-icons="keywords"]').addEventListener('change', function (e) {
    var words = iconsWords(e.target.value);
    iconsChange(api, function (set) { set[glyph] = words; }, said);
  });
  host.querySelector('[data-icons="remove"]').addEventListener('click', function () {
    iconsChange(api, function (set) { delete set[glyph]; }, said).then(function (ok) { if (ok) back(); });
  });
}

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3; Andy: every app bootstraps its own components, "lazy-load, is a tree...."):
// through spirit.require, each element bringing its own.
var iconsParts = Promise.all(['spirit/element/search/icon/listElement.js', 'spirit/element/fieldInput.js', 'spirit/element/icon.js', 'spirit/element/rowForm.js'].map(function (p) { return spirit.require(p); }));

spirit.shell.activateApp({
  mount: function (container, api) {
    var E = window.spirit.element;
    container.innerHTML =
      // Its list column takes its pane: the add row fixed on top, the list's box the rest (goal/G40.8).
      '<div data-icons="list" class="fill">' +
        '<div data-icons="form"></div>' +
        '<div data-icons="added" class="job-manifest-note"></div>' +
        '<div data-icons="pane" class="fill"></div>' +
      '</div>';
    var drawn = iconsParts.then(function () {
      E = window.spirit.element;
      // THE ADD ROW IS A ROWFORM (goal/G41.27; Andy: "icons app:\n[➕] [an icon:paste] [keywords, comma separated][Add]"):
      // ➕, the icon to paste and its keywords in its span, Add its button; what Add did is said below it.
      var form = E.rowForm.create(container.querySelector('[data-icons="form"]'), { icon: '➕', button: 'Add' });
      form.span.innerHTML =
        '<input type="text" data-icons="new-glyph" placeholder="an icon (paste it)" style="width:8em">' +
        '<input type="text" data-icons="new-keywords" placeholder="keywords, comma separated" style="flex:1">';
      form.button.setAttribute('data-icons', 'add');
      form.button.addEventListener('click', add);
      // The keywords to the description rule, the glyph to the glyph rule: one glyph of at most 8 bytes (goal/G41.27; Andy:
      // "icon text follows description rules.", "glyph field rule: max 1 char/glyph, 8-bytes maximum.").
      E.fieldInput.attach(container.querySelector('[data-icons="new-keywords"]'), 'description');
      E.fieldInput.attach(container.querySelector('[data-icons="new-glyph"]'), 'glyph');
      iconsList = E.search.icon.listElement.create(container.querySelector('[data-icons="pane"]'), {
        api: api,
        face: 'pane',
        details: function (row, glyph) { iconsPanel(api, row, glyph); },
      });
    }, function () { container.querySelector('[data-icons="pane"]').textContent = 'Icons could not be loaded.'; });
    function add() {
      var glyph = String(container.querySelector('[data-icons="new-glyph"]').value || '').trim();
      var words = iconsWords(container.querySelector('[data-icons="new-keywords"]').value);
      if (!window.spirit.element.fieldInput.fits(words.join(', '), 'description')) { container.querySelector('[data-icons="added"]').textContent = 'too many keywords'; return; }
      var said = container.querySelector('[data-icons="added"]');
      if (!glyph) { said.textContent = 'paste an icon first'; return; }
      // A DUPLICATE IS REFUSED (Andy: "the icon app allowed me to add a duplicate icon.... that shouldn't work"): an
      // icon already in the set, under any spelling, is changed from its own row, never added again.
      iconsChange(api, function (set) {
        var known = Object.keys(set).filter(function (g) { return iconsSame(g, glyph); })[0];
        // AND IT OPENS THAT ICON (goal/G40.5; Andy: "if add icon cannot add because the icon already exists, the open
        // the edit dialog for the existing icon."): its edit view, with the keywords it has; nothing is written.
        if (known) {
          iconsPanel(api, { keywords: set[known] || [] }, known);
          return known + ' is in the set already: opened it';
        }
        set[glyph] = words;
      }, said);
    }
    return drawn;
  },

  render: function () {},
});
