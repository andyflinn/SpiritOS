// One row of the address book, as its own screen.
//
// The first DIALOG (Andy). A dialog is a hidden app a table pushes for
// one row: it shows that row and nothing else, it cannot launch anything,
// and the only way out is back to the table it came from. What it wants
// to happen elsewhere it RETURNS, and the app underneath acts on it.
//
// Why a screen and not the expanding row it replaces:
//
//   - the table keeps its shape. A six-fact bubble and a form inside a
//     colspan made the widest thing on the page live inside the narrowest,
//     which is what pushed Contacts off a portrait screen;
//   - the table keeps its scroll. Panes are hidden and never destroyed,
//     so the list is exactly where it was when you come back — which is
//     the reason this is a separate app id and not a second view of
//     Contacts, whose one pane would have been rebuilt;
//   - one thing on screen. Reading somebody's numbers while their
//     neighbours are still listed above and below is what the row
//     expansion made you do.
//
// A sibling folder, not a child: discovery is flat and stays flat
// (app/<name>/<name>.js). The cost is that api.fs here is scoped to
// app/contactsDetails/ — NOT to Contacts' folder — so this app writes
// nothing locally. It does not need to: every decision about a person is
// a hub verb, and the one file Contacts keeps (prefs.json, the stranger
// policy) belongs to the list rather than to any row.

var cdEscapeHtml = spirit.core.util.escapeHtml;
var cdIcon = spirit.core.const.ICON;
var cdApi = null;

var cdKey = '';        // whose row this screen is
var cdPerson = null;   // the row itself, as buildPeople hands it over
var cdChanged = false; // has anything happened that the table must repaint for?
var cdBlockArmed = false;

function cdPost(path, body) {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function (r) {
    return r.text().then(function (t) { return { status: r.status, text: t }; });
  });
}

function cdStatus(text) {
  var el = document.getElementById('cd-status');
  if (el) el.textContent = text || '';
}

// Re-fetched by key, never handed over in params.
//
// params carries the KEY and nothing else, on purpose. A row captured at
// launch would sit here going stale while you read it, and the numbers
// are the half most likely to move — a message arriving while this screen
// is open changes unanswered inbound. The key is the only part of a row
// that cannot change.
function cdLoad() {
  return fetch('/api/hub/who')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var people = (data && data.people) || [];
      cdPerson = people.filter(function (p) { return p.publicKey === cdKey; })[0] || null;
      cdRender();
    })
    .catch(function (e) { cdStatus('could not read the book: ' + e.message); });
}

// A rate is messages per day across peerStats' window, to one decimal,
// with the unit riding along. Same reading the table's own panel gave
// before this screen took it over.
function cdRate(perDay) {
  var n = Number(perDay);
  if (!isFinite(n) || n < 0) n = 0;
  return n.toFixed(1) + ' / day';
}

// The titlebar says WHOSE row this is, because the app's own name
// ("Contact") is the least useful word available on a screen that only
// ever shows one person. The mark comes with it: a screen about somebody
// refused should say so where you are already looking.
function cdTitle() {
  if (!cdPerson) return 'Contact';
  var mark = cdPerson.blocked ? cdIcon.NO + ' '
    : cdPerson.held ? cdIcon.WAITING + ' '
    : '';
  var name = cdPerson.publicLabel || '';
  var mine = cdPerson.myLabel || '';
  if (mine && name && mine !== name) return mark + name + ' (' + mine + ')';
  return mark + (mine || name || ('…' + (cdPerson.tail || '')));
}

