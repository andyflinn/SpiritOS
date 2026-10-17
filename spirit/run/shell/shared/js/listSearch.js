// spirit/run/shell/shared/js/listSearch.js
// THE LIST WITH ITS SEARCH — goal/G29.4. One shell element, looking the same everywhere a list is searched.
//
//   The item's box (Andy, 2026-10-17): "in the shell, a list with a search combined should look as similar as
//   possible every where". Configuration and behaviour are kept apart there, and so here: the app says what it
//   searches and how a row looks; the element does everything else the same way for every app.
//
// shellCreateListSearch(container, {
//   api,                          the shell api the app was mounted with: the element asks through api.verb('jobs.api',
//                                 {ask: {<server>: {<verb>: args}}}), as Desk asks, and hears api.onPublished(fn, server)
//   server, verb,                 the server searched (its stream too) and its search verb
//   args(text, filters),          the verb's arguments from the words and the filters' values, by filter name
//   filters: [{ name, choices: [{ value, icon, word }], test(row, value) }],
//                                 declared, drawn here; test answers a probability, 0 to 1, that only lowers a row
//   paint(row),                   one row's cells, html
//   press(row),                   a press on a row
//   empty                         the sentence of an empty list
// }) -> { refresh, destroy }
//
// WHAT EVERY SEARCH IT CALLS ANSWERS: {items: [{key, label}], more, total}; key is the identity of what the row shows,
// label the row as json. A row is that json's object; paint, press and test all take it.
//
// BEHAVIOUR, the box's, in order:
//   - rows are keyed by the answer's key: a row a later search brings again replaces the older one;
//   - every row any search brought is kept, in one unbounded probabilityBucket;
//   - each character typed or erased redraws the list from it at once: every row scored by probabilityStringObjectMatch
//     against the words, times every filter's test, handed to bucket.sort; best matches on top, every row the filters
//     let through shown. The bucket knows nothing of strings: this element does the matching;
//   - THE SERVER CALLS MUST BE SERIALIZED (Andy: "this is VERY important"): at most one request of the element on the
//     wire, every call included; no typing pause ("no pause in typing, that's extremely irritating."): a character asks
//     at once when nothing is out, and while one is out the latest words go the moment its answer returns;
//   - the count line says how many match in all, and that the answer was partial when the server capped it.
// A publish on its server's stream asks again with the words as they stand, through the same one slot.

