// spirit/run/shell/js/rowElement.js
// WHAT EVERY ROW ELEMENT SHARES (goal/G30.18). Andy's box:
//
//   rowElements carry the listeners and painters a subject needs for real-time updates, wherever they are used: a list
//   row and a details panel show the same element, so nothing has to keep the two in sync. rowElement does the shared
//   work once: paints each field into its cell, registers the one listener, drops it on destroy, runs expandInfo and
//   keeps its answer. Inheriting is plain: rowElement.create(parts) builds the element from the parts fileElement or
//   contactElement hands in; no class chains.
//
// rowElement.create(parts)
//   parts.kind, parts.key        what the subject is, and its identity (a path, a public key)
//   parts.row                    its values, by field name
//   parts.fields                 [{ name, rule, paint(row), edit }], in order: the default column order. rule is the
//                                field's rule from js/fieldRules.js; paint draws the value; edit (details dialogs) asks
//                                the server and never paints: the confirmed change on the stream repaints.
//   parts.actions                [{ name, label, run(el, ctx) }]: what can be done to the subject, the same in a row and
//                                in a details screen (add, block, remove, open). An action asks; it paints nothing.
//   parts.expand(el)             fetches what is too large for a row (long text, attached lists, fan-out data): asked
//                                once, the answer kept.
//   parts.index                  the kind's index (rowElement.index): the element registers its key there and leaves
//                                on destroy.
// -> { kind, key, row, cells(), mount(hosts), apply(changes), act(name, ctx), expandInfo(), destroy() }
//   cells() is [{ name, html }] in field order; mount(hosts) takes a node per field name and paints each; apply(changes)
//   merges new values and repaints only the fields that changed.
//
// rowElement.index(subscribe)
//   The stream dispatch of one kind (the box: it lives per kind, in the element's own file). subscribe(index) is called
//   once, on the first add: one stream subscription for every row of that kind, however many. forKey(key) gives the
//   elements registered for a subject, so an event costs one lookup.
(function () {
  function create(parts) {
    var p = parts || {};
    var fields = Array.isArray(p.fields) ? p.fields : [];
    var actions = Array.isArray(p.actions) ? p.actions : [];
    var hosts = null;
    var expanded = null;
    var gone = false;
    var el = {
      kind: String(p.kind || ''),
      key: String(p.key || ''),
      row: Object.assign({}, p.row || {}),
      fields: fields.map(function (f) { return f.name; }),
      actions: actions.map(function (a) { return { name: a.name, label: a.label || a.name }; }),
    };
    function paintOf(f) {
      try { return String(f.paint ? f.paint(el.row) : (el.row[f.name] == null ? '' : el.row[f.name])); }
      catch (e) { return ''; }
    }
    function paint(f) {
      if (hosts && hosts[f.name]) hosts[f.name].innerHTML = paintOf(f);
    }
    el.cells = function () {
      return fields.map(function (f) { return { name: f.name, html: paintOf(f) }; });
    };
    el.mount = function (h) {
      hosts = h || null;
      fields.forEach(paint);
      return el;
    };
    // New values from the stream: each field whose value changed repaints, and only those.
    el.apply = function (changes) {
      if (gone || !changes) return;
      var changed = {};
      Object.keys(changes).forEach(function (k) {
        if (el.row[k] !== changes[k]) { el.row[k] = changes[k]; changed[k] = true; }
      });
      fields.forEach(function (f) {
        // A field repaints when its own value changed, or one it names in `from` (a status drawn from several values).
        var from = Array.isArray(f.from) ? f.from : [f.name];
        if (from.some(function (k) { return changed[k]; })) paint(f);
      });
    };
    el.act = function (name, ctx) {
      var a = actions.filter(function (x) { return x.name === name; })[0];
      if (!a || typeof a.run !== 'function') return Promise.resolve(null);
      return Promise.resolve(a.run(el, ctx || {}));
    };
    el.expandInfo = function () {
      if (!expanded) expanded = Promise.resolve(typeof p.expand === 'function' ? p.expand(el) : null);
      return expanded;
    };
    el.destroy = function () {
      if (gone) return;
      gone = true;
      if (p.index) p.index.remove(el.key, el);
      hosts = null;
    };
    if (p.index) p.index.add(el.key, el);
    return el;
  }

  function index(subscribe) {
    var byKey = Object.create(null);
    var subscribed = false;
    var idx = {
      add: function (key, el) {
        (byKey[key] = byKey[key] || []).push(el);
        if (!subscribed && typeof subscribe === 'function') { subscribed = true; subscribe(idx); }
      },
      remove: function (key, el) {
        var list = byKey[key];
        if (!list) return;
        var i = list.indexOf(el);
        if (i !== -1) list.splice(i, 1);
        if (!list.length) delete byKey[key];
      },
      forKey: function (key) { return (byKey[key] || []).slice(); },
      keys: function () { return Object.keys(byKey); },
    };
    return idx;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.rowElement = { create: create, index: index };
}());
