// The address book, which used to be three panels inside Relay Chat
// (packet 2, ARCHITECTURAL-CONCERNS.md). whoBook is still the store and
// the hub still owns every verb; what moved is the view.
//
// Chat is one app that reads this list. Chess will be another, and a
// contact card arriving as a packet will be a third — none of which are
// reasons to open a chat window. RC keeps the To dropdown and nothing
// else: no adding, no accepting, no blocking, no relabelling.
//
// Everything here goes through the hub's own routes, the same ones the
// chat window called:
//
//   GET  /api/hub/who      the address book, captioned by this node
//   GET  /api/hub/handle   every key the mailbox carries under a word
//   POST /api/hub/contact  confirm one of those keys (acquiredVia handle)
//   POST /api/hub/peer     accept / block / unblock / label
//
// No packets. Sharing a contact is a later sitting and a bigger
// question: a card that arrives from somebody else is their six
// characters, not yours.

var contactsEscapeHtml = spirit.core.util.escapeHtml;
var contactsIcon = spirit.core.const.ICON;
var contactsApi = null;

// What this node does with mail from somebody it has not added. It moved
// here from Relay Chat (Andy): the question is what to do about a person
// who is not in the address book, and this app is the address book.
// Adding, accepting and renaming came over in packet 2; this was the
// piece that stayed behind, and beside a chat thread it read as a setting
// about chat rather than about people.
//
// The hub is where it is APPLIED — a dropped message never reaches the
// browser at all (js/hub.js, unknownPolicy) — and since 2026-09-12 it is
// also where it is HELD. It used to travel as a query parameter from
// whoever polled the inbox, then as this app's own file; the open
// question in both arrangements was whether the node should read it
// itself rather than trust a caller, and the answer turned out to be
// that the node should OWN it. This app draws the control and asks.
// NO FILE HERE ANY MORE. It was app/contacts/prefs.json, and before that
// app/relayChat/prefs.json — it has now moved twice between apps, which
// was the tell that it belonged to neither. It is preferences.json on the
// node, reached through /api/hub/unknown-senders, and this app no longer
// stores it at all.
//
// The old files are not read here either: hub.js honours
// app/contacts/prefs.json when preferences.json says nothing, so the
// migration happens once, on the node, where the value now lives.
var CONTACTS_UNKNOWN_CHOICES = ['silent', 'hold', 'acquire'];
var contactsPrefs = { unknown: 'silent' };

// A short name to choose by, and a sentence saying what it costs. The
// name is what the heading repeats back and what somebody remembers
// having picked; the sentence is read once.
//
// The stored values do not change with the wording: 'acquire' is what the
// hub is asked for and what prefs.json holds, whatever the radio happens
// to be called on screen.
//
// The words describe the BOOK, because that is what the setting decides.
// They used to sound like a choice about whether a message body is kept
// or dropped, which is only true of `acquire` — the other two drop the
// line either way, and what actually differs between them is whether the
// person gets a row (packet 4).
var CONTACTS_UNKNOWN_LABELS = {
  silent: {
    title: 'Ignore',
    note: 'No row. The line is not kept. They are not told.',
  },
  hold: {
    title: 'List them',
    note: 'A waiting row (×). The line is not kept. You accept or block later.',
  },
  acquire: {
    title: 'Add them',
    note: 'Writing is enough: they get a row and the line is kept.',
  },
};

var contactsPeople = [];
var contactsSelfTail = '';

function contactsPost(path, body) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r.text().then(function (t) { return { status: r.status, text: t }; });
  });
}

function contactsStatus(text) {
  var el = document.getElementById('contacts-status');
  if (el) el.textContent = text || '';
}

// The Handle column: their own name, and nothing else on an ordinary
// row. No key endings for people you have already acquired — you did
// that comparing down a telephone and it is finished (Andy).
//
// Two rows are the exception, because on those the handle is not an
// answer. Nobody claimed one, so the cell would be empty; or somebody
// else claimed the same one, which is `ambiguous` — the node's own
// verdict (buildPeople), not a second opinion formed here, so the table
// and the To list can never disagree about which rows read alike. The
// tail comes down with the row for the same reason: six from the end is
// one rule and it lives in hub.js.
function contactsHandleCell(person) {
  var handle = contactsEscapeHtml(person.publicLabel || '');
  var tail = contactsEscapeHtml(person.tail || '');
  if (handle && !person.ambiguous) return handle;
  if (!tail) return handle;
  return (handle ? handle + ' ' : '') + '…' + tail;
}

