// spirit/run/spirit/element/search/bundle/rowElement.js
// ONE BUNDLE, AS A ROW ELEMENT, AND WHAT A BUNDLE IS ON THE STREAM (goal/G41.14). Its subject is a bundle of node.db's
// bundle table, keyed by its hidden number; its fields label and owner. rowElement.js does the shared work; this
// file says what a bundle is (G30.18: "rowElements carry the listeners and painters a subject needs for real-time
// updates, wherever they are used").
// Its Edit and Delete went with goal/G41.32 (Andy: "the bundleSelector:pane looses both the 'Edit' button and the 'Delete'
// Button"): a row pressed is the selector's, Delete is the branchEditor's. The label is shown only since goal/G41.26 (Andy:
// "bundleSelector:pane mode the Label should now just be an output, field").
//
// THE TYPE ON THE STREAM, IN ITS OWN ELEMENT (Andy: "EVERY FUCKING element MUST FUCKING LISTING to anything that changes
// their data set. and the SHELL's spirit fucking object is supposed to hold ALL cached data, and propagate updates to the
// fucking elements", "NO FUCKING DATA SCRIPT", "THAT FUCKING ELEMENTS carry THEIR FUCKING DESCRIPTIONS"): the node
// publishes each changed bundle row on its permanent job 'bundles' ({ table: 'bundle', row }, gone when deleted); this
// file puts it into data.bundles of the spirit object, and every bundle row on the page repaints from there through its
// kind's index. A row asks and draws nothing of its own (rule/19): what it shows is what the stream said.
//
//   bundleElement.create(row) -> a rowElement of kind bundle
//     row            { id, label, owner }, as auth.bundle answers it
(function () {
  var E = (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.require.
  if (window.spirit.require) window.spirit.require('spirit/element/rowElement.js');

  // A NODE'S BUNDLES ARE THE auth FAMILY'S CACHE (goal/G41.28): what a bundle row on the stream means, and its branch,
  // are the family's own data.js's (spirit/auth/data.js), which this element loads itself
  // (rule/26), as part of its tree; a row reads spirit.data.auth.data.bundles.
  var authReady = Promise.resolve(window.spirit.cacheManager('auth')).then(function () { return window.spirit.data.auth.data.bundles; });
  // THE KIND'S INDEX: one watch on the bundles for every bundle row on the page, each change to the rows of that key;
  // its release answered to the index, which lets it go with the kind's last row.
  var bundles = null;
  function dispatch(idx) {
    var off = null;
    var gone = false;
    function listen(B) {
      if (gone || !B || off) return;
      off = B.watch(function (key, v) {
        if (!key || !v) return;
        idx.forKey(key).forEach(function (el) { el.apply({ label: String(v.label || ''), owner: String(v.owner || 'node') }); });
      });
    }
    // At once when the manager is on the page already, so a change in the tick a row mounts is heard.
    listen(((window.spirit.data || {}).auth || {}).data && window.spirit.data.auth.data.bundles);
    if (!off) authReady.then(listen);
    return function () { gone = true; if (off) off(); off = null; };
  }
  function index() {
    bundles = bundles || E.rowElement.index(dispatch);
    return bundles;
  }

  function esc(s) {
    var f = window.spirit && spirit.escapeHtml;
    return f ? f(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function create(row) {
    var r = row || {};
    var id = Number(r.id);
    return E.rowElement.create({
      kind: 'bundle',
      key: String(id),
      index: index(),
      row: { id: id, label: String(r.label || ''), owner: String(r.owner || 'node') },
      fields: [
        { name: 'label', paint: function (v) { return esc(v.label); } },
        // THE OWNER, SHOWN ONLY (goal/G41.25; Andy, box: "the bundleSelector's list will gain a new column \"owner\",
        // displayed right after the bundles label", and "the owner field can never be changed after a bundle is added").
        { name: 'owner', paint: function (v) { return esc(v.owner); } },
      ],
    });
  }

  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  Object.assign(['search', 'bundle', 'rowElement'].reduce(function (o, k) { return (o[k] = o[k] || {}); }, E), { create: create });
}());
