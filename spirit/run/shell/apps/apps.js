// Apps (goal/G30.21): every app of this node, a mountable wrapper over the standard list-tool
// (shell/js/probabilitySearch.js) as a view of data.files, the Files cache: nothing of its own is kept or asked for the
// list. An app is a <name>/<name>.js under shell/ or process/js/ with its <name>/<name>.json beside it, two types,
// shell and process; only the .js is a row. A press opens the app's detail panel, the editor of its face annotation
// space: the face part of the .js sidecar (app, intrinsic, name, icon, description), read with fs.annotations. Its
// intrinsic mark is the only one that makes the app's code core. Where it runs at home (its .json's runs) and on the face
// is shown, not changed.
//
// THE FACE PART IS WRITTEN FROM THE FACE ONLY: the node routes the face's fs.annotate to the face part (faceHome), and
// the home shell's fs.annotate writes the client part, so at home the panel shows the face part and says so. On the face
// a save tells the face shell (spirit.shell.faceApp), and the app comes or goes on its desktop at once.
//
// The old Apps app's overrides (custom name, icon, tile place) are not carried over (the box).
//
// Intrinsic, so it sits in the Spirit group and its name, icon and place are locked. Its id is 'shell/apps'.

var appsList = null;
var APP_SCRIPT = /^(shell|process\/js)\/([^/]+)\/\2\.js$/;

function appsEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function appsOnFace() { return !!(window.spirit && spirit.shell && typeof spirit.shell.faceApp === 'function'); }
// An app: its .js, with its .json in the Files cache beside it.
function appsIsApp(path) {
  var m = APP_SCRIPT.exec(String(path || ''));
  var D = window.spirit.data;
  return !!m && !!D && !!D.get('files/' + path.replace(/\.js$/, '.json'));
}

