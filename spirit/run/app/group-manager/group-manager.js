// The sixth of the shell apps to leave index.html (CLEANUP-PLAN). Same
// app: create a group, rename or re-icon one, delete one and its members
// go back to the desktop. Placement of an individual app into a group
// still happens in the Apps table's Location dropdown — this screen
// manages the groups themselves, not membership.
//
// Its id changed with its folder, 'group-manager' to 'app/group-manager'
// — see APP_ID_RENAMES and INTRINSIC_APP_FOLDERS in js/client/shell.js,
// and the Spirit group's member list in index.html, all updated in this
// same commit. The cycle note asked that the id stay 'group-manager',
// and that is not reachable: declareDynamicApp derives an id from the
// folder ON PURPOSE, because saveAppManifest lets an app write its own
// manifest and a manifest that could name its own id could claim
// somebody else's (shell.js, declareDynamicApp). An id that moves
// without its rename map is an operator's overrides thrown away by
// pruneStalePreferences, so the map carries it across instead.
//
// Intrinsic, so it sits in the Spirit group with its name and icon
// locked — which is where it already was, since it was registered hidden
// and reachable only through Spirit.
//
// Still on spirit.shell, because step 6 did not name them:
// createGroup / updateGroup / deleteGroup and fileInfoRow. api.listGroups
// exists and is used. The three writers are the obvious next additions to
// that surface — app/process-browser carries the same note about the
// viewer lookup — and they wait for a sitting that opens it rather than
// riding along with a move.
//
// `api` arrives at mount and render never gets one, so it is kept here,
// the same as Files and Processes.

var groupsEscapeHtml = spirit.core.util.escapeHtml;
var groupsIcon = spirit.core.const.ICON;
var groupsApi = null;

// The one expanded row, or null. Opening one closes any other.
var expandedGroupId = null;

function groupsList() {
  return groupsApi ? groupsApi.listGroups() : [];
}

function renderGroupManagerRow(g) {
  var isExpanded = g.id === expandedGroupId;
  var mainRow = '<tr class="job-row" data-group-row="' + groupsEscapeHtml(g.id) + '">' +
    '<td>' + (isExpanded ? groupsIcon.POINTDOWN : groupsIcon.POINTRIGHT) + ' ' + groupsEscapeHtml(g.icon) + '</td>' +
    '<td>' + groupsEscapeHtml(g.name) + '</td>' +
    '<td>' + g.memberCount + '</td>' +
    '</tr>';

  if (!isExpanded) return mainRow;

  var detailHtml = '<div class="stat-tile wide">' +
    spirit.shell.fileInfoRow('Id', groupsEscapeHtml(g.id)) +
    spirit.shell.fileInfoRow('Members', g.memberCount === 0
      ? '(none — see the warning panel on the group itself)'
      : g.memberIds.map(groupsEscapeHtml).join(', ')) +
    '<label class="field-label">Name<input type="text" id="group-manager-name-input" data-group-id="' + groupsEscapeHtml(g.id) + '" value="' + groupsEscapeHtml(g.name) + '"></label>' +
    '<label class="field-label">Icon<input type="text" id="group-manager-icon-input" data-group-id="' + groupsEscapeHtml(g.id) + '" value="' + groupsEscapeHtml(g.icon) + '"></label>' +
    '<button type="button" class="cancel-btn" data-delete-group="' + groupsEscapeHtml(g.id) + '">Delete group</button>' +
    '</div>';

  return mainRow + '<tr class="job-log-row"><td colspan="3">' + detailHtml + '</td></tr>';
}

function renderGroupManagerTable(force) {
  var tbody = document.getElementById('group-manager-tbody');
  if (!tbody) return;
  // Same focus-preserving guard as the Apps table, same reason — render()
  // fires on every job-updated tick regardless of user action, and would
  // otherwise destroy a focused rename input.
  var focusedId = document.activeElement && document.activeElement.id;
  if (!force && (focusedId === 'group-manager-name-input' || focusedId === 'group-manager-icon-input')) return;
  var groups = groupsList().sort(function (a, b) { return a.name.localeCompare(b.name); });
  tbody.innerHTML = groups.map(renderGroupManagerRow).join('') || '<tr><td colspan="3">(no groups yet)</td></tr>';
}

spirit.shell.activateApp({
  mount: function (container, api) {
    groupsApi = api;
    expandedGroupId = null; // fresh visit starts fully collapsed

    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<label class="field-label">New group name<input type="text" id="group-manager-new-name" placeholder="e.g. Media Tools"></label>' +
        '<label class="field-label">New group icon (paste any emoji)<input type="text" id="group-manager-new-icon" placeholder="e.g. 🎨"></label>' +
        '<button type="button" class="cancel-btn" id="group-manager-create">Create group</button>' +
        '<div id="group-manager-create-error" class="job-start-error"></div>' +
      '</div>' +
      '<table class="jobs-table"><thead><tr><th></th><th>Name</th><th>Members</th></tr></thead><tbody id="group-manager-tbody"></tbody></table>';

    document.getElementById('group-manager-create').addEventListener('click', function () {
      var nameInput = document.getElementById('group-manager-new-name');
      var iconInput = document.getElementById('group-manager-new-icon');
      var errorEl = document.getElementById('group-manager-create-error');
      var result = spirit.shell.createGroup(nameInput.value.trim(), iconInput.value.trim());
      if (!result.ok) {
        var messages = {
          'name-and-icon-required': 'Both a name and an icon are required.',
          'name-collision': 'Another app or group is already using that name.',
          'icon-collision': 'Another app or group is already using that icon.',
        };
        errorEl.textContent = messages[result.reason] || ('Could not create group: ' + result.reason);
        return;
      }
      errorEl.textContent = '';
      nameInput.value = '';
      iconInput.value = '';
      renderGroupManagerTable(true);
    });

    document.getElementById('group-manager-tbody').addEventListener('click', function (event) {
      var deleteBtn = event.target.closest('[data-delete-group]');
      if (deleteBtn) {
        var id = deleteBtn.dataset.deleteGroup;
        var group = groupsList().filter(function (g) { return g.id === id; })[0];
        var memberCount = group ? group.memberCount : 0;
        var name = group ? group.name : id;
        // The one destructive step on this screen, and the only one that
        // asks first.
        if (!confirm('Delete "' + name + '"? ' + memberCount + ' app(s) will move back to the desktop.')) return;
        spirit.shell.deleteGroup(id);
        expandedGroupId = null;
        renderGroupManagerTable(true);
        return;
      }

      var row = event.target.closest('[data-group-row]');
      if (row) {
        var rowId = row.dataset.groupRow;
        expandedGroupId = (expandedGroupId === rowId) ? null : rowId; // opening one closes any other
        renderGroupManagerTable(true);
      }
    });

    document.getElementById('group-manager-tbody').addEventListener('change', function (event) {
      var isName = event.target.id === 'group-manager-name-input';
      var isIcon = event.target.id === 'group-manager-icon-input';
      if (!isName && !isIcon) return;

      var patch = isName ? { name: event.target.value.trim() } : { icon: event.target.value.trim() };
      var result = spirit.shell.updateGroup(event.target.dataset.groupId, patch);
      if (!result.ok) {
        var messages = {
          'name-required': 'Name cannot be empty.',
          'icon-required': 'Icon cannot be empty.',
          'name-collision': 'Another app or group is already using that name.',
          'icon-collision': 'Another app or group is already using that icon.',
        };
        alert(messages[result.reason] || ('Could not update group: ' + result.reason));
      }
      renderGroupManagerTable(true);
    });
  },

  render: function () {
    renderGroupManagerTable();
  },
});
