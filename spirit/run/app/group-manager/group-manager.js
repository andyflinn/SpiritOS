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

// This app's own mount container, kept so the render guard can ask
// whether an icon list is open in THIS app rather than anywhere on the
// page — apps stay mounted, so the document holds other apps' DOM too.
var groupsContainer = null;

// The glyph picked in the create form, held here rather than read back
// off the control: it survives the rebuild the create picker gets on
// every render, and clearing the form after a create is one assignment.
var newGroupIcon = '';

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
    // Name and icon share a line for the same reason (§3). Delete does
    // NOT join them: it is the row's verb rather than the field's, and a
    // button that erases a group should not sit a thumb-width from a
    // picker somebody is adjusting.
    '<div class="start-job-form card">' +
    '<label class="field-label grow">Name<input type="text" id="group-manager-name-input" data-group-id="' + groupsEscapeHtml(g.id) + '" value="' + groupsEscapeHtml(g.name) + '"></label>' +
    // A slot for the icon picker, filled by fillGroupIconSelectors once
    // this markup is in the page — the row is a string and the picker is
    // an element. Same shape the Apps panel uses, including keeping the
    // id here so the delegated `change` handler and anything reading this
    // markup still see the control being offered.
    '<label class="field-label">Icon<div id="group-manager-icon-input" data-group-id="' + groupsEscapeHtml(g.id) + '" data-group-icon-slot="' + groupsEscapeHtml(g.icon) + '"></div></label>' +
    '</div>' +
    '<button type="button" class="cancel-btn" data-delete-group="' + groupsEscapeHtml(g.id) + '">Delete group</button>' +
    '</div>';

  return mainRow + '<tr class="job-log-row"><td colspan="3">' + detailHtml + '</td></tr>';
}

// Every glyph something else is already showing, which is what the icon
// picker is told to leave off its list.
//
// An app's shipped default counts as taken alongside its current icon: a
// default is what a Reset would bring back, so it is just as spoken for.
// `exceptGroupId` is the group being edited — its own glyph must stay on
// the list, or the field could not show what is currently set.
//
// This mirrors what createGroup/updateGroup already refuse (they run the
// same collidesWithAnotherApp check the Apps panel does). The picker does
// not add a rule; it stops the refusal from being reachable.
function glyphsTaken(exceptGroupId) {
  var taken = [];
  (groupsApi ? groupsApi.listApps() : []).forEach(function (a) {
    taken.push(a.icon, a.defaultIcon);
  });
  groupsList().forEach(function (g) {
    if (g.id !== exceptGroupId) taken.push(g.icon);
  });
  return taken;
}

// Plants a picker in each expanded row's slot, and moves the id and the
// group it edits onto the control itself — the delegated `change` handler
// reads event.target.id and event.target.dataset.groupId, and
// event.target is whatever fired, which is the selector.
function fillGroupIconSelectors(tbody) {
  var slots = tbody.querySelectorAll('[data-group-icon-slot]');
  Array.prototype.forEach.call(slots, function (slot) {
    var id = slot.dataset.groupId;
    var selector = groupsApi.ui.elements.createIconSelector(glyphsTaken(id), {
      value: slot.dataset.groupIconSlot,
    });
    selector.id = slot.id;
    selector.dataset.groupId = id;
    slot.removeAttribute('id');
    slot.appendChild(selector);
  });
}

// The create form's own picker. Rebuilt with the table rather than once
// at mount, because what is taken changes as apps and groups come and go
// and mount runs only on the first visit — a list built once would be
// offering glyphs that had since been claimed.
//
// The chosen glyph is held in newGroupIcon rather than read back off the
// element, so clearing the form after a successful create is a variable
// assignment and not a control that has to be talked into looking empty.
function refreshCreateIconSelector() {
  var slot = document.getElementById('group-manager-new-icon');
  if (!slot || !groupsApi) return;
  slot.innerHTML = '';
  var selector = groupsApi.ui.elements.createIconSelector(glyphsTaken(null), {
    value: newGroupIcon,
  });
  selector.addEventListener('change', function (event) {
    newGroupIcon = event.target.value;
  });
  slot.appendChild(selector);
}

function renderGroupManagerTable(force) {
  var tbody = document.getElementById('group-manager-tbody');
  if (!tbody) return;
  // Same focus-preserving guard as the Apps table, same reason — render()
  // fires on every job-updated tick regardless of user action, and would
  // otherwise destroy a focused rename input.
  var focusedId = document.activeElement && document.activeElement.id;
  if (!force && (focusedId === 'group-manager-name-input' || focusedId === 'group-manager-icon-input')) return;
  // An icon picker's focus sits on the filter input inside it, whose id is
  // neither of those two, so the guard above cannot see it. An open list
  // says so on its root — and this asks the app's own container, not the
  // document, because apps stay mounted and another app's open list is
  // none of this one's business.
  if (!force && groupsContainer && groupsContainer.querySelector('[data-open]')) return;
  var groups = groupsList().sort(function (a, b) { return a.name.localeCompare(b.name); });
  tbody.innerHTML = groups.map(renderGroupManagerRow).join('') || '<tr><td colspan="3">(no groups yet)</td></tr>';
  fillGroupIconSelectors(tbody);
  refreshCreateIconSelector();
}

spirit.shell.activateApp({
  mount: function (container, api) {
    groupsApi = api;
    groupsContainer = container;
    expandedGroupId = null; // fresh visit starts fully collapsed
    newGroupIcon = '';

    container.innerHTML =
      '<div class="stat-tile wide">' +
        // Name, icon and the one button that acts on them, on one line
        // (§3). The name takes the width; the picker sits at its own, and
        // Create ends the row. It wraps on a narrow screen rather than
        // squeezing, so a phone still gets full-width targets.
        '<div class="start-job-form">' +
        '<label class="field-label grow">New group name<input type="text" id="group-manager-new-name" placeholder="e.g. Media Tools"></label>' +
        // A slot, filled by refreshCreateIconSelector on every render. The
        // field used to read "paste any emoji" and take anything at all,
        // then be refused afterwards if something was already showing it.
        // The pool is the vocabulary now, and a taken glyph is not on the
        // list, so there is nothing left to refuse.
        '<label class="field-label">New group icon<div id="group-manager-new-icon"></div></label>' +
        '<button type="button" class="cancel-btn" id="group-manager-create">Create group</button>' +
        '</div>' +
        // Under the row, not in it: this is something to read when it
        // appears, not a control on the line.
        '<div id="group-manager-create-error" class="job-start-error"></div>' +
      '</div>' +
      '<table class="jobs-table"><thead><tr><th></th><th>Name</th><th>Members</th></tr></thead><tbody id="group-manager-tbody"></tbody></table>';

    document.getElementById('group-manager-create').addEventListener('click', function () {
      var nameInput = document.getElementById('group-manager-new-name');
      var errorEl = document.getElementById('group-manager-create-error');
      var result = spirit.shell.createGroup(nameInput.value.trim(), newGroupIcon);
      if (!result.ok) {
        // icon-collision is unreachable from this form now — the picker
        // is never offered a glyph something else is showing. It stays
        // because createGroup is the enforcer and this is not its only
        // caller. "Both a name and an icon are required" still fires: an
        // icon has to be PICKED, and nothing is picked to begin with.
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
      newGroupIcon = '';
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
