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
//     shell/js/bundleSelector.js); below it every grant, the grant list (shell/js/grantSelector/listElement.js, a view
//     of data.grants the node's stream keeps current, goal/G41.14), narrowed by its own filters, an ID and a family with
//     its verb (shell/js/apiFamilySelector.js): the peer's name, the path, deprecated when spiritApiTreeIndex.serves says
//     no server serves it today (a REPORT: pruning is the owner's press, one Revoke at a time), and in the rightmost
//     column each row's Revoke, an armingButton that revokes that grant.
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
var grList = null;      // the grant list (shell/js/grantSelector/listElement.js), a view of data.grants
var grBundleSel = null; // the grant form's bundle selector
var grIdSel = null;     // and its ID selector
var grFilterId = null;  // the list's filters: an ID, and a family with its verb (the family selector)
var grFilterFamily = null;
var grSaid = '';        // what the page says a press did
var grSaidError = false;
var grPaint = null;     // draws the Grants tab again with what it says
function grEsc(text) { return grApi.escapeHtml(String(text == null ? '' : text)); }
// The owner's api tree, once per paint: what serves() judges against. Through the one spirit object, spirit.tree(), which
// answers on the home node and on a face alike (goal/G41.14: asked as the verb 'api', the face's home path refused it,
// the tree came back empty, and every grant read deprecated).
function grLoadTree() {
  return Promise.resolve(spirit.tree()).then(function (t) {
    grTree = t && typeof t === 'object' ? t : {};
    return grTree;
  }, function () { grTree = null; return grTree; });
}
function grSay(text, isError) {
  grSaid = String(text || '');
  grSaidError = !!isError;
  if (grPaint) grPaint();
}
function grRefusal(body) {
  return (body && (body.error || body.code)) || 'refused';
}
// THE LIST'S FILTERS NARROW IT (goal/G41.13, Andy: "a probabilitySearch for grants. with the normal filters,
// (idSelector, apiBranchSelector, apiVerbSelector)", the branch selector since renamed the family selector, goal/G41.14):
// the ID chosen, the family chosen and its verb; one left unchosen means all. No button: the selectors are the filters.
var GR_FILTERS = [
  { name: 'id', when: function () { return false; },
    test: function (row) { var peer = grFilterId ? grFilterId.value : ''; return !peer || (row && row.key === peer) ? 1 : 0; } },
  { name: 'family', when: function () { return false; },
    test: function (row) {
      var family = grFilterFamily ? grFilterFamily.family : '';
      var verb = grFilterFamily ? grFilterFamily.verb : '';
      if (!family) return 1;
      var p = String((row && row.path) || '');
      var dot = p.indexOf('.');
      var app = dot === -1 ? p : p.slice(0, dot);
      if (app !== family) return 0;
      return !verb || p === app + '.' + verb ? 1 : 0;
    } },
  // A DEPRECATED FILTER, OFF BY DEFAULT (Andy: "your allowed to keep the deprecated, BUT you must provide a filter for
  // deprecated that is OFF by default, BUT KNOW THAT THE DEPRECATED IS COMPLETELY INACCURATE....."): off, a grant no
  // server here serves today is left out; on, it is listed, marked.
  // Its button stands on the app's filter line with the others (Andy: "put the fucking deprecated filter on the same
  // fucking line as all other filters"), so the list draws none of its own.
  { name: 'deprecated', word: 'deprecated', toggle: true, when: function () { return false; },
    test: function (row, on) { return on === true || grShowDeprecated || grServes(String((row && row.path) || '')) ? 1 : 0; } },
];
// Deprecated is a REPORT: the server is away or the verb is gone, and the grant waits for the owner, intact
// (suspend/repair, G1.4). The grant row asks this of each path (shell/js/grantSelector/rowElement.js).
function grServes(path) { return !grTree || window.spirit.apiTreeIndex.serves(grTree, path); }
// DEPRECATED FOLLOWS THE STREAM (Andy: "so show deprecated, but CHANGE AS SOON AS STREMED DATA SAYS OTHERWISE."): a
// node's servers are jobs of kind server on its stream, their status changing as each starts and ends; such a job
// changed, the tree is read again and the list redraws, so a grant's mark follows what the node serves. One read at a
// time: a change while one is out asks once more when it lands.
var grShowDeprecated = false;   // the deprecated filter's button, off by default
var grTreeBusy = false;
var grTreeAgain = false;
function grTreeChanged() {
  if (grTreeBusy) { grTreeAgain = true; return; }
  grTreeBusy = true;
  grLoadTree().then(function () {
    grTreeBusy = false;
    if (grList) grList.list.redraw();
    if (grTreeAgain) { grTreeAgain = false; grTreeChanged(); }
  });
}
function grFollowServers() {
  var D = window.spirit.data;
  if (!D || typeof D.translate !== 'function') return;
  var seen = Object.create(null);   // job id -> its last status, so a replay of the same says nothing new
  D.translate({
    onJob: function (job) {
      if (!job || job.kind !== 'server' || !job.id) return;
      var status = String(job.status || '');
      if (seen[job.id] === status) return;
      var first = !(job.id in seen);
      seen[job.id] = status;
      // A server the page first hears of as it registers was in the tree already read.
      if (first && grList === null) return;
      grTreeChanged();
    },
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
      // Each new grant arrives on the stream, one row (rule/19); nothing reads every grant again.
    });
  });
}

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3, goal/G41.5; Andy: every app bootstraps its own components, "lazy-load, is a
// tree...."): through spirit.require, each element bringing its own. Nothing of the old shell's list search is left.
var grParts = Promise.all(['shell/js/grantSelector/listElement.js',
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
  [grFilterId, grFilterFamily].forEach(function (f) { f.addEventListener('change', function () { if (grList) grList.list.redraw(); }); });
  var listHost = document.createElement('div');
  listHost.className = 'fill';
  grPaint = function () {
    // Only the list fills (Andy: "and what about the HUGE vertical space in the grants tab, between the search filters and
    // the search input???"): the heading, the form and the filters take their own height.
    box.innerHTML =
      '<div>' +
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
          // Drawn as the search element draws a toggle: bold and outlined when on.
          '<button type="button" data-grants="deprecated" aria-pressed="' + (grShowDeprecated ? 'true' : 'false') + '" style="' +
            (grShowDeprecated ? 'font-weight:bold;outline:1px solid currentColor' : 'opacity:0.6') + '">deprecated</button>' +
        '</div>' +
      '</div>';
    box.querySelector('[data-grants="id"]').appendChild(grIdSel);
    box.querySelector('[data-grants="bundle"]').appendChild(grBundleSel);
    box.querySelector('[data-grants="filter-id"]').appendChild(grFilterId);
    box.querySelector('[data-grants="filter-family"]').appendChild(grFilterFamily);
    box.querySelector('[data-grants="deprecated"]').addEventListener('click', function () {
      grShowDeprecated = !grShowDeprecated;
      grPaint();
      if (grList) grList.list.redraw();
    });
    box.querySelector('#gr-grant').addEventListener('click', function () { grGrantBundle(); });
    box.appendChild(listHost);
  };
  grPaint();

  // THE GRANTS LIST (goal/G41.14): the grant list element, a view of data.grants the node's stream keeps current, each
  // row a grant row element with its Revoke; this app hands it its filters and what the tree serves.
  // The servers followed first, so the jobs the page already holds are taken as the tree about to be read.
  grFollowServers();
  return grLoadTree().then(function () {
    grList = E.grantList.create(listHost, { filters: GR_FILTERS, serves: grServes, api: grApi });
  });
}
