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

// The rule itself lives in js/ownerBadge.js, whose isomorphic half the
// shell loads (index.html) — one definition of "how few mailboxes this
// node may be left with", shared with the hub that has to speak to them.
// If that script did not load there is no helper and no Remove: losing
// the button is a nuisance, losing the last relay is a node that cannot
// claim, send or read anything.
function natterCanRemove(count) {
  var badge = (typeof window !== 'undefined' && window.spiritOwnerBadge) || null;
  return !!(badge && badge.canRemoveMailbox(count));
}

// Removal decided in one place, so the button and the click agree. A
// disabled-looking button that still deletes when clicked is the failure
// this cycle is about.
function natterRemoveAt(relays, index) {
  if (!natterCanRemove(relays.length)) return null;
  if (!(index >= 0 && index < relays.length)) return null;
  return relays.splice(index, 1)[0];
}

// What the badge probe last said about each URL: { owned, report }.
// `report` is the census the mailbox answers an owner with — owner, mode,
// peers, message count — and it arrives with the same signed call that
// decides whether this node owns the row at all (js/ownerBadge.js,
// readBadge). So the panel below costs no endpoint and no second
// authority: it shows what was already fetched to draw the star.
var natterBadgeByUrl = Object.create(null);

// The one expanded row, or null. Same rule as the Jobs table: opening one
// closes any other, because two open panels in a list of mailboxes is a
// page you have to scroll to compare rather than a thing you are looking
// at.
var natterExpandedUrl = null;

// Never the invites: a live token is a spoken secret, and a panel that
// opens on a click is visible to whoever is looking at the screen. The
// rule holds by construction as long as this shows what the probe
// returned and fetches nothing of its own — `report` carries no tokens.
//
// Peers by count, not by key. The census names every peer and carries a
// 48-character key for each; a wall of those is machine detail wearing a
// person's clothes (UI_DESIGN_STYLE.md §6).
function natterReportHtml(api, badge) {
  if (!badge) return '<div class="job-log-empty">asking that mailbox…</div>';
  if (!badge.owned) {
    return '<div class="job-log-empty">' + api.escapeHtml(badge.error || 'not owner') + '</div>';
  }
  var report = badge.report || {};
  var peers = Array.isArray(report.peers) ? report.peers.length : 0;
  function row(label, value) {
    return '<div class="file-info-row">' +
      '<span class="file-info-label">' + api.escapeHtml(label) + '</span>' +
      '<span>' + api.escapeHtml(String(value)) + '</span>' +
      '</div>';
  }
  return row('Owner', report.owner || '(none)') +
    row('Mode', report.mode || '(unknown)') +
    row('Peers', peers) +
    row('Messages', report.messages == null ? '(unknown)' : report.messages);
}

function natterRenderList(container, api, relays) {
  var tbody = container.querySelector('#natter-tbody');
  if (relays.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">(no relays added yet)</td></tr>';
    return;
  }
  var removable = natterCanRemove(relays.length);
  tbody.innerHTML = relays.map(function (relay, index) {
    var badge = natterBadgeByUrl[relay.url];
    var owned = !!(badge && badge.owned);
    var open = owned && natterExpandedUrl === relay.url;
    // ★ means owned, here and in Relay Chat's To list — one mark, one
    // meaning, wherever a mailbox is named. A row this node does not own
    // has no star and nothing to open.
    //
    // The star only says the row can be opened; the row itself is the
    // control, which gives a phone the whole width of it to aim at. The
    // one thing that must not toggle is Remove, so the click handler
    // answers that first (mount, below) — otherwise a tap meant for a
    // panel would delete a mailbox.
    var star = owned ? '<span class="natter-star">★</span> ' : '';
    var mainRow = '<tr class="job-row' + (owned ? ' natter-openable' : '') + '"' +
      (owned ? ' data-row-url="' + api.escapeHtml(relay.url) + '"' : '') +
      (owned ? ' title="' + (open ? 'Hide' : 'Show') + ' what this mailbox says"' : '') + '>' +
      '<td>' + star + api.escapeHtml(relay.label) + '</td>' +
      '<td>' + api.escapeHtml(relay.url) + '</td>' +
      '<td>' + (removable
        ? '<button type="button" class="cancel-btn" data-remove-index="' + index + '">Remove</button>'
        : '<span class="muted">last relay</span>') +
      '</td>' +
      '</tr>';
    if (!open) return mainRow;
    return mainRow + '<tr class="job-log-row"><td colspan="3"><div class="stat-tile wide">' +
      natterReportHtml(api, badge) +
      '</div></td></tr>';
  }).join('');
}

