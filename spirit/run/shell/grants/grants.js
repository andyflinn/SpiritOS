// spirit/run/shell/grants/grants.js
// WHO MAY CALL WHICH API — the owner's screen for the allow-table (apiAuth/G1.6).
//
//   Andy: "before the switch an, intrinsic auth shellApp must be in place so andy may manage has
//   interactive access", "it will be the apiAuth module that provides the necessary loopback
//   interface for the shell app", "yes i find it by searching labels, then select one key, and
//   issue or revoke grand rows for that key.", "so we defer pruning to be triggered by the owners
//   auth app, who can report deprecated branches", and on the name: "YES to your name".
//
// ON THE SHARED LIST (goal/G29.7). Andy, 2026-10-18: "one line of selectors at the top, no stacked stuff...
// [whose access] [choose a server] [chose a verb, displayed only when a server is chosen ] [grant-button] below it a
// pretty looking list like all other searches", and "the selected ones filter the list with their selection, if not
// selected, the list show "all (peers,servers,verbs)", the search bar below that line searches within those set
// filters." So:
//   - THE LINE: the contact selector, the api-branch selector (server, then verb) and Grant, on one line. Each chosen
//     selector narrows the table; one left unchosen means all. Grant grants what the line names: the peer the server,
//     one verb or all of them; a server that names a bundle (its DEPENDENCIES) offers Grant the bundle beside it.
//   - THE TABLE: every grant, held by the page (auth.search with no words) and ranked by the shared list within
//     the line's filters: the peer's name, the path, deprecated when spiritApiTreeIndex.serves says no server serves
//     it today (a REPORT: pruning is the owner's press, one Revoke at a time), and each row's own Revoke.
// Nothing here writes node.db; every change goes through the loopback verbs apiAuth.js answers.
var grApi = null;
var grTree = null;
var grGrants = [];      // every grant, {name, key, path}, as auth.search answered with no words
var grList = null;      // the shared list over them
var grContact = null;
var grBranch = null;
var grSaid = null;      // where the page says what a press did
var grBundle = null;    // the Grant-the-bundle slot on the line
function grEsc(text) { return grApi.escapeHtml(String(text == null ? '' : text)); }
// The owner's api tree, once per paint: what serves() judges against.
function grLoadTree() {
  return grApi.verb('api').then(function (a) {
    grTree = (a && a.body) || {};
    return grTree;
  });
}
function grSay(text, isError) {
  var out = grSaid;
  if (!out) return;
  out.textContent = text;
  out.className = isError ? 'job-refusal' : 'job-manifest-note';
}
function grRefusal(body) {
  return (body && (body.error || body.code)) || 'refused';
}
// Every grant, held by the page; the shared list ranks them.
function grLoadGrants() {
  return grApi.verb('auth.search', { text: '' }).then(function (a) {
    if (a.status !== 200) { grSay('the grants could not be read: ' + grRefusal(a.body), true); return; }
    grGrants = ((a.body && a.body.items) || []).map(function (i) {
      try { return JSON.parse(i.label); } catch (e) { return null; }
    }).filter(Boolean);
    if (a.body && a.body.more) grSay('more grants than fit one answer: the table shows the first');
    if (grList) grList.redraw();
  });
}
// THE LINE'S FILTERS: a chosen peer, server or verb narrows the table; unchosen means all.
function grRows() {
  var peer = grContact ? grContact.value : '';
  var server = grBranch ? grBranch.server : '';
  var verb = grBranch ? grBranch.verb : '';
  return grGrants.filter(function (g) {
    if (peer && g.key !== peer) return false;
    var dot = g.path.indexOf('.');
    var app = dot === -1 ? g.path : g.path.slice(0, dot);
    if (server && app !== server) return false;
    if (verb && g.path !== app + '.' + verb) return false;
    return true;
  }).map(function (g) { return { key: g.key + '\n' + g.path, name: g.name, path: g.path, peer: g.key }; });
}
// EACH GRANT A ROW ELEMENT (goal/G41.5): it paints whose grant it is, the path, and its own Revoke, a row action that asks
// the node once he is sure; the grants read again afterwards are what the list then shows (rule/19).
function grElement(row, key) {
  var el = window.spirit.elements.rowElement.create({
    kind: 'grant',
    key: key,
    row: row,
    fields: [
      { name: 'name', paint: function (r) { return '<span style="white-space:nowrap">' + grEsc(r.name) + '</span>'; } },
      { name: 'path', paint: function (r) {
        var gone = grTree && !window.spirit.apiTreeIndex.serves(grTree, r.path);
        return '<span style="white-space:nowrap">' + grEsc(r.path) + '</span>' +
          // Deprecated is a REPORT: the server is away or the verb is gone,
          // and the grant waits for the owner, intact (suspend/repair, G1.4).
          (gone ? ' <span class="gr-gone" title="no server serves this path today">deprecated</span>' : '');
      } },
      { name: 'revoke', paint: function () { return '<button type="button" class="gr-revoke" data-action="revoke">Revoke</button>'; } },
    ],
    actions: [{ name: 'revoke', label: 'Revoke', run: function (e) { return grRevoke(e.row.peer, e.row.path); } }],
  });
  // REVOKE ASKS "ARE YOU SURE?" (goal/G41.9). THE ARE-YOU-SURE IS THE SHELL'S: the drawn Revoke made an armingButton as
  // the row mounts, its second press the element's action.
  var mount = el.mount;
  el.mount = function (hosts) {
    mount(hosts);
    var b = hosts && hosts.revoke ? hosts.revoke.querySelector('[data-action="revoke"]') : null;
    if (b) window.spirit.elements.armingButton.attach(b, { label: 'Revoke', api: grApi, run: function () { return el.act('revoke', {}); } });
    return el;
  };
  return el;
}

