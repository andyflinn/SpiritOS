// spirit/run/shell/js/changeMyLabel.js
// THE NODE'S NAME, CHANGED (goal/G41.6; Andy, Q1: Info's two blocks "become shell elements of their own, each with its
// test folder"). One field and its Save: what this node answers to anybody who asks (js/nodeCard.js). Info draws it.
//
//   changeMyLabel.create(host, { api, onSaved }) -> { set(value), destroy() }
//
// The field is marked with its rule (rule/12, data-field="label") and held at the name rule's byte limit by fieldInput,
// the bytes left beside it, counted in bytes as typed: an emoji costs four. Save asks here first and the wire is not
// troubled when the rule already says no (js/fieldRules.js, the rule the node checks with). Then node.setName, and the
// field shows what the node STORED, not what was typed (rule/19): the node normalises what it keeps.
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
        '<label class="field-label grow">Name' +
          '<input type="text" data-field="label" placeholder="' + esc(api, 'what people see, everywhere') + '">' +
        '</label>' +
        '<button type="button" data-label="save">Save</button>' +
      '</div>' +
      '<div data-label="left" class="job-manifest-note"></div>' +
      '<div data-label="said" class="job-start-error"></div></div>';
    var input = host.querySelector('[data-field="label"]');
    var left = host.querySelector('[data-label="left"]');
    var said = host.querySelector('[data-label="said"]');
    var gone = false;

    // A refusal is red and a confirmation is not: the shell's two classes, both collapsing when empty.
    function say(text, isError) {
      said.textContent = text || '';
      said.className = isError ? 'job-start-error' : 'job-manifest-note';
    }
    function count() {
      var R = rules();
      if (!R) { left.textContent = ''; return; }
      left.textContent = Math.max(0, R.MAX_BYTES - R.byteLength(R.normalize(input.value))) + ' left';
    }
    function save() {
      if (gone) return Promise.resolve();
      var R = rules();
      var bad = R ? R.problem(input.value) : '';
      if (bad) { say(bad, true); return Promise.resolve(); }
      return Promise.resolve(api.verb('node.setName', { name: input.value })).then(function (r) {
        var body = (r && r.body) || {};
        if (!body.ok) { say(body.error || 'could not save', true); return; }
        input.value = String(body.name == null ? '' : body.name);
        count();
        say('saved', false);
        if (typeof o.onSaved === 'function') o.onSaved(input.value);
      }, function (e) { say((e && e.message) || 'could not save', true); });
    }

    parts.then(function () {
      if (!gone && E.fieldInput) E.fieldInput.attach(input, 'name');
    }, function () { /* the node still refuses what the rule refuses */ });
    input.addEventListener('input', count);
    // Return saves, as the button does: the hand that never leaves the keyboard.
    input.addEventListener('keydown', function (e) {
      if (!e || e.key !== 'Enter') return;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      save();
    });
    host.querySelector('[data-label="save"]').addEventListener('click', save);
    count();

    return {
      set: function (value) { input.value = String(value == null ? '' : value); count(); },
      // Destroy leaves its host empty (goal/G41.19, box v23: "destroy empties it").
      destroy: function () { gone = true; host.innerHTML = ''; },
    };
  }

  E.changeMyLabel = { create: create };
}(typeof window !== 'undefined' ? window : globalThis));
