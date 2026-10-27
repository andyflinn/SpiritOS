// Apps (goal/G30.21): every app of this node, a mountable wrapper over the standard list-tool
// (shell/js/probabilitySearch.js) as a view of data.files, the Files cache: nothing of its own is kept or asked for the
// list. An app is a <name>/<name>.js under shell/ or process/js/ with its <name>/<name>.json beside it, two types,
// shell and process; only the .js is a row. A press opens the app's detail panel, the editor of its face annotation
// space: the face part of the .js sidecar (app, intrinsic, name, icon, description), read with fs.annotations. Its
// intrinsic mark is the only one that makes the app's code core. Where a shell app runs at home (its .json's runs) is
// shown, not changed; a server's home switch is its face part's home, a checkbox here (goal/G41.1).
//
// THE FACE PART IS THE ONE PART (goal/G41.1, box v15): every fs.annotate writes it, the face link's and the node's door
// alike. On the face a save tells the face shell (spirit.shell.faceApp), and the app comes or goes on its desktop at once.
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
// EVERY APP'S MANIFEST AND FACE PART, read once before the list is drawn (goal/G41.1, box v14 and v15), by its
// script's path.
var appsManifests = {};
var appsFaces = {};
function appsReadManifests() {
  var D = window.spirit.data;
  var paths = D ? Object.keys(D.branch('files')).filter(appsIsApp) : [];
  return spirit.ready.then(function (s) {
    return Promise.all(paths.map(function (p) {
      var manifest = Promise.resolve(s.fs.loadFile(p.replace(/\.js$/, '.json'))).then(function (t) {
        try { appsManifests[p] = JSON.parse(t || '{}') || {}; } catch (e) { appsManifests[p] = {}; }
      }, function () { appsManifests[p] = {}; });
      var face = Promise.resolve(s.fs.getAnnotations(p)).then(function (a) { appsFaces[p] = (a && a.face) || {}; }, function () { appsFaces[p] = {}; });
      return Promise.all([manifest, face]);
    }));
  });
}
// AN APP WITH A BUTTON (box v15: "a filter for installable apps only"): not intrinsic, and not this app itself.
function appsInstallable(path) {
  return !(appsFaces[path] && appsFaces[path].intrinsic === true) && String(path) !== 'shell/apps/apps.js';
}
// TWO TYPES OF ROW ONLY (box v14: "the apps app only lists two types of apps: 1 ) shell apps that don't depend on an
// appServer and 2) appServers"): a shell app naming a server goes with its server; under process/js only a server.
function appsIsRow(path) {
  if (!appsIsApp(path)) return false;
  // Login and Join are boot's own components (goal/G41.3), never apps: no row, no button.
  if (/^shell\/(login|join)\//.test(String(path))) return false;
  var m = appsManifests[path] || {};
  return String(path).indexOf('shell/') === 0 ? !m.server : m.kind === 'server';
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
    // WHERE IT RUNS AT HOME: a shell app's manifest says so (goal/G30.20); a server's own sidecar, its face part's home, the
    // only place (goal/G41.1, box v13), switched here.
    var isProcess = m[1] === 'process/js';
    // Intrinsic is the coded list's, on the face part the node hands out (goal/G41.1, box v17).
    var home = face.intrinsic === true || (isProcess ? face.home === true : Array.isArray(manifest.runs) && manifest.runs.indexOf('home') !== -1);
    var canWrite = appsOnFace();
    var dis = canWrite ? '' : ' disabled';
    // NO CHECKMARK (box v14: the panel "will see all it's checkmarks go, because intrinsic is decided by the development
    // team"): the app installer switches it, and the intrinsic mark, set by hand in the sidecar, is only said.
    panel.innerHTML =
      '<div class="panel-heading">' + appsEsc(path) + '</div>' +
      '<div class="job-manifest-note">' + (m[1] === 'shell' ? 'shell app' : 'appServer') + ' · at home: ' + (home ? 'runs' : 'does not run') +
        (isProcess ? '' : ' · on the face: ' + (face.app === true ? 'shown' : 'not shown')) +
        ' · intrinsic: ' + (face.intrinsic === true ? 'yes, its code is core' : 'no') + '</div>' +
      '<div data-apps="installer"></div>' +
      '<label class="field-label">Name <input type="text" data-face="name" value="' + appsEsc(face.name || manifest.name || '') + '"' + dis + '></label>' +
      // THE ICON IS THE GLYPH ITSELF (goal/G30.21), picked from the icons list (shell/js/icons/listElement.js).
      '<label class="field-label">Icon <span data-apps="icon-shown" style="font-size:1.3em">' + appsEsc(face.icon || '') + '</span> <span data-apps="icon-pick"></span>' +
        '<input type="hidden" data-face="icon" value="' + appsEsc(face.icon || '') + '"></label>' +
      '<label class="field-label">Description <input type="text" data-face="description" value="' + appsEsc(face.description || manifest.description || '') + '"' + dis + '></label>' +
      (canWrite ? '' : '<div class="job-manifest-note">The face part is written from the face.</div>') +
      '<div data-apps="said" class="job-manifest-note"></div>';
    var installerBox = panel.querySelector('[data-apps="installer"]');
    if (installerBox) window.spirit.elements.appInstaller.create(installerBox, { path: path });
    if (!canWrite) return;
    // NO SAVE BUTTON (Andy: "why would there be a save button when the face can re-write annotations as soon as a field
    // changes?"): every change writes the whole face part at once.
    function save() {
      var said = panel.querySelector('[data-apps="said"]');
      var v = function (k) { return panel.querySelector('[data-face="' + k + '"]'); };
      // Wholesale, as every sidecar part is written: the face part as read, the three edited fields over it, so the
      // installer's switch and the intrinsic mark stay as they are.
      var payload = Object.assign({}, face, { name: v('name').value, icon: v('icon').value, description: v('description').value });
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
  'shell/js/icons/listElement.js', 'shell/js/appInstaller.js'].map(function (p) { return spirit.require(p); }));

spirit.shell.activateApp({
  mount: function (container, api) {
    // Its list box takes the whole of its pane (goal/G40.8: space granted top-down).
    container.innerHTML = '<div data-apps="list" class="fill"></div>';
    var listHost = container.querySelector('[data-apps="list"]');
    return appsParts.then(appsReadManifests).then(function () { appsDraw(listHost, api); }, function () { listHost.textContent = 'Apps could not be loaded.'; });
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
        // THE APP INSTALLER, one per row (box v14: "the apps list has one new column, containing the appInstaller.js element").
        { field: 'installer', label: '' },
      ],
      element: function (row, key) { return appsRowElement(E, row, key); },
      matched: function (row) { return { path: String(row.path || '') }; },
      filters: [
        { name: 'type', choices: [{ value: 'all', word: 'all' }, { value: 'shell', word: 'shell' }, { value: 'process', word: 'process' }],
          test: function (row, v) {
            if (!appsIsRow(row.path)) return 0;
            if (!v || v === 'all') return 1;
            return (v === 'shell') === (String(row.path).indexOf('shell/') === 0) ? 1 : 0;
          } },
        { name: 'installable', choices: [{ value: 'all', word: 'all' }, { value: 'only', word: 'installable' }],
          test: function (row, v) { return v === 'only' && !appsInstallable(row.path) ? 0 : 1; } },
      ],
      details: function (row, key) { appsPanel(api, key); },
      empty: 'No app matches.',
    });
    appsList.sort('name', 'asc');
    appsList.refresh();
}

// THE FILE ROW, WITH THE APP INSTALLER IN ITS OWN CELL: mounted with the row, destroyed with it.
function appsRowElement(E, row, key) {
  var el = E.fileElement.create(Object.assign({ path: key }, row));
  var installer = null;
  var mount = el.mount;
  var destroy = el.destroy;
  el.fields = el.fields.concat(['installer']);
  el.mount = function (hosts) {
    mount.call(el, hosts);
    if (installer) installer.destroy();
    installer = hosts && hosts.installer ? E.appInstaller.create(hosts.installer, { path: key }) : null;
    return el;
  };
  el.destroy = function () { if (installer) { installer.destroy(); installer = null; } destroy.call(el); };
  return el;
}
