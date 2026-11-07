// spirit/run/shell/grants/grants.js
// WHO MAY CALL WHICH API — the owner's screen for the allow-table (apiAuth/G1.6).
//
//   Andy: "before the switch an, intrinsic auth shellApp must be in place so andy may manage has
//   interactive access", "it will be the apiAuth module that provides the necessary loopback
//   interface for the shell app", "yes i find it by searching labels, then select one key, and
//   issue or revoke grand rows for that key.", "so we defer pruning to be triggered by the owners
//   auth app, who can report deprecated branches", and on the name: "YES to your name".
//
// A WRAPPER OF THE GRANTS PANEL (goal/G41.16; Andy: "the shell app shell/grans/grants/ must be a wrapper for a new shell element: shell/js/grantsPanel.js").
// Two tabs (goal/G41.13): Grants, the grants panel (spirit/element/grantsPanel.js);
// Bundles, the bundle editor (spirit/element/bundleEditor.js). The panel knows no table; this app configures it (Andy: "the
// callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel element"): its IDs
// are the contacts, its grants the node's auth table. Its contract and its test: ./test/grants.md and ./test/grants.js.
// Nothing here writes node.db; every change goes through the loopback verbs apiAuth.js answers.
var grApi = null;

// The node's grants, as the panel, the grant list and the grant row take a grants table: kept by the auth family's
// cache manager (spirit.data.auth.data.grants, goal/G41.28), keyed by the peer's key, labelled by whose grant it is; each grant
// row arrives on the auth tables' job (table grant, gone when revoked, goal/G41.14), which the manager translates. WHO
// ASKS FOR A CHANGE LISTENS FOR IT (goal/G41.27): what grant and revoke send comes back through watch, the manager's.
function grAnswer(a) {
  if (a && a.status === 200) return { ok: true };
  var b = (a && a.body) || {};
  return { ok: false, code: String(b.code || ''), error: String(b.error || b.code || 'refused') };
}
var GR_GRANTS = {
  get branch() { return window.spirit.data.auth.data.grants.branch; },
  // watch(fn): fn(id + newline + path, row) on every grant kept or let go; answers its release.
  watch: function (fn) { return window.spirit.data.auth.data.grants.watch(fn); },
  key: 'key',
  label: 'label',
  // auth.search answers whose grant it is as name, the stream as label: a found row carries it as label too, so the
  // panel reads one field.
  search: function (text) {
    return grApi.verb('auth.search', { text: String(text || '') }).then(function (a) {
      var b = (a && a.body) || {};
      var items = (b.items || []).map(function (i) {
        var r = null;
        try { r = JSON.parse(i.label); } catch (e) { r = null; }
        return r && typeof r === 'object' && r.label === undefined && r.name !== undefined ? { key: i.key, label: JSON.stringify(Object.assign({}, r, { label: r.name })) } : i;
      });
      return { items: items, more: !!b.more };
    });
  },
  grant: function (id, path) { return grApi.verb('auth.grant', { key: id, path: path }).then(grAnswer); },
  revoke: function (id, path) { return grApi.verb('auth.revoke', { key: id, path: path }).then(grAnswer); },
};

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3, goal/G41.5; Andy: every app bootstraps its own components, "lazy-load, is a
// tree...."): through spirit.require, each element bringing its own.
var grParts = Promise.all(['spirit/element/grantsPanel.js', 'spirit/element/tabContainer.js', 'spirit/element/bundleEditor.js']
  .map(function (p) { return spirit.require(p); }).concat([spirit.cacheManager('auth')]));

spirit.shell.activateApp({
  mount: function (container, api) {
    grApi = api;
    return grParts.then(function () {
      var E = window.spirit.element;
      // The bundles pane opens each bundle's branchEditor as a closable tab in this row (goal/G41.32; Andy: "in the Grants
      // app, this will be the grant app's tabContainer."), each named owner-bundle (Andy: "Grants: <owner>-<bundle>.").
      var tabs = E.tabContainer.create(container, {
        tabs: [
          { name: 'grants', label: 'Grants', mount: function (box) {
            E.grantsPanel.create(box, { ids: { table: 'loopback://api/contact/search' }, grants: GR_GRANTS, api: api });
          } },
          { name: 'bundles', label: 'Bundles', mount: function (box) { E.bundleEditor.create(box, { api: api, tabs: tabs, tabLabel: function (row) { return String(row.owner || 'node') + '-' + String(row.label || ''); } }); } },
        ],
      });
    }, function () { container.textContent = 'Grants could not be loaded.'; });
  },
});
