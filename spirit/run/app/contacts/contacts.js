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

// One row per key. The marks are the shell's, and mean here what they
// mean in the chat To list: ❌ refused, × waiting for an answer.
function contactsRowHtml(person) {
  var mark = '';
  if (person.blocked) mark = contactsIcon.NO + ' ';
  else if (person.held) mark = '× ';

  var open = contactsEditing === person.publicKey;
  var row = '<tr class="job-row" data-contact-row="' + contactsEscapeHtml(person.publicKey) + '">' +
    '<td>' + mark + contactsEscapeHtml(person.caption) + '</td>' +
    '<td>' + contactsEscapeHtml(person.acquiredVia || '') + '</td>' +
    '<td>ends …' + contactsEscapeHtml(String(person.publicKey || '').slice(-6)) + '</td>' +
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

  var detail = '<div class="stat-tile wide">' +
    spirit.shell.fileInfoRow('Their name', contactsEscapeHtml(person.publicLabel || '(none)')) +
    spirit.shell.fileInfoRow('How', contactsEscapeHtml(person.acquiredVia || '')) +
    spirit.shell.fileInfoRow('Key ends', contactsEscapeHtml(String(person.publicKey || '').slice(-6))) +
    // myLabel: what YOU call that key. Never uploaded, and the reason the
    // book keeps their caption separately — theirs can change under you.
    '<label class="field-label">Your name for them' +
      '<input type="text" id="contacts-label-input" data-contact-key="' + contactsEscapeHtml(person.publicKey) + '"' +
      ' value="' + contactsEscapeHtml(person.myLabel || '') + '" placeholder="' + contactsEscapeHtml(person.publicLabel || '') + '">' +
    '</label>' +
    '<div class="start-job-form">' + buttons + '</div>' +
    '</div>';

  return row + '<tr class="job-log-row"><td colspan="3">' + detail + '</td></tr>';
}

function contactsRender() {
  var tbody = document.getElementById('contacts-tbody');
  if (!tbody) return;
  // Same focus guard the Apps and Groups tables use, same reason: a
  // repaint while somebody is typing a name would take the name.
  var focusedId = document.activeElement && document.activeElement.id;
  if (focusedId === 'contacts-label-input') return;

  if (!contactsPeople.length) {
    tbody.innerHTML = '<tr><td colspan="3">(nobody yet — add someone by handle below)</td></tr>';
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

spirit.shell.activateApp({
  mount: function (container, api) {
    contactsApi = api;
    contactsEditing = '';

    container.innerHTML =
      '<table class="jobs-table"><thead><tr><th>Name</th><th>How</th><th>Key</th></tr></thead>' +
        '<tbody id="contacts-tbody"></tbody></table>' +
      '<details class="stat-tile wide" id="contacts-add-panel">' +
        '<summary>Add someone by handle</summary>' +
        '<div class="start-job-form">' +
          '<input type="text" id="contacts-add-handle" placeholder="the name you were told">' +
          '<button type="button" id="contacts-add-find">Find</button>' +
        '</div>' +
        '<div id="contacts-add-out"></div>' +
      '</details>' +
      '<div class="job-manifest-note" id="contacts-status"></div>' +
      '<div class="job-manifest-note" id="contacts-self"></div>';

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
          contactsRefresh();
        });
    });

    contactsRefresh();
  },

  render: function () {
    contactsRender();
  },
});