// One row per key.
//
//   ❌ NO       this node refuses them.
//   ⌛ WAITING   they wrote and nobody has decided yet.
//
// ❌ rather than the 📇 the chat list uses for the same person, and that
// is not an inconsistency (Andy). In chat the rolodex says WHICH app
// refused them, because the answer is somewhere else and you have to be
// sent there. Here you are already in that app: a mark pointing at
// Contacts, drawn in Contacts, points at itself.
//
// Chat's own refusal has no mark here at all. It lives in chat's
// per-peer log file, which api.fs will not let this app read — Contacts
// genuinely cannot know it, and do not "fix" that by widening a scope.
// The two refusals being separate is the point (packet 2).
// A row is what you need to decide whether to look closer, and no more
// (Andy). Everything else — the six facts, the rename, the decisions —
// is a screen of its own now: app/contactsDetails, the first dialog.
//
// What that bought, in the order it matters:
//
//   - the table keeps its shape. The old expansion put a six-fact bubble
//     and a form inside a colspan="4", so the widest thing on the page
//     lived inside the narrowest, and that is what pushed this app off a
//     portrait screen;
//   - the table keeps its place. Expanding a row reflowed everything
//     under it and collapsing changed the page height, so a long list
//     lost your position twice per look;
//   - one person at a time, with their neighbours not listed above and
//     below them while you read their numbers.
// PRESENCE, AND THE JOIN HAPPENS HERE AND ONLY HERE (PRESENCE.md, Stage
// 4). Presence arrives keyed by public key because a key is the only
// thing a relay and this node agree about; whoBook says who that is.
//
// Three marks, and the third is the point of the other two:
//
//   GREEN  a relay we are connected to says this key is present
//   RED    a relay we are connected to says this key is absent
//   WHITE  no relay mentions this key at all
//
// White is NOT a dimmer red. A contact we share no relay with is not
// offline, they are UNSEEN, and painting them red would be this column
// claiming knowledge it does not have. That is also why a removed peer
// goes white rather than red: they have no row anywhere any more, so
// nobody is in a position to say they are absent.
//
// FALSE NEGATIVES ONLY. Anything unknown, stale or unreachable reads as
// white — the mark that promises nothing.
var contactsPresence = Object.create(null);
var contactsPresenceSeen = false;

function contactsPresenceMark(publicKey) {
  // Before the first payload arrives nothing is known about anybody, and
  // a screenful of red on load would be a lie that corrects itself a
  // second later — which is worse than a screenful of white that fills
  // in, because the lie is the one that looks like information.
  if (!contactsPresenceSeen) return contactsIcon.WHITE_CIRCLE;
  var state = contactsPresence[publicKey];
  if (state === true) return contactsIcon.GREEN_CIRCLE;
  if (state === false) return contactsIcon.RED_CIRCLE;
  return contactsIcon.WHITE_CIRCLE;
}

function contactsPresenceTitle(publicKey) {
  if (!contactsPresenceSeen) return 'not known yet';
  var state = contactsPresence[publicKey];
  if (state === true) return 'present — a relay you share is holding their connection';
  if (state === false) return 'absent — a relay you share says they are not connected';
  return 'not known — no relay you are connected to mentions this key';
}

function contactsRowHtml(person) {
  var mark = '';
  if (person.blocked) mark = contactsIcon.NO;
  else if (person.held) mark = contactsIcon.WAITING;

  return '<tr class="job-row" data-contact-row="' + contactsEscapeHtml(person.publicKey) + '">' +
    '<td title="' + contactsEscapeHtml(contactsPresenceTitle(person.publicKey)) + '">' +
      contactsPresenceMark(person.publicKey) + '</td>' +
    '<td>' + mark + '</td>' +
    '<td>' + contactsHandleCell(person) + '</td>' +
    '<td>' + contactsEscapeHtml(person.myLabel || '') + '</td>' +
    '<td>' + contactsEscapeHtml(person.acquiredVia || '') + '</td>' +
    '</tr>';
}

function contactsRender() {
  var tbody = document.getElementById('contacts-tbody');
  if (!tbody) return;
  // The focus guard that stood here went with the field it guarded. It
  // existed because a repaint arriving while somebody was typing a name
  // would take the name — and the rename input is on the dialog now,
  // inside a pane this table's repaints cannot reach.

  if (!contactsPeople.length) {
    tbody.innerHTML = '<tr><td colspan="5">(nobody yet — add someone by handle below)</td></tr>';
    return;
  }
  tbody.innerHTML = contactsPeople.map(contactsRowHtml).join('');
}

