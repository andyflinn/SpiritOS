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
  var D = window.spiritData;
  return !!m && !!D && !!D.get('files/' + path.replace(/\.js$/, '.json'));
}

function appsPanel(host, listHost, api, path) {
  var m = APP_SCRIPT.exec(path);
  var id = m[1] + '/' + m[2];
  listHost.hidden = true;
  host.hidden = false;
  host.innerHTML = '<button type="button" class="cancel-btn" data-apps="back">← Apps</button><div data-apps="panel" class="stat-tile wide">reading…</div>';
  var panel = host.querySelector('[data-apps="panel"]');
  host.querySelector('[data-apps="back"]').addEventListener('click', function () { host.hidden = true; host.innerHTML = ''; listHost.hidden = false; });
  Promise.all([
    Promise.resolve(api.verb('fs.annotations', { path: path })),
    Promise.resolve(api.verb('fs.load', { path: id + '/' + m[2] + '.json' })),
  ]).then(function (got) {
    var face = (got[0] && got[0].body && got[0].body.face) || {};
    var manifest = {};
    try { manifest = JSON.parse((got[1] && got[1].body && got[1].body.text) || '{}'); } catch (e) { manifest = {}; }
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
      '<label class="field-label">Icon <input type="text" data-face="icon" value="' + appsEsc(face.icon || manifest.icon || '') + '"' + dis + '></label>' +
      '<label class="field-label">Description <input type="text" data-face="description" value="' + appsEsc(face.description || manifest.description || '') + '"' + dis + '></label>' +
      (canWrite ? '<button type="button" data-apps="save">Save</button>' : '<div class="job-manifest-note">The face part is written from the face.</div>') +
      '<div data-apps="said" class="job-manifest-note"></div>';
    if (!canWrite) return;
    panel.querySelector('[data-apps="save"]').addEventListener('click', function () {
      var said = panel.querySelector('[data-apps="said"]');
      var v = function (k) { return panel.querySelector('[data-face="' + k + '"]'); };
      // Wholesale, as every sidecar part is written: what the panel shows is the whole face part.
      var payload = { app: !!v('shown').checked, intrinsic: !!v('intrinsic').checked, name: v('name').value, icon: v('icon').value, description: v('description').value };
      Promise.resolve(api.verb('fs.annotate', { path: path, payload: payload })).then(function (r) {
        if (r && r.status === 200) {
          said.textContent = 'saved';
          if (m[1] === 'shell') spirit.shell.faceApp(id);
        } else said.textContent = 'not saved: ' + ((r && r.body && (r.body.error || r.body.code)) || (r && r.status) || 'no answer');
      }, function (e) { said.textContent = 'not saved: ' + ((e && e.message) || e); });
    });
  }, function (e) { panel.textContent = 'could not read ' + path + ': ' + ((e && e.message) || e); });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var E = window.spiritElements;
    container.innerHTML = '<div data-apps="list"></div><div data-apps="detail" hidden></div>';
    var listHost = container.querySelector('[data-apps="list"]');
    var appHost = container.querySelector('[data-apps="detail"]');
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
      details: function (row, key) { appsPanel(appHost, listHost, api, key); },
      empty: 'No app matches.',
    });
    appsList.sort('name', 'asc');
    appsList.refresh();
  },

  render: function () {},
});