// AN APP'S PANEL IS A PAGE (goal/G40.8: back is the same for everything, the frame's): pushed on the navigation, the
// app's folder the title; no back row of its own.
function appsPanel(api, path) {
  var m = APP_SCRIPT.exec(path);
  window.spirit.elements.navigation.push({ title: m[2], mount: function (host) { appsPanelDraw(host, api, path); } });
}
function appsPanelDraw(host, api, path) {
  var m = APP_SCRIPT.exec(path);
  var id = m[1] + '/' + m[2];
  host.innerHTML = '<div data-apps="panel" class="stat-tile wide">reading…</div>';
  var panel = host.querySelector('[data-apps="panel"]');
  // Through the spirit object (goal/G32.2): the face part and the manifest's text.
  spirit.ready.then(function (s) {
    return Promise.all([s.fs.getAnnotations(path), s.fs.loadFile(id + '/' + m[2] + '.json')]);
  }).then(function (got) {
    var face = (got[0] && got[0].face) || {};
    var manifest = {};
    try { manifest = JSON.parse(got[1] || '{}'); } catch (e) { manifest = {}; }
    var home = Array.isArray(manifest.runs) && manifest.runs.indexOf('home') !== -1 || manifest.intrinsic === true;
    var canWrite = appsOnFace();
    var dis = canWrite ? '' : ' disabled';
    panel.innerHTML =
      '<div class="panel-heading">' + appsEsc(path) + '</div>' +
      '<div class="job-manifest-note">' + (m[1] === 'shell' ? 'shell app' : 'process') + ' · at home: ' + (home ? 'runs' : 'does not run') +
        ' · on the face: ' + (face.app === true ? 'shown' : 'not shown') + '</div>' +
      '<label class="field-label"><input type="checkbox" data-face="shown"' + (face.app === true ? ' checked' : '') + dis + '> on the face</label>' +
      // THE INTRINSIC MARK: only this one makes the app's code core (js/coreFiles.js).
      '<label class="field-label"><input type="checkbox" data-face="intrinsic"' + (face.intrinsic === true ? ' checked' : '') + dis + '> intrinsic (its code is core)</label>' +
      '<label class="field-label">Name <input type="text" data-face="name" value="' + appsEsc(face.name || manifest.name || '') + '"' + dis + '></label>' +
      // THE ICON IS THE GLYPH ITSELF (goal/G30.21), picked from the icons list (shell/js/icons/listElement.js).
      '<label class="field-label">Icon <span data-apps="icon-shown" style="font-size:1.3em">' + appsEsc(face.icon || '') + '</span> <span data-apps="icon-pick"></span>' +
        '<input type="hidden" data-face="icon" value="' + appsEsc(face.icon || '') + '"></label>' +
      '<label class="field-label">Description <input type="text" data-face="description" value="' + appsEsc(face.description || manifest.description || '') + '"' + dis + '></label>' +
      (canWrite ? '' : '<div class="job-manifest-note">The face part is written from the face.</div>') +
      '<div data-apps="said" class="job-manifest-note"></div>';
    if (!canWrite) return;
    // NO SAVE BUTTON (Andy: "why would there be a save button when the face can re-write annotations as soon as a field
    // changes?"): every change writes the whole face part at once.
    function save() {
      var said = panel.querySelector('[data-apps="said"]');
      var v = function (k) { return panel.querySelector('[data-face="' + k + '"]'); };
      // Wholesale, as every sidecar part is written: what the panel shows is the whole face part.
      var payload = { app: !!v('shown').checked, intrinsic: !!v('intrinsic').checked, name: v('name').value, icon: v('icon').value, description: v('description').value };
      spirit.ready.then(function (s) { return s.fs.annotate({ path: path, payload: payload }); }).then(function () {
        said.textContent = 'saved';
        if (m[1] === 'shell') spirit.shell.faceApp(id);
      }, function (err) { said.textContent = 'not saved: ' + ((err && err.message) || err); });
    }
    // The name and the description stop at their limits as they are typed (shell/js/fieldInput.js).
    window.spirit.elements.fieldInput.attach(panel.querySelector('[data-face="name"]'), 'name');
    window.spirit.elements.fieldInput.attach(panel.querySelector('[data-face="description"]'), 'description');
    panel.addEventListener('change', function (e) {
      if (!e || !e.target || !e.target.getAttribute || !e.target.getAttribute('data-face')) return;
      save();
    });
    window.spirit.elements.iconList.create(panel.querySelector('[data-apps="icon-pick"]'), {
      api: api,
      face: 'dropdown',
      placeholder: 'choose an icon…',
      pick: function (row, glyph) {
        if (!glyph) return;
        panel.querySelector('[data-face="icon"]').value = glyph;
        panel.querySelector('[data-apps="icon-shown"]').textContent = glyph;
        save();
      },
    });
  }, function (e) { panel.textContent = 'could not read ' + path + ': ' + ((e && e.message) || e); });
}

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3; Andy: every app bootstraps its own components, "lazy-load, is a tree...."):
// through spirit.require, each element bringing its own.
var appsParts = Promise.all(['shell/js/files/data.js', 'shell/js/files/rowElement.js', 'shell/js/probabilitySearch.js', 'shell/js/fieldInput.js',
  'shell/js/icons/listElement.js'].map(function (p) { return spirit.require(p); }));

spirit.shell.activateApp({
  mount: function (container, api) {
    // Its list box takes the whole of its pane (goal/G40.8: space granted top-down).
    container.innerHTML = '<div data-apps="list" class="fill"></div>';
    var listHost = container.querySelector('[data-apps="list"]');
    return appsParts.then(function () { appsDraw(listHost, api); }, function () { listHost.textContent = 'Apps could not be loaded.'; });
  },

  render: function () {},
});

function appsDraw(listHost, api) {
    var E = window.spirit.elements;
    appsList = E.probabilitySearch.create(listHost, {
      api: { verb: function () { return Promise.resolve({ status: 200, body: { ok: true, items: [], more: false } }); } },
      data: 'files',
      server: 'fs',
      verb: 'search',
      columns: [
        { field: 'name', from: 'path', label: 'App', sort: 'path' },
        { field: 'changed', from: 'modified', label: 'Changed', sort: 'date' },
      ],
      element: function (row, key) { return E.fileElement.create(Object.assign({ path: key }, row)); },
      matched: function (row) { return { path: String(row.path || '') }; },
      filters: [
        { name: 'type', choices: [{ value: 'all', word: 'all' }, { value: 'shell', word: 'shell' }, { value: 'process', word: 'process' }],
          test: function (row, v) {
            if (!appsIsApp(row.path)) return 0;
            if (!v || v === 'all') return 1;
            return (v === 'shell') === (String(row.path).indexOf('shell/') === 0) ? 1 : 0;
          } },
      ],
      details: function (row, key) { appsPanel(api, key); },
      empty: 'No app matches.',
    });
    appsList.sort('name', 'asc');
    appsList.refresh();
}