// One signed status per row, the same call the owner badge makes: the
// mailbox already answers "is this key the owner here?" every time an
// owner asks for a census, so there is no second route and no second
// authority (js/ownerBadge.js). Answers land in natterBadgeByUrl and the
// list repaints — stars appear for what is owned and nothing else moves.
//
// Asked again whenever a panel is opened, because a badge is fetched on
// arrival and a message count from ten minutes ago is worse than one
// that says it is being fetched.
function natterProbe(api, container, relays) {
  var label = (typeof api.nodeLabel === 'function' && api.nodeLabel()) || '';
  if (!label) return Promise.resolve(); // no claim, nothing to sign as, no stars
  return fetch('/api/hub/status?name=' + encodeURIComponent(label))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      ((data && data.rows) || []).forEach(function (row) {
        if (row && row.url) natterBadgeByUrl[row.url] = row;
      });
      natterRenderList(container, api, relays);
    })
    .catch(function () { /* a mailbox that cannot be reached is not one this node owns */ });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    var relays = natterLoadRelays(api);
    var statusEl;

    // The shared row (.start-job-form): fields with a button on the end,
    // one gap between everything, wrapping to full-width targets on a
    // narrow screen, and a block of space under it before the list. It
    // used to be a tile of bare labels with no spacing rules at all, so
    // a caption, its input and the next caption ran together.
    // .field-label is the shared caption-over-input pair — see
    // UI_DESIGN_STYLE.md before inventing either of them again.
    container.innerHTML =
      '<div class="stat-tile wide start-job-form">' +
        // The dictionary's word rather than an example with a person's
        // name in it. This caption is yours, it stays on this node and
        // never goes on the wire — DICTIONARY.md calls that a private
        // caption ("My label"). One word for one thing, in the UI as in
        // the docs.
        '<label class="field-label">Private label<input type="text" id="natter-label" placeholder="only you see this"></label>' +
        '<label class="field-label">URL<input type="text" id="natter-url" placeholder="https://example.com"></label>' +
        '<button type="button" id="natter-add">Add</button>' +
        '<span id="natter-status"></span>' +
      '</div>' +
      '<table class="jobs-table"><thead><tr><th>Label</th><th>URL</th><th></th></tr></thead><tbody id="natter-tbody"></tbody></table>';

    statusEl = document.getElementById('natter-status');
    // A fresh visit starts fully collapsed, like the Jobs table.
    natterExpandedUrl = null;
    natterRenderList(container, api, relays);
    natterProbe(api, container, relays);

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

      // The row opens what its mailbox says — but only where the click
      // was not Remove. Answered in that order deliberately: the
      // destructive control sits inside the openable row, and a tap that
      // could mean either must mean the one that cannot be undone by
      // tapping again.
      if (indexAttr == null) {
        var row = e.target.closest && e.target.closest('[data-row-url]');
        var rowUrl = row && row.getAttribute('data-row-url');
        if (!rowUrl) return;
        // Opening one closes any other.
        natterExpandedUrl = (natterExpandedUrl === rowUrl) ? null : rowUrl;
        natterRenderList(container, api, relays);
        if (natterExpandedUrl) natterProbe(api, container, relays);
        return;
      }
      var index = Number(indexAttr);
      var removed = natterRemoveAt(relays, index);
      // A button that survived a stale render, or was put back by hand,
      // still does not empty the list.
      if (!removed) {
        statusEl.textContent = 'a node keeps at least one relay';
        natterRenderList(container, api, relays);
        return;
      }
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