(function () {
  var made = 0;
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function shellCreateListSearch(container, options) {
    var o = options || {};
    var P = window.spiritProbability || {};
    var pre = 'listsearch-' + (++made) + '-';
    var filters = Array.isArray(o.filters) ? o.filters : [];
    var values = Object.create(null);
    filters.forEach(function (f) { values[f.name] = f.choices && f.choices.length ? f.choices[0].value : ''; });
    var bucket = P.createProbabilityBucket(Infinity);
    var byKey = Object.create(null);   // key -> { key, row }, the one object the bucket holds for it
    var last = { total: 0, more: false, error: '' };
    var live = true;
    var busy = false;
    var again = false;
    var off = null;

    function el(name) { return document.getElementById(pre + name); }
    function words() { var t = el('text'); return t ? String(t.value || '').trim() : ''; }

    // THE LAYOUT, the same everywhere: filters, the search box with its clear button inside on the right, the search
    // button, the count line, the list.
    function filterHtml() {
      return filters.map(function (f) {
        return '<span data-filter="' + esc(f.name) + '">' + (f.choices || []).map(function (c) {
          var on = values[f.name] === c.value;
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
      '<div id="' + pre + 'count" class="job-manifest-note" style="margin-top:1em"></div>' +
      '<div id="' + pre + 'list" style="margin-top:1em"></div>';

    // SCORED AND DRAWN FROM THE CACHE: the words' match times every filter's test; a filter at 0 leaves the row out.
    function score(w) {
      var f = 1;
      for (var i = 0; i < filters.length; i++) {
        var t = filters[i].test;
        if (typeof t !== 'function') continue;
        var v = Number(t(w.row, values[filters[i].name]));
        if (!(v > 0)) return -1;
        f *= Math.min(1, v);
      }
      var text = words();
      if (!text) return f;
      var m = typeof P.probabilityStringObjectMatch === 'function' ? Number(P.probabilityStringObjectMatch(text, w.row)) || 0 : 0;
      return Math.max(0, Math.min(1, m)) * f;
    }
    function draw() {
      if (!live) return;
      bucket.sort(score);
      var rows = bucket.serialize().items;
      var list = el('list');
      if (list) {
        list.innerHTML = rows.length
          ? '<table class="jobs-table"><tbody>' + rows.map(function (w) {
            return '<tr data-key="' + esc(w.key) + '" style="cursor:pointer">' + (typeof o.paint === 'function' ? o.paint(w.row) : esc(JSON.stringify(w.row))) + '</tr>';
          }).join('') + '</tbody></table>'
          : '<div class="job-manifest-note">' + esc(o.empty || 'Nothing matches.') + '</div>';
      }
      var count = el('count');
      if (count) {
        count.textContent = last.error ? last.error
          : (Math.max(last.total, rows.length) + ' match in all; ' + rows.length + ' shown' + (last.more ? ' (partial: the server holds more, narrow the search)' : ''));
      }
    }
    function take(answer) {
      (answer && Array.isArray(answer.items) ? answer.items : []).forEach(function (it) {
        var row = null;
        try { row = JSON.parse(it.label); } catch (e) { row = null; }
        if (!row || it.key == null) return;
        var key = String(it.key);
        if (byKey[key]) { byKey[key].row = row; return; }
        byKey[key] = { key: key, row: row };
        bucket.seatFor(0, byKey[key]);
      });
      last = { total: Number(answer && answer.total) || 0, more: !!(answer && answer.more), error: '' };
    }

    // THE ONE SLOT ON THE WIRE.
    function ask() {
      if (!live || !o.api || typeof o.api.verb !== 'function') return;
      if (busy) { again = true; return; }
      busy = true;
      var inner = {};
      inner[o.verb] = typeof o.args === 'function' ? o.args(words(), Object.assign({}, values)) : { text: words() };
      var outer = {};
      outer[o.server] = inner;
      Promise.resolve(o.api.verb('jobs.api', { ask: outer })).then(function (r) {
        var body = r && r.body;
        if (!r || r.status !== 200 || !body || body.ok === false) last = { total: last.total, more: last.more, error: 'The search could not be run: ' + ((body && (body.error || body.code)) || 'no answer') };
        else take(body);
      }, function (e) {
        last = { total: last.total, more: last.more, error: 'The search could not be run: ' + ((e && e.message) || e) };
      }).then(function () {
        busy = false;
        draw();
        if (again) { again = false; ask(); }
      });
    }

    function typed() { draw(); ask(); }
    function rowOf(target) {
      var tr = target && typeof target.closest === 'function' ? target.closest('[data-key]') : null;
      var key = tr && typeof tr.getAttribute === 'function' ? tr.getAttribute('data-key') : (target && typeof target.getAttribute === 'function' ? target.getAttribute('data-key') : null);
      return key != null && byKey[key] ? byKey[key].row : null;
    }
    container.addEventListener('input', function (e) { var t = e && e.target; if (t && t.id === pre + 'text') typed(); });
    container.addEventListener('keydown', function (e) { var t = e && e.target; if (t && t.id === pre + 'text' && e.key === 'Enter' && !e.repeat) ask(); });
    container.addEventListener('click', function (e) {
      var t = e && e.target;
      if (!t) return;
      if (t.id === pre + 'clear') { var box = el('text'); if (box) box.value = ''; typed(); return; }
      if (t.id === pre + 'search') { ask(); return; }
      var name = typeof t.getAttribute === 'function' ? t.getAttribute('data-filter') : null;
      var value = typeof t.getAttribute === 'function' ? t.getAttribute('data-value') : null;
      if (name != null && value != null) {
        values[name] = value;
        var strip = el('filters');
        if (strip) strip.innerHTML = filterHtml();
        typed();
        return;
      }
      var row = rowOf(t);
      if (row && typeof o.press === 'function') o.press(row);
    });
    if (o.api && typeof o.api.onPublished === 'function') off = o.api.onPublished(function () { ask(); }, o.server);

    return {
      refresh: function () { ask(); },
      destroy: function () { live = false; if (typeof off === 'function') off(); off = null; },
    };
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.shellCreateListSearch = shellCreateListSearch;
}());
