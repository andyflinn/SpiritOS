// Icons (goal/G30.21): the icon set this node's face uses, shell/icons/iconSet.json, each key a glyph (the icon itself,
// never a key into a table) and its value the keywords it is found by. A mountable wrapper over the icons list
// (shell/js/icons/listElement.js) as a pane. A press opens the icon: its keywords edited, or the icon removed; a glyph
// added at the top. Every change writes the whole set at once (fs.save), and every icons list on the page reads it
// again from the Files cache's word that it changed.
//
// Intrinsic: its code is core by the intrinsic mark in its sidecar's face part; the set beside it is data and stays
// writable (box v22).

var iconsList = null;
var ICON_SET = 'shell/icons/iconSet.json';

function iconsEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function iconsWords(text) { return String(text || '').split(',').map(function (w) { return w.trim(); }).filter(Boolean); }

// The set as it stands, changed by fn, written whole.
function iconsChange(api, fn, said) {
  return Promise.resolve(api.verb('fs.load', { path: ICON_SET })).then(function (r) {
    var set = {};
    try { set = JSON.parse((r && r.body && r.body.text) || '{}'); } catch (e) { set = {}; }
    fn(set);
    return Promise.resolve(api.verb('fs.save', { path: ICON_SET, content: JSON.stringify(set, null, 2) + '\n' }));
  }).then(function (r) {
    var ok = r && r.status >= 200 && r.status < 300;
    if (said) said.textContent = ok ? 'saved' : 'not saved: ' + ((r && r.body && (r.body.error || r.body.code)) || (r && r.status) || 'no answer');
    if (ok && iconsList) iconsList.reload();
    return ok;
  }, function (e) { if (said) said.textContent = 'not saved: ' + ((e && e.message) || e); return false; });
}

function iconsPanel(host, listHost, api, row, glyph) {
  listHost.hidden = true;
  host.hidden = false;
  host.innerHTML = '<button type="button" class="cancel-btn" data-icons="back">← Icons</button>' +
    '<div class="stat-tile wide"><div class="panel-heading" style="font-size:2em">' + iconsEsc(glyph) + '</div>' +
    '<label class="field-label">Keywords <input type="text" data-icons="keywords" value="' + iconsEsc((row.keywords || []).join(', ')) + '"></label>' +
    '<button type="button" data-icons="remove">Remove this icon</button>' +
    '<div data-icons="said" class="job-manifest-note"></div></div>';
  var said = host.querySelector('[data-icons="said"]');
  function back() { host.hidden = true; host.innerHTML = ''; listHost.hidden = false; }
  host.querySelector('[data-icons="back"]').addEventListener('click', back);
  // Saved as the field changes, no Save button (as the Apps panel).
  host.querySelector('[data-icons="keywords"]').addEventListener('change', function (e) {
    var words = iconsWords(e.target.value);
    iconsChange(api, function (set) { set[glyph] = words; }, said);
  });
  host.querySelector('[data-icons="remove"]').addEventListener('click', function () {
    iconsChange(api, function (set) { delete set[glyph]; }, said).then(function (ok) { if (ok) back(); });
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var E = window.spiritElements;
    container.innerHTML =
      '<div data-icons="list">' +
        '<div class="stat-tile wide" style="display:flex;gap:1em;align-items:center">' +
          '<input type="text" data-icons="new-glyph" placeholder="an icon (paste it)" style="width:8em">' +
          '<input type="text" data-icons="new-keywords" placeholder="keywords, comma separated" style="flex:1">' +
          '<button type="button" data-icons="add">Add</button><span data-icons="added" class="job-manifest-note"></span>' +
        '</div>' +
        '<div data-icons="pane"></div>' +
      '</div><div data-icons="icon" hidden></div>';
    var listHost = container.querySelector('[data-icons="list"]');
    var iconHost = container.querySelector('[data-icons="icon"]');
    iconsList = E.iconList.create(container.querySelector('[data-icons="pane"]'), {
      api: api,
      face: 'pane',
      details: function (row, glyph) { iconsPanel(iconHost, listHost, api, row, glyph); },
    });
    container.querySelector('[data-icons="add"]').addEventListener('click', function () {
      var glyph = String(container.querySelector('[data-icons="new-glyph"]').value || '').trim();
      var words = iconsWords(container.querySelector('[data-icons="new-keywords"]').value);
      var said = container.querySelector('[data-icons="added"]');
      if (!glyph) { said.textContent = 'paste an icon first'; return; }
      iconsChange(api, function (set) { set[glyph] = words; }, said);
    });
  },

  render: function () {},
});
