// spirit/run/shell/js/peerFind.js
// FIND SOMEONE ON THE NETWORK, ONE SHELL ELEMENT (goal/G30.1, box v39; Andy: "we make a shell-element out of the part
// in contacts-shell-app where it says: \"Find someone on the network\""). Moved whole out of Contacts, which draws it
// as before; the Join app draws it as its Find someone step. Contacts keeps no copy.
//
//   create(opts) -> { list, redraw() }
//     opts.listHost, opts.noteHost  the elements the shared list and its note go into
//     opts.addClass                 the class of a row's Add button (Contacts keeps contacts-seen-add)
//     opts.ask(verb, args)          the node's door, answering { status, text, body }
//     opts.peerPost(app, key, body) a card asked of a node (the shell's api.peerPost)
//     opts.callDialog(id, params)   a relay row opens natterDetails
//     opts.presence(key)            optional: true, false or undefined from the caller's own presence table
//     opts.onAdded(row), opts.say(text)  what the caller does after an Add, and where it says so
//
// What follows is the panel as Contacts had it (goal/G29.17 and before); the comments that argued each choice stay
// with Contacts' history in git, this keeps the rule each one settled.

(function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function icon(name) {
    var s = typeof spirit !== 'undefined' ? spirit : window.spirit;
    return (s && s.core && s.core.const && s.core.const.ICON[name]) || '';
  }
  function bodyOf(r) {
    if (r && r.body) return r.body;
    try { return JSON.parse(r && r.text); } catch (e) { return null; }
  }

  function create(opts) {
    var o = opts || {};
    var addClass = o.addClass || 'pf-add';
    var seen = [];
    var silent = [];
    var collide = Object.create(null);
    // Keyed by public key: 'asking' | { name, description } | { why }, thrown away with each new search.
    var cards = Object.create(null);
    var list = null;
    function ask(verb, args) { return Promise.resolve(o.ask(verb, args)).then(bodyOf); }
    function say(text) { if (typeof o.say === 'function') o.say(text); }

    // The nearer answer wins: the caller's own presence table, else the answering relay's word.
    function presence(c) { return typeof o.presence === 'function' ? o.presence(c.publicKey) : undefined; }
    function mark(c) {
      var known = presence(c);
      if (known === true) return icon('GREEN_CIRCLE');
      if (known === false) return icon('RED_CIRCLE');
      return c.present ? icon('GREEN_CIRCLE') : icon('WHITE_CIRCLE');
    }
    function markTitle(c) {
      var known = presence(c);
      if (known === true) return 'present — a relay you share is holding their connection';
      if (known === false) return 'absent — a relay you share says they are not connected';
      return c.present ? 'the relay that found them says they are connected, but you share no relay with them'
        : 'no relay you are connected to mentions this key';
    }

    // Nothing is asked while no words are typed: a search with no words would ask every relay for anyone.
    function source(text) {
      // AN EMPTY SEARCH ANSWERS LIKE ANY OTHER (goal/G30.15): what the relays rank first. It used to be dropped here.
      var q = String(text || '').trim();
      cards = Object.create(null);
      return ask('peer.search', { q: q }).then(function (data) {
        var items = (data && Array.isArray(data.items)) ? data.items : [];
        seen = items.map(function (i) { try { return JSON.parse(i.label); } catch (e) { return null; } }).filter(Boolean);
        silent = (data && data.silent) || [];
        collide = Object.create(null);
        seen.forEach(function (c) { var l = String(c.publicLabel || ''); collide[l] = (collide[l] || 0) + 1; });
        paintNote();
        return { items: items, more: !!(data && data.more) };
      });
    }

    // One line per person: the dot, the name, Add, and what they said in a bubble.
    function saidCell(c) {
      var card = cards[c.publicKey];
      if (card === 'asking') return '<td class="seen-said"><span class="said-bubble muted">asking them…</span></td>';
      if (card && card.why) {
        return '<td class="seen-said"><span class="said-bubble is-error">' + icon('WARNING') + ' ' +
          esc('could not reach them — ' + card.why) + '</span></td>';
      }
      if (card) {
        return '<td class="seen-said"><span class="said-bubble' + (card.description ? '' : ' muted') + '">' +
          (card.description ? esc(card.description) : 'they have not said anything about themselves') + '</span></td>';
      }
      return '<td class="seen-said"><span class="said-bubble muted">ask them…</span></td>';
    }
    function cells(c, markText) {
      var known = c.acquiredVia && c.acquiredVia !== 'roll';
      var alike = (collide[String(c.publicLabel || '')] || 0) > 1;
      return '' +
        '<td title="' + esc(markTitle(c)) + '">' + mark(c) + '</td>' +
        '<td>' + (c.publicLabel ? markText(c.publicLabel) : '(no label)') +
          (alike ? ' <span class="muted" title="more than one answer wears this name">…' + esc(String(c.tail || '')) + '</span>' : '') + '</td>' +
        // A relay is never written into the book (goal/G30.7): it is reached through natterDetails, so no Add.
        '<td>' + (c.kind === 'relay' ? '<span class="muted">a relay</span>' : known
          ? '<span class="muted">already a contact</span>'
          : '<button type="button" class="cancel-btn ' + esc(addClass) + '"' +
            ' data-key="' + esc(c.publicKey) + '"' +
            // The label travels with the row: the relay said it when it answered the search.
            ' data-label="' + esc(c.publicLabel || '') + '"' +
            ' data-url="' + esc(c.relay) + '">Add</button>') + '</td>' +
        saidCell(c);
    }

    // More than one answer wearing a name, and the relays that could not search.
    function paintNote() {
      var box = o.noteHost;
      if (!box) return;
      box.innerHTML =
        (seen.length > 1
          ? '<div class="job-manifest-note">More than one answer. Press a row to ask that node who it is — or ask them ' +
            'what their key ends with, which they can read in fine print at the foot of their own screen.</div>'
          : '') +
        (silent.length
          ? '<div class="job-manifest-note">' + silent.length + ' relay(s) could not search — they may be running older code: ' +
            esc(silent.join(', ')) + '</div>'
          : '');
    }
    function redraw() { if (list) list.redraw(); paintNote(); }

    // What is drawn is what the node verified: r.card, checked against the key the request was addressed to.
    function askCard(key) {
      if (!key || cards[key]) return;
      cards[key] = 'asking';
      Promise.resolve(o.peerPost('', key, { card: true })).then(function (r) {
        var said = (r && r.card) || null;
        if (r && r.ok && said && said.ok) cards[key] = { name: String(said.name || ''), description: String(said.description || '') };
        else if (said && said.why === 'wrong key') cards[key] = { why: 'answered by a different key — not this person\'s card' };
        else cards[key] = { why: (said && said.error) || (r && r.error) || 'no answer' };
        redraw();
      }).catch(function (e) { cards[key] = { why: String((e && e.message) || e) }; redraw(); });
    }

    function add(button) {
      var key = button.getAttribute('data-key') || '';
      var url = button.getAttribute('data-url') || '';
      var label = button.getAttribute('data-label') || '';
      if (!key) return;
      say('adding…');
      ask('peer.acquire', { publicKey: key, url: url, via: 'handle', publicLabel: label }).then(function (row) {
        say(row && row.publicLabel ? 'added ' + row.publicLabel : 'added');
        if (typeof o.onAdded === 'function') o.onAdded(row);
      }).catch(function (e) { say('could not add: ' + e.message); });
    }

    // Add first: it sits inside the row, and the press that writes a contact must not also ask for a description.
    // Bound before the list is made, so it runs first and stops the list hearing it.
    o.listHost.addEventListener('click', function (event) {
      var target = event.target;
      var btn = target && target.closest ? target.closest('.' + addClass) : null;
      if (!btn) return;
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      add(btn);
    });

    list = window.spiritElements.shellCreateListSearch(o.listHost, {
      api: {
        verb: function (name, body) {
          return source((body || {}).q).then(function (answer) {
            return { status: 200, body: { items: answer.items, more: answer.more, total: answer.items.length } };
          });
        },
        onPublished: function () { return function () {}; },
      },
      server: 'node',
      verb: 'peer.search',
      args: function (text) { return { q: text }; },
      // Matched on the name, as the node and every relay match it; * is anyone.
      matched: function (c) { return { name: String((c && c.publicLabel) || '') }; },
      score: function () { return list && list.words() === '*' ? 1 : null; },
      paint: cells,
      head: ['', 'Name', '', ''],
      filters: [{ name: 'kind', choices: [{ value: 'all', word: 'all' }, { value: 'node', word: 'nodes' }, { value: 'relay', word: 'relays' }],
        test: function (c, v) {
          var relay = !!(c && c.kind === 'relay');
          return v === 'relay' ? (relay ? 1 : 0) : v === 'node' ? (relay ? 0 : 1) : 1;
        } }],
      // A row asks that one person for a description; a relay row opens natterDetails.
      details: function (c) {
        if (c && c.kind === 'relay' && c.atKey) { o.callDialog('shell/natterDetails', { url: String(c.atKey) }); return; }
        var key = String((c && c.publicKey) || '');
        if (!key || cards[key]) return;
        askCard(key);
        redraw();
      },
      empty: 'Type part of a name, or * for anyone.',
    });

    // FILLED AS SOON AS ITS FOLD OPENS (goal/G30.15): the app hands its <details> as `fold`, and opening it searches
    // with whatever the field holds, nothing included.
    if (o.fold && typeof o.fold.addEventListener === 'function') {
      o.fold.addEventListener('toggle', function () { if (o.fold.open) list.refresh(); });
      if (o.fold.open) list.refresh();
    }

    return { list: list, redraw: redraw };
  }

  window.spiritElements = window.spiritElements || {};
  window.spiritElements.peerFind = { create: create };
}());