// No focus guard, and that is the shell's doing rather than an oversight.
// A dialog is never driven by the job tick (switchTo, renderActive), so
// the only repaints are the ones this file asks for: a load, and a
// decision. There is no two-second repaint left to destroy the field
// somebody is typing in — which is exactly what it used to do, and what
// every table in the shell still needs a guard against.
function cdRender() {
  var body = document.getElementById('cd-body');
  if (!body) return;

  if (cdApi) cdApi.setScreenTitle(cdTitle());

  if (!cdPerson) {
    // The row went away while this screen was open — blocked from
    // somewhere else, or a book edited by hand. Say so rather than
    // drawing an empty panel that looks like a load that never finished.
    body.innerHTML = '<div class="stat-tile wide">' +
      '<div class="job-log-empty">That contact is no longer in the book.</div>' +
      '</div>';
    return;
  }

  // Andy's order: who they are, then what they cost. The three verbs that
  // answer the second half are the buttons underneath — accept, block,
  // and leaving them where they are.
  //
  // Rates are per day over peerStats' 14-day window, not lifetime: a
  // lifetime total only ever grows, so it ranks contacts by how long they
  // have been in the book, which is the opposite of the question.
  var facts = spirit.shell.factRow([
    ['Public Handle', cdPerson.publicLabel || '(none)'],
    ['My Label', cdPerson.myLabel || '(none)'],
    ['Unanswered inbound', String(cdPerson.unansweredInbound || 0)],
    ['Inbound rate', cdRate(cdPerson.inboundPerDay)],
    ['Outbound rate', cdRate(cdPerson.outboundPerDay)],
    ['Storage', spirit.core.util.formatBytes(cdPerson.bytesHeld || 0)],
  ]);

  // Accept is offered only to somebody waiting, Unblock only to somebody
  // refused: the buttons are how the two states are told apart, which is
  // exactly how the chat strip and the old row panel did it.
  var buttons = '';
  if (cdPerson.blocked) {
    buttons = '<button type="button" class="cancel-btn" id="cd-unblock">Unblock</button>';
  } else {
    if (cdPerson.held) {
      buttons += '<button type="button" class="cancel-btn" id="cd-accept">Accept</button>';
    }
    buttons += '<button type="button" class="cancel-btn" id="cd-block">' +
      (cdBlockArmed ? 'Block — press again' : 'Block') + '</button>';
  }

  var handle = cdPerson.publicLabel || '';
  var caption = handle ? 'Change My Label for ' + cdEscapeHtml(handle) : 'Change My Label';

  body.innerHTML =
    '<div class="stat-tile wide">' +
      facts +
      // The caption and its input take the width and the buttons fill the
      // end; align-items:flex-end on the row is what lines a button up
      // with the input rather than with the caption above it.
      '<div class="start-job-form card">' +
        '<label class="field-label grow">' + caption +
          '<input type="text" id="cd-label-input"' +
          ' value="' + cdEscapeHtml(cdPerson.myLabel || '') + '"' +
          ' placeholder="' + cdEscapeHtml(cdPerson.publicLabel || '') + '">' +
        '</label>' +
        buttons +
      '</div>' +
    '</div>' +
    '<div class="job-manifest-note" id="cd-status"></div>';
}

// Everything this screen decides is a hub verb. Nothing is written to
// disk here, and nothing about the person is kept: whoBook is the book.
function cdPeerAction(action, extra) {
  var body = { publicKey: cdKey, action: action };
  Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
  return cdPost('/api/hub/peer', body).then(function (r) {
    if (r.status !== 200) {
      cdStatus(action + ' failed: ' + r.status + ' ' + r.text);
      return false;
    }
    cdStatus('');
    // The table behind this screen paints from a list it fetched before
    // this screen existed, so it has to be told. Said NOW rather than on
    // the way out, because the way out is Back and Back is the shell's.
    cdChanged = true;
    if (cdApi) cdApi.setDialogResult({ changed: true, key: cdKey });
    return cdLoad().then(function () { return true; });
  });
}

spirit.shell.activateApp({
  // Once per pane, ever. Everything about WHO this screen is showing
  // belongs in open(), which runs on every call — see below.
  mount: function (container, api) {
    cdApi = api;
    container.innerHTML = '<div id="cd-body" class="stack"></div>';

    // Delegated, because the panel is repainted after every decision and
    // a handler bound to a button would go with it.
    document.getElementById('cd-body').addEventListener('click', function (event) {
      var id = event.target && event.target.id;
      if (id === 'cd-accept') { cdBlockArmed = false; cdPeerAction('accept'); return; }
      if (id === 'cd-unblock') { cdBlockArmed = false; cdPeerAction('unblock'); return; }
      if (id === 'cd-block') {
        // Two presses. Blocking is the one decision here that stops mail
        // arriving, and the button sits at the end of a row you may have
        // been tabbing along.
        if (!cdBlockArmed) { cdBlockArmed = true; cdRender(); return; }
        cdBlockArmed = false;
        cdPeerAction('block');
      }
    });

    document.getElementById('cd-body').addEventListener('change', function (event) {
      if (!event.target || event.target.id !== 'cd-label-input') return;
      cdPeerAction('label', { myLabel: event.target.value.trim() });
    });

  },

  // Every call, mounted or not — the shell guarantees it (switchTo). So
  // this is where the subject arrives, and where everything about the
  // last subject has to be let go of.
  //
  // The shell can promise that open() runs; it cannot know what is stale
  // inside. A half-armed Block is the example: two presses must mean two
  // presses about the SAME person, so arming it for bert and then
  // opening carol has to disarm.
  open: function (params) {
    cdKey = (params && params.key) || '';
    cdPerson = null;
    cdChanged = false;
    cdBlockArmed = false;
    cdLoad();
  },

});
