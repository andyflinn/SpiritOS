// spirit/run/shell/introSpector/introSpector.js
// INTROSPECTOR, AN INTRINSIC APP (goal/G30.5).
//
//   Andy, 2026-10-20: "I want an intrinsic app: introSpector", and why: "this all happens because i want to SEE", and
//   "it's also another way i can check on your work."
//
// One line at the top: [party, self by default] [family] [verb]. Pane 1 is the chosen verb's form with a call button;
// pane 2 the reply, read-only, in CodeMirror. Picking a party asks it for api, and what comes back is all it shows:
// grants alone decide (Andy: "the user sees what he's allowed to use/call").
//   - self: the verb api through the node's flat apiDoor ("the api query belongs to the apiDoor"), never jobs;
//   - a peer node: api by peerPost, which that node answers cut to the grants it gave this node;
//   - a relay: api by peerPost to its key, which the relay answers for every member, cut to the caller's verbs.
// No families back: the dropdowns hide and the input pane says so. The party is the contacts list as a dropdown.

var isApi = null;
var isParty = { kind: 'self', key: '', name: 'self' };   // who is asked; self until a pick
var isFields = [];
var isReply = null;

// ── THE FORM, WITHOUT A PAGE ─────────────────────────────────────────────
// One field per key of the verb's declared request, typed by the prototype's value: a string is text, a number a
// number, a boolean a checkbox, anything else (an object, an array, null) JSON.
function isFieldsOf(request) {
  var r = request && typeof request === 'object' && !Array.isArray(request) ? request : {};
  return Object.keys(r).map(function (key) {
    var v = r[key];
    var type = typeof v === 'string' ? 'text' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'checkbox' : 'json';
    return { key: key, type: type, value: v };
  });
}
// The form back into the verb's arguments, each typed as declared: texts[key] is what the field holds (a checkbox's
// is true or false). Empty number and JSON fields take the prototype's value; JSON that does not parse throws, with
// the field's name.
function isArgsOf(fields, texts) {
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

function isEsc(s) { return isApi.escapeHtml(String(s == null ? '' : s)); }

// ── ASKING THE PARTY ─────────────────────────────────────────────────────
// The tree a party answers to api, or a refusal ({ok: false, ...}) passed through for the input pane to say.
function isTreeOf(party) {
  if (party.kind === 'self') return Promise.resolve(isApi.verb('api')).then(function (a) { return a && a.body; });
  if (party.kind === 'relay') return isRelayKey(party).then(function (key) {
    if (!key) return { ok: false, error: 'this relay has not said what its key is' };
    return isApi.peerPost('relay', key, 'api').then(isBodyOf);
  });
  return isApi.peerPost('api', party.key, 'api').then(isBodyOf);
}
function isCall(party, family, verb, args) {
  if (party.kind === 'self') return Promise.resolve(isApi.verb(family + '.' + verb, args)).then(function (a) { return a && a.body !== undefined && a.body !== null ? a.body : a; });
  var body = {};
  if (party.kind === 'relay') {
    body[verb] = args;
    return isRelayKey(party).then(function (key) { return isApi.peerPost('relay', key, body).then(isBodyOf); });
  }
  body[family] = {};
  body[family][verb] = args;
  return isApi.peerPost('api', party.key, body).then(isBodyOf);
}
function isBodyOf(out) {
  if (out && out.body !== undefined && out.body !== null) return out.body;
  return { ok: false, error: (out && out.error) || 'no answer' };
}
// A relay row's key is its url; its key on the wire is the one its roll names (as Contacts reads it).
function isRelayKey(party) {
  if (party.relayKey) return Promise.resolve(party.relayKey);
  return Promise.resolve(isApi.verb('relay.get', { key: party.key })).then(function (a) {
    var r = (a && a.body && a.body.relay) || {};
    party.relayKey = (r.roll && r.roll.relayKey) || (a && a.body && a.body.report && a.body.report.key) || '';
    return party.relayKey;
  });
}

// ── PAINTING ─────────────────────────────────────────────────────────────
function isSay(text) {
  var form = document.getElementById('is-form');
  if (form) form.innerHTML = '<div class="job-manifest-note">' + isEsc(text) + '</div>';
}
function isShow(answer) {
  var text = JSON.stringify(answer, null, 2);
  if (isReply) isReply.cm.setValue(text == null ? '' : text);
}
function isPaintForm(branch) {
  var form = document.getElementById('is-form');
  var tree = branch.tree || {};
  var entry = branch.server && branch.verb && tree[branch.server] ? tree[branch.server][branch.verb] : null;
  if (!entry) { form.innerHTML = '<div class="job-manifest-note">' + (branch.server ? 'choose a verb' : 'choose a family') + '</div>'; return; }
  isFields = isFieldsOf(entry.request);
  form.innerHTML =
    (entry.description ? '<div class="job-manifest-note">' + isEsc(entry.description) + '</div>' : '') +
    isFields.map(function (f) {
      var id = 'is-f-' + f.key;
      if (f.type === 'checkbox') return '<label style="display:block"><input type="checkbox" id="' + isEsc(id) + '"' + (f.value ? ' checked' : '') + '> ' + isEsc(f.key) + '</label>';
      var shown = f.type === 'json' ? JSON.stringify(f.value) : '';
      var tag = f.type === 'json' ? 'textarea rows="2"' : 'input type="' + (f.type === 'number' ? 'number' : 'text') + '"';
      return '<label style="display:block">' + isEsc(f.key) + ' <' + tag + ' id="' + isEsc(id) + '" placeholder="' + isEsc(shown) + '" style="width:100%">' +
        (f.type === 'json' ? '</textarea>' : '') + '</label>';
    }).join('') +
    '<button type="button" id="is-call">call</button>';
  document.getElementById('is-call').addEventListener('click', function () {
    var texts = {};
    isFields.forEach(function (f) {
      var el = document.getElementById('is-f-' + f.key);
      texts[f.key] = f.type === 'checkbox' ? !!(el && el.checked) : (el ? el.value : '');
    });
    var args;
    try { args = isArgsOf(isFields, texts); }
    catch (e) { isShow({ ok: false, error: e.message }); return; }
    isShow({ calling: branch.server + '.' + branch.verb });
    isCall(isParty, branch.server, branch.verb, args).then(isShow, function (e) { isShow({ ok: false, error: String(e && e.message || e) }); });
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    isApi = api;
    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<div id="is-line" style="display:flex;flex-wrap:wrap;align-items:center;gap:1em"></div>' +
        '<div id="is-form" style="margin-top:1em"></div>' +
        '<div id="is-reply" style="margin-top:1em"></div>' +
      '</div>';
    var line = document.getElementById('is-line');
    var party = document.createElement('span');
    var branch = api.ui.elements.createApiBranchSelector({ serverPlaceholder: 'choose a family…', tree: function () { return isTreeOf(isParty); } });
    line.appendChild(party);
    line.appendChild(branch);
    // THE PARTY: the contacts list as a dropdown (goal/G30.20, shell/js/contacts/listElement.js), the book and this
    // node's relays; None is self.
    window.spirit.elements.contactList.create(party, {
      api: api,
      face: 'dropdown',
      placeholder: 'self (this node)',
      all: 'self (this node)',
      pick: function (row, key) {
        var relay = !!row && row.relay === true;
        isParty = !row ? { kind: 'self', key: '', name: 'self' }
          : { kind: relay ? 'relay' : 'peer', key: relay ? String(row.url || key) : key, name: String(row.name || key) };
        isShow('');
        isSay('asking ' + isParty.name + ' for its api…');
        branch.load(function () { return isTreeOf(isParty); });
      },
    });
    // THE REPLY ON THE CODEMIRROR ELEMENT, READ MODE (goal/G41.7: it replaced the text view), loaded by this app itself.
    Promise.resolve(spirit.require('shell/js/codeMirror.js')).then(function () {
      return window.spirit.elements.codeMirror.create(document.getElementById('is-reply'), { mode: 'read', text: '', path: 'reply.json' });
    }).then(function (view) { isReply = view; }, function () { /* the reply stays unshown */ });

    // What a party answered decides what shows: no families, no dropdowns, and the input pane says why.
    branch.addEventListener('tree', function () {
      var tree = branch.tree;
      var families = tree && tree.ok !== false ? window.spirit.apiTreeIndex.servers(tree) : [];
      branch.hidden = !families.length;
      if (!families.length) {
        isSay('no verbs available' + (tree && tree.ok === false ? ': ' + (tree.error || tree.code || 'refused') : ''));
        return;
      }
      isPaintForm(branch);
    });
    branch.addEventListener('change', function () { isPaintForm(branch); });
  },
});