// The chosen server's bundle: its DEPENDENCIES (<server>.DEPENDENCIES on the flat apiDoor),
// the way every owner question reaches a server.
function grLoadBundle(server) {
  var slot = grBundle;
  if (!slot) return;
  if (!server) { slot.innerHTML = ''; return; }
  grApi.verb(server + '.DEPENDENCIES', {}).then(function (a) {
    var paths = (a.body && a.body.paths) || [];
    slot.innerHTML = paths.length
      ? '<button type="button" id="gr-grant-bundle" title="' + grEsc(server) + ' says a peer user needs: ' + grEsc(paths.join(', ')) + '">Grant the bundle</button>'
      : '';
    var all = slot.querySelector('#gr-grant-bundle');
    if (all) all.addEventListener('click', function () { grGrantMany(paths); });
  });
}

// THE WARNINGS BEFORE A GRANT (goal/G30.4; Andy, 2026-10-20: "the grant screen warns when a grant reaches a verb that
// carries a warning"). A warning is a file in the family's folder, <verb>.warning.txt, read through that family's FS
// (FS.loadFile); nothing about it is opened to agents. A grant of a whole family reaches every verb in it, so each
// one's is read. Asked through the one flat door, node families and apps alike.
function grWarnings(path) {
  var dot = path.indexOf('.');
  var family = dot === -1 ? path : path.slice(0, dot);
  var verbs = dot === -1
    ? Object.keys((grTree && grTree[family]) || {}).filter(function (v) { return v.indexOf('AGENTS') !== 0 && v.indexOf('FS.') !== 0; })
    : [path.slice(dot + 1)];
  return Promise.all(verbs.map(function (verb) {
    return grApi.verb(family + '.FS.loadFile', { path: verb + '.warning.txt' }).then(function (a) {
      var w = a && a.body && typeof a.body.text === 'string' ? a.body.text.trim() : '';
      return w ? family + '.' + verb + ': ' + w : '';
    }, function () { return ''; });
  })).then(function (all) { return all.filter(Boolean); });
}

function grGrant(key, path) {
  if (!key) { grSay('pick whose access first', true); return Promise.resolve(); }
  if (!path) { grSay('pick a server first', true); return Promise.resolve(); }
  return grWarnings(path).then(function (warnings) {
    if (warnings.length && !window.confirm('Before you grant ' + path + ':\n\n' + warnings.join('\n\n') + '\n\nGrant it anyway?')) {
      grSay('not granted: ' + path);
      return null;
    }
    return grGrantNow(key, path);
  });
}

function grGrantNow(key, path) {
  return grApi.verb('auth.grant', { key: key, path: path }).then(function (a) {
    if (a.status !== 200) { grSay('grant refused: ' + grRefusal(a.body), true); return; }
    grSay('granted ' + ((a.body && a.body.label) || '') + ' ' + path);
    return grLoadGrants();
  });
}

function grGrantMany(paths) {
  var key = grContact ? grContact.value : '';
  if (!key) { grSay('pick whose access first', true); return; }
  var left = paths.slice();
  (function next() {
    if (!left.length) return;
    grGrant(key, left.shift()).then(next);
  })();
}

