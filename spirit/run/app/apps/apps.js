// The third of the five to leave index.html (CLEANUP-PLAN step 5.3).
// Same app: the same table, the same expand-one-row edit panel, the same
// focus guard, the same collision alerts. Its id changed with its
// folder, 'app-manager' to 'app/apps' — see APP_ID_RENAMES and
// INTRINSIC_APP_FOLDERS in js/client/shell.js, the Spirit group's member
// list in index.html, and registerGroupApp's "go to Apps" link in
// shell.js, all updated in this same commit.
//
// It edits every OTHER app's overrides through spirit.shell, which is
// the shell's own registry and not something api can scope per-app: an
// app manager that could only manage itself would not be one. Step 6
// decides what a system app's api looks like; until then these are the
// same calls index.html made, from a different file.

var APPS_ICON = spirit.core.const.ICON;
var appsEscapeHtml = spirit.core.util.escapeHtml;

// Lists every registered app (built-in + already-discovered
// dynamic apps) via spirit.shell.listApps(), visually similar to the Jobs
// table — including the same click-a-row-to-expand pattern
// (expandedAppId mirrors Jobs' own expandedJobId, now in app/jobs/jobs.js). The expanded
// panel is the actual edit surface for appOverrides: currently
// just the name property (the only one built so far); more
// properties (icon next) will grow this same panel rather than
// each getting a separate screen.
var expandedAppId = null;

function locationLabel(a, groupsById) {
  if (!a.group) return 'Desktop';
  if (a.group === 'none') return 'None';
  // The Spirit group is the shell's own, not a preferences.groups
  // entry, so it has no row in groupsById to be named from.
  if (a.group === spirit.shell.SPIRIT_GROUP_ID) return 'Spirit';
  var g = groupsById[a.group];
  return g ? g.name : a.group; // fallen-out-of-sync fallback — shouldn't happen, setAppOverride validates on write
}