function contactsPaintSelf() {
  var el = document.getElementById('contacts-self');
  if (!el) return;
  el.textContent = contactsSelfTail
    ? 'Being added yourself? Your key ends …' + contactsSelfTail + ' — that is what to tell them.'
    : '';
}

function contactsRefresh() {
  return fetch('/api/hub/who')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      contactsPeople = (data && data.people) || [];
      contactsSelfTail = (data && data.selfTail) || '';
      contactsRender();
      contactsPaintSelf();
    })
    .catch(function (e) { contactsStatus('could not read the book: ' + e.message); });
}

// Every key the mailbox has under that handle. Never one: a handle is a
// caption, and two johns are two keys — the whole reason this asks
// rather than picks.
function contactsFindByHandle() {
  var handle = document.getElementById('contacts-add-handle').value.trim();
  var out = document.getElementById('contacts-add-out');
  if (!handle) {
    out.innerHTML = '<div class="job-log-empty">Type the name you were told.</div>';
    return;
  }
  out.innerHTML = '<div class="job-log-empty">looking…</div>';
  fetch('/api/hub/handle?handle=' + encodeURIComponent(handle))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var matches = (data && data.matches) || [];
      if (!matches.length) {
        out.innerHTML = '<div class="job-log-empty">Nobody on this mailbox is called ' +
          contactsEscapeHtml(handle) + '.</div>';
        return;
      }
      // One match is still a question. A lone john today is not a lone
      // john next month, and the confirm is the habit that protects the
      // person, not the count.
      out.innerHTML =
        '<div class="job-log-empty">Ask them what their key ends with. They can see it in fine print ' +
        'at the bottom of their chat app, then confirm the one that matches.</div>' +
        matches.map(function (row) {
          var known = row.acquiredVia === 'handle'
            ? ' — already confirmed'
            : (row.acquiredVia && row.acquiredVia !== 'census' ? ' — already a contact' : '');
          return '<div class="rc-msg them">' +
            '<span class="rc-who">' + contactsEscapeHtml(row.publicLabel) + '</span>' +
            '<span class="rc-text">ends …' + contactsEscapeHtml(row.tail) + contactsEscapeHtml(known) + '</span>' +
            '<button type="button" class="cancel-btn" data-add-key="' + contactsEscapeHtml(row.publicKey) + '">Confirm</button>' +
            '</div>';
        }).join('');
    })
    .catch(function (e) { out.innerHTML = '<div class="job-log-empty">could not ask: ' + contactsEscapeHtml(e.message) + '</div>'; });
}

// Factory is the tightest setting that still lets two people who added
// each other talk. A file that is missing, empty or nonsense therefore
// reads as silent — the safe answer is also the default answer, so a
// broken prefs.json cannot quietly open a node up.
//
// When this app has no file of its own, the value is adopted once from
// where it used to live. Without that, a deliberate Hold or Add-them
// would silently revert to Silent on the first load after the move, which
// is a change of behaviour nobody asked for. Read-only and one-way: the
// old file is never written, and chat has already stopped reading its own
// copy, so there is no moment with two live answers.
// ASKED, NOT READ. The setting stopped being this app's file: it is what
// the NODE does about a stranger, and a node-global answer stored inside
// one of its readers was wrong twice over — wrong as a location, and
// wrong as a layer, because api.fs is scoped to app/<name>/ and a jail
// that an app can write is not a jail.
//
// So this app draws the control and nothing else. The node holds the
// value, applies it, and is the only thing that can change it. What the
// radios show is always what the node last said, never what this app
// believes it asked for.
function contactsLoadPrefs() {
  return fetch('/api/hub/unknown-senders')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var wanted = d && d.policy;
      contactsPrefs = {
        unknown: CONTACTS_UNKNOWN_CHOICES.indexOf(wanted) === -1 ? 'silent' : wanted,
      };
    })
    .catch(function () {
      // A node that will not answer reads as the tightest setting rather
      // than as whatever was on screen before. Being wrong towards
      // `silent` costs a message; being wrong the other way costs a
      // stranger a row in the book.
      contactsPrefs = { unknown: 'silent' };
    });
}