function grRevoke(key, path) {
  return grApi.verb('auth.revoke', { key: key, path: path }).then(function (a) {
    if (a.status !== 200) { grSay('revoke refused: ' + grRefusal(a.body), true); return; }
    grSay('revoked ' + path);
    return grLoadGrants();
  });
}

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3, goal/G41.5; Andy: every app bootstraps its own components, "lazy-load, is a
// tree...."): through spirit.require, each element bringing its own. Nothing of the old shell's list search is left.
var grParts = Promise.all(['shell/js/probabilitySearch.js', 'shell/js/rowElement.js', 'shell/js/contacts/listElement.js',
  'shell/js/apiBranchSelector.js', 'shell/js/armingButton.js'].map(function (p) { return spirit.require(p); }));

spirit.shell.activateApp({
  mount: function (container, api) {
    grApi = api;
    // THE PAGE IS A FLEX COLUMN, AND THE LIST TAKES WHAT IT LEAVES (rule/16; as in Apps and Contacts).
    container.innerHTML =
      '<div class="fill">' +
        '<div class="label">Who may call which api</div>' +
        '<div class="job-manifest-note">A member calls only what you have granted: a whole server, ' +
          'or one verb. Denial is the absence of a row, so an empty table means only you.</div>' +
        // THE LINE, nothing stacked: [whose access] [server] [verb] [Grant] [Grant the bundle].
        '<div data-grants="line" style="display:flex;flex-wrap:wrap;align-items:center;gap:1em;margin-top:1em"></div>' +
        '<div data-grants="said" class="job-manifest-note"></div>' +
        '<div data-grants="list" class="fill"></div>' +
      '</div>';
    var line = container.querySelector('[data-grants="line"]');
    grSaid = container.querySelector('[data-grants="said"]');
    var listHost = container.querySelector('[data-grants="list"]');
    return grParts.then(function () { return grDraw(api, line, listHost); }, function () { listHost.textContent = 'Grants could not be loaded.'; });
  },
});

function grDraw(api, line, listHost) {
    var E = window.spirit.elements;
    // The contacts list as a dropdown (goal/G30.20, shell/js/contacts/listElement.js); its value is the picked key.
    var contactHost = document.createElement('span');
    grContact = E.contactList.create(contactHost, {
      api: api,
      face: 'dropdown',
      placeholder: 'whose access…',
      all: 'all peers',
      pick: function () { grList.redraw(); grLine(); },
    }).list;
    grBranch = E.createApiBranchSelector({ all: 'all servers' });
    var grant = document.createElement('button');
    grant.type = 'button';
    grant.id = 'gr-grant';
    grant.textContent = 'Grant';
    // NO BLANKET GRANTS (Andy, 2026-10-18: "just don't show the Grant button, show \"Select a contact\". The designed
    // restriction makes sense."): Grant shows only once a contact and a server are chosen; until then the line says
    // which is missing.
    var hint = document.createElement('span');
    hint.id = 'gr-hint';
    hint.className = 'job-manifest-note';
    function grLine() {
      var missing = !grContact.value ? 'Select a contact' : !grBranch.server ? 'Select a server' : '';
      grant.hidden = !!missing;
      hint.hidden = !missing;
      hint.textContent = missing;
    }
    grBundle = document.createElement('span');
    grBundle.id = 'gr-bundle';
    line.appendChild(contactHost);
    line.appendChild(grBranch);
    line.appendChild(grant);
    line.appendChild(hint);
    line.appendChild(grBundle);

    // THE GRANTS LIST, A PROBABILITYSEARCH PANE (goal/G41.5): the page's grants are its rows, each a row element.
    grList = E.probabilitySearch.create(listHost, {
      rows: grRows,
      columns: [
        { field: 'name', label: 'Whose', sort: 'text' },
        { field: 'path', label: 'Path', sort: 'text' },
        { field: 'revoke', label: '' },
      ],
      element: grElement,
      matched: function (row) { return { name: row.name, path: row.path.split('.').join(' ') }; },
      empty: 'No grant matches.',
    });

    grBranch.addEventListener('change', function () {
      grList.redraw();
      grLine();
      grLoadBundle(grBranch.server);
    });
    grant.addEventListener('click', function () { grGrant(grContact.value, grBranch.value); });

    grLine();
    return grLoadTree().then(grLoadGrants);
}
