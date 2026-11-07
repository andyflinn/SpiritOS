// spirit/run/spirit/element/changeMyLabel.js
// THE NODE'S NAME, CHANGED (goal/G41.6; Andy, Q1: Info's two blocks "become shell elements of their own, each with its
// test folder"). One field and its Save: what this node answers to anybody who asks (spirit/nodeCard.js). Info draws it.
//
//   changeMyLabel.create(host, { api }) -> { set(value), destroy() }
//
// The field is marked with its rule (rule/12, data-field="label") and held at the name rule's byte limit by fieldInput,
// the bytes left beside it, counted in bytes as typed: an emoji costs four. Save asks here first and the wire is not
// troubled when the rule already says no (spirit/fieldRules.js, the rule the node checks with). Then node.setName, and the
// field shows what the node STORED, not what was typed (rule/19): the node normalises what it keeps.
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
    // A ROWFORM (goal/G41.27; Andy: "Info app:\n\n[✏️] \"Name\" [name-input] [Save]\n\nthis might be in the changeMyLabel
    // element...."): ✏️, the word Name and the input in its span, Save its button; the bytes left and what Save did stand
    // below the bubble.
    host.innerHTML =
      '<div class="stack"><div data-label="form"></div>' +
      '<div data-label="left" class="job-manifest-note"></div>' +
      '<div data-label="said" class="job-start-error"></div></div>';
    var form = E.rowForm.create(host.querySelector('[data-label="form"]'), { icon: '✏️', button: 'Save' });
    form.span.innerHTML = 'Name' +
      '<input type="text" data-field="label" placeholder="' + esc(api, 'what people see, everywhere') + '">';
    var input = host.querySelector('[data-field="label"]');
    var left = host.querySelector('[data-label="left"]');
    var said = host.querySelector('[data-label="said"]');
    var gone = false;

    // A refusal is red and a confirmation is not: the shell's two classes, both collapsing when empty.
    function say(text, isError) {
      said.textContent = text || '';
      said.className = isError ? 'job-start-error' : 'job-manifest-note';
    }
    // DISCREPANCY WITH ANDY's RULES: goal/G41.27's box (v8) says "character counters outside a form go: a field is limited
    // by fieldRules.js as it is typed, so a counter says nothing" (Andy: "the most fucking miserable example are those
    // fucking character counter OUTSIDE the fucking form, the damned fields are supposed limit input based on
    // fieldRules.js, they ALL have to go"); this element still writes the bytes left below the
    // rowForm's bubble, outside the form, and its test asserts that counter.
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
        root.spirit.data.node.data.card.keep({ name: String(body.name == null ? '' : body.name) });
        say('saved', false);
      }, function (e) { say((e && e.message) || 'could not save', true); });
    }
    // WHAT IT CHANGES, IT LISTENS FOR (goal/G41.27, G41.28): the node's card as the node family's cache keeps it
    // (spirit.data.node.data). The field shows the name the card holds; a save keeps there what the node stored.
    var stop = null;
    function show(card) {
      if (gone || !card) return;
      input.value = String(card.name == null ? '' : card.name);
      count();
    }
    root.spirit.cacheManager('node').then(function () {
      if (gone) return;
      stop = root.spirit.data.node.data.card.watch(show);
      show(root.spirit.data.node.data.card.get());
    });

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
    form.button.addEventListener('click', save);
    count();

    return {
      set: function (value) { input.value = String(value == null ? '' : value); count(); },
      // Destroy leaves its host empty (goal/G41.19, box v23: "destroy empties it"), and lets the card go.
      destroy: function () { gone = true; if (stop) stop(); stop = null; host.innerHTML = ''; },
    };
  }

  E.changeMyLabel = { create: create };
}(typeof window !== 'undefined' ? window : globalThis));
