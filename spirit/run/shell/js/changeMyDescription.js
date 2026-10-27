// spirit/run/shell/js/changeMyDescription.js
// THE NODE'S DESCRIPTION, CHANGED (goal/G41.6; Andy, Q1: Info's two blocks "become shell elements of their own, each
// with its test folder"). One field, its Save and the bytes left: the second of the two things this node answers to
// anybody who asks (js/nodeCard.js). Info draws it.
//
//   changeMyDescription.create(host, { api, onSaved }) -> { set(value), destroy() }
//
// The field is marked with its rule (rule/12, data-field="description") and held at the description rule's byte limit
// by fieldInput, the bytes left beside it (fieldRules.describeRemaining), counted in bytes as typed. Save asks here first
// (fieldRules.describeProblem); then node.setDescription, and the field shows what the node STORED (rule/19).
(function (root) {
  var E = (root.spirit = root.spirit || {}).elements = root.spirit.elements || {};
  // WHAT IT USES, IT LOADS ITSELF (goal/G41.3): fieldInput, through spirit.require.
  var parts = root.spirit.require ? root.spirit.require('shell/js/fieldInput.js') : Promise.resolve();

  function rules() { return (root.spirit && root.spirit.fieldRules) || null; }
  function esc(api, s) { return api && api.escapeHtml ? api.escapeHtml(s) : String(s); }

  function create(host, opts) {
    var o = opts || {};
    var api = o.api;
    // Its blocks stacked 1em apart (rule/2), its row's items 1em apart (rule/1): the shell's stack and form classes.
    host.innerHTML =
      '<div class="stack"><div class="start-job-form card">' +
        '<label class="field-label grow">Description' +
          '<input type="text" data-field="description" placeholder="' + esc(api, 'a sentence somebody who has just found you would want to read') + '">' +
        '</label>' +
        '<button type="button" data-description="save">Save</button>' +
      '</div>' +
      '<div data-description="left" class="job-manifest-note"></div>' +
      '<div data-description="said" class="job-start-error"></div></div>';
    var input = host.querySelector('[data-field="description"]');
    var left = host.querySelector('[data-description="left"]');
    var said = host.querySelector('[data-description="said"]');
    var gone = false;

    // A refusal is red and a confirmation is not: the shell's two classes, both collapsing when empty.
    function say(text, isError) {
      said.textContent = text || '';
      said.className = isError ? 'job-start-error' : 'job-manifest-note';
    }
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
        input.value = String(body.description == null ? '' : body.description);
        count();
        say('saved', false);
        if (typeof o.onSaved === 'function') o.onSaved(input.value);
      }, function (e) { say((e && e.message) || 'could not save', true); });
    }

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
    host.querySelector('[data-description="save"]').addEventListener('click', save);
    count();

    return {
      set: function (value) { input.value = String(value == null ? '' : value); count(); },
      destroy: function () { gone = true; },
    };
  }

  E.changeMyDescription = { create: create };
}(typeof window !== 'undefined' ? window : globalThis));