// PAINTED FROM THE ANSWER, not from the press. The node is asked to
// change it and replies with what it will actually do — so a refused or
// unwritable setting shows as unchanged instead of showing a radio that
// lies.
function contactsSavePrefs() {
  return fetch('/api/hub/unknown-senders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ policy: contactsPrefs.unknown }),
  })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || d.ok !== true) throw new Error((d && d.error) || 'refused');
      contactsPrefs.unknown = d.policy;
    })
    .catch(function (e) {
      contactsStatus('could not remember the setting: ' + (e && e.message ? e.message : 'no answer'));
      return contactsLoadPrefs();
    })
    .then(function () { contactsPaintUnknown(); });
}

// The heading carries the current answer, so the fold can be read closed
// and only the question being changed is open.
function contactsPaintUnknown() {
  var box = document.getElementById('contacts-unknown-choices');
  if (!box) return;
  box.innerHTML = CONTACTS_UNKNOWN_CHOICES.map(function (choice) {
    var text = CONTACTS_UNKNOWN_LABELS[choice];
    // The note sits in the same label as the radio, so reading it and
    // choosing it are the same gesture, laid out under the title rather
    // than under the button (rc-choice, in index.html).
    return '<label class="rc-choice">' +
      '<input type="radio" name="contacts-unknown" value="' + choice + '"' +
      (contactsPrefs.unknown === choice ? ' checked' : '') + '>' +
      '<span class="rc-choice-title">' + contactsEscapeHtml(text.title) + '</span>' +
      '<span class="rc-choice-note">' + contactsEscapeHtml(text.note) + '</span>' +
      '</label>';
  }).join('');

  var summary = document.getElementById('contacts-unknown-summary');
  var current = CONTACTS_UNKNOWN_LABELS[contactsPrefs.unknown];
  if (summary) {
    summary.textContent = 'People who write and are not in this book' +
      (current ? ' — ' + current.title : '');
  }
}

// THE WIRE, AND IT IS ALREADY THERE. The node holds one connection per
// relay and publishes what it hears as a permanent `relay-presence` job,
// so the shell's existing jobs channel carries this — no new shell
// surface, no second socket of our own, and nothing added to the bones
// so that a column could work.
//
// PRESENCE.md Stage 3 proposes spirit.core.presence.subscribe() to fold
// several app subscriptions into one EventSource. Contacts is the only
// app that consumes this arc — the document says so — so that fold would
// today have exactly one thing to fold. Left undone deliberately; if a
// second app ever wants presence, do Stage 3 then rather than opening a
// third socket.
// ONCE PER PAGE, NOT ONCE PER MOUNT.
//
// The shell loads an app's script once and mounts it on every entry, and
// activateApp takes mount/render/loadFile/open — there is no unmount
// hook. So a subscription opened in mount() and never closed would be a
// new EventSource every time somebody walked into Contacts, each one
// feeding its own repaint of a table that is drawn once.
//
// Guarded here rather than solved by adding a lifecycle hook to the
// shell: a column does not get to change the app contract. That the
// contract has no unmount is worth raising on its own, away from this.
var contactsWatching = false;

