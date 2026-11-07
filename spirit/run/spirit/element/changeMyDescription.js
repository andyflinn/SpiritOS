// spirit/run/spirit/element/changeMyDescription.js
// THE NODE'S DESCRIPTION, CHANGED (goal/G41.6; Andy, Q1: Info's two blocks "become shell elements of their own, each
// with its test folder"). One field, its Save and the bytes left: the second of the two things this node answers to
// anybody who asks (spirit/nodeCard.js). Info draws it.
//
//   changeMyDescription.create(host, { api }) -> { set(value), destroy() }
//
// The field is marked with its rule (rule/12, data-field="description") and held at the description rule's byte limit
// by fieldInput, the bytes left beside it (fieldRules.describeRemaining), counted in bytes as typed. Save asks here first
// (fieldRules.describeProblem); then node.setDescription, and the field shows what the node STORED (rule/19).
(function (root) {
  var E = (root.spirit = root.spirit || {}).element = root.spirit.element || {};
  // WHAT IT USES, IT LOADS ITSELF (goal/G41.3): fieldInput, through spirit.require.
  var parts = root.spirit.require ? root.spirit.require('spirit/element/fieldInput.js') : Promise.resolve();
  // ITS FORM IS A ROWFORM (goal/G41.27), asked as this file runs, so whoever requires this element is answered once the
  // rowForm is in and create can draw it at once.
  if (root.spirit.require) root.spirit.require('spirit/element/rowForm.js');

  function rules() { return (root.spirit && root.spirit.fieldRules) || null; }
  function esc(api, s) { return api && api.escapeHtml ? api.escapeHtml(s) : String(s); }

  function create(host, opts) {
    var o = opts || {};
    var api = o.api;
    // Its blocks stacked 1em apart (rule/2): the shell's stack class.
    // A ROWFORM (goal/G41.27; Andy: "changeMyDescription:\n\n[✏️][Description-input][Save]"): ✏️, the input alone in its
    // span, Save its button; the bytes left and what Save did stand below the bubble.
    host.innerHTML =
      '<div class="stack"><div data-description="form"></div>' +
      '<div data-description="left" class="job-manifest-note"></div>' +
      '<div data-description="said" class="job-start-error"></div></div>';
    var form = E.rowForm.create(host.querySelector('[data-description="form"]'), { icon: '✏️', button: 'Save' });
    form.span.innerHTML = '<input type="text" data-field="description" placeholder="' + esc(api, 'a sentence somebody who has just found you would want to read') + '">';
    var input = host.querySelector('[data-field="description"]');
    var left = host.querySelector('[data-description="left"]');
    var said = host.querySelector('[data-description="said"]');
    var gone = false;

    // A refusal is red and a confirmation is not: the shell's two classes, both collapsing when empty.
    function say(text, isError) {
      said.textContent = text || '';
      said.className = isError ? 'job-start-error' : 'job-manifest-note';
    }
    // DISCREPANCY WITH ANDY's RULES: goal/G41.27's box (v8) says "character counters outside a form go: a field is limited
    // by fieldRules.js as it is typed, so a counter says nothing"; this element still writes the bytes left below the
    // rowForm's bubble, outside the form, and its test asserts that counter.
    // THE COUNTDOWN IS IN BYTES, because the cap is: a counter of characters would say there was room where the node
    // refuses.
    function count() {
      var R = rules();
      if (!R) { left.textContent = ''; return; }
      left.textContent = Math.max(0, R.describeRemaining(input.value)) + ' left';
    }
    function save() {
      if (gone) return Promise.resolve();
      var R = rules();
      var bad = R ? R.describeProblem(input.value) : '';
      if (bad) { say(bad, true); return Promise.resolve(); }
      return Promise.resolve(api.verb('node.setDescription', { description: input.value })).then(function (r) {
        var body = (r && r.body) || {};
        if (!body.ok) { say(body.error || 'could not save', true); return; }
        root.spirit.data.node.data.card.keep({ description: String(body.description == null ? '' : body.description) });
        say('saved', false);
      }, function (e) { say((e && e.message) || 'could not save', true); });
    }
    // WHAT IT CHANGES, IT LISTENS FOR (goal/G41.27, G41.28): the node's card as the node family's cache keeps it
    // (spirit.data.node.data). The field shows the description the card holds; a save keeps there what the node stored.
    var stop = null;
    function show(card) {
      if (gone || !card) return;
      input.value = String(card.description == null ? '' : card.description);
      count();
    }
    root.spirit.cacheManager('node').then(function () {
      if (gone) return;
      stop = root.spirit.data.node.data.card.watch(show);
      show(root.spirit.data.node.data.card.get());
    });

    parts.then(function () {
      if (!gone && E.fieldInput) E.fieldInput.attach(input, 'description');
    }, function () { /* the node still refuses what the rule refuses */ });
    input.addEventListener('input', count);
    // Return saves, as the button does.
    input.addEventListener('keydown', function (e) {
      if (!e || e.key !== 'Enter') return;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      save();
    });
    form.button.addEventListener('click', save);
    count();

    return {
      set: function (value) { input.value = String(value == null ? '' : value); count(); },
      // Destroy leaves its host empty (goal/G41.19, box v23: "destroy empties it"), and lets the card go.
      destroy: function () { gone = true; if (stop) stop(); stop = null; host.innerHTML = ''; },
    };
  }

  E.changeMyDescription = { create: create };
}(typeof window !== 'undefined' ? window : globalThis));
