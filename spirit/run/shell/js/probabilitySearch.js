// spirit/run/shell/js/probabilitySearch.js
// THE STANDARD SHELL LIST-TOOL (goal/G30.17), a finished intrinsic shell element. Files and Contacts use it; apps not
// yet ported into the new shell keep using shell/shared/js/listSearch.js until none does, and then that one is deleted.
//
// TAKEN FROM listSearch: rows kept by key, every row any search brought, in one unbounded probability bucket, a later
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
// probabilitySearch.create(container, {
//   api, server, verb          the shell api, the server searched (its stream too) and its search verb
//   args(text, values)         the verb's arguments from the words and the filters' values
//   columns                    [{ field, from, label, width, align, sort }]: sort is how the field compares, 'text',
//                              'number' or 'date'; without it the column is not a sort trigger. from names the row's value
//                              when it is not the field's own name (a contact's label column shows its name)
//   element(row, key)          optional: the rowElement that draws a row (shell/js/rows/)
//   filters, matched, score, rows(), fold(row, key), details(row, key, el), pick(row, key), empty   as in listSearch
// }) -> { refresh, redraw, words(), ask(verb, args), sort(field, direction), feed(answer), destroy }
//
// probabilitySearch.order(entries, state) is the list's pure heart: what it draws, in order. entries [{ key, row, at,
// gone, el }], state { words, values, filters, sort: { field, direction }, columns, matched, score }.
(function () {
  function P() { return window.spiritProbability || {}; }
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
  // What the words are matched against: the app's choice, or the columns' values.
  function against(entry, state) {
    if (typeof state.matched === 'function') return state.matched(entry.el ? entry.el.row : entry.row, state.values || {});
    var cols = state.columns || [];
    if (!cols.length) return entry.el ? entry.el.row : entry.row;
    var o = {};
    cols.forEach(function (c) { o[c.field] = valueOf(entry, c.from || c.field); });
    return o;
  }
  function compareBy(column, direction) {
    var dir = direction === 'desc' ? -1 : 1;
    var how = (column && column.sort) || 'text';
    return function (a, b) {
      var x = valueOf(a, column.from || column.field);
      var y = valueOf(b, column.from || column.field);
      var d;
      if (how === 'number') d = (Number(x) || 0) - (Number(y) || 0);
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
    var self = {};

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
    function filterHtml() {
      return filters.filter(function (f) { return typeof f.when !== 'function' || !!f.when(cachedRows()); }).map(function (f) {
        return '<span data-filter="' + esc(f.name) + '">' + choicesOf(f).map(function (c) {
          var on = f.toggle ? values[f.name] === true : f.multi ? !values[f.name][c.value] : values[f.name] === c.value;
          return '<button type="button" data-filter="' + esc(f.name) + '" data-value="' + esc(c.value) + '" style="margin-right:1em;' +
            (on ? 'font-weight:bold;outline:1px solid currentColor' : 'opacity:0.6') + '">' + esc((c.icon ? c.icon + ' ' : '') + (c.word || '')) + '</button>';
        }).join('') + '</span>';
      }).join('');
    }
    container.innerHTML =
      '<div id="' + pre + 'filters" style="margin-top:1em">' + filterHtml() + '</div>' +
      '<div style="margin-top:1em;display:flex;gap:1em;align-items:center">' +
        '<span style="position:relative;display:inline-block;flex:1">' +
          '<input id="' + pre + 'text" type="text" autocomplete="off" style="width:100%;padding-right:2em;box-sizing:border-box">' +
          '<button id="' + pre + 'clear" type="button" title="Clear" style="position:absolute;right:0.3em;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer">✕</button>' +
        '</span>' +
        '<button id="' + pre + 'search" type="button">Search</button>' +
      '</div>' +
      '<div id="' + pre + 'list" tabindex="0" style="margin-top:1em"></div>';

    // THE MATCHED PARTS MARKED, by the one marking rule listSearch and the text view share (window.spiritMatchRanges).
    function mark(text) {
      var s = String(text == null ? '' : text);
      var ranges = typeof window.spiritMatchRanges === 'function' ? window.spiritMatchRanges(s, words()) : [];
      var out = '';
      var at = 0;
      ranges.forEach(function (r) { out += esc(s.slice(at, r[0])) + '<mark>' + esc(s.slice(r[0], r[1])) + '</mark>'; at = r[1]; });
      return out + esc(s.slice(at));
    }
    // The page's own rows, when the app has them (rows()); each joins the cache by its key.
    var pageKeys = Object.create(null);
    function takePage() {
      if (typeof o.rows !== 'function') return;
      var now = Object.create(null);
      (o.rows() || []).forEach(function (r, i) {
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
      if (!live) return;
      takePage();
      var fs0 = el('filters');
      if (filters.length && fs0) fs0.innerHTML = filterHtml();
      var entries = Object.keys(byKey).map(function (k) { var e = byKey[k]; elementOf(e); return e; });
      var searching = !!words();
      var rows = order(entries, { words: words(), values: values, filters: filters, sort: sortBy, columns: columns, matched: o.matched, score: o.score });
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
      var list = el('list');
      if (!list) return;
      if (snap) list.scrollTop = 0;
      list.innerHTML = rows.length
        ? '<table class="jobs-table">' + headHtml(searching) + '<tbody>' + rows.map(function (w) {
          var cur = w.key === currentKey;
          return '<tr data-key="' + esc(w.key) + '"' + (cur ? ' class="current"' : '') + ' style="cursor:pointer' + (cur ? ';background:rgba(255,255,255,0.12)' : '') + '">' +
            (searching ? bar(w) : '') + cellsOf(w) + '</tr>';
        }).join('') + '</tbody></table>'
        : '<div class="job-manifest-note">' + esc(o.empty || 'Nothing matches.') + '</div>';
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
    function send(verb, args) {
      return Promise.resolve(o.api.verb(o.server + '.' + verb, args)).then(function (r) {
        var body = r && r.body;
        if (!r || r.status !== 200 || !body || body.ok === false) throw new Error((body && (body.error || body.code)) || 'no answer');
        return body;
      });
    }
    function pump() {
      if (busy || !live || !o.api || typeof o.api.verb !== 'function') return;
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
    function typed() { snap = true; draw(); ask(); }

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
      if (typeof o.details === 'function') { o.details(w.row, w.key, w.el || null); return; }
      if (typeof o.pick === 'function') o.pick(w.row, w.key);
    }
    function move(to) {
      if (!shown.length) return;
      snap = false;
      var at = shown.map(function (w) { return w.key; }).indexOf(currentKey);
      var next = to === 'top' ? 0 : to === 'bottom' ? shown.length - 1
        : Math.max(0, Math.min(shown.length - 1, (at === -1 ? (to > 0 ? -1 : shown.length) : at) + to));
      currentKey = shown[next].key;
      draw();
      var l = el('list');
      var cur = l && typeof l.querySelector === 'function' ? l.querySelector('tr.current') : null;
      if (cur && typeof cur.scrollIntoView === 'function') cur.scrollIntoView({ block: 'nearest' });
    }
    function setSort(field, direction) {
      if (!field) { sortBy = null; draw(); return; }
      sortBy = { field: field, direction: direction === 'desc' ? 'desc' : 'asc' };
      draw();
    }
    container.addEventListener('input', function (e) { var t = e && e.target; if (t && t.id === pre + 'text') typed(); });
    container.addEventListener('keydown', function (e) {
      var stop = function () { if (typeof e.preventDefault === 'function') e.preventDefault(); };
      if (e.key === 'ArrowDown') { stop(); move(1); return; }
      if (e.key === 'ArrowUp') { stop(); move(-1); return; }
      if (e.key === 'Home' || e.key === 'End') { stop(); move(e.key === 'Home' ? 'top' : 'bottom'); return; }
      if (e.key === 'Enter' && !e.repeat) {
        // ENTER IN THE SEARCH FIELD SEARCHES, and only that (Andy: "that enter belong to the search input box only");
        // Enter on the list opens the current row.
        if (e.target && e.target.id === pre + 'text') { stop(); ask(); return; }
        if (currentKey != null && byKey[currentKey]) { stop(); pressRow(byKey[currentKey]); return; }
      }
    });
    container.addEventListener('click', function (e) {
      var t = e && e.target;
      if (!t) return;
      if (t.id === pre + 'clear') { var box = el('text'); if (box) box.value = ''; typed(); return; }
      if (t.id === pre + 'search') { ask(); return; }
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
    if (o.api && typeof o.api.onPublished === 'function') off = o.api.onPublished(function () { ask(); }, o.server);

    self.refresh = function () { draw(); ask(); };
    self.redraw = function () { draw(); };
    self.words = function () { return words(); };
    self.ask = function (verb, args) { return lend(verb, args); };
    // AN ANSWER THAT ARRIVES ON THE STREAM (goal/G30.19: the network search's rows, one at a time) feeds the cache like
    // the list's own; the words as they stand rank it.
    self.feed = function (answer) { if (!live) return; take(answer); draw(); };
    self.sort = setSort;
    self.destroy = function () {
      live = false;
      if (typeof off === 'function') off();
      off = null;
      Object.keys(byKey).forEach(function (k) { if (byKey[k].el) byKey[k].el.destroy(); });
    };
    if (typeof o.rows === 'function') draw();
    return self;
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.probabilitySearch = { create: create, order: order };
}());
