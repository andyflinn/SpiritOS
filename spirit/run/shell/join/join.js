// spirit/run/shell/join/join.js
// THE JOIN APP (goal/G30.1, box v39): it walks a new user from joining a relay to opening his face, as one to-do list.
// The steps are its manifest's (join.json), each with its name, icon and the fact that ends it. Done steps are ticked;
// every open step up to the open one is expanded with its form, so the optional Find someone never stands in the way
// of the step after it. The forms are the shell elements: joinForm, contactList (Contacts' one list, goal/G30.19),
// faceForm.
//
// DECIDED ONCE, IN THE SHELL (box v42; Andy: "Why, when the shell already figured out that the join-app must appear,
// does the join app figure out AGAIN where the user stands?"). The shell hears the node's join-steps job, works out the
// open step and which steps are done, and hands that to onSteps below: when this app mounts, when the job changes, and
// when this app's own faceOpened changes. This app subscribes to nothing, decides nothing and asks the node nothing
// about the steps; it draws what it is handed. Handed the same again, it draws nothing; handed something new while a
// field in the list has focus, it waits until the focus leaves, so nothing he is typing is wiped.
//
// It goes exactly this far: the last step is a link to his face URL, ticked once he has opened it, kept as this app's
// own state (faceOpened, relay-state/shell/join/state.json); the face answers once the face switch is built.

var joinApi = null;
var joinHanded = null;    // what the shell last handed: { facts, open, done }
var joinFacts = null;
var joinRelays = [];       // the relays this node lists, as spirit.relay.status rows them
var joinShown = '';       // what the list was last drawn from
var joinWaiting = false;  // handed something new while he was typing

// The shell elements this app is made of. WHAT IT USES, IT LOADS ITSELF (goal/G41.3; Andy: every app bootstraps its own
// components, "lazy-load, is a tree...."): through spirit.require, and the steps are drawn again once they are in.
var joinParts = Promise.all(['shell/js/joinForm.js', 'shell/js/faceForm.js', 'shell/js/contacts/listElement.js'].map(function (p) { return spirit.require(p); }));
joinParts.then(function () { joinShown = ''; joinShow(); }, function () { /* a form missing leaves its step without one */ });
function joinEl() {
  var w = window.spirit.elements || {};
  return { joinForm: w && window.spirit.elements.joinForm, contactList: w && window.spirit.elements.contactList, faceForm: w && window.spirit.elements.faceForm };
}
// ICONS ARE GLYPHS (goal/G41.1): a step names its own in join.json, and the marks are written here; no icon table.
var JOIN_DONE = '☑️';
var JOIN_OPEN = '⬜';
function joinEsc(s) { return joinApi.escapeHtml(String(s == null ? '' : s)); }
// The steps' names, icons and words, read once from this app's own manifest.
// Asked once, as it loads (goal/G40.8: spirit.fs answers when it has it, where the kernel's read waited in place).
var joinStepList = null;
spirit.fs.loadFile('shell/join/join.json').then(function (text) {
  try { joinStepList = (JSON.parse(text) || {}).steps || []; } catch (e) { joinStepList = []; }
  if (joinHanded) { joinShown = ''; joinShow(); }
}, function () { joinStepList = []; });
function joinSteps() { return joinStepList || []; }

function joinShow() {
  if (!joinHanded) return;
  var said = JSON.stringify(joinHanded);
  if (said === joinShown) return;
  var host = document.getElementById('join-list');
  if (host && host.contains(document.activeElement)) { joinWaiting = true; return; }
  joinShown = said;
  joinWaiting = false;
  joinFacts = joinHanded.facts || {};
  joinDraw();
}

function joinDraw() {
  var host = document.getElementById('join-list');
  if (!host || !joinHanded) return;
  var list = joinSteps();
  var done = joinHanded.done || [];
  var reached = false;
  host.innerHTML = '<ol class="join-steps">' + list.map(function (s, i) {
    // Every open step up to and including the open one is expanded.
    var open = !done[i] && !reached;
    if (s.until === joinHanded.open) reached = true;
    return '<li class="stat-tile wide">' +
      '<div class="label">' + (done[i] ? JOIN_DONE : JOIN_OPEN) + ' ' + joinEsc(s.icon || '') + ' ' + joinEsc(s.name) +
        (s.optional ? ' <span class="job-manifest-note">(optional)</span>' : '') + '</div>' +
      (open ? '<div class="job-manifest-note">' + joinEsc(s.text || '') + '</div><div id="join-step-' + i + '"></div>' : '') +
      '</li>';
  }).join('') + '</ol>' +
  (joinHanded.open ? '' : '<div class="job-manifest-note">' + JOIN_DONE + ' Every step is done.</div>');
  list.forEach(function (s, i) {
    var box = document.getElementById('join-step-' + i);
    if (box) joinForm(s, box);
  });
}

