// spirit/run/shell/shared/js/listSearch.js
// THE LIST WITH ITS SEARCH — goal/G29.4. One shell element, looking the same everywhere a list is searched.
//
//   The item's box (Andy, 2026-10-17): "in the shell, a list with a search combined should look as similar as
//   possible every where". Configuration and behaviour are kept apart there, and so here: the app says what it
//   searches and how a row looks; the element does everything else the same way for every app.
//
// shellCreateListSearch(container, {
//   api,                          the shell api the app was mounted with: the element asks through
//                                 api.verb('<server>.<verb>', args), as Desk asks, and hears api.onPublished(fn, server)
//   server, verb,                 the server searched (its stream too) and its search verb
//   args(text, filters),          the verb's arguments from the words and the filters' values, by filter name
//   filters: [{ name, choices: [{ value, icon, word }], test(row, value) }],
//                                 declared, drawn here; test answers a probability, 0 to 1, that only lowers a row
//   paint(row, mark),             one row's cells, html; mark(text) marks the words in a text
//   matched(row, filters),        what of a row the words are matched against, by the filters' values; the row itself
//                                 when not given (goal/G29.8: the file list's words in: names | paths)
//   score(row, filters),          a row's match score from elsewhere, 0 to 1, in place of the words' match; null to
//                                 match as usual (goal/G29.11: the file list's contents, scored by the node)
//   rows(),                       the page's own rows, ranked here; with no words they stand in the order rows() gives
//   fold(row, key),               a press on a row that folds it (a folder in a tree): true when it took the press
//                                 itself, so it is no pick (goal/G29.8)
//   empty                         the sentence of an empty list
//   head                          the column headings of the app's cells, in order (goal/G29.14)
//   filters[].multi               a row of toggles, every one on at the start; test gets the values turned off, and
//                                 choices may be a function of the rows held (goal/G29.14)
// }) -> { refresh, redraw, words(), ask(verb, args), destroy }   ask: the one slot lent to the app (goal/G29.5)
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
  // THE ONE MARKING RULE (goal/G29.12; Andy, 2026-10-18, to "both markers live in one shared function": "yes"): every
  // place each word stands, partial words included, case ignored, as [from, to) index pairs in order. The list marks its
  // rows with it, and the text view (shell/js/textView.js) marks a file's text with it, so the two never drift apart.
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
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function shellCreateListSearch(container, options) {
    var o = options || {};
    var P = window.spirit.probability || {};
    var pre = 'listsearch-' + (++made) + '-';
    var filters = Array.isArray(o.filters) ? o.filters : [];
    var values = Object.create(null);
    // A MULTI FILTER (goal/G29.14) is a row of toggles, every one on at the start: its value is the object of the
    // values turned off, which its test is handed. Its choices may be a function of the rows held ("one toggle per
    // status the list holds").
    // Choices given as a function of the rows (goal/G30.7, the contact list's one row) start at '' — nothing picked, all.
    filters.forEach(function (f) { values[f.name] = f.multi ? {} : (Array.isArray(f.choices) && f.choices.length ? f.choices[0].value : ''); });
    function choicesOf(f) { return (typeof f.choices === 'function' ? f.choices(cachedRows()) : f.choices) || []; }
    var bucket = P.createProbabilityBucket(Infinity);
    var byKey = Object.create(null);   // key -> { key, row }, the one object the bucket holds for it
    var last = { total: 0, more: false, error: '' };
    var live = true;
    var busy = false;
    var again = false;
    var off = null;
    // goal/G29.9: the mode, the current row (by key), the rows drawn last, the order rows first came in, and the choice.
    var dropdown = o.mode === 'dropdown';
    var open = !dropdown;
    var currentKey = null;
    var shown = [];
    var seated = 0;
    var self = { value: '', row: null };

    // ITS PARTS FOUND INSIDE IT FIRST (goal/G29.6): an element made before the app places it on the page (the contact
    // selector is) is not in the document yet, so the document cannot find what it holds.
    function el(name) {
      var inside = typeof container.querySelector === 'function' ? container.querySelector('#' + pre + name) : null;
      return inside || document.getElementById(pre + name);
    }
    function words() { var t = el('text'); return t ? String(t.value || '').trim() : ''; }
    function cachedRows() { return Object.keys(byKey).map(function (k) { return byKey[k].row; }); }

    // THE LAYOUT, the same everywhere: filters, the search box with its clear button inside on the right, the search
    // button, the count line, the list. A FILTER SHOWS WHEN IT HAS SOMETHING TO SAY (goal/G29.6; Andy: "owned, blocked,
    // held, (if our list has any)"): one with when(rows) is drawn only while that answers true for the rows held.
    function filterHtml() {
      return filters.filter(function (f) { return typeof f.when !== 'function' || !!f.when(cachedRows()); }).map(function (f) {
        return '<span data-filter="' + esc(f.name) + '">' + choicesOf(f).map(function (c) {
          var on = f.multi ? !values[f.name][c.value] : values[f.name] === c.value;
          return '<button type="button" data-filter="' + esc(f.name) + '" data-value="' + esc(c.value) + '" style="margin-right:1em;' +
            (on ? 'font-weight:bold;outline:1px solid currentColor' : 'opacity:0.6') + '">' + esc((c.icon ? c.icon + ' ' : '') + (c.word || '')) + '</button>';
        }).join('') + '</span>';
      }).join('');
    }
    // THE PANE: row 1 the filters, row 2 the search row, row 3 the count and the list.
    var paneHtml =
      '<div id="' + pre + 'filters" style="margin-top:1em">' + filterHtml() + '</div>' +
      '<div style="margin-top:1em;display:flex;gap:1em;align-items:center">' +
        '<span style="position:relative;display:inline-block;flex:1">' +
          '<input id="' + pre + 'text" type="text" autocomplete="off" style="width:100%;padding-right:2em;box-sizing:border-box">' +
          '<button id="' + pre + 'clear" type="button" title="Clear" style="position:absolute;right:0.3em;top:50%;transform:translateY(-50%);border:none;background:none;cursor:pointer">✕</button>' +
        '</span>' +
        '<button id="' + pre + 'search" type="button">Search</button>' +
      '</div>' +
      '<div id="' + pre + 'count" class="job-manifest-note" style="margin-top:1em"></div>' +
      // FOCUSABLE (Andy, 2026-10-18: "in the contacts app the up-down keys etc... don't work."): the list takes the
      // keys itself once a press gives it the focus.
      '<div id="' + pre + 'list" tabindex="0" style="margin-top:1em' + (dropdown ? ';max-height:20em;overflow:auto' : '') + '"></div>';
    // THE DROPDOWN IS JUST A POP-UP PANE (goal/G29.9; Andy, 2026-10-18: "the dropdown is just a pop-up pane.", and "why
    // does the dropdown not just show a \"pane\" exactly like the pane would look?"): closed, a field with the chosen
    // name or a placeholder; a click on it pops the very same pane up under it.
    container.innerHTML = dropdown
      // INLINE, LIKE ANY INPUT CONTROL (goal/G29.8; Andy, 2026-10-18: "the dropdown selector itself appears as a popup
      // as well, it should be inline like any normal input control."): the field sits in its line; only the pane pops.
      ? '<span style="position:relative;display:inline-block">' +
          '<button id="' + pre + 'field" type="button" style="text-align:left"></button>' +
          // SOLID (seen in grants: the tile's see-through background let the page under it show): the tile's tint over
          // the page's own colour, a shadow, and room for its rows even under a narrow field. AS WIDE AS ITS ROWS
          // (goal/G29.8; Andy, 2026-10-18: "can it be the required with to display everything, constrained by page
          // width?"): hung off a narrow field it would shrink to the field, so it is sized by its content, up to the page.
          '<div id="' + pre + 'popup" class="stat-tile wide" style="position:absolute;left:0;min-width:24em;width:max-content;max-width:calc(100vw - 32px);z-index:10;' +
            'background:linear-gradient(rgba(255,255,255,0.06),rgba(255,255,255,0.06)),#1a1a2e;box-shadow:0 6px 24px rgba(0,0,0,0.5)" hidden>' + paneHtml + '</div>' +
        '</span>'
      : paneHtml;
    if (dropdown) { var p0 = el('popup'); if (p0) p0.hidden = true; }

    // SCORED AND DRAWN FROM THE CACHE: the words' match times every filter's test; a filter at 0 leaves the row out.
    // A TIE KEEPS THE ORDER ROWS FIRST CAME IN, so clearing the words gives the first order back.
    function score(w) { var s = rank(w); return s < 0 ? -1 : s * (1 - 1e-9) + 1e-9 / (1 + w.at); }
    function rank(w) {
      if (w.gone) return -1;
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
      var given = typeof o.score === 'function' ? o.score(w.row, values) : null;
      var m;
      if (given !== null && given !== undefined) m = Number(given) || 0;
      else {
        var against = typeof o.matched === 'function' ? o.matched(w.row, values) : w.row;
        m = typeof P.probabilityStringObjectMatch === 'function' ? Number(P.probabilityStringObjectMatch(text, against)) || 0 : 0;
      }
      return Math.max(0, Math.min(1, m)) * f;
    }
    // THE MATCHED PARTS MARKED (goal/G29.9): every word typed wrapped where it stands in the text, the rest escaped.
    function mark(text) {
      var s = String(text == null ? '' : text);
      var out = '';
      var at = 0;
      matchRanges(s, words()).forEach(function (r) {
        out += esc(s.slice(at, r[0])) + '<mark>' + esc(s.slice(r[0], r[1])) + '</mark>';
        at = r[1];
      });
      return out + esc(s.slice(at));
    }
    // THE PAGE'S OWN ROWS (goal/G29.9, the first tier): rows() answers them; each joins the cache by its key, and one
    // no longer answered leaves the list. THEIR ORDER IS THE PAGE'S (goal/G29.8): a tie stands where rows() put it, so a
    // file made later still sits in its folder.
    var pageKeys = Object.create(null);
    function takePage() {
      if (typeof o.rows !== 'function') return;
      var now = Object.create(null);
      (o.rows() || []).forEach(function (r, i) {
        if (!r || r.key == null) return;
        var key = String(r.key);
        now[key] = true;
        if (byKey[key]) { byKey[key].row = r; byKey[key].gone = false; byKey[key].at = i; return; }
        byKey[key] = { key: key, row: r, at: i };
        bucket.seatFor(0, byKey[key]);
      });
      Object.keys(pageKeys).forEach(function (k) { if (!now[k] && byKey[k]) byKey[k].gone = true; });
      pageKeys = now;
    }
    function draw() {
      if (!live) return;
      takePage();
      // THE FILTERS DRAWN WITH THE ROWS (goal/G29.14): toggles drawn from the rows held follow the rows, and a pressed
      // choice shows pressed, whoever redraws.
      if (filters.length) { var fs0 = el('filters'); if (fs0) fs0.innerHTML = filterHtml(); }
      bucket.sort(score);
      var rows = bucket.serialize().items;
      shown = rows;
      // THE RANKING SHOWN (goal/G29.11; Andy, 2026-10-18: "one column that's only filled in search mode, where the rank
      // of a file is displayed in a ... horizontal bar, where it shows as 1.0 (full) for the highest ranking row, and
      // proportionally less for all others", then "the left-most column has a right adjusted weight bar, width 5em"):
      // in search mode every list's left-most column is that bar; with no words it is gone.
      var searching = !!words();
      var top = 0;
      if (searching) rows.forEach(function (w) { w.rank = Math.max(0, rank(w)); if (w.rank > top) top = w.rank; });
      // SNAPPED TO THE TOP (goal/G29.11; Andy: "whenever the search expression changes even by one character, the list
      // ... should snap to the highest ranking (top) row"): after a change of the words the best row is current, until
      // the user moves it.
      if (snap && rows.length) currentKey = rows[0].key;
      function bar(w) {
        var pct = top > 0 ? Math.round((w.rank / top) * 1000) / 10 : 0;
        // The number shown is the bar's own: 1.00 for the best row (Andy: "why would the top not be fucking 1.0?").
        // A FIXED 3EM BOX THE BAR SITS IN (Andy, 2026-10-18: "score bars STILL NOT SEEN"): at his window width rows that
        // never wrap squeezed the table and an empty cell gave its width up, every bar 0 px. The box holds it at 3em (Andy: "i'm sure 3em is wide enough").
        // The bar itself is a solid border in the one match colour (--spirit-match, index.html), 0.8em tall, never a background colour alone.
        return '<td class="list-rank" style="width:3em;min-width:3em" title="' + esc((top > 0 ? w.rank / top : 0).toFixed(2)) + '">' +
          '<div style="width:3em"><div style="width:' + pct + '%;margin-left:auto;height:0;border-top:0.8em solid var(--spirit-match, rgba(130,180,240,0.55))"></div></div></td>';
      }
      // COLUMN HEADINGS, THE LIST'S OWN (goal/G29.14; Andy, 2026-10-18: "put column headings ( a flaw in out
      // list-search element?)"): options.head names the app's cells, one heading each; the rank column, while words are
      // typed, gets an empty one of its own.
      function headHtml(searching) {
        if (!Array.isArray(o.head) || !o.head.length) return '';
        return '<thead><tr>' + (searching ? '<th></th>' : '') + o.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead>';
      }
      var list = el('list');
      if (list) {
        if (snap) list.scrollTop = 0;
        // NONE, A SELECT THING (goal/G29.7; Andy, 2026-10-18: "Those selection option need to be very different from the
        // rest of the options otherwise they're not recognized....", "id rather have it at the top of the list as button
        // saying [None]", "it's a Select-thing"): a dropdown given options.all starts its list with [None], which chooses
        // nothing; while nothing is chosen its field reads that all text.
        // In the labels' column when the list names it (options.noneAt, the cells before its labels; Andy: "in the
        // contact selector, could you left-align the [None] button with the user labels?"): a row of its own, no pick.
        var noneBtn = '<button id="' + pre + 'none" type="button">None</button>';
        var noneInTable = dropdown && o.all && typeof o.noneAt === 'number';
        var noneRow = '';
        if (noneInTable) {
          noneRow = '<tr class="list-none">' + (searching ? '<td></td>' : '');
          for (var c = 0; c < o.noneAt; c++) noneRow += '<td></td>';
          noneRow += '<td>' + noneBtn + '</td></tr>';
        }
        list.innerHTML = (dropdown && o.all && !noneInTable ? noneBtn.replace('type="button"', 'type="button" style="margin-top:0.5em"') : '') + ((rows.length || noneInTable)
          // IN A POPUP THE TABLE TAKES ITS OWN WIDTH (goal/G29.8): a table at 100% gives a popup sized by its rows nothing
          // to measure; the popup's own max-width keeps it inside the page.
          ? '<table class="jobs-table"' + (dropdown ? ' style="width:auto"' : '') + '>' + headHtml(searching) + '<tbody>' + noneRow + rows.map(function (w) {
            // THE CURRENT ROW, DRAWN BY THE LIST, THE SAME EVERYWHERE (goal/G29.9): a slightly brighter background.
            var cur = w.key === currentKey;
            return '<tr data-key="' + esc(w.key) + '"' + (cur ? ' class="current"' : '') + ' style="cursor:pointer' + (cur ? ';background:rgba(255,255,255,0.12)' : '') + '">' +
              (searching ? bar(w) : '') + (typeof o.paint === 'function' ? o.paint(w.row, mark) : mark(JSON.stringify(w.row))) + '</tr>';
          }).join('') + '</tbody></table>'
          : '<div class="job-manifest-note">' + esc(o.empty || 'Nothing matches.') + '</div>');
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
        byKey[key] = { key: key, row: row, at: seated++ };
        bucket.seatFor(0, byKey[key]);
      });
      last = { total: Number(answer && answer.total) || 0, more: !!(answer && answer.more), error: '' };
      var strip = el('filters');
      if (strip && filters.some(function (f) { return typeof f.when === 'function'; })) strip.innerHTML = filterHtml();
    }

    // THE ONE SLOT ON THE WIRE: the list's search first, with the words as they stand when it goes; then what the app
    // asks through the lent slot (goal/G29.5, list.ask), one at a time, in the order asked.
    var lent = [];
    // By the verb's own name on the flat apiDoor (goal/G30.6): <server>.<verb>, the args beside it.
    function send(verb, args) {
      return Promise.resolve(o.api.verb(o.server + '.' + verb, args)).then(function (r) {
        var body = r && r.body;
        if (!r || r.status !== 200 || !body || body.ok === false) throw new Error((body && (body.error || body.code)) || 'no answer');
        return body;
      });
    }
    function pump() {
      if (busy || !live || !o.api || typeof o.api.verb !== 'function') return;
      var done = function () { busy = false; pump(); };
      if (again) {
        again = false;
        busy = true;
        send(o.verb, typeof o.args === 'function' ? o.args(words(), Object.assign({}, values)) : { text: words() }).then(function (body) {
          take(body);
        }, function (e) {
          last = { total: last.total, more: last.more, error: 'The search could not be run: ' + ((e && e.message) || e) };
        }).then(function () { draw(); done(); });
        return;
      }
      var job = lent.shift();
      if (!job) return;
      busy = true;
      send(job.verb, job.args).then(function (body) { job.resolve(body); }, function (e) { job.reject(e); }).then(done);
    }
    function ask() { again = true; pump(); }
    function lend(verb, args) {
      return new Promise(function (resolve, reject) { lent.push({ verb: verb, args: args || {}, resolve: resolve, reject: reject }); pump(); });
    }

    var snap = false;   // a change of the words snaps the list to its top until the user moves the current row
    function typed() { snap = true; setOpen(true); draw(); ask(); }
    function rowOf(target) {
      var tr = target && typeof target.closest === 'function' ? target.closest('[data-key]') : null;
      var key = tr && typeof tr.getAttribute === 'function' ? tr.getAttribute('data-key') : (target && typeof target.getAttribute === 'function' ? target.getAttribute('data-key') : null);
      return key != null && byKey[key] ? byKey[key] : null;
    }
    function nameOf(row) { return typeof o.name === 'function' ? String(o.name(row)) : String((row && (row.name || row.key)) || ''); }
    // THE FIELD (dropdown mode): the chosen row's name, or the placeholder.
    function paintField(showing) {
      var f = el('field');
      if (!f) return;
      var row = showing || self.row;
      f.innerHTML = esc(row ? nameOf(row) : (o.all || o.placeholder || 'choose…')) + ' ▾';
    }
    // THE POPUP OPENED AND SHUT (goal/G29.9), in dropdown mode only; opened, its search box takes the focus.
    function setOpen(want) {
      if (!dropdown || open === want) return;
      open = want;
      var pop = el('popup');
      if (pop) pop.hidden = !open;
      if (open) { draw(); var box = el('text'); if (box && typeof box.focus === 'function') box.focus(); }
      // Shut without a pick, the field says the chosen one again.
      else paintField();
    }
    // A PRESS (goal/G29.9): in dropdown mode a pick; in pane mode details(row) when the list was given one, else a pick.
    function pick(w) {
      self.value = w.key;
      self.row = w.row;
      currentKey = w.key;
      if (dropdown) { setOpen(false); paintField(); }
      draw();
      if (typeof o.pick === 'function') o.pick(w.row, w.key);
    }
    function pressRow(w) {
      if (!w) return;
      snap = false;
      currentKey = w.key;
      if (!dropdown) { var l = el('list'); if (l && typeof l.focus === 'function') l.focus(); }
      if (typeof o.fold === 'function' && o.fold(w.row, w.key) === true) { draw(); return; }
      if (!dropdown && typeof o.details === 'function') { draw(); o.details(w.row, w.key); return; }
      pick(w);
    }
    // KEYS (goal/G29.9): up and down move the current row, home and end to the top or bottom (not in the search box,
    // where they are the text cursor's), enter presses it, escape shuts an open dropdown.
    function move(to) {
      if (!shown.length) return;
      snap = false;
      var at = shown.map(function (w) { return w.key; }).indexOf(currentKey);
      var next = to === 'top' ? 0 : to === 'bottom' ? shown.length - 1
        : Math.max(0, Math.min(shown.length - 1, (at === -1 ? (to > 0 ? -1 : shown.length) : at) + to));
      currentKey = shown[next].key;
      setOpen(true);
      draw();
      // KEPT IN VIEW, AND SAID IN THE FIELD (goal/G29.8; Andy, 2026-10-18: "the drobdown should make sure that the
      // \"current\" line is visible, and the the current selection is reflected in the dropdown input.").
      var l = el('list');
      var cur = l && typeof l.querySelector === 'function' ? l.querySelector('tr.current') : null;
      if (cur && typeof cur.scrollIntoView === 'function') cur.scrollIntoView({ block: 'nearest' });
      if (dropdown && byKey[currentKey]) paintField(byKey[currentKey].row);
    }
    container.addEventListener('input', function (e) { var t = e && e.target; if (t && t.id === pre + 'text') typed(); });
    container.addEventListener('keydown', function (e) {
      var t = (e && e.target) || {};
      var inBox = t.id === pre + 'text';
      var stop = function () { if (typeof e.preventDefault === 'function') e.preventDefault(); };
      if (e.key === 'ArrowDown') { stop(); move(1); return; }
      if (e.key === 'ArrowUp') { stop(); move(-1); return; }
      // HOME AND END ARE THE LIST'S (goal/G29.8; Andy, 2026-10-18: "for a little search string, the user can use the
      // mouse or left and right arrow keys for the search box cursor-positioning. Give home and end to the list, same as
      // up and down arrow keys."): from the search box too, in pane and dropdown alike.
      if (e.key === 'Home' || e.key === 'End') { stop(); move(e.key === 'Home' ? 'top' : 'bottom'); return; }
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key === 'Enter' && !e.repeat) {
        if (currentKey != null && byKey[currentKey] && open) { stop(); pressRow(byKey[currentKey]); return; }
        if (inBox) ask();
      }
    });
    if (dropdown && typeof document.addEventListener === 'function') document.addEventListener('click', function (e) {
      // A ROW DRAWN AWAY IS NOT ELSEWHERE (goal/G29.8): a press that redraws the rows (a folder folding) takes its row
      // off the page before the click reaches the document, so a target no longer on the page shuts nothing.
      if (!open || !e || !e.target || e.target.isConnected === false) return;
      if (typeof container.contains === 'function' && !container.contains(e.target)) setOpen(false);
    });
    container.addEventListener('click', function (e) {
      var t = e && e.target;
      if (!t) return;
      if (t.id === pre + 'field') { setOpen(!open); return; }
      if (t.id === pre + 'clear') { var box = el('text'); if (box) box.value = ''; typed(); return; }
      if (t.id === pre + 'none') {
        self.value = '';
        self.row = null;
        currentKey = null;
        setOpen(false);
        paintField();
        draw();
        if (typeof o.pick === 'function') o.pick(null, '');
        return;
      }
      if (t.id === pre + 'search') { ask(); return; }
      var name = typeof t.getAttribute === 'function' ? t.getAttribute('data-filter') : null;
      var value = typeof t.getAttribute === 'function' ? t.getAttribute('data-value') : null;
      if (name != null && value != null) {
        var multi = filters.filter(function (f) { return f.name === name && f.multi; })[0];
        if (multi) {
          // A toggle: off when it was on, on when it was off; the others stay as they are.
          if (values[name][value]) delete values[name][value]; else values[name][value] = true;
        } else values[name] = value;
        var strip = el('filters');
        if (strip) strip.innerHTML = filterHtml();
        typed();
        return;
      }
      pressRow(rowOf(t));
    });
    if (o.api && typeof o.api.onPublished === 'function') off = o.api.onPublished(function () { ask(); }, o.server);

    // THE LIST ITSELF: value and row are the chosen one's (goal/G29.9).
    self.refresh = function () { draw(); ask(); };
    // ONE ROW CHANGED BY THE APP, NOT THE SERVER (goal/G29.6: "The app repaints one row when a peer's presence or
    // status changes, without asking the server."): the list drawn again from what it holds.
    self.redraw = function () { draw(); };
    // THE WORDS AS THEY STAND (goal/G29.8): a list drawn one way with words and another without asks here.
    self.words = function () { return words(); };
    // THE SLOT LENT TO THE APP (goal/G29.5): another call of the app to the same server, through the same one slot, so
    // nothing of the app's is ever two on the wire; it answers the server's body.
    self.ask = function (verb, args) { return lend(verb, args); };
    self.destroy = function () { live = false; if (typeof off === 'function') off(); off = null; };
    paintField();
    if (typeof o.rows === 'function') draw();
    return self;
  }

  (window.spirit = window.spirit || {}).elements = window.spirit.elements || {};
  window.spirit.elements.shellCreateListSearch = shellCreateListSearch;
  (window.spirit = window.spirit || {}).matchRanges = matchRanges;
}());
