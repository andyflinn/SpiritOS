// Dynamically loaded by index.html's discoverDynamicApps (see natter.json
// for the id/name/icon this app is already declared under before this
// script ever runs). Maintains a simple list of known relay URLs — Server
// #3's future public-IP hub nodes, for eventual peer-to-peer connections.
// v0 is deliberately just a list: add/remove/view, one label + one URL
// per entry, nothing else — no liveness checking, no key material, no
// connection logic. Stored under this app's own scoped folder
// (app/natter/relays.json, a fixed filename) via api.fs, not shell-wide
// preferences — this is this app's own data, not a shell display setting.
var RELAYS_FILENAME = 'relays.json';

function natterLoadRelays(api) {
  var raw = api.fs.loadFile(RELAYS_FILENAME);
  if (raw == null) return [];
  try {
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function natterRenderList(container, api, relays) {
  var tbody = container.querySelector('#natter-tbody');
  if (relays.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">(no relays added yet)</td></tr>';
    return;
  }
  tbody.innerHTML = relays.map(function (relay, index) {
    return '<tr class="job-row">' +
      '<td>' + api.escapeHtml(relay.label) + '</td>' +
      '<td>' + api.escapeHtml(relay.url) + '</td>' +
      '<td><button type="button" class="cancel-btn" data-remove-index="' + index + '">Remove</button></td>' +
      '</tr>';
  }).join('');
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var relays = natterLoadRelays(api);
    var statusEl;

    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<label>Label<input type="text" id="natter-label" placeholder="e.g. Andy\'s hub"></label>' +
        '<label>URL<input type="text" id="natter-url" placeholder="https://example.com"></label>' +
        '<button type="button" id="natter-add">Add</button>' +
        '<span id="natter-status"></span>' +
      '</div>' +
      '<table class="jobs-table"><thead><tr><th>Label</th><th>URL</th><th></th></tr></thead><tbody id="natter-tbody"></tbody></table>';

    statusEl = document.getElementById('natter-status');
    natterRenderList(container, api, relays);

    document.getElementById('natter-add').addEventListener('click', function () {
      var labelInput = document.getElementById('natter-label');
      var urlInput = document.getElementById('natter-url');
      var label = labelInput.value.trim();
      var url = urlInput.value.trim();
      if (!label || !url) {
        statusEl.textContent = 'both a label and a URL are required';
        return;
      }
      relays.push({ label: label, url: url });
      api.fs.saveFile(RELAYS_FILENAME, JSON.stringify(relays, null, 2)).then(function () {
        labelInput.value = '';
        urlInput.value = '';
        statusEl.textContent = 'saved';
        natterRenderList(container, api, relays);
      }).catch(function (err) {
        relays.pop();
        statusEl.textContent = 'save failed: ' + err.message;
      });
    });

    container.querySelector('#natter-tbody').addEventListener('click', function (e) {
      var indexAttr = e.target.getAttribute('data-remove-index');
      if (indexAttr == null) return;
      var index = Number(indexAttr);
      var removed = relays.splice(index, 1)[0];
      api.fs.saveFile(RELAYS_FILENAME, JSON.stringify(relays, null, 2)).then(function () {
        statusEl.textContent = 'saved';
        natterRenderList(container, api, relays);
      }).catch(function (err) {
        relays.splice(index, 0, removed);
        statusEl.textContent = 'remove failed: ' + err.message;
      });
    });
  },
  render: function () {},
});
