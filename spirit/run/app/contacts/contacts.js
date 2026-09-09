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
// browser at all (js/hub.js, unknownPolicy) — but it arrives there as a
// query parameter from whoever polls the inbox, which is Relay Chat. So
// this app owns the value and chat reads it back, unscoped and read-only
// (RC_UNKNOWN_FILE, relayChat.js). Whether the hub should read it itself
// rather than trust the caller is the open question.
var CONTACTS_PREFS_FILE = 'prefs.json';
// Where the value used to live, for the one-time adoption below.
var CONTACTS_OLD_PREFS_FILE = 'app/relayChat/prefs.json';
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
var contactsEditing = ''; // the key whose row is open for editing

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

// A rate is messages per day across peerStats' window, and one decimal
// is the whole of it (packet 7). The number is there to be compared with
// the one beside it and with what it was last week — 0.2 against 3.1
// says everything a reader needs, and 0.214285… only says that a
// computer divided something.
//
// The unit rides with the figure. A bare "0.2" in a bubble beside a byte
// count is a number nobody can act on: per day is what makes it a rate
// rather than a total, and the difference between those two is the point
// of the whole packet.
function contactsRate(perDay) {
  var n = Number(perDay);
  if (!isFinite(n) || n < 0) n = 0;
  return n.toFixed(1) + ' / day';
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

// A contact who has never claimed a handle has nothing to name here, and
// "Change My Label for " trailing off into nothing is worse than the
// shorter sentence. The field is the same field either way.
function contactsRenameCaption(person) {
  var handle = person.publicLabel || '';
  return handle
    ? 'Change My Label for ' + contactsEscapeHtml(handle)
    : 'Change My Label';
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
function contactsRowHtml(person) {
  var mark = '';
  if (person.blocked) mark = contactsIcon.NO;
  else if (person.held) mark = contactsIcon.WAITING;

  var open = contactsEditing === person.publicKey;
  var row = '<tr class="job-row" data-contact-row="' + contactsEscapeHtml(person.publicKey) + '">' +
    '<td>' + mark + '</td>' +
    '<td>' + contactsHandleCell(person) + '</td>' +
    '<td>' + contactsEscapeHtml(person.myLabel || '') + '</td>' +
    '<td>' + contactsEscapeHtml(person.acquiredVia || '') + '</td>' +
    '</tr>';

  if (!open) return row;

  // What you can decide about one person, in the one place those
  // decisions live. Accept is offered only to somebody waiting, Unblock
  // only to somebody refused — the buttons are how the two states are
  // told apart, exactly as they were on the chat strip.
  var buttons = '';
  if (person.blocked) {
    buttons = '<button type="button" class="cancel-btn" data-contact-unblock="' + contactsEscapeHtml(person.publicKey) + '">Unblock</button>';
  } else {
    if (person.held) {
      buttons += '<button type="button" class="cancel-btn" data-contact-accept="' + contactsEscapeHtml(person.publicKey) + '">Accept</button>';
    }
    buttons += '<button type="button" class="cancel-btn" data-contact-block="' + contactsEscapeHtml(person.publicKey) + '">Block</button>';
  }

  // Who they are, and what they cost, as one reading. The row that
  // opened is the heading, so three rows stacked down the panel made a
  // list out of it.
  //
  // Andy's order: who they are, then what they cost. The question this
  // panel exists to answer is "how much is that contact a drain on my
  // attention and my resources", and the three verbs that answer it are
  // the ones on the row below — accept, block, leave waiting.
  //
  // The three middle numbers are counted by the NODE when a packet moves
  // (peerStats.js, packet 7), never derived here and never derived from
  // chat's log: that ring caps at 500, so a total taken from it stops
  // rising exactly when somebody becomes worth looking at, and it would
  // speak for the whole node while measuring one app.
  //
  // Zeros are drawn, unlike the blanks that stood here before the
  // counters existed. That is the difference between a fact that was
  // measured and came out nothing, and a fact nobody measured.
  //
  // Rates are per day over a 14-day window (peerStats.WINDOW_DAYS), not
  // lifetime. A lifetime total only ever grows, so it ranks contacts by
  // how long they have been in the book — the opposite of the question.
  //
  // "How" is not here: it is the fourth column of the table above, and a
  // fact repeated one line under itself says nothing twice.
  var detail = '<div class="stat-tile wide">' +
    spirit.shell.factRow([
      // Theirs, and it can change under you — which is why the book
      // keeps myLabel separately rather than overwriting this.
      ['Public Handle', person.publicLabel || '(none)'],
      ['My Label', person.myLabel || '(none)'],
      // Since the last thing you sent them. Replying is what resets it,
      // which is exactly the behaviour the number describes: high
      // because you are neglecting somebody, or high because somebody is
      // haranguing you. Those are opposite actions, and the row below
      // has a button for each.
      ['Unanswered inbound', String(person.unansweredInbound || 0)],
      ['Inbound rate', contactsRate(person.inboundPerDay)],
      ['Outbound rate', contactsRate(person.outboundPerDay)],
      ['Storage', spirit.core.util.formatBytes(person.bytesHeld || 0)],
    ]) +
    // What you call them and what you decide about them, on one line: the
    // caption and its input take the width (.field-label.grow) and the
    // buttons fill the end. align-items:flex-end on the row is what lines
    // a button up with the input rather than with the caption above it.
    //
    // myLabel: what YOU call that key. Never uploaded, and the reason the
    // book keeps their caption separately — theirs can change under you.
    //
    // The caption names the fact it edits — "Change My Label", the same
    // words the bubble one line above uses — and then says whose, so
    // that with a panel open there is no doubt which of the two names on
    // screen the field is about. Their handle and not their caption: the
    // caption is already myLabel resolved, so it would answer with what
    // you are in the middle of changing.
    '<div class="start-job-form card">' +
      '<label class="field-label grow">' + contactsRenameCaption(person) +
        '<input type="text" id="contacts-label-input" data-contact-key="' + contactsEscapeHtml(person.publicKey) + '"' +
        ' value="' + contactsEscapeHtml(person.myLabel || '') + '" placeholder="' + contactsEscapeHtml(person.publicLabel || '') + '">' +
      '</label>' +
      buttons +
    '</div>' +
    '</div>';

  return row + '<tr class="job-log-row"><td colspan="4">' + detail + '</td></tr>';
}

// `committed` says this repaint was asked for by the field that just
// changed, and it is the whole reason the guard below takes an argument.
function contactsRender(committed) {
  var tbody = document.getElementById('contacts-tbody');
  if (!tbody) return;
  // Same focus guard the Apps and Groups tables use, same reason: a
  // repaint arriving while somebody is typing a name would take the name
  // out of the field.
  //
  // But Return in that field fires `change` WITHOUT blurring it, so the
  // field still has focus when its own save comes back — and guarded
  // blindly, the one repaint that was actually asked for became the only
  // one ever refused. The label saved, and the facts bubble one line
  // above it went on showing the old one (Andy). A commit is not
  // somebody mid-word: it redraws.
  var focusedId = document.activeElement && document.activeElement.id;
  if (!committed && focusedId === 'contacts-label-input') return;

  if (!contactsPeople.length) {
    tbody.innerHTML = '<tr><td colspan="4">(nobody yet — add someone by handle below)</td></tr>';
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

function contactsRefresh(committed) {
  return fetch('/api/hub/who')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      contactsPeople = (data && data.people) || [];
      contactsSelfTail = (data && data.selfTail) || '';
      contactsRender(committed);
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
function contactsLoadPrefs() {
  var raw = null;
  try { raw = contactsApi.fs.loadFile(CONTACTS_PREFS_FILE); }
  catch (e) { raw = null; }
  if (!raw) {
    try { raw = contactsApi.readProject(CONTACTS_OLD_PREFS_FILE); }
    catch (e) { raw = null; }
  }
  var parsed = null;
  try { parsed = JSON.parse(raw); }
  catch (e) { parsed = null; }
  var wanted = parsed && parsed.unknown;
  contactsPrefs = {
    unknown: CONTACTS_UNKNOWN_CHOICES.indexOf(wanted) === -1 ? 'silent' : wanted,
  };
}

function contactsSavePrefs() {
  contactsApi.fs.saveFile(CONTACTS_PREFS_FILE, JSON.stringify(contactsPrefs, null, 2))
    .catch(function (e) { contactsStatus('could not remember the setting: ' + e.message); });
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

spirit.shell.activateApp({
  mount: function (container, api) {
    contactsApi = api;
    contactsEditing = '';

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
      // Handle then Label, in that order, because Handle is theirs and
      // is what somebody told you on the phone, and Label is what you
      // decided afterwards. The bubble under an open row reads the same
      // way for the same reason.
      '<table class="jobs-table"><thead><tr><th></th><th>Handle</th><th>Label</th><th>How</th></tr></thead>' +
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

    contactsLoadPrefs();
    contactsPaintUnknown();

    // A change of policy changes what the next inbox read will even
    // return, so it is written on the spot. Relay Chat picks it up on its
    // next poll — it reads this file rather than being told, so neither
    // app has to know the other is running.
    document.getElementById('contacts-unknown-choices').addEventListener('change', function (event) {
      var choice = event.target && event.target.value;
      if (CONTACTS_UNKNOWN_CHOICES.indexOf(choice) === -1) return;
      contactsPrefs.unknown = choice;
      contactsSavePrefs();
      contactsPaintUnknown(); // the heading carries the answer, so it moves with it
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

    document.getElementById('contacts-tbody').addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var verb = target.closest('[data-contact-accept]') || target.closest('[data-contact-block]') ||
        target.closest('[data-contact-unblock]');
      if (verb) {
        var key = verb.dataset.contactAccept || verb.dataset.contactBlock || verb.dataset.contactUnblock;
        var action = verb.dataset.contactAccept ? 'accept' : (verb.dataset.contactBlock ? 'block' : 'unblock');
        contactsPost('/api/hub/peer', { publicKey: key, action: action }).then(function (r) {
          if (r.status !== 200) { contactsStatus(action + ' failed: ' + r.status + ' ' + r.text); return; }
          contactsStatus('');
          contactsRefresh();
        });
        return;
      }

      var row = target.closest('[data-contact-row]');
      if (row) {
        var rowKey = row.dataset.contactRow;
        contactsEditing = (contactsEditing === rowKey) ? '' : rowKey; // opening one closes any other
        contactsRender();
      }
    });

    document.getElementById('contacts-tbody').addEventListener('change', function (event) {
      if (!event.target || event.target.id !== 'contacts-label-input') return;
      var key = event.target.dataset.contactKey;
      contactsPost('/api/hub/peer', { publicKey: key, action: 'label', myLabel: event.target.value.trim() })
        .then(function (r) {
          if (r.status !== 200) { contactsStatus('rename failed: ' + r.status + ' ' + r.text); return; }
          contactsStatus('');
          // Committed: redraw even though Return left the field focused,
          // or My Label in the bubble above keeps the old answer.
          contactsRefresh(true);
        });
    });

    contactsRefresh();
  },

  render: function () {
    contactsRender();
  },
});