// THE RELAYS THE FORMS OFFER: read when a step is drawn, which is when the job changed. Through the spirit object
// (goal/G40.8): spirit.relay.status rows every relay this node lists, its seat, email and face.
function joinRelaysThen(draw) {
  spirit.relay.status('').then(function (r) { joinRelays = (r && r.body && Array.isArray(r.body.rows)) ? r.body.rows : []; }, function () { joinRelays = []; }).then(draw);
}

// The form each step draws, from the shell elements.
function joinForm(step, box) {
  var el = joinEl();
  // Step 1 (box v41): the one join control, its words where the node stands: Join with no seat, Add on a seat taken
  // without a verified email (by invite), Change once verified. So a node seated by invite completes it here.
  if (step.until === 'email' && el.joinForm) {
    // THE EMAIL FORM, THE SAME EVERYWHERE (goal/G40.10, box v19): its dropdown over every relay this node lists.
    joinRelaysThen(function () { el.joinForm.mount(box, { relays: joinRelays, escape: joinApi.escapeHtml }); });
    return;
  }
  // FIND SOMEONE: the same one list Contacts draws (goal/G30.19), the book, the shadow and the network.
  if (step.until === 'contact' && el.contactList) {
    box.innerHTML = '<div class="join-find-list"></div><div class="job-manifest-note join-find-said"></div>';
    el.contactList.create(box.querySelector('.join-find-list'), {
      api: joinApi,
      // The node republishes join-steps once the contact is in the book; nothing to ask here.
      say: function (text) { var s = box.querySelector('.join-find-said'); if (s) s.textContent = text; },
      empty: 'Nobody matches: the network is searched as you type.',
    });
    return;
  }
  if (step.until === 'face' && el.faceForm) {
    // THE FACE FORM, THE SAME EVERYWHERE (goal/G40.10, box v19): it offers the relays with a verified email itself. The
    // node republishes join-steps once a face is accepted.
    joinRelaysThen(function () { el.faceForm.mount(box, { relays: joinRelays, reload: function () { return Promise.resolve(); }, escape: joinApi.escapeHtml }); });
    return;
  }
  if (step.until === 'opened') {
    var url = joinFacts.faceUrl;
    box.innerHTML = url
      ? '<a id="join-face-link" href="' + joinEsc(url) + '" target="_blank" rel="noopener">' + joinEsc(url) + '</a>' +
        '<div class="job-manifest-note">Your face does not answer yet: the relay\'s face switch is still being built.</div>'
      : '<div class="job-manifest-note">No face name yet.</div>';
    var link = document.getElementById('join-face-link');
    // Kept as this app's own state, relay-state/shell/join/ (goal/G40.10: shell-app state out of git); the shell reads it
    // again when the file tree says it changed, and hands the steps again.
    if (link) link.addEventListener('click', function () {
      spirit.fs.saveFile('relay-state/shell/join/state.json', JSON.stringify({ faceOpened: true }) + '\n');
    });
  }
}

spirit.shell.activateApp({
  mount: function (container, api) {
    joinApi = api;
    container.innerHTML =
      '<div class="stack">' +
        '<div class="stat-tile wide"><div class="label">Becoming a SpiritOS participant</div>' +
          '<div class="job-manifest-note">A few steps, from joining a relay to opening your node from anywhere.</div></div>' +
        '<div id="join-list"><div class="job-manifest-note">Waiting for this node to say where you stand…</div></div>' +
      '</div>';
    // Handed something new while he typed: drawn once the focus has left the list.
    document.getElementById('join-list').addEventListener('focusout', function () {
      setTimeout(function () { if (joinWaiting) joinShow(); }, 0);
    });
  },
  // Where the user stands, worked out by the shell (handSteps): { facts, open, done }.
  onSteps: function (handed) {
    joinHanded = handed || null;
    joinShow();
  },
  // The shell's messages are not this app's news: it draws what onSteps hands it alone.
  render: function () {},
});
