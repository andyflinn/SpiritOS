// spirit/run/shell/grants/grants.js
// WHO MAY CALL WHICH API — the owner's screen for the allow-table (apiAuth/G1.6).
//
//   Andy: "before the switch an, intrinsic auth shellApp must be in place so andy may manage has
//   interactive access", "it will be the apiAuth module that provides the necessary loopback
//   interface for the shell app", "yes i find it by searching labels, then select one key, and
//   issue or revoke grand rows for that key.", "so we defer pruning to be triggered by the owners
//   auth app, who can report deprecated branches", and on the name: "YES to your name".
//
// A WRAPPER OF THE GRANTS PANEL (goal/G41.16; Andy: "the shell app shell/grans/grants/ must be a wrapper for a new shell
// element: shell/js/grantsPanel.js"). Two tabs (goal/G41.13): Grants, the grants panel (shell/js/grantsPanel.js);
// Bundles, the bundle editor (shell/js/bundleEditor.js). The panel knows no table; this app configures it (Andy: "the
// callers (Grants and agent shell apps should boody well know how to configure the damn grantsPanel element"): its IDs
// are the contacts, its grants the node's auth table. Its contract and its test: ./test/grants.md and ./test/grants.js.
// Nothing here writes node.db; every change goes through the loopback verbs apiAuth.js answers.
var grApi = null;

// The node's grants, as the panel, the grant list and the grant row take a grants table: kept in data.grants, keyed by
// the peer's key, labelled by whose grant it is; each grant row arrives on the auth tables' job (table grant, gone when
// revoked, goal/G41.14).
function grAnswer(a) {
  if (a && a.status === 200) return { ok: true };
  var b = (a && a.body) || {};
  return { ok: false, code: String(b.code || ''), error: String(b.error || b.code || 'refused') };
}
var GR_GRANTS = {
  branch: 'grants',
  key: 'key',
  label: 'label',
  search: function (text) {
    return grApi.verb('auth.search', { text: String(text || '') }).then(function (a) {
      var b = (a && a.body) || {};
      return { items: b.items || [], more: !!b.more };
    });
  },
  grant: function (id, path) { return grApi.verb('auth.grant', { key: id, path: path }).then(grAnswer); },
  revoke: function (id, path) { return grApi.verb('auth.revoke', { key: id, path: path }).then(grAnswer); },
  stream: function (job) {
    var d = job && job.type === 'bundles' ? job.data : null;
    return d && d.table === 'grant' ? { row: d.row, gone: d.gone === true } : null;
  },
};

// WHAT IT USES, IT LOADS ITSELF (goal/G41.3, goal/G41.5; Andy: every app bootstraps its own components, "lazy-load, is a
// tree...."): through spirit.require, each element bringing its own.
var grParts = Promise.all(['shell/js/grantsPanel.js', 'shell/js/tabContainer.js', 'shell/js/bundleEditor.js']
  .map(function (p) { return spirit.require(p); }));

spirit.shell.activateApp({
  mount: function (container, api) {
    grApi = api;
    return grParts.then(function () {
      var E = window.spirit.elements;
      E.tabContainer.create(container, {
        tabs: [
          { name: 'grants', label: 'Grants', mount: function (box) {
            E.grantsPanel.create(box, { ids: { table: 'loopback://api/contact/search' }, grants: GR_GRANTS, api: api });
          } },
          { name: 'bundles', label: 'Bundles', mount: function (box) { E.bundleEditor.create(box, { api: api }); } },
        ],
      });
    }, function () { container.textContent = 'Grants could not be loaded.'; });
  },
});
