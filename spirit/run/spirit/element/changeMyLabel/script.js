'use strict';
// spirit/run/spirit/element/changeMyLabel/script.js
// THE NODE'S NAME, CHANGED (goal/G41.6; Andy, Q1: Info's two blocks "become shell elements of their own, each with its
// test folder"). One field and its Save: what this node answers to anybody who asks (spirit/nodeCard.js). Info draws it.
//
//   changeMyLabel.create(host) -> { set(value), destroy() }
//
// The field is marked with its rule (rule/12, data-field="label") and held at the label type's byte limit by fieldInput.
// Save asks here first and the wire is not troubled when the type already says no (spirit/type/string/label.js). Then
// node.setName, and the field shows what the node STORED, not what was typed (rule/19): the node normalises what it keeps.
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
  // WHAT IT USES, IT LOADS ITSELF (goal/G41.3): fieldInput, through spirit.requireScript.
  // And its type, spirit.type.string.label, which Save asks before the wire is troubled (goal/G48.4, the box: "fieldRules.js
  // dies").
  var parts = root.spirit.requireScript ? Promise.all([keepAnswer('spirit/element/fieldInput/script.js'), keepAnswer('spirit/type/string/label.js')]) : Promise.resolve();
  // ITS FORM IS A ROWFORM (goal/G41.27), asked as this file runs, so whoever requires this element is answered once the
  // rowForm is in and create can draw it at once.
  if (root.spirit.requireScript) keepAnswer('spirit/element/rowForm/script.js');

  function label() { return ANSWER['spirit/type/string/label.js'] || null; }
  // WHAT IT NEEDS, IT GETS ITSELF (goal/G43.24; Andy: "every fucking element gets the interfaces it needs"): the spirit
  // object's escapeHtml and the node family's setName, no api handed.
  function esc(s) { return root.spirit.escapeHtml ? root.spirit.escapeHtml(s) : String(s); }

  function create(host, opts) {
    var o = opts || {};
    // Its blocks stacked 1em apart (rule/2): the shell's stack class.
    // A ROWFORM (goal/G41.27; Andy: "Info app:\n\n[✏️] \"Name\" [name-input] [Save]\n\nthis might be in the changeMyLabel
    // element...."): ✏️, the word Name and the input in its span, Save its button; what Save did stands below the bubble.
    // NO COUNTER OUTSIDE THE FORM (goal/G41.27's box v8, Andy: "the most fucking miserable example are those fucking character
    // counter OUTSIDE the fucking form ... they ALL have to go"): fieldInput holds the field at its limit as it is typed.
    host.innerHTML =
      // Its box keeps what it holds inside (spirit-sibling-browser.js: overflow not visible).
      '<div class="stack" style="overflow:hidden"><div data-label="form"></div>' +
      '<div data-label="said" class="job-start-error"></div></div>';
    var form = ANSWER['spirit/element/rowForm/script.js'].create(host.querySelector('[data-label="form"]'), { icon: '✏️', button: 'Save', press: function () { return save(); } });
    // ITS SAVE IS THE ROWFORM'S TO HEAR (goal/G47.1, Q20; Andy: "mark the button busy from press until the mounter's answer
    // comes"): handed as press, so Save is busy until the node answers; Return presses it.
    form.span.innerHTML = 'Name' +
      '<input type="text" data-field="label" placeholder="' + esc('what people see, everywhere') + '">';
    var input = host.querySelector('[data-field="label"]');
    var said = host.querySelector('[data-label="said"]');
    var gone = false;

    // A refusal is red and a confirmation is not: the shell's two classes, both collapsing when empty.
    function say(text, isError) {
      said.textContent = text || '';
      said.className = isError ? 'job-start-error' : 'job-manifest-note';
    }
    // Save asks the label type first, and a name it refuses never troubles the wire: the reason it gives is said.
    function save() {
      if (gone) return Promise.resolve();
      var L = label();
      var bad = '';
      if (L) { try { L.isValid(input.value); } catch (e) { bad = (e && e.message) || 'not a label'; } }
      if (bad) { say(bad, true); return Promise.resolve(); }
      return root.spirit.callOutcome(Promise.resolve(root.spirit.readyPromise).then(function () { return keepAnswer('spirit/node/api.js'); }).then(function (s) { return s.setName({ name: input.value }); })).then(function (r) {
        var body = (r && r.body) || {};
        if (!body.ok) { say(body.error || 'could not save', true); return; }
        root.spirit.required.spirit.data.node.data.card.keep({ name: String(body.name == null ? '' : body.name) });
        say('saved', false);
      }, function (e) { say((e && e.message) || 'could not save', true); });
    }
    // WHAT IT CHANGES, IT LISTENS FOR (goal/G41.27, G41.28): the node's card as the node family's cache keeps it
    // (spirit.required.spirit.data.node.data). The field shows the name the card holds; a save keeps there what the node stored.
    var stop = null;
    function show(card) {
      if (gone || !card) return;
      // The name in the field and in its value attribute both, so the page shows the card's change as a change of the field.
      var name = String(card.name == null ? '' : card.name);
      input.defaultValue = name;
      input.value = name;
    }
    keepAnswer('spirit/node/api.js').then(function () {
      if (gone) return;
      stop = root.spirit.required.spirit.data.node.data.card.watch(show);
      show(root.spirit.required.spirit.data.node.data.card.get());
    });

    parts.then(function () {
      if (!gone && ANSWER['spirit/element/fieldInput/script.js']) ANSWER['spirit/element/fieldInput/script.js'].attach(input, 'spirit.type.string.label');
    }, function () { /* the node still refuses what the rule refuses */ });
    // Return saves, as the button does: the hand that never leaves the keyboard.
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
