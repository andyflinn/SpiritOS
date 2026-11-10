'use strict';
// spirit/run/spirit/element/search.js
// THE SHELL'S ONE LIST-TOOL (goal/G30.17), a finished intrinsic shell element: every list in the shell is one.
//
// What it does: rows kept by key, every row any search brought, in one unbounded probability bucket, a later
// answer replacing a row with the same key; ranking as you type (probabilityStringObjectMatch times every filter's test),
// best on top; the matched letters marked and the match bar; one call on the wire at a time, no typing pause; filters
// declared by the app and drawn here.
//
// ADDED (Andy's box):
//   - A column mapping: which value field of a row goes in which column. It defines the headers, and a header is a sort
//     trigger. Column sort is client-side only, on the cached rows, combined with the filters.
//   - No count line. No cut-off: a row that scored zero is still listed, last.
//   - The server's answers only feed the cache: while a search is out the words keep changing, so what the list shows is
//     always ranked from the cache against the words as they stand now.
//   - Rows drawn by rowElements (goal/G30.18) when the app gives element(row): each row's element paints its own cells
//     and repaints a field that changes on the stream; destroy drops them all.
//
// spirit.element.search.create(container, {   (the probabilitySearch)
//   server, verb               the family searched and its search verb: the list asks server.verb itself, through the spirit
//                              object (goal/G43.24; Andy: "every element that accesses ANY api must require them
//                              themselves"), a family on spirit.ready or one spirit.require(spirit.familyPath(server))
//                              binds, a dotted verb walked as a path into it
//   search(args, verb)         optional: the list's own data source, asked instead, answering { status, body } (a list
//                              that shapes its answer itself: contacts, branches, grants); verb is the search's or ask's
//   published(fn)              optional: fn told when what the list shows changed elsewhere, so it asks again; answers its
//                              release
//   args(text, values)         the verb's arguments from the words and the filters' values
//   columns                    [{ field, from, label, width, align, sort }]: sort is how the field compares, 'text', 'path',
//                              'number' or 'date'; without it the column is not a sort trigger. from names the row's value
//                              when it is not the field's own name (a contact's label column shows its name)
//   data                       optional: a branch of the faceless layer (spirit/data.js, goal/G30.16): the list is
//                              a view of it. Its rows are the branch's, the server's answers are seated in it, and a
//                              write to it redraws the list
//   element(row, key)          optional: the rowElement that draws a row (spirit/element/search/file/, spirit/element/search/contact/)
//   face                       'pane' (the default) or 'dropdown' (goal/G30.20): a closed field with the chosen row's name
//                              or the placeholder, opening to the same list; a pick closes it. placeholder, all (a None
//                              button that picks nothing, its words the field's while nothing is chosen) and name(row)
//                              are the dropdown's. Or 'tiles' (goal/G43.6): the same ranked rows, each row.icon above
//                              the relevance above row.label, the row itself in the tooltip; no headers, no sorting
//   toggle                     true: a button after Search flips pane and tiles, the words kept (goal/G43.9); never on a dropdown
//   onFace(face)               told the new face, 'pane' or 'tiles', before the list draws
//   tile(row, key)             optional: { icon, label } of a tile, where the row's own icon and label are not (goal/G43.17,
//                              Q14: a file's tile shows its kind's icon and its name); either left out is the row's
//   visible(row)               false holds a row back; asked at every draw
//   filters, score, rows(), fold(row, key), details(row, key, el), pick(row, key), empty   the list's own; the words
//                              are matched against the whole row (goal/G41.28), so a list hands no matched()
//   selectors                  [{ name, element, test(row) }]: selectors the mounter made, mounted in the 🪣 row; each
//                              element's change redraws the list, and its test narrows it as a filter's does
// }) -> { value, row, refresh, redraw, words(), ask(verb, args), sort(field, direction), destroy }
//
// spirit.element.search.order(entries, state) is the list's pure heart: what it draws, in order. entries [{ key, row, at,
// gone, el }], state { words, values, filters, sort: { field, direction }, columns, score }.
(function () {
  // ITS LIBRARIES, IT LOADS ITSELF (rule/26; found by the shell's general test on a bare page, goal/G41.18): the string
  // and object matchers and the probability bucket, through spirit.require. Asked as this file runs, so whoever requires
  // the list is answered once they are in. And fieldInput, which holds the search words to their rule.
  if (window.spirit && typeof window.spirit.require === 'function') {
    ['spirit/probabilityStringMatch.js', 'spirit/probabilityStringObjectMatch.js', 'spirit/probabilityBucket.js', 'spirit/element/icon.js',
      'spirit/element/fieldInput.js', 'spirit/limits.js'].forEach(function (p) { window.spirit.require(p); });
  }
  function P() { return window.spirit.probability || {}; }
  // A VERB OF A FAMILY, THROUGH THE SPIRIT OBJECT (goal/G43.24, as grantsPanel asks): family.verb called on that family as
  // spirit.ready holds it, or as spirit.require binds a server's; a dotted verb is a path into the family (a.b is
  // f.a.b); answered { status, body } by spirit.outcome, as the list reads it.
  function viaSpirit(name, args) {
    var S = window.spirit;
    var n = String(name || '');
    var dot = n.indexOf('.');
    var fam = n.slice(0, dot);
    return S.outcome(Promise.resolve(S.ready).then(function (s) { return (s && s[fam]) || S.require(S.familyPath(fam)); }).then(function (f) {
      var at = n.slice(dot + 1).split('.');
      var owner = f;
      for (var i = 0; i < at.length - 1; i++) owner = owner ? owner[at[i]] : null;
      return owner[at[at.length - 1]](args || {});
    }));
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function valueOf(entry, field) {
    var row = entry.el ? entry.el.row : entry.row;
    return row ? row[field] : undefined;
  }
  // The filters' product, or -1 for a row a filter leaves out (or one the page no longer has).
  function filtered(entry, state) {
    if (entry.gone) return -1;
    var f = 1;
    var filters = state.filters || [];
    for (var i = 0; i < filters.length; i++) {
      var t = filters[i].test;
      if (typeof t !== 'function') continue;
      var v = Number(t(entry.el ? entry.el.row : entry.row, (state.values || {})[filters[i].name]));
      if (!(v > 0)) return -1;
      f *= Math.min(1, v);
    }
    return f;
  }
  // WHAT THE WORDS ARE MATCHED AGAINST: THE WHOLE ROW, ALWAYS (goal/G41.28; Andy, box v15: "All client side searches will
  // be fixed, too, and search the whole row, as cached in spirit.data."): the row as the list holds it, its element's when
  // it has one. What the list shows, or a matched() it hands, narrows nothing.
  function against(entry) {
    return entry.el ? entry.el.row : entry.row;
  }
  function comparePaths(x, y) {
    var a = x.toLowerCase().split('/');
    var b = y.toLowerCase().split('/');
    for (var i = 0; i < Math.min(a.length, b.length); i++) { if (a[i] !== b[i]) return a[i].localeCompare(b[i]); }
    return a.length - b.length;
  }
  function compareBy(column, direction) {
    var dir = direction === 'desc' ? -1 : 1;
    var how = (column && column.sort) || 'text';
    return function (a, b) {
      var x = valueOf(a, column.from || column.field);
      var y = valueOf(b, column.from || column.field);
      var d;
      if (how === 'number') d = (Number(x) || 0) - (Number(y) || 0);
      // A path as a tree reads it (goal/G30.16): folder by folder, so a folder's contents follow it, before its next sibling.
      else if (how === 'path') d = comparePaths(String(x == null ? '' : x), String(y == null ? '' : y));
      else if (how === 'date') d = (Date.parse(x) || 0) - (Date.parse(y) || 0);
      else d = String(x == null ? '' : x).toLowerCase().localeCompare(String(y == null ? '' : y).toLowerCase());
      return d * dir || a.at - b.at;
    };
  }

  function order(entries, state) {
    var s = state || {};
    var text = String(s.words || '').trim();
    var list = (entries || []).map(function (e) { return { e: e, f: filtered(e, s) }; }).filter(function (x) { return x.f >= 0; });
    if (text) {
      // RANKED, and nothing cut: a row the words miss scores 0 and still stands, last.
      list.forEach(function (x) {
        var given = typeof s.score === 'function' ? s.score(x.e.el ? x.e.el.row : x.e.row, s.values || {}) : null;
        var m = given !== null && given !== undefined ? Number(given) || 0
          : (typeof P().probabilityStringObjectMatch === 'function' ? Number(P().probabilityStringObjectMatch(text, against(x.e, s))) || 0 : 0);
        x.rank = Math.max(0, Math.min(1, m)) * x.f;
      });
      list.sort(function (a, b) { return b.rank - a.rank || a.e.at - b.e.at; });
    } else {
      // VIEWED: a column sort when one is chosen, else the order rows came.
      var col = s.sort && (s.columns || []).filter(function (c) { return c.field === s.sort.field && c.sort; })[0];
      var cmp = col ? compareBy(col, s.sort.direction) : function (a, b) { return a.at - b.at; };
      list.sort(function (a, b) { return cmp(a.e, b.e); });
      list.forEach(function (x) { x.rank = x.f; });
    }
    return list.map(function (x) { return { key: x.e.key, row: x.e.el ? x.e.el.row : x.e.row, rank: x.rank, entry: x.e }; });
  }

  var made = 0;
  function create(container, options) {
    var o = options || {};
    var pre = 'probsearch-' + (++made) + '-';
    var columns = Array.isArray(o.columns) ? o.columns : [];
    var filters = Array.isArray(o.filters) ? o.filters : [];
    // EVERY SEARCH SELECTOR IN THE SEARCH'S OWN ROW (Andy, on G41.26: "so the client probabilitySearch needs to provide a
    // selectorRow, on top of the filter row. the selectorRow must start with a 🪣icon, and be hidden, if no selectors are
    // present.", and "any searchSelector in our system must go into the probabilitySearch's selectorRow, so that the
    // user-can see, which elements belong to the search."): each narrows the list as a filter with no buttons does.
    var selectors = (Array.isArray(o.selectors) ? o.selectors : []).filter(function (s) { return s && s.element; });
    filters = filters.concat(selectors.map(function (s) {
      return { name: s.name, when: function () { return false; }, test: function (row) { return typeof s.test === 'function' ? s.test(row) : 1; } };
    }));
    var values = Object.create(null);
    // A TOGGLE (goal/G30.19) is one button, { name, word, icon, toggle: true }, its value false until pressed.
    filters.forEach(function (f) { values[f.name] = f.toggle ? false : f.multi ? {} : (Array.isArray(f.choices) && f.choices.length ? f.choices[0].value : ''); });
    var bucket = P().createProbabilityBucket(Infinity);
    var byKey = Object.create(null);    // key -> { key, row, at, gone, el }, the one object the bucket holds for it
    var seated = 0;
    var sortBy = null;                  // { field, direction }
    var live = true;
    var busy = false;
    var again = false;
    var off = null;
    var currentKey = null;
    var shown = [];
    var snap = false;
    var dropdown = o.face === 'dropdown';
    var tiles = o.face === 'tiles';
    // THE TOGGLE (goal/G43.9; Andy, box: "A new option, toggle: true."): pane and tiles only, as "Dropdown closes to a field".
    var toggling = o.toggle === true && !dropdown;
    function toggleGlyph() { return tiles ? '☰' : '▦'; }
    var open = !dropdown;
    var self = { value: '', row: null };

    function el(name) {
      var inside = typeof container.querySelector === 'function' ? container.querySelector('#' + pre + name) : null;
      return inside || (typeof document !== 'undefined' && document.getElementById ? document.getElementById(pre + name) : null);
    }
    function words() { var t = el('text'); return t ? String(t.value || '').trim() : ''; }
    function cachedRows() { return Object.keys(byKey).map(function (k) { return byKey[k].row; }); }
    function choicesOf(f) {
      if (f.toggle) return [{ value: 'toggle', word: f.word || f.name, icon: f.icon }];
      return (typeof f.choices === 'function' ? f.choices(cachedRows()) : f.choices) || [];
    }
    // THE FILTER ROW STARTS WITH 🗜, THE SEARCH ROW WITH 🔎 (Andy, on G41.26: "in probablitySearch, if there is a filter row,
    // it must start wit a '🗜' icon, and the search input row must start with a '🔎' icon"); BOTH IN ONE TRANSPARENT BUBBLE
    // ("the filer row and search-input row must be set in a transparent bubble, with a border that has the same color as
    // the type-face", then "NO! the filtel row and the search-input row int eh SAME bubble"): its border currentColor.
    // No filter shown, no filter row and no 🗜: the bubble holds the search row alone. The 🪣 row of selectors stands on
    // top of it, drawn only when there are selectors.
    // EACH ROW'S ICON IS THE ICON ELEMENT (Andy: "why do the icons in the probabilitySearch row have different width's? do
    // they not use the icon element? I'd like it, if the controls in the search bubble look better aligned.", then "do it
    // for all probabilitySearch object in the new face-shell."): a square of 1em, the row's controls 1em after it, so
    // every row's first control starts at the same place. The row is text, so the icon is written as the markup it made.
    // THE BUBBLE IS THE ONE SHARED STYLE (goal/G41.27; Andy, box: "The bubble is one shared style, the same
    // probabilitySearch's search bubble uses."): shell.css's .shell-bubble, the rowForm's too.
    var ROW = 'display:flex;flex-wrap:wrap;align-items:center;gap:1em;';
    function iconHtml(glyph) {
      var I = window.spirit.element && window.spirit.element.spirit.element.icon;
      if (!I || typeof I.create !== 'function' || typeof document === 'undefined') return '<span>' + esc(glyph) + '</span>';
      var hold = document.createElement('span');
      I.create(hold, { glyph: glyph });
      return hold.innerHTML;
    }
    function filterHtml() {
      var row = filters.filter(function (f) { return typeof f.when !== 'function' || !!f.when(cachedRows()); }).map(function (f) {
        return '<span data-filter="' + esc(f.name) + '">' + choicesOf(f).map(function (c) {
          var on = f.toggle ? values[f.name] === true : f.multi ? !values[f.name][c.value] : values[f.name] === c.value;
          return '<button type="button" data-filter="' + esc(f.name) + '" data-value="' + esc(c.value) + '" style="margin-right:1em;' +
            (on ? 'font-weight:bold;outline:1px solid currentColor' : 'opacity:0.6') + '">' + esc((c.icon ? c.icon + ' ' : '') + (c.word || '')) + '</button>';
        }).join('') + '</span>';
      }).join('');
      return row ? '<div style="margin-bottom:0.5em;' + ROW + '">' + iconHtml('🗜') + row + '</div>' : '';
    }
    var paneHtml =
      // ITS OWN COLUMN (goal/G40.8): the box it is given is its mounter's, sized by it; inside, the filters and the search
      // row are fixed rows and the list takes the rest. A dropdown's pane is the same, popped up.
      '<div style="display:flex;flex-direction:column;height:100%;min-height:0;flex:1 1 auto">' +
      '<div class="shell-bubble" style="margin-top:1em">' +
      (selectors.length ? '<div id="' + pre + 'selectors" style="margin-bottom:0.5em;' + ROW + '">' + iconHtml('🪣') +
        selectors.map(function (s, i) { return '<span id="' + pre + 'selector' + i + '"></span>'; }).join('') + '</div>' : '') +
      '<div id="' + pre + 'filters">' + filterHtml() + '</div>' +
      '<div style="' + ROW + 'flex-wrap:nowrap">' +
        iconHtml('🔎') +
        '<span style="position:relative;display:inline-block;flex:1">' +
          '<input id="' + pre + 'text" type="text" autocomplete="off" style="width:100%;padding-right:2em;box-sizing:border-box">' +
          '<button id="' + pre + 'clear" type="button" title="Clear" style="position:absolute;right:0.3em;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer">✕</button>' +
        '</span>' +
        '<button id="' + pre + 'search" type="button">Search</button>' +
        (toggling ? '<button id="' + pre + 'toggle" class="list-toggle" type="button" title="List or tiles">' + toggleGlyph() + '</button>' : '') +
      '</div>' +
      '</div>' +
      // EVERY LIST SCROLLS IN ITS OWN BOX (goal/G40.8, the contained-app rule: "only a list or a viewer scrolls, inside
      // itself"): a dropdown's up to 20em, a pane's list filling what its pane leaves it.
      '<div id="' + pre + 'list" tabindex="0" style="margin-top:1em;overflow:auto;' + (dropdown ? 'max-height:20em' : 'flex:1;min-height:0') + '"></div>' +
      '</div>';
    // THE DROPDOWN IS JUST A POP-UP PANE (goal/G29.9): inline like any input, a field; the very
    // same pane pops up under it, solid, as wide as its rows up to the page.
    // THE FIELD STAYS, THE LIST FLOATS (goal/G43.18; Andy: "and the actual dropdown control stays where it is? just the popped
    // list would "float"? then do that for the lists in the search-dropdown please."): the pane is a manual popover, shown in
    // the page's top layer, so no box cuts it off and nothing drawn over it hides it; place() puts it at its field, inside the
    // window. A press outside closes it (outside, below), so one is open at a time.
    container.innerHTML = dropdown
      ? '<span style="position:relative;display:inline-block">' +
          '<button id="' + pre + 'field" type="button" style="text-align:left"></button>' +
          '<div id="' + pre + 'popup" popover="manual" class="stat-tile wide" style="position:fixed;inset:auto;margin:0;color:inherit;overflow:auto;box-sizing:border-box;min-width:min(24em,calc(100vw - 16px));width:max-content;max-width:calc(100vw - 16px);z-index:10;' +
            'background:linear-gradient(rgba(255,255,255,0.06),rgba(255,255,255,0.06)),#1a1a2e;box-shadow:0 6px 24px rgba(0,0,0,0.5)" hidden>' + paneHtml + '</div>' +
        '</span>'
      : paneHtml;
    if (dropdown) { var p0 = el('popup'); if (p0) p0.hidden = true; }
    // THE SEARCH WORDS STOP AT THEIR LIMIT (goal/G41.27; Andy: "of course search words need a limit, search words must
    // follow the description rules."): fieldInput holds them to the description rule as they are typed.
    var E0 = window.spirit.element || {};
    if (E0.spirit.element.fieldInput && el('text')) E0.spirit.element.fieldInput.attach(el('text'), 'description');
    // The selectors mounted in their row; a pick in any of them redraws the list.
    function onSelector() { draw(); }
    selectors.forEach(function (s, i) {
      var slot = el('selector' + i);
      if (slot) slot.appendChild(s.element);
      if (typeof s.element.addEventListener === 'function') s.element.addEventListener('change', onSelector);
    });

    // THE MATCHED PARTS MARKED, by the one marking rule the codeMirror element shares (window.spirit.matchRanges, below).
    function mark(text) {
      var s = String(text == null ? '' : text);
      var ranges = typeof window.spirit.matchRanges === 'function' ? window.spirit.matchRanges(s, words()) : [];
      var out = '';
      var at = 0;
      ranges.forEach(function (r) { out += esc(s.slice(at, r[0])) + '<mark>' + esc(s.slice(r[0], r[1])) + '</mark>'; at = r[1]; });
      return out + esc(s.slice(at));
    }
    // The page's own rows, when the app has them (rows()); each joins the cache by its key.
    var pageKeys = Object.create(null);
    function pageRows() {
      if (o.data && window.spirit.data) return window.spirit.data.rowsOf(o.data);
      return typeof o.rows === 'function' ? o.rows() : null;
    }
    function takePage() {
      var page = pageRows();
      if (!page) return;
      var now = Object.create(null);
      page.forEach(function (r, i) {
        if (!r || r.key == null) return;
        var key = String(r.key);
        now[key] = true;
        if (byKey[key]) { byKey[key].row = r; byKey[key].gone = false; byKey[key].at = i; if (byKey[key].el) byKey[key].el.apply(r); return; }
        byKey[key] = { key: key, row: r, at: i };
        bucket.seatFor(0, byKey[key]);
      });
      Object.keys(pageKeys).forEach(function (k) { if (!now[k] && byKey[k]) byKey[k].gone = true; });
      pageKeys = now;
    }
    // A ROW'S ELEMENT, made once per key and kept: it listens for its subject itself.
    function elementOf(entry) {
      if (typeof o.element !== 'function') return null;
      if (!entry.el) { try { entry.el = o.element(entry.row, entry.key) || null; } catch (e) { entry.el = null; } }
      return entry.el;
    }
    function headHtml(searching) {
      if (!columns.length) return '';
      return '<thead><tr>' + (searching ? '<th></th>' : '') + columns.map(function (c) {
        var on = !searching && sortBy && sortBy.field === c.field;
        var arrow = on ? (sortBy.direction === 'desc' ? ' ▼' : ' ▲') : '';
        // A HEADER IS A SORT TRIGGER (the box), and only while the search field is empty.
        var trigger = c.sort && !searching ? ' data-sort="' + esc(c.field) + '" style="cursor:pointer' + (c.width ? ';width:' + esc(c.width) : '') + '"'
          : (c.width ? ' style="width:' + esc(c.width) + '"' : '');
        return '<th' + trigger + (c.align ? ' align="' + esc(c.align) + '"' : '') + '>' + esc(c.label != null ? c.label : c.field) + arrow + '</th>';
      }).join('') + '</tr></thead>';
    }
    function draw() {
      if (!live || !open) return;
      takePage();
      var fs0 = el('filters');
      if (filters.length && fs0) fs0.innerHTML = filterHtml();
      var entries = Object.keys(byKey).map(function (k) { var e = byKey[k]; elementOf(e); return e; });
      // Its owner may hold some rows back (o.visible; appSelector's tiles show active apps alone, goal/G43.9).
      if (typeof o.visible === 'function') entries = entries.filter(function (e) { return o.visible(e.row); });
      var searching = !!words();
      var rows = order(entries, { words: words(), values: values, filters: filters, sort: sortBy, columns: columns, score: o.score });
      shown = rows;
      var top = 0;
      if (searching) rows.forEach(function (w) { if (w.rank > top) top = w.rank; });
      if (snap && rows.length) currentKey = rows[0].key;
      function bar(w) {
        var pct = top > 0 ? Math.round((w.rank / top) * 1000) / 10 : 0;
        return '<td class="list-rank" style="width:3em;min-width:3em" title="' + esc((top > 0 ? w.rank / top : 0).toFixed(2)) + '">' +
          '<div style="width:3em"><div style="width:' + pct + '%;margin-left:auto;height:0;border-top:0.8em solid var(--spirit-match, rgba(130,180,240,0.55))"></div></div></td>';
      }
      function cellsOf(w) {
        var e = w.entry.el;
        return columns.map(function (c) {
          var html = e ? '' : mark(valueOf(w.entry, c.from || c.field));
          return '<td data-field="' + esc(c.field) + '"' + (c.align ? ' align="' + esc(c.align) + '"' : '') + '>' + html + '</td>';
        }).join('');
      }
      // THE FACE TILES (goal/G43.6). Andy, box: "A tile: its image, the relevance, its label.", "The relevance is a centered,
      // horizontal bar, between the tile image and the tile label: the bar the lists draw, the same colour and number.", "With no
      // search words there is no bar. Its space stays, so the tiles do not jump."
      function tileBar(w) {
        var pct = top > 0 ? Math.round((w.rank / top) * 1000) / 10 : 0;
        return '<div class="list-rank" style="width:3em;height:0.8em;flex:none"' + (searching ? ' title="' + esc((top > 0 ? w.rank / top : 0).toFixed(2)) + '"' : '') + '>' +
          '<div style="width:' + pct + '%;margin:0 auto;height:0;border-top:0.8em solid var(--spirit-match, rgba(130,180,240,0.55))"></div></div>';
      }
      // Andy, box: "The tooltip shows the contents of the row, one above the other", "If the object is nested, it shows the js
      // object path", "It drops the icon row: the user is hovering over it."
      function tileTip(row) {
        return (typeof P().measureObject === 'function' ? P().measureObject(row || {}) : []).filter(function (r) {
          return (!r.isKey || r.flag) && r.path !== 'icon';
        }).map(function (r) { return r.path + ': ' + (r.isKey ? 'true' : r.objectString); }).join('\n');
      }
      // What a tile shows: what the list hands for it, else the row's own (goal/G43.17, Q14).
      function tileOf(w) {
        var t = (typeof o.tile === 'function' ? o.tile(w.row || {}, w.key) : null) || {};
        return { icon: t.icon != null ? t.icon : w.row && w.row.icon, label: t.label != null ? t.label : w.row && w.row.label };
      }
      var list = el('list');
      if (!list) return;
      if (snap) list.scrollTop = 0;
      if (tiles) {
        list.innerHTML = rows.length
          ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:16px;align-content:start">' + rows.map(function (w) {
            var cur = w.key === currentKey;
            var t = tileOf(w);
            return '<div class="app-icon' + (cur ? ' current' : '') + '" data-key="' + esc(w.key) + '" title="' + esc(tileTip(w.row)) + '"' + (cur ? ' style="background:rgba(255,255,255,0.12)"' : '') + '>' +
              '<span class="icon">' + iconHtml(t.icon) + '</span>' + tileBar(w) + '<span class="label">' + mark(t.label) + '</span></div>';
          }).join('') + '</div>'
          : '<div class="job-manifest-note">' + esc(o.empty || 'Nothing matches.') + '</div>';
        return;
      }
      list.innerHTML = (dropdown && o.all ? '<button id="' + pre + 'none" type="button" style="margin-top:0.5em">None</button>' : '') + (rows.length
        ? '<table class="jobs-table"' + (dropdown ? ' style="width:auto"' : '') + '>' + headHtml(searching) + '<tbody>' + rows.map(function (w) {
          var cur = w.key === currentKey;
          return '<tr data-key="' + esc(w.key) + '"' + (cur ? ' class="current"' : '') + ' style="cursor:pointer' + (cur ? ';background:rgba(255,255,255,0.12)' : '') + '">' +
            (searching ? bar(w) : '') + cellsOf(w) + '</tr>';
        }).join('') + '</tbody></table>'
        : '<div class="job-manifest-note">' + esc(o.empty || 'Nothing matches.') + '</div>');
      // EACH ROW'S ELEMENT PAINTS ITS OWN CELLS, and keeps repainting them as its subject changes.
      if (typeof list.querySelectorAll === 'function') {
        rows.forEach(function (w) {
          var e = w.entry.el;
          if (!e) return;
          var tr = list.querySelector('tr[data-key="' + (window.CSS && CSS.escape ? CSS.escape(w.key) : w.key) + '"]');
          if (!tr) return;
          var hosts = {};
          Array.prototype.forEach.call(tr.querySelectorAll('td[data-field]'), function (td) { hosts[td.getAttribute('data-field')] = td; });
          e.mount(hosts);
        });
      }
    }
    // THE SERVER'S ANSWERS ONLY FEED THE CACHE.
    function take(answer) {
      // A VIEW: the answer goes into the tree, and the tree's write redraws this list and every other one of that type.
      if (o.data && window.spirit.data) { window.spirit.data.seatRows(o.data, answer && answer.items); return; }
      (answer && Array.isArray(answer.items) ? answer.items : []).forEach(function (it) {
        var row = null;
        try { row = JSON.parse(it.label); } catch (e) { row = null; }
        if (!row || it.key == null) return;
        var key = String(it.key);
        if (byKey[key]) { byKey[key].row = row; if (byKey[key].el) byKey[key].el.apply(row); return; }
        byKey[key] = { key: key, row: row, at: seated++ };
        bucket.seatFor(0, byKey[key]);
      });
    }

    // ONE CALL ON THE WIRE: the list's search first, with the words as they stand when it goes; then what the app asks
    // through the lent slot, one at a time.
    var lent = [];
    // WHAT IT NEEDS, IT REQUIRES ITSELF (goal/G43.24): its own data source if the mounter gave one, else server.verb asked
    // through the spirit object; it is handed no api.
    var asks = typeof o.search === 'function' || (!!o.server && !!o.verb);
    function send(verb, args) {
      var asked = typeof o.search === 'function' ? Promise.resolve(o.search(args, verb)) : viaSpirit(o.server + '.' + verb, args);
      return asked.then(function (r) {
        var body = r && r.body;
        if (!r || r.status !== 200 || !body || body.ok === false) throw new Error((body && (body.error || body.code)) || 'no answer');
        return body;
      });
    }
    function pump() {
      if (busy || !live || !asks) return;
      var finish = function () { busy = false; pump(); };
      if (again) {
        again = false;
        busy = true;
        send(o.verb, typeof o.args === 'function' ? o.args(words(), Object.assign({}, values)) : { text: words() })
          .then(take, function () { /* the cache stands; the next words ask again */ })
          .then(function () { draw(); finish(); });
        return;
      }
      var job = lent.shift();
      if (!job) return;
      busy = true;
      send(job.verb, job.args).then(job.resolve, job.reject).then(finish);
    }
    function ask() { again = true; pump(); }
    function lend(verb, args) {
      return new Promise(function (resolve, reject) { lent.push({ verb: verb, args: args || {}, resolve: resolve, reject: reject }); pump(); });
    }
    function typed() { snap = true; setOpen(true); draw(); ask(); }

    function nameOf(row) { return typeof o.name === 'function' ? String(o.name(row)) : String((row && (row.name || row.key)) || ''); }
    // THE FIELD (dropdown): the chosen row's name, or the None words, or the placeholder.
    function paintField(showing) {
      var f = el('field');
      if (!f) return;
      var row = showing || self.row;
      f.innerHTML = esc(row ? nameOf(row) : (o.all || o.placeholder || 'choose…')) + ' ▾';
    }
    // THE POPUP OPENED AND SHUT, in the dropdown only; opened, its search box takes the focus.
    function setOpen(want) {
      if (!dropdown || open === want) return;
      open = want;
      var pop = el('popup');
      if (pop) pop.hidden = !open;
      if (pop && typeof pop.showPopover === 'function') {
        try { if (open) pop.showPopover(); else pop.hidePopover(); } catch (e) { /* already so */ }
      }
      floating(open);
      if (open) { draw(); place(); var box = el('text'); if (box && typeof box.focus === 'function') box.focus({ preventScroll: true }); }
      else paintField();
    }
    // AT ITS FIELD, INSIDE THE WINDOW: under the field where it fits, else above it where there is more room, at most as tall
    // as that room; never wider than the window, slid back in from its right edge.
    var EDGE = 8;
    function place() {
      var pop = el('popup');
      var f = el('field');
      if (!open || !pop || !f || typeof f.getBoundingClientRect !== 'function' || typeof window.innerHeight !== 'number') return;
      var r = f.getBoundingClientRect();
      pop.style.maxHeight = '';
      var h = pop.offsetHeight;
      var w = pop.offsetWidth;
      var below = window.innerHeight - r.bottom - EDGE;
      var above = r.top - EDGE;
      var top;
      if (h <= below || below >= above) { top = r.bottom; if (h > below) pop.style.maxHeight = Math.max(0, below) + 'px'; }
      else { if (h > above) pop.style.maxHeight = Math.max(0, above) + 'px'; top = r.top - Math.min(h, above); }
      pop.style.top = Math.round(top) + 'px';
      pop.style.left = Math.round(Math.max(EDGE, Math.min(r.left, window.innerWidth - w - EDGE))) + 'px';
    }
    // While open it follows its field through a scroll of any box and a resize of the window.
    var placing = false;
    function floating(on) {
      if (typeof window.addEventListener !== 'function' || placing === on) return;
      placing = on;
      if (on) { window.addEventListener('scroll', onScroll, true); window.addEventListener('resize', place); }
      else { window.removeEventListener('scroll', onScroll, true); window.removeEventListener('resize', place); }
    }
    // Rows arriving or a search narrowing them change its size: it is placed again.
    var sized = dropdown && typeof ResizeObserver === 'function' && el('popup') ? new ResizeObserver(function () { if (open) place(); }) : null;
    if (sized) sized.observe(el('popup'));
    // Its own list scrolling is not its field moving.
    function onScroll(e) { var pop = el('popup'); if (pop && e && e.target && typeof pop.contains === 'function' && pop.contains(e.target)) return; place(); }
    // A PICK: the list's value and row are the chosen one's; a dropdown shuts and says it.
    function choose(row, key) {
      self.value = key == null ? '' : String(key);
      self.row = row || null;
      if (dropdown) { setOpen(false); paintField(); }
      if (typeof o.pick === 'function') o.pick(row || null, self.value);
    }

    function rowOf(target) {
      var tr = target && typeof target.closest === 'function' ? target.closest('[data-key]') : null;
      var key = tr && typeof tr.getAttribute === 'function' ? tr.getAttribute('data-key') : null;
      return key != null && byKey[key] ? byKey[key] : null;
    }
    function pressRow(w) {
      if (!w) return;
      snap = false;
      currentKey = w.key;
      var l = el('list');
      if (l && typeof l.focus === 'function') l.focus();
      if (typeof o.fold === 'function' && o.fold(w.row, w.key) === true) { draw(); return; }
      draw();
      if (!dropdown && typeof o.details === 'function') { o.details(w.row, w.key, w.el || null); return; }
      choose(w.el ? w.el.row : w.row, w.key);
    }
    // A PAGE OF ROWS (goal/G40.8: page up and page down): as many as the list shows at once, at least one.
    function rowsPerPage() {
      var l = el('list');
      var row = l && typeof l.querySelector === 'function' ? l.querySelector('tr') : null;
      var h = row && row.offsetHeight ? row.offsetHeight : 0;
      return l && l.clientHeight && h ? Math.max(1, Math.floor(l.clientHeight / h) - 1) : 10;
    }
    function move(to) {
      if (!shown.length) return;
      snap = false;
      if (to === 'pagedown') to = rowsPerPage();
      else if (to === 'pageup') to = -rowsPerPage();
      var at = shown.map(function (w) { return w.key; }).indexOf(currentKey);
      var next = to === 'top' ? 0 : to === 'bottom' ? shown.length - 1
        : Math.max(0, Math.min(shown.length - 1, (at === -1 ? (to > 0 ? -1 : shown.length) : at) + to));
      currentKey = shown[next].key;
      setOpen(true);
      draw();
      var l = el('list');
      var cur = l && typeof l.querySelector === 'function' ? l.querySelector('[data-key].current') : null;
      if (cur && typeof cur.scrollIntoView === 'function') cur.scrollIntoView({ block: 'nearest' });
      // On tiles too the keys move on into the list, so Enter there picks.
      if (tiles && l && typeof l.focus === 'function') l.focus();
      // In a dropdown the keys move on into the list, so Enter there picks; the field says the current row.
      if (dropdown) { if (l && typeof l.focus === 'function') l.focus(); if (byKey[currentKey]) paintField(byKey[currentKey].row); }
    }
    function setSort(field, direction) {
      if (!field) { sortBy = null; draw(); return; }
      sortBy = { field: field, direction: direction === 'desc' ? 'desc' : 'asc' };
      draw();
    }
    container.addEventListener('input', function (e) { var t = e && e.target; if (t && t.id === pre + 'text') typed(); });
    // THE KEYS ON THE WHOLE LIST (goal/G40.8; Andy: "the up/down/home/end/pageUp/pageDown keys ... should always work, on
    // the whole search list, if the search input string is activated or not"). Heard on the search itself, and on the
    // page while this list is on screen and nothing else that takes typing has the focus.
    function onKeys(e) {
      var stop = function () { if (typeof e.preventDefault === 'function') e.preventDefault(); };
      // Andy, box: "arrow keys also go left and right" on tiles; words in the search field keep them for its caret.
      if (tiles && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !(e.target && e.target.id === pre + 'text' && words())) {
        stop(); move(e.key === 'ArrowRight' ? 1 : -1); return true;
      }
      if (e.key === 'ArrowDown') { stop(); move(1); return true; }
      if (e.key === 'ArrowUp') { stop(); move(-1); return true; }
      if (e.key === 'PageDown') { stop(); move('pagedown'); return true; }
      if (e.key === 'PageUp') { stop(); move('pageup'); return true; }
      if (e.key === 'Home' || e.key === 'End') { stop(); move(e.key === 'Home' ? 'top' : 'bottom'); return true; }
      return false;
    }
    function onScreen() {
      var l = el('list');
      return !!(l && typeof l.getClientRects === 'function' && l.getClientRects().length);
    }
    function typesElsewhere(t) {
      if (!t || (typeof container.contains === 'function' && container.contains(t))) return false;
      var tag = String(t.tagName || '').toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable === true;
    }
    if (container.ownerDocument && typeof container.ownerDocument.addEventListener === 'function') {
      container.ownerDocument.addEventListener('keydown', function (e) {
        if (e.defaultPrevented || (typeof container.contains === 'function' && container.contains(e.target))) return;
        if (typesElsewhere(e.target) || !onScreen()) return;
        onKeys(e);
      });
    }
    // A press or a key inside the 🪣 row is its selector's own, never this list's.
    function inSelectors(t) { var row = selectors.length ? el('selectors') : null; return !!(row && t && typeof row.contains === 'function' && row.contains(t)); }
    container.addEventListener('keydown', function (e) {
      var stop = function () { if (typeof e.preventDefault === 'function') e.preventDefault(); };
      if (inSelectors(e && e.target)) return;
      if (onKeys(e)) return;
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'Enter' && !e.repeat) {
        // ENTER IN THE SEARCH FIELD SEARCHES, and only that (Andy: "that enter belong to the search input box only");
        // Enter on the list opens the current row.
        if (e.target && e.target.id === pre + 'text') { stop(); ask(); return; }
        if (currentKey != null && byKey[currentKey]) { stop(); pressRow(byKey[currentKey]); return; }
      }
    });
    container.addEventListener('click', function (e) {
      var t = e && e.target;
      if (!t || inSelectors(t)) return;
      if (t.id === pre + 'field') { setOpen(!open); return; }
      if (t.id === pre + 'none') { currentKey = null; choose(null, ''); return; }
      if (t.id === pre + 'clear') { var box = el('text'); if (box) box.value = ''; typed(); return; }
      if (t.id === pre + 'search') { ask(); return; }
      // The face changes, the words stay, and the owner is told before the list draws (Andy, box: "It tells its owner the new face.").
      if (t.id === pre + 'toggle') {
        tiles = !tiles;
        t.textContent = toggleGlyph();
        if (typeof o.onFace === 'function') o.onFace(tiles ? 'tiles' : 'pane');
        draw();
        return;
      }
      // A HEADER PRESS sorts by its column, a second reverses (only while the field is empty: no header is a trigger then).
      var th = typeof t.closest === 'function' ? t.closest('th[data-sort]') : null;
      if (th) {
        var field = th.getAttribute('data-sort');
        setSort(field, sortBy && sortBy.field === field && sortBy.direction === 'asc' ? 'desc' : 'asc');
        return;
      }
      var name = typeof t.getAttribute === 'function' ? t.getAttribute('data-filter') : null;
      var value = typeof t.getAttribute === 'function' ? t.getAttribute('data-value') : null;
      if (name != null && value != null) {
        var toggle = filters.filter(function (f) { return f.name === name && f.toggle; })[0];
        var multi = filters.filter(function (f) { return f.name === name && f.multi; })[0];
        if (toggle) values[name] = !values[name];
        else if (multi) { if (values[name][value]) delete values[name][value]; else values[name][value] = true; }
        else values[name] = value;
        typed();
        return;
      }
      // A press inside a row's element (its own action buttons) is the element's, not a row press.
      if (typeof t.closest === 'function' && t.closest('[data-action]')) return;
      pressRow(rowOf(t));
    });
    // A PRESS ELSEWHERE SHUTS AN OPEN DROPDOWN; a row a press drew away (a folder folding) is not elsewhere.
    function outside(e) {
      if (!open || !e || !e.target || e.target.isConnected === false) return;
      if (typeof container.contains === 'function' && !container.contains(e.target)) setOpen(false);
    }
    if (dropdown && typeof document !== 'undefined' && typeof document.addEventListener === 'function') document.addEventListener('click', outside);
    if (typeof o.published === 'function') off = o.published(function () { ask(); });
    var unwatch = o.data && window.spirit && window.spirit.data ? window.spirit.data.watchPath(o.data, function () { draw(); }) : null;

    self.refresh = function () { draw(); ask(); };
    self.redraw = function () { draw(); };
    self.words = function () { return words(); };
    self.ask = function (verb, args) { return lend(verb, args); };
    self.sort = setSort;
    self.destroy = function () {
      live = false;
      selectors.forEach(function (s) { if (typeof s.element.removeEventListener === 'function') s.element.removeEventListener('change', onSelector); });
      if (typeof off === 'function') off();
      if (typeof unwatch === 'function') unwatch();
      if (dropdown && typeof document !== 'undefined' && typeof document.removeEventListener === 'function') document.removeEventListener('click', outside);
      floating(false);
      if (sized) sized.disconnect();
      off = null;
      Object.keys(byKey).forEach(function (k) { if (byKey[k].el) byKey[k].el.destroy(); });
      // DESTROY LEAVES THE CONTAINER EMPTY (goal/G41.19, box v23: "destroy empties it").
      container.innerHTML = '';
    };
    paintField();
    if (typeof o.rows === 'function' || o.data) draw();
    return self;
  }

  // THE ONE MARKING RULE (goal/G29.12; Andy, 2026-10-18, to "both markers live in one shared function": "yes"): every
  // place each word stands, partial words included, case ignored, as [from, to) index pairs in order. The list marks its
  // rows with it, and the codeMirror element (spirit/element/codeMirror.js) marks a file's text with it, so the two never drift apart.
  function matchRanges(text, words) {
    var s = String(text == null ? '' : text);
    var ws = String(words || '').split(/\s+/).filter(Boolean).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!ws.length) return [];
    var re = new RegExp(ws.join('|'), 'ig');
    var out = [];
    var hit;
    while ((hit = re.exec(s)) !== null) {
      if (!hit[0]) { re.lastIndex += 1; continue; }
      out.push([hit.index, hit.index + hit[0].length]);
    }
    return out;
  }
  (window.spirit = window.spirit || {}).element = window.spirit.element || {};
  // ITS PLACE ON THE SPIRIT OBJECT, AS ON DISC (goal/G43.18, Q5): merged into, so a search and the parts in its folder load in any order.
  window.spirit.require('spirit/element/installSpiritElement.js').then(function () { window.spirit.required.spirit.element.installSpiritElement(window.spirit, 'spirit/element/search.js', { create: create, order: order }); });
  window.spirit.matchRanges = matchRanges;
}());
