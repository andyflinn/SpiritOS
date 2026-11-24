'use strict';
// spirit/run/spirit/element/changeMyDescription.js
// THE NODE'S DESCRIPTION, CHANGED (goal/G41.6; Andy, Q1: Info's two blocks "become shell elements of their own, each
// with its test folder"). One field, its Save and the bytes left: the second of the two things this node answers to
// anybody who asks (spirit/nodeCard.js). Info draws it.
//
//   changeMyDescription.create(host) -> { set(value), destroy() }
//
// The field is marked with its rule (rule/12, data-field="description") and held at the description type's byte limit
// by fieldInput. Save asks here first (spirit/type/string/description.js, its isValid); then node.setDescription, and
// the field shows what the node STORED (rule/19).
// THE INTERFACES IT CALLS, IT REQUIRES ITSELF, AS IT RUNS (goal/G47.1; Andy: "EVERY FUCKING ELEMENT REQUIRES THE FUCKING
// INTERFACES IT FUCKING NEEDS"): a require made while this file runs is part of its tree, so whoever requires it waits for them.
if (window.spirit && typeof window.spirit.requireScript === 'function') ['spirit/node/api.js'].forEach(function (p) { Promise.resolve(window.spirit.requireScript(p)).catch(function () {}); });
(function (root) {
  // WHAT IT ASKS FOR, KEPT AS spirit.requireScript HANDS IT BACK (goal/G49.9: never read at its spirit.required place).
  var ANSWER = {};
  function keepAnswer(p) {
    var a = window.spirit.requireScript(p);
    if (a && typeof a.then === 'function') a.then(function (m) { ANSWER[p] = m; }, function () { /* not loaded: no answer */ }); else ANSWER[p] = a;
    return a;
  }
  var E = ((root.spirit = root.spirit || {}).required = root.spirit.required || {});
  // WHAT IT USES, IT LOADS ITSELF (goal/G41.3): fieldInput and its type, through spirit.requireScript (goal/G48.4, the box:
  // "fieldRules.js dies").
  var parts = root.spirit.requireScript ? Promise.all([root.keepAnswer('spirit/element/fieldInput.js'), root.keepAnswer('spirit/type/string/description.js')]) : Promise.resolve();
  // ITS FORM IS A ROWFORM (goal/G41.27), asked as this file runs, so whoever requires this element is answered once the
  // rowForm is in and create can draw it at once.
  if (root.spirit.requireScript) root.keepAnswer('spirit/element/rowForm.js');

  function description() { var r = root.spirit && root.spirit.required; return (r && r.spirit && r.spirit.type && r.spirit.type.string && r.spirit.type.string.description) || null; }
  // WHAT IT NEEDS, IT GETS ITSELF (goal/G43.24; Andy: "every fucking element gets the interfaces it needs"): the spirit
  // object's escapeHtml and the node family's setDescription, no api handed.
  function esc(s) { return root.spirit.escapeHtml ? root.spirit.escapeHtml(s) : String(s); }

  function create(host, opts) {
    var o = opts || {};
    // Its blocks stacked 1em apart (rule/2): the shell's stack class.
    // A ROWFORM (goal/G41.27; Andy: "changeMyDescription:\n\n[✏️][Description-input][Save]"): ✏️, the input alone in its
    // span, Save its button; what Save did stands below the bubble.
    // NO COUNTER OUTSIDE THE FORM (goal/G41.27's box v8, Andy: "the most fucking miserable example are those fucking character
    // counter OUTSIDE the fucking form ... they ALL have to go"): fieldInput holds the field at its limit as it is typed.
    host.innerHTML =
      // Its box keeps what it holds inside (spirit-sibling-browser.js: overflow not visible).
      '<div class="stack" style="overflow:hidden"><div data-description="form"></div>' +
      '<div data-description="said" class="job-start-error"></div></div>';
    var form = ANSWER['spirit/element/rowForm.js'].create(host.querySelector('[data-description="form"]'), { icon: '✏️', button: 'Save', press: function () { return save(); } });
    // ITS SAVE IS THE ROWFORM'S TO HEAR (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer
    // comes"): handed as press, so Save is busy until the node answers; Return presses it.
    form.span.innerHTML = '<input type="text" data-field="description" placeholder="' + esc('a sentence somebody who has just found you would want to read') + '">';
    var input = host.querySelector('[data-field="description"]');
    var said = host.querySelector('[data-description="said"]');
    var gone = false;

    // A refusal is red and a confirmation is not: the shell's two classes, both collapsing when empty.
    function say(text, isError) {
      said.textContent = text || '';
      said.className = isError ? 'job-start-error' : 'job-manifest-note';
    }
    // Save asks the description type first, and a description it refuses never troubles the wire: its reason is said.
    function save() {
      if (gone) return Promise.resolve();
      var D = description();
      var bad = '';
      if (D) { try { D.isValid(input.value); } catch (e) { bad = (e && e.message) || 'not a description'; } }
      if (bad) { say(bad, true); return Promise.resolve(); }
      return root.spirit.callOutcome(Promise.resolve(root.spirit.readyPromise).then(function () { return root.keepAnswer('spirit/node/api.js'); }).then(function (s) { return s.setDescription({ description: input.value }); })).then(function (r) {
        var body = (r && r.body) || {};
        if (!body.ok) { say(body.error || 'could not save', true); return; }
        root.spirit.required.spirit.data.node.data.card.keep({ description: String(body.description == null ? '' : body.description) });
        say('saved', false);
      }, function (e) { say((e && e.message) || 'could not save', true); });
    }
    // WHAT IT CHANGES, IT LISTENS FOR (goal/G41.27, G41.28): the node's card as the node family's cache keeps it
    // (spirit.required.spirit.data.node.data). The field shows the description the card holds; a save keeps there what the node stored.
    var stop = null;
    function show(card) {
      if (gone || !card) return;
      // The description in the field and in its value attribute both, so the page shows the card's change as a change of the
      // field.
      var text = String(card.description == null ? '' : card.description);
      input.defaultValue = text;
      input.value = text;
    }
    root.keepAnswer('spirit/node/api.js').then(function () {
      if (gone) return;
      stop = root.spirit.required.spirit.data.node.data.card.watch(show);
      show(root.spirit.required.spirit.data.node.data.card.get());
    });

    parts.then(function () {
      if (!gone && ANSWER['spirit/element/fieldInput.js']) ANSWER['spirit/element/fieldInput.js'].attach(input, 'spirit.type.string.description');
    }, function () { /* the node still refuses what the rule refuses */ });
    // Return saves, as the button does.
    input.addEventListener('keydown', function (e) {
      if (!e || e.key !== 'Enter') return;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof form.button.click === 'function') form.button.click(); else save();
    });

    return {
      set: function (value) { input.value = String(value == null ? '' : value); },
      // Destroy leaves its host empty (goal/G41.19, box v23: "destroy empties it"), and lets the card go.
      destroy: function () { gone = true; if (stop) stop(); stop = null; host.innerHTML = ''; },
    };
  }

  // What it hands out, as the loader places it (goal/G49.9: module.exports, on the node and on a page alike).
  module.exports = { create: create };
}(typeof window !== 'undefined' ? window : globalThis));