function renderAppManagerRow(a, groupsById, groupList) {
  var isExpanded = a.id === expandedAppId;
  var mainRow = '<tr class="job-row" data-app-row="' + appsEscapeHtml(a.id) + '">' +
    '<td>' + (isExpanded ? APPS_ICON.POINTDOWN : APPS_ICON.POINTRIGHT) + ' ' + appsEscapeHtml(a.icon) + '</td>' +
    '<td>' + appsEscapeHtml(a.name) + '</td>' +
    '<td>' + appsEscapeHtml(a.id) + '</td>' +
    '<td>' + appsEscapeHtml(locationLabel(a, groupsById)) + '</td>' +
    '<td>' + (a.dynamic ? 'Dynamic' : 'Built-in') + '</td>' +
    '</tr>';

  if (!isExpanded) return mainRow;

  var override = spirit.shell.getAppOverride(a.id);
  // Renaming is locked for built-in shell utilities (see
  // setAppOverride's own comment, shell.js) — a written doc or
  // support note referring to "the Jobs app" should always match
  // what's actually on screen. Dynamically-loaded apps (AI Chat,
  // Text Editor, anything installed later) aren't called out by a
  // fixed name in core docs the same way, so they stay renameable.
  // Saves on change (fires on blur/Enter, not per keystroke) rather
  // than requiring an explicit Save click — one less click, and
  // still compatible with the focus-guard in renderAppManagerTable
  // above, since the input has already blurred by the time change
  // fires. Clearing the field to empty and blurring is equivalent
  // to "Reset to default" (setAppOverride treats '' as "clear this
  // property"); the explicit button stays too, as a one-click
  // shortcut over select-all-and-delete.
  // An intrinsic app gets one note in place of all three
  // controls: name, icon and Location are locked in
  // setAppOverride (shell.js), and a picker whose every value
  // comes back refused is worse than no picker.
  var nameFieldHtml = a.intrinsic
    ? '<div class="job-manifest-note">Intrinsic shell app — part of how this node works, not something installed. Name and icon stay as shipped, and it lives in the Spirit group.</div>'
    : a.dynamic
    ? '<label class="field-label">Custom name' +
      '<input type="text" id="app-manager-name-input" data-app-id="' + appsEscapeHtml(a.id) + '" value="' + appsEscapeHtml(override.name || '') + '" placeholder="' + appsEscapeHtml(a.defaultName) + '"></label>' +
      (override.name ? '<button type="button" class="cancel-btn" data-reset-app-name="' + appsEscapeHtml(a.id) + '">Reset to default</button>' : '')
    : '<div class="job-manifest-note">Built-in shell utility — name and icon stay as shipped. A shell app is its tile on a screen with no labels to read.</div>';
  // Not locked to dynamic apps the way name is — see
  // setAppOverride's comment (shell.js) for why icon doesn't carry
  // the same documentation-drift risk.
  // Built-ins are covered by their own note above, intrinsic apps
  // by theirs: neither offers a control setAppOverride would
  // refuse.
  var iconFieldHtml = (a.intrinsic || !a.dynamic)
    ? ''
    : '<label class="field-label">Custom icon (paste any emoji)' +
    '<input type="text" id="app-manager-icon-input" data-app-id="' + appsEscapeHtml(a.id) + '" value="' + appsEscapeHtml(override.icon || '') + '" placeholder="' + appsEscapeHtml(a.defaultIcon) + '"></label>' +
    (override.icon ? '<button type="button" class="cancel-btn" data-reset-app-icon="' + appsEscapeHtml(a.id) + '">Reset to default</button>' : '');
  // Locked to dynamic apps only, unlike icon — built-in apps' place
  // in the shell is curated by code (Spirit's own fixed member
  // list); groups exist to organize the open-ended, growing set of
  // installed apps, not to override that curation. No collision
  // check (any number of apps may share a group, or all be
  // "none"). "" selects Desktop, which clears the override back to
  // the default, same convention as clearing name/icon.
  // An intrinsic app (Natter) gets a note instead of the control:
  // there is no location for it but the desktop, and offering a
  // picker whose "None" would be refused by setAppOverride is
  // worse than offering nothing.
  var groupFieldHtml = a.intrinsic
    ? '' // the intrinsic note above already says where it lives
    : a.dynamic
    ? '<label class="field-label">Location' +
      '<select id="app-manager-group-input" data-app-id="' + appsEscapeHtml(a.id) + '">' +
        '<option value=""' + (!a.group ? ' selected' : '') + '>Desktop</option>' +
        groupList.map(function (g) {
          return '<option value="' + appsEscapeHtml(g.id) + '"' + (a.group === g.id ? ' selected' : '') + '>' + appsEscapeHtml(g.name) + '</option>';
        }).join('') +
        '<option value="none"' + (a.group === 'none' ? ' selected' : '') + '>None</option>' +
      '</select></label>'
    : '';
  var detailHtml = '<div class="stat-tile wide">' +
    spirit.shell.fileInfoRow('Id', appsEscapeHtml(a.id)) +
    spirit.shell.fileInfoRow('Default name', appsEscapeHtml(a.defaultName)) +
    spirit.shell.fileInfoRow('Default icon', appsEscapeHtml(a.defaultIcon)) +
    spirit.shell.fileInfoRow('Source', a.dynamic ? 'Dynamic (script loads on first launch)' : 'Built-in') +
    nameFieldHtml +
    iconFieldHtml +
    groupFieldHtml +
    '</div>';

  // No .job-log-panel wrapper here, unlike Jobs' own expand panel —
  // that class's max-height/overflow-y:auto is right for Jobs'
  // genuinely unbounded, ever-growing log, but wrong for this
  // panel's small, fixed set of fields: it clipped to a scrollbar
  // once the icon/visibility fields were added, and the periodic
  // re-render (every job-updated tick) recreated that scrollable
  // div fresh each time, visibly resetting its scroll position
  // every ~2s. detailHtml's own .stat-tile wide already provides
  // background/padding, so nothing else is needed here.
  return mainRow + '<tr class="job-log-row"><td colspan="5">' + detailHtml + '</td></tr>';
}

