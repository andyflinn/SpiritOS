'use strict';
// spirit/run/spirit/element/introSpector.js
// INTROSPECTOR, AN ELEMENT (goal/G43.29; Andy: "a wrapper for separate spirit/element/ files"): what the introSpector app
// (spirit/app/introSpector/element.js) draws, moved here from shell/introSpector/introSpector.js (goal/G30.5) and
// working as it did. Its contract and its test: ./test/introSpector.md and ./test/introSpector.js.
//
//   spirit.element.spirit.element.introSpector.create(container) -> { destroy() }
//   spirit.element.spirit.element.introSpector.fieldsOf(request), .argsOf(fields, texts)   the form, without a page
//
//   Andy, 2026-10-20: "I want an intrinsic app: introSpector", and why: "this all happens because i want to SEE", and "it's
//   also another way i can check on your work."
//
// One line at the top: [party, self by default] [family] [verb]. Pane 1 is the chosen verb's form with a call button; pane 2
// the reply, read-only, in CodeMirror. Picking a party asks it for api, and what comes back is all it shows: grants alone
// decide (Andy: "the user sees what he's allowed to use/call").
//   - self: the node's api answer (spirit.tree), and a call through the family spirit.require binds;
//   - a peer node: api by spirit.peerPost, which that node answers cut to the grants it gave this node;
//   - a relay: api by spirit.peerPost to its key, which the relay answers for every member, cut to the caller's verbs.
// No families back: the dropdowns hide and the input pane says so. The party is the contacts list as a dropdown.
(function () {
  var S = window.spirit = window.spirit || {};
  // WHAT IT DRAWS WITH, IT LOADS ITSELF (rule/26: "every shell element loads its own elements dynamically through the fucking
  // apirit.require functionality"): the family selector, the contacts list as its party, and the reply's codeMirror.
  var parts = Promise.all(['spirit/element/search/api.js', 'spirit/element/search/contact/list.js', 'spirit/element/codeMirror.js', 'spirit/element/fieldInput.js']
    .map(function (p) { return S.require(p); }));

  function esc(s) { return S.escapeHtml(String(s == null ? '' : s)); }

  // ── THE FORM, WITHOUT A PAGE ─────────────────────────────────────────────
  // One field per key of the verb's declared request, typed by the prototype's value: a string is text, a number a number, a
  // boolean a checkbox, anything else (an object, an array, null) JSON.
  function fieldsOf(request) {
    var r = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
    return Object.keys(r).map(function (key) {
      var v = r[key];
      var type = typeof v === 'string' ? 'text' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'checkbox' : 'json';
      return { key: key, type: type, value: v };
    });
  }
  // The form back into the verb's arguments, each typed as declared: texts[key] is what the field holds (a checkbox's is true
  // or false). Empty number and JSON fields take the prototype's value; JSON that does not parse throws, with the field's name.
  function argsOf(fields, texts) {
    var t = texts || {};
    var out = {};
    (fields || []).forEach(function (f) {
      var raw = t[f.key];
      if (f.type === 'checkbox') { out[f.key] = raw === true || raw === 'true'; return; }
      if (f.type === 'text') { out[f.key] = raw == null ? '' : String(raw); return; }
      var s = raw == null ? '' : String(raw).trim();
      if (f.type === 'number') { out[f.key] = s === '' ? f.value : Number(s); return; }
      if (s === '') { out[f.key] = f.value; return; }
      try { out[f.key] = JSON.parse(s); }
      catch (e) { throw new Error(f.key + ' is not JSON'); }
    });
    return out;
  }

  // ── ASKING THE PARTY ─────────────────────────────────────────────────────
  // What a peer answered, or a refusal ({ok: false, ...}) passed through for the input pane to say.
  function bodyOf(got) { return got !== undefined && got !== null ? got : { ok: false, error: 'no answer' }; }
  function refusalOf(e) { return { ok: false, error: String((e && e.message) || e) }; }
  // A family of this node, bound by the one loader (goal/G43.27: bound on first call).
  function family(name) { return S.require(S.branchPath(name)); }
  // A relay row's key is its url; its key on the wire is the one its roll names (as Contacts reads it).
  function relayKey(party) {
    if (party.relayKey) return Promise.resolve(party.relayKey);
    return family('relay').then(function (r) { return r.get({ key: party.key }); }).then(function (b) {
      var r = (b && b.relay) || {};
      party.relayKey = (r.roll && r.roll.relayKey) || (b && b.report && b.report.key) || '';
      return party.relayKey;
    }, function () { return ''; });
  }
  // The tree a peer or a relay answers to api (self's is this node's own, which the family list reads itself).
  function treeOf(party) {
    if (party.kind === 'relay') return relayKey(party).then(function (key) {
      if (!key) return { ok: false, error: 'this relay has not said what its key is' };
      return S.peerPost(key, 'relay', 'api').then(bodyOf);
    });
    return S.peerPost(party.key, 'api', 'api').then(bodyOf);
  }
  function call(party, fam, verb, args) {
    // Self: the answer's body, a refusal's own body when the node sent one.
    if (party.kind === 'self') return S.outcome(family(fam).then(function (f) { return f[verb](args); })).then(function (o) {
      return o.body !== undefined && o.body !== null ? o.body : o;
    });
    var body = {};
    if (party.kind === 'relay') {
      body[verb] = args;
      return relayKey(party).then(function (key) { return S.peerPost(key, 'relay', body).then(bodyOf); });
    }
    body[fam] = {};
    body[fam][verb] = args;
    return S.peerPost(party.key, 'api', body).then(bodyOf);
  }

  function create(container) {
    var gone = false;
    var party = { kind: 'self', key: '', name: 'self' };   // who is asked; self until a pick
    var fields = [];
    var reply = null;
    var picker = null;
    // THE FAMILY AND VERB PICKER, KEPT TO BE DESTROYED WITH IT (goal/G48.4, Andy: "make sure that elements get cleaned up"):
    // its two lists put listeners on the page.
    var apiPick = null;
    // Its spacing is shell.css's (box v109: "style issues like margin, padding and gap do NOT belong in UI scripts"): the line's
    // .introspector-line, its blocks 1em apart by .stack (rule/2). Its box keeps what it holds inside (-browser: overflow).
    container.innerHTML =
      '<div class="stat-tile wide stack" style="overflow:hidden">' +
        '<div data-is="line" class="introspector-line"></div>' +
        '<div data-is="form"></div>' +
        '<div data-is="reply"></div>' +
      '</div>';
    function part(n) { return container.querySelector('[data-is="' + n + '"]'); }

    // ── PAINTING ───────────────────────────────────────────────────────────
    function say(text) { var form = part('form'); if (form) form.innerHTML = '<div class="job-manifest-note">' + esc(text) + '</div>'; }
    function show(answer) {
      var text = JSON.stringify(answer, null, 2);
      if (reply && reply.cm) reply.cm.setValue(text == null ? '' : text);
    }
    function paintForm(branch) {
      var form = part('form');
      var tree = branch.tree || {};
      var entry = branch.family && branch.verb && tree[branch.family] ? tree[branch.family][branch.verb] : null;
      if (!entry) { form.innerHTML = '<div class="job-manifest-note">' + (branch.family ? 'choose a verb' : 'choose a family') + '</div>'; return; }
      fields = fieldsOf(entry.request);
      form.innerHTML =
        (entry.description ? '<div class="job-manifest-note">' + esc(entry.description) + '</div>' : '') +
        fields.map(function (f) {
          if (f.type === 'checkbox') return '<label style="display:block"><input type="checkbox" data-is-field="' + esc(f.key) + '"' + (f.value ? ' checked' : '') + '> ' + esc(f.key) + '</label>';
          var shown = f.type === 'json' ? JSON.stringify(f.value) : '';
          var tag = f.type === 'json' ? 'textarea rows="2"' : 'input type="' + (f.type === 'number' ? 'number' : 'text') + '"';
          return '<label style="display:block">' + esc(f.key) + ' <' + tag + ' data-is-field="' + esc(f.key) + '" placeholder="' + esc(shown) + '" style="width:100%">' +
            (f.type === 'json' ? '</textarea>' : '') + '</label>';
        }).join('') +
        '<button type="button" data-is="call">call</button>';
      // EVERY FIELD STOPS AT ITS LIMIT (the general rules: every input it draws has a maxlength): a verb's declaration holds
      // an example, not a rule, so a text or a JSON field takes the longest standard rule, paragraph, through fieldInput; a
      // number field a number's length.
      var FI = S.required && S.required.spirit && S.required.spirit.element && S.required.spirit.element.fieldInput;
      Array.prototype.forEach.call(form.querySelectorAll('[data-is-field]'), function (x) {
        if (x.type === 'checkbox') return;
        if (x.type === 'number') { x.maxLength = 32; return; }
        if (FI && typeof FI.attach === 'function') FI.attach(x, 'spirit.type.string.paragraph'); else x.maxLength = 2048;
      });
      part('call').addEventListener('click', function () {
        var texts = {};
        fields.forEach(function (f) {
          var el = null;
          Array.prototype.forEach.call(form.querySelectorAll('[data-is-field]'), function (x) { if (x.getAttribute('data-is-field') === f.key) el = x; });
          texts[f.key] = f.type === 'checkbox' ? !!(el && el.checked) : (el ? el.value : '');
        });
        var args;
        try { args = argsOf(fields, texts); }
        catch (e) { show({ ok: false, error: e.message }); return; }
        show({ calling: branch.family + '.' + branch.verb });
        call(party, branch.family, branch.verb, args).then(show, function (e) { show(refusalOf(e)); });
      });
    }

    parts.then(function () {
      if (gone) return;
      var line = part('line');
      var hold = document.createElement('span');
      line.appendChild(hold);
      var branch = apiPick = S.element.spirit.element.search.api.create(line, { familyPlaceholder: 'choose a family…' });
      // THE PARTY: the contacts list as a dropdown (goal/G30.20, spirit/element/search/contact/list.js), the book and
      // this node's relays; no pick is self, this node.
      picker = S.element.spirit.element.search.contact.list.create(hold, {
        face: 'dropdown',
        placeholder: 'self (this node)',
        all: 'self (this node)',
        pick: function (row, key) {
          var relay = !!row && row.relay === true;
          party = !row ? { kind: 'self', key: '', name: 'self' }
            : { kind: relay ? 'relay' : 'peer', key: relay ? String(row.url || key) : key, name: String(row.name || key) };
          show('');
          say('asking ' + party.name + ' for its api…');
          // EACH PARTY'S TREE IN spirit.required.spirit.data (goal/G48.4; Andy: "fix the introSpector, too"): self is this node's own branch,
          // a peer or a relay is the branch under its own node, named by its key or its address.
          branch.load(party.kind === 'self' ? undefined : function () { return treeOf(party); }, party.key);
        },
      });
      // THE REPLY ON THE CODEMIRROR ELEMENT, READ MODE (goal/G41.7), loaded with its parts.
      Promise.resolve(S.element.spirit.element.codeMirror.create(part('reply'), { mode: 'read', text: '', path: 'reply.json' }))
        .then(function (view) { if (!gone) reply = view; }, function () { /* the reply stays unshown */ });
      // What a party answered decides what shows: no families, no dropdowns, and the input pane says why.
      branch.addEventListener('tree', function () {
        var tree = branch.tree;
        var families = tree && tree.ok !== false ? S.apiTreeIndex.servers(tree) : [];
        branch.hidden = !families.length;
        if (!families.length) {
          say('no verbs available' + (tree && tree.ok === false ? ': ' + (tree.error || tree.code || 'refused') : ''));
          return;
        }
        paintForm(branch);
      });
      branch.addEventListener('change', function () { paintForm(branch); });
    }, function () { container.textContent = 'introSpector could not be loaded.'; });

    return {
      destroy: function () {
        gone = true;
        if (picker && typeof picker.destroy === 'function') picker.destroy();
        if (apiPick && typeof apiPick.destroy === 'function') apiPick.destroy();
        picker = null; apiPick = null;
        reply = null;
        container.innerHTML = '';
      },
    };
  }

  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/introSpector.js', { create: create, fieldsOf: fieldsOf, argsOf: argsOf }); });
}());
