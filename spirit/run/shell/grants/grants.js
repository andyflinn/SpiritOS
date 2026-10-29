// spirit/run/shell/grants/grants.js
// WHO MAY CALL WHICH API — the owner's screen for the allow-table (apiAuth/G1.6).
//
//   Andy: "before the switch an, intrinsic auth shellApp must be in place so andy may manage has
//   interactive access", "it will be the apiAuth module that provides the necessary loopback
//   interface for the shell app", "yes i find it by searching labels, then select one key, and
//   issue or revoke grand rows for that key.", "so we defer pruning to be triggered by the owners
//   auth app, who can report deprecated branches", and on the name: "YES to your name".
//
// TWO TABS, AND EVERY GRANT THROUGH A BUNDLE (goal/G41.13, box v7). Its contract and its test: ./test/grants.md and
// ./test/grants.js.
//   - GRANTS: the one-row grant form, "grant" [ID selector] [bundle selector] [Grant] (shell/js/contactSelector.js,
//     shell/js/bundleSelector.js); below it every grant, held by the page (auth.search with no words) and ranked by
//     probabilitySearch, narrowed by its own filters, an ID and a family with its verb (shell/js/apiFamilySelector.js):
//     the peer's name, the path, deprecated when spiritApiTreeIndex.serves says no server serves it today (a REPORT:
//     pruning is the owner's press, one Revoke at a time), and in the rightmost column each row's Revoke, an
//     armingButton that revokes that grant.
//   - BUNDLES: the bundle editor (shell/js/bundleEditor.js), "where bundles are created and maintained with the bundle
//     shell element".
// A BUNDLE IS NOT GRANTED BY REFERENCE (box v7): "each path row of the bundle, combined with the ID chosen in the ID
// selector (contactSelector), becomes a new auth row, unless that row exists already": since goal/G41.14 a bundle's rows
// are its branches (auth.branch), one auth.grant per branch, its path family.verb or the family alone for (ALL), a path
// already granted counted done. The old line, its api-branch selector, its contacts list and the Grant the bundle button
// of a server's DEPENDENCIES are gone with it.
// Nothing here writes node.db; every change goes through the loopback verbs apiAuth.js answers.
var grApi = null;
var grTree = null;
var grGrants = [];      // every grant, {name, key, path}, as auth.search answered with no words
var grList = null;      // the probabilitySearch over them
var grBundleSel = null; // the grant form's bundle selector
var grIdSel = null;     // and its ID selector
var grFilterId = null;  // the list's filters: an ID, and a family with its verb (the family selector)
var grFilterFamily = null;
var grSaid = '';        // what the page says a press did
var grSaidError = false;
var grPaint = null;     // draws the Grants tab again with what it says
function grEsc(text) { return grApi.escapeHtml(String(text == null ? '' : text)); }
// The owner's api tree, once per paint: what serves() judges against.
function grLoadTree() {
  return grApi.verb('api').then(function (a) {
    grTree = (a && a.body) || {};
    return grTree;
  });
}
function grSay(text, isError) {
  grSaid = String(text || '');
  grSaidError = !!isError;
  if (grPaint) grPaint();
}
function grRefusal(body) {
  return (body && (body.error || body.code)) || 'refused';
}
// Every grant, held by the page; the list ranks them.
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
// THE LIST'S FILTERS NARROW IT (goal/G41.13, Andy: "a probabilitySearch for grants. with the normal filters,
// (idSelector, apiBranchSelector, apiVerbSelector)", the branch selector since renamed the family selector, goal/G41.14):
// the ID chosen, the family chosen and its verb; one left unchosen
// means all. A row is one grant, keyed by its peer and path.
function grRows() {
  var peer = grFilterId ? grFilterId.value : '';
  var family = grFilterFamily ? grFilterFamily.family : '';
  var verb = grFilterFamily ? grFilterFamily.verb : '';
  return grGrants.filter(function (g) {
    if (peer && g.key !== peer) return false;
    var dot = g.path.indexOf('.');
    var app = dot === -1 ? g.path : g.path.slice(0, dot);
    if (family && app !== family) return false;
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

// A BUNDLE'S PATHS, from its branches (goal/G41.14): auth.branch's search on that bundle, each branch family.verb, or
// the family alone for the empty verb, all of it (the node's grant takes a family as every verb of it).
function grBundlePaths(bundle) {
  return grApi.verb('auth.branch', { op: 'search', text: '', bundle: Number(bundle.id) }).then(function (a) {
    if (a.status !== 200) throw new Error(grRefusal(a.body));
    if (a.body && a.body.more) grSay('more branches than fit one answer: only the first are granted');
    return ((a.body && a.body.items) || []).map(function (i) {
      var b = null;
      try { b = JSON.parse(i.label); } catch (e) { b = null; }
      return b && b.family ? (b.verb ? b.family + '.' + b.verb : b.family) : '';
    }).filter(Boolean);
  });
}

// GRANT: the chosen bundle's branches to the chosen ID, one auth.grant per branch, after the warnings of every path it
// reaches; a path the ID holds already is counted done; any other refusal is said. Then the grants are read again.
function grGrantBundle() {
  var key = grIdSel ? grIdSel.value : '';
  var bundle = grBundleSel ? grBundleSel.row : null;
  if (!key || !bundle || !grBundleSel.value) return Promise.resolve();
  var paths = [];
  return grBundlePaths(bundle).then(function (got) {
    paths = got;
    return Promise.all(paths.map(grWarnings));
  }, function (e) { grSay('the bundle could not be read: ' + ((e && e.message) || e), true); return null; }).then(function (lists) {
    if (!lists) return null;
    var warnings = [].concat.apply([], lists);
    if (warnings.length && !window.confirm('Before you grant ' + (bundle.label || 'this bundle') + ':\n\n' + warnings.join('\n\n') + '\n\nGrant it anyway?')) {
      grSay('not granted: ' + (bundle.label || 'the bundle'));
      return null;
    }
    var done = 0;
    var refused = [];
    return paths.reduce(function (chain, path) {
      return chain.then(function () {
        return grApi.verb('auth.grant', { key: key, path: path }).then(function (a) {
          var code = a && a.body && a.body.code;
          if (a.status === 200 || code === 'already-granted') { done += 1; return; }
          refused.push(path + ': ' + grRefusal(a.body));
        });
      });
    }, Promise.resolve()).then(function () {
      if (refused.length) grSay('not granted: ' + refused.join('; '), true);
      else grSay('granted ' + (bundle.label || 'the bundle') + ' (' + done + ' of ' + paths.length + ' paths) to ' + ((grIdSel.row && grIdSel.row.name) || 'that ID'));
      return grLoadGrants();
    });
  });
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
var grParts = Promise.all(['shell/js/probabilitySearch.js', 'shell/js/rowElement.js', 'shell/js/armingButton.js',
  'shell/js/tabContainer.js', 'shell/js/bundleSelector.js', 'shell/js/contactSelector.js', 'shell/js/bundleEditor.js',
  'shell/js/apiFamilySelector.js'].map(function (p) { return spirit.require(p); }));

spirit.shell.activateApp({
  mount: function (container, api) {
    grApi = api;
    return grParts.then(function () {
      var E = window.spirit.elements;
      E.tabContainer.create(container, {
        tabs: [
          { name: 'grants', label: 'Grants', mount: function (box) { grGrantsTab(box); } },
          { name: 'bundles', label: 'Bundles', mount: function (box) { E.bundleEditor.create(box, { api: api }); } },
        ],
      });
    }, function () { container.textContent = 'Grants could not be loaded.'; });
  },
});

// THE GRANTS TAB: the grant form, what a press did, the filters, and the list below in a box of a stated size (rule/16). Drawn again
// when it has something to say; the selectors and the list are made once and put back in their places.
function grGrantsTab(box) {
  var E = window.spirit.elements;
  // THE GRANT FORM, ONE ROW (goal/G41.13, Andy: "the grants tab should have one-row grant form: \"grant\" [idSelector]
  // [bundleSelector] [grantButton]").
  grIdSel = E.createContactSelector({ placeholder: 'choose an ID…' });
  grBundleSel = E.createBundleSelector({ placeholder: 'choose a bundle…' });
  // THE LIST'S FILTERS, their own selectors: an ID, and a family with its verb.
  grFilterId = E.createContactSelector({ placeholder: 'every ID', all: 'every ID' });
  grFilterFamily = E.createApiFamilySelector({ all: 'every family' });
  [grFilterId, grFilterFamily].forEach(function (f) { f.addEventListener('change', function () { if (grList) grList.redraw(); }); });
  var listHost = document.createElement('div');
  listHost.className = 'fill';
  grPaint = function () {
    box.innerHTML =
      '<div class="fill">' +
        '<div class="label">Who may call which api</div>' +
        '<div class="job-manifest-note">A member calls only what you have granted, a bundle at a time. ' +
          'Denial is the absence of a row, so an empty table means only you.</div>' +
        '<div data-grants="line" style="display:flex;flex-wrap:wrap;align-items:center;gap:1em;margin-top:1em">' +
          '<span>grant</span><span data-grants="id"></span><span data-grants="bundle"></span>' +
          '<button type="button" id="gr-grant">Grant</button>' +
        '</div>' +
        '<div data-grants="said" class="' + (grSaidError ? 'job-refusal' : 'job-manifest-note') + '">' + grEsc(grSaid) + '</div>' +
        '<div data-grants="filters" style="display:flex;flex-wrap:wrap;align-items:center;gap:1em;margin-top:1em">' +
          '<span data-grants="filter-id"></span><span data-grants="filter-family"></span>' +
        '</div>' +
      '</div>';
    box.querySelector('[data-grants="id"]').appendChild(grIdSel);
    box.querySelector('[data-grants="bundle"]').appendChild(grBundleSel);
    box.querySelector('[data-grants="filter-id"]').appendChild(grFilterId);
    box.querySelector('[data-grants="filter-family"]').appendChild(grFilterFamily);
    box.querySelector('#gr-grant').addEventListener('click', function () { grGrantBundle(); });
    box.appendChild(listHost);
  };
  grPaint();

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
  return grLoadTree().then(grLoadGrants);
}