function contactsWatchPresence() {
  if (contactsWatching) return;
  contactsWatching = true;

  function take(job) {
    if (!job || job.type !== 'relay-presence') return;
    var table = (job.data && job.data.presence) || null;
    if (!table) return;
    contactsPresence = table;
    contactsPresenceSeen = true;
    contactsRender();
  }

  spirit.core.jobs.subscribe({
    // The snapshot matters as much as the updates: an app mounted after
    // the job last changed would otherwise sit white until something
    // moved, and "nothing has happened yet" would look identical to
    // "nobody is here".
    onSnapshot: function (jobs) { (jobs || []).forEach(take); },
    onUpdate: take,
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    contactsApi = api;

    container.innerHTML =
      // No Key column, and none in the panel either (Andy). Six
      // characters of somebody's key are what two people compare down a
      // phone while one adds the other; once they are in this list that
      // is done, and it is a column nobody reads.
      //
      // The two places a tail still earns its space are both about
      // acquiring: the candidates under Add-someone-by-handle, where
      // picking the right key IS the decision, and the footer, which is
      // your own tail for somebody else to add you by.
      // The mark gets a column of its own, and that column has no
      // heading (Andy): there is no word for it, and a mark sharing a
      // cell with a name pushed every name in the table a glyph to the
      // right or not, depending on the row. Its own column and the
      // handles line up down the page whatever anyone is marked.
      //
      // The dot gets the same treatment, leftmost, and for the same
      // reason — there is no word for it either. What the colour means
      // rides on each cell's title rather than on a heading, so hovering
      // a dot answers the question at the place the question is asked.
      //
      // Handle then Label, in that order, because Handle is theirs and
      // is what somebody told you on the phone, and Label is what you
      // decided afterwards. The bubble under an open row reads the same
      // way for the same reason.
      '<table class="jobs-table"><thead><tr><th></th><th></th><th>Handle</th><th>Label</th><th>How</th></tr></thead>' +
        '<tbody id="contacts-tbody"></tbody></table>' +
      // name= makes the two folds one exclusive group: opening either
      // closes the other, done by the browser with no JS and no state.
      // Named from this app's id prefix rather than its app id, because
      // app ids are folder-derived and have moved before — a group named
      // from one would silently regroup on the next move. See
      // UI_DESIGN_STYLE.md §3.
      '<details class="stat-tile wide" name="contacts-panels" id="contacts-add-panel">' +
        '<summary>Add someone by handle</summary>' +
        '<div class="start-job-form">' +
          '<input type="text" id="contacts-add-handle" placeholder="the name you were told">' +
          '<button type="button" id="contacts-add-find">Find</button>' +
        '</div>' +
        '<div id="contacts-add-out"></div>' +
      '</details>' +
      // Under Add-someone, because adding is what you come here to do and
      // this is the standing answer for people you have not. No count of
      // who is waiting: under Hold the hub writes them into the book, so
      // they are rows in the table above — which is more than a number,
      // and something you can act on.
      '<details class="stat-tile wide" name="contacts-panels" id="contacts-unknown-section">' +
        '<summary id="contacts-unknown-summary">People who write and are not in this book</summary>' +
        '<div id="contacts-unknown-choices"></div>' +
      '</details>' +
      '<div class="job-manifest-note" id="contacts-status"></div>' +
      '<div class="job-manifest-note" id="contacts-self"></div>';

    // Painted when the node answers, not before. The read is a round trip
    // now rather than a file, so painting on the next line would draw
    // `silent` every time and then correct itself.
    contactsLoadPrefs().then(contactsPaintUnknown);

    // A change of policy changes what the next inbox read will even
    // return, so it is sent on the spot. Nothing else has to be told:
    // every reader asks the node, and the node is the one that holds it.
    document.getElementById('contacts-unknown-choices').addEventListener('change', function (event) {
      var choice = event.target && event.target.value;
      if (CONTACTS_UNKNOWN_CHOICES.indexOf(choice) === -1) return;
      contactsPrefs.unknown = choice;
      // The repaint happens inside, from what the node answered rather
      // than from what was clicked.
      contactsSavePrefs();
    });

    document.getElementById('contacts-add-find').addEventListener('click', contactsFindByHandle);
    document.getElementById('contacts-add-handle').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        contactsFindByHandle();
      }
    });

    // Confirming is what writes the contact. Delegated, because the rows
    // are painted and repainted.
    document.getElementById('contacts-add-out').addEventListener('click', function (event) {
      var button = event.target && event.target.closest && event.target.closest('[data-add-key]');
      if (!button) return;
      var out = document.getElementById('contacts-add-out');
      contactsPost('/api/hub/contact', { publicKey: button.dataset.addKey }).then(function (r) {
        if (r.status !== 201) {
          out.innerHTML = '<div class="job-log-empty">' + contactsEscapeHtml(r.status + ' ' + r.text) + '</div>';
          return;
        }
        out.innerHTML = '<div class="job-log-empty">added — they are in your list now</div>';
        document.getElementById('contacts-add-handle').value = '';
        contactsRefresh();
      });
    });

    // A row opens the person, and that is all a row does now.
    //
    // callDialog rather than launchApp, because this is a question with
    // an answer. The shell hands the dialog its subject on every call
    // and gives back what it decided, so the code that opens the screen
    // is the code three lines below that acts on it — rather than a hook
    // declared at the bottom of the file, far from the click.
    //
    // The key alone. The dialog re-fetches the row rather than being
    // handed one, because the numbers move while it is open.
    //
    // The answer matters because render() repaints from a list this app
    // fetched and does not fetch again: without re-reading, blocking
    // somebody on their own screen would leave an unmarked row behind
    // you, and the mark is the whole of what a row says about that
    // decision. A dialog that decided nothing answers null, and costs
    // this table nothing.
    document.getElementById('contacts-tbody').addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var row = target.closest('[data-contact-row]');
      if (!row) return;
      contactsApi.callDialog('app/contactsDetails', { key: row.dataset.contactRow })
        .then(function (result) {
          if (result && result.changed) contactsRefresh();
        });
    });

    contactsRefresh();
    contactsWatchPresence();
  },

  render: function () {
    contactsRender();
  },
});
