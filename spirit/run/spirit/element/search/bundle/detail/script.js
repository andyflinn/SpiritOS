'use strict';
// spirit/run/spirit/element/search/bundle/detail/script.js
// ONE BUNDLE'S BRANCHES, EDITED: what a closable tab holds (goal/G41.32; goal/G41.14). Andy, box: "the branchEditor page is
// always configured with a bundle key", "second row, add form: "new" [apiFamilySelector:dropdown] [apiVerbSelector:dropdown]
// [Add-button]" (a rowForm since goal/G41.27, ➕ for "new"), "branchSelector:pane, with table columns as follows: 1. Family
// (duh?) 2. Verb 3. armingButton 'Delete'". The two dropdowns of the add form are the family selector's two halves (Andy:
// "apiFamiliySelector.js will use apiVerbSelector as part of itself").
//
// THE BUNDLE SEARCH'S DETAIL since goal/G43.32 (Andy: "uniformity, in the search elements and their folders, contain list,
// row an detail elements."), spirit/element/branchEditor.js before; the bundle selector (../script.js) opens it in a pane's
// tab. Its contract and its test: ./test/script.md and ./test/detail.js.
//
//   spirit.required.spirit.element.search.bundle.detail.create(container, { bundle, label, owner, gone }) -> { destroy() }
//     bundle  the bundle's id; label its label; owner its owner (its Delete is an armingButton, which hears a click elsewhere itself)
//     gone    called when this bundle's deletion is heard (Andy: "a bundle that hears its deletion, closes its branchEditor tab.")
// A BUNDLE NOT THE NODE'S IS SHOWN ONLY (Andy: "A user can only create, change and delete node-owned bundles and branches, and
// sees the others read-only"): its branches, no add form, no Delete. The node refuses them as well.
// An Add left at All Verbs is the empty verb, all of the family. The node checks the family and verb against its api
// tree and refuses a family and verb the bundle holds already; a refusal is said in the page in the node's words.
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/auth/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function () {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  // What it reads, it asks for itself, as it runs (goal/G49.9; rule/26).
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/branch/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/rowForm/script.js');
  if (window.spirit && typeof window.spirit.requireScript === 'function') keepAnswer('spirit/element/search/api/script.js');
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26): through spirit.requireScript.
  var parts = Promise.all(['spirit/element/search/api/script.js', 'spirit/element/search/branch/script.js', 'spirit/element/rowForm/script.js'].map(function (p) {
    return window.spirit.requireScript ? window.spirit.requireScript(p) : null;
  }).concat([window.spirit.requireScript ? keepAnswer('spirit/element/armingButton/script.js') : null, keepAnswer('spirit/auth/api.js')]));

  function mount(box, o) {
    box.innerHTML = '';
    var A = ((window.spirit.required.spirit.data || {}).auth || {}).data;
    // ITS DELETION HEARD, FROM THIS SCREEN OR ANY OTHER: the mounter closes it.
    var offBundle = A && typeof o.gone === 'function' ? A.bundles.watch(function (key, v) {
      if (String(key) === String(o.bundle) && !v) o.gone();
    }) : null;
    if ((o.owner || 'node') !== 'node') {
      var shown = ANSWER['spirit/element/search/branch/script.js'].create(box, { bundle: o.bundle, face: 'pane', columns: ['family', 'verb'] });
      shown.className += ' fill';
      return { destroy: function () { if (typeof offBundle === 'function') offBundle(); shown.destroy(); } };
    }
    // THE ADD FORM, A ROWFORM (goal/G41.27; Andy: "branchEditor:\n\n[➕] [choose a family… ▾] [Add]", and "careful,
    // there's a hidden verb selector there that only displays when a family is selected... !\n[➕] [choose a family… ▾]
    // [All Verbs ▾] [Add]"): ➕, the family selector in its span, its verb half with it, Add its button.
    // ITS ADD IS THE ROWFORM'S TO HEAR (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer
    // comes"): handed as press, so Add is busy until the node answers.
    var form = ANSWER['spirit/element/rowForm/script.js'].create(box, { icon: '➕', button: 'Add', press: function () { return addBranch(); } });
    form.root.className += ' branch-editor-add';
    var family = ANSWER['spirit/element/search/api/script.js'].create(form.span, { all: 'choose a family…' });
    var said = document.createElement('div');
    said.className = 'job-manifest-note';
    // Each note keeps its words inside (spirit-sibling-browser.js: overflow not visible).
    if (said.style) said.style.overflow = 'hidden';
    box.appendChild(said);
    // THE BUNDLE'S BRANCHES, filling the rest (shell.css fill).
    var branches = ANSWER['spirit/element/search/branch/script.js'].create(box, { bundle: o.bundle, face: 'pane', columns: ['family', 'verb', 'delete'] });
    branches.className += ' fill';

    function say(text) { said.textContent = String(text || ''); }
    // WHAT IT ADDS, IT FOLLOWS IN spirit.required.spirit.data (goal/G41.28; Andy: "EVERY FUCKING ELEMENT is verified to make sure when it
    // changes shit it listens to fucking update via the spirit object"): the branches the auth family's cache keeps
    // (spirit.required.spirit.data.auth.data.branches). The branch asked for, once there, is said added.
    var waiting = null;
    var off = A ? A.branches.watch(function (id, v) {
      if (!waiting || !v) return;
      if (Number(v.bundle) === waiting.bundle && String(v.family) === waiting.family && String(v.verb || '') === waiting.verb) { waiting = null; say('added'); }
    }) : null;
    function addBranch() {
      if (!family.family) { say('choose a family first'); return null; }
      say('');
      var ask = { op: 'add', bundle: Number(o.bundle), family: family.family, verb: family.verb || '' };
      waiting = { bundle: ask.bundle, family: ask.family, verb: ask.verb };
      return spirit.readyPromise.then(function () { return keepAnswer('spirit/auth/api.js'); }).then(function (s) { return s.branch(ask); }).then(function () {
        branches.refresh();
      }, function (e) { waiting = null; say((e && (e.message || e.refusal)) || 'not added'); });
    }
    // AT THE BOTTOM, THE BUNDLE'S DELETE (goal/G41.32; Andy: "i need the branchEditor to have a rowForm at the bottom: [❌]
    // "Delete <bundle-name> bundle and branches " [Delete (armingButton)]."): the bundle and every branch that names it, in one
    // transaction at the node, and what closes this is hearing it. A refusal is said below it, in the node's words.
    var del = ANSWER['spirit/element/rowForm/script.js'].create(box, { icon: '❌', button: 'Delete' });
    del.root.className += ' branch-editor-delete';
    del.span.textContent = 'Delete ' + String(o.label || '') + ' bundle and branches';
    var delSaid = document.createElement('div');
    delSaid.className = 'job-manifest-note';
    if (delSaid.style) delSaid.style.overflow = 'hidden';
    box.appendChild(delSaid);
    ANSWER['spirit/element/armingButton/script.js'].attach(del.button, { label: 'Delete', run: function () {
      delSaid.textContent = '';
      return spirit.readyPromise.then(function () { return keepAnswer('spirit/auth/api.js'); }).then(function (s) { return s.bundle({ op: 'delete', id: Number(o.bundle) }); }).then(null, function (e) {
        delSaid.textContent = (e && (e.message || e.refusal)) || 'not deleted';
      });
    } });
    // Everything it made, and its watches, let go with it (rule/8).
    return { destroy: function () { if (typeof off === 'function') off(); if (typeof offBundle === 'function') offBundle(); family.destroy(); branches.destroy(); } };
  }

  // And the shell's element shape (goal/G41.19, box v23): create(container, options) draws the editor into the
  // container, once its parts are in.
  function create(container, options) {
    var gone = false;
    var mounted = null;
    parts.then(function () { if (!gone) mounted = mount(container, options || {}); });
    return { destroy: function () { gone = true; if (mounted) mounted.destroy(); mounted = null; container.innerHTML = ''; } };
  }
  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}());