function renderAppManagerTable(force) {
  var tbody = document.getElementById('app-manager-tbody');
  if (!tbody) return;
  // Skip rebuilding while a name/icon/location field is focused,
  // UNLESS force is set. render() fires on every job-updated tick
  // (server-stats alone is ~every 2s, regardless of user action),
  // and a full tbody.innerHTML rebuild destroys and recreates those
  // fields each time — kicking focus out from under anyone mid-edit
  // before they can act, confirmed live twice now: first via
  // matching renderActive/focusout timestamps for the text inputs,
  // then live again for the group <select> specifically — an open
  // native dropdown counts as "focused" too, and was being
  // collapsed out from under a selection in progress before this
  // was added to the same guard. force:true is for the opposite
  // case — a real user action (change/reset/row-toggle) that must
  // always take effect immediately, even if document.activeElement's
  // transition away from the field hasn't fully settled yet.
  var focusedId = document.activeElement && document.activeElement.id;
  if (!force && (focusedId === 'app-manager-name-input' || focusedId === 'app-manager-icon-input' || focusedId === 'app-manager-group-input')) return;
  var groupList = spirit.shell.listGroups();
  var groupsById = {};
  groupList.forEach(function (g) { groupsById[g.id] = g; });
  var rows = spirit.shell.listApps().sort(function (a, b) { return a.name.localeCompare(b.name); });
  tbody.innerHTML = rows.map(function (a) { return renderAppManagerRow(a, groupsById, groupList); }).join('') || '<tr><td colspan="5">(no apps registered)</td></tr>';
}

spirit.shell.activateApp({
  mount: function (container) {
    expandedAppId = null; // fresh visit starts fully collapsed

    container.innerHTML =
      '<table class="jobs-table"><thead><tr>' +
      '<th></th><th>Name</th><th>Id</th><th>Location</th><th>Source</th>' +
      '</tr></thead><tbody id="app-manager-tbody"></tbody></table>';

    document.getElementById('app-manager-tbody').addEventListener('click', function (event) {
      var resetNameBtn = event.target.closest('[data-reset-app-name]');
      if (resetNameBtn) {
        spirit.shell.setAppOverride(resetNameBtn.dataset.resetAppName, { name: '' });
        renderAppManagerTable(true);
        return;
      }

      var resetIconBtn = event.target.closest('[data-reset-app-icon]');
      if (resetIconBtn) {
        spirit.shell.setAppOverride(resetIconBtn.dataset.resetAppIcon, { icon: '' });
        renderAppManagerTable(true);
        return;
      }

      var row = event.target.closest('[data-app-row]');
      if (row) {
        var id = row.dataset.appRow;
        expandedAppId = (expandedAppId === id) ? null : id; // opening one closes any other
        renderAppManagerTable(true); // re-render immediately — don't wait for the next live update
      }
    });

    // Saves on change rather than requiring an explicit Save click
    // — change fires on blur/Enter. force:true here since this IS
    // the user finishing their edit; it must show up right away
    // regardless of exactly where focus has landed by this point.
    document.getElementById('app-manager-tbody').addEventListener('change', function (event) {
      var isName = event.target.id === 'app-manager-name-input';
      var isIcon = event.target.id === 'app-manager-icon-input';
      var isGroup = event.target.id === 'app-manager-group-input';
      if (!isName && !isIcon && !isGroup) return;

      var patch = isName ? { name: event.target.value.trim() }
        : isIcon ? { icon: event.target.value.trim() }
        : { group: event.target.value };
      var result = spirit.shell.setAppOverride(event.target.dataset.appId, patch);
      if (!result.ok) {
        var messages = {
          'name-collision': 'Another app is already showing that name — pick a different one.',
          'icon-collision': 'Another app is already using that icon — pick a different one.',
        };
        alert(messages[result.reason] || ('Could not update this app: ' + result.reason));
      }
      renderAppManagerTable(true);
    });
  },
  render: function () {
    renderAppManagerTable();
  },
});
