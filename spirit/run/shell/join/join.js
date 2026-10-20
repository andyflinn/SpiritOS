// spirit/run/shell/join/join.js
// THE JOIN APP (goal/G30.1, box v39): it walks a new user from joining a relay to opening his face, as one to-do list.
// The steps are its manifest's (join.json), each with its name, icon and the fact that ends it. Done steps are ticked;
// every open step up to the open one is expanded with its form, so the optional Find someone never stands in the way
// of the step after it. The forms are the shell elements: joinForm, peerFind, faceForm.
//
// DECIDED ONCE, IN THE SHELL (box v42; Andy: "Why, when the shell already figured out that the join-app must appear,
// does the join app figure out AGAIN where the user stands?"). The shell hears the node's join-steps job, works out the
// open step and which steps are done, and hands that to onSteps below: when this app mounts, when the job changes, and
// when this app's own faceOpened changes. This app subscribes to nothing, decides nothing and asks the node nothing
// about the steps; it draws what it is handed. Handed the same again, it draws nothing; handed something new while a
// field in the list has focus, it waits until the focus leaves, so nothing he is typing is wiped.
//
// It goes exactly this far: the last step is a link to his face URL, ticked once he has opened it, kept as this app's
// own override (faceOpened); the face answers once the face switch is built, which is not in this item.

var joinApi = null;
var joinHanded = null;    // what the shell last handed: { facts, open, done }
var joinFacts = null;
var joinRelayRow = null;
var joinShown = '';       // what the list was last drawn from
var joinWaiting = false;  // handed something new while he was typing

// The shell elements this app is made of, as index.html hands them out.
function joinEl() {
  var w = window.spiritElements || {};
  return { joinForm: w && window.spiritElements.joinForm, peerFind: w && window.spiritElements.peerFind, faceForm: w && window.spiritElements.faceForm };
}
function joinIcon(name) { return spirit.core.const.ICON[name] || ''; }
function joinEsc(s) { return joinApi.escapeHtml(String(s == null ? '' : s)); }
function joinAsk(verb, args) { return joinApi.verb(verb, args); }
// The steps' names, icons and words, read once from this app's own manifest.
var joinStepList = null;
function joinSteps() {
  if (joinStepList) return joinStepList;
  try { joinStepList = (JSON.parse(spirit.core.fs.loadFile('shell/join/join.json')) || {}).steps || []; } catch (e) { joinStepList = []; }
  return joinStepList;
}

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
      '<div class="label">' + (done[i] ? joinIcon('CHECKED') : joinIcon('UNCHECKED')) + ' ' + joinIcon(s.icon) + ' ' + joinEsc(s.name) +
        (s.optional ? ' <span class="job-manifest-note">(optional)</span>' : '') + '</div>' +
      (open ? '<div class="job-manifest-note">' + joinEsc(s.text || '') + '</div><div id="join-step-' + i + '"></div>' : '') +
      '</li>';
  }).join('') + '</ol>' +
  (joinHanded.open ? '' : '<div class="job-manifest-note">' + joinIcon('CHECKED') + ' Every step is done.</div>');
  list.forEach(function (s, i) {
    var box = document.getElementById('join-step-' + i);
    if (box) joinForm(s, box);
  });
}

// The form each step draws, from the shell elements.
function joinForm(step, box) {
  var el = joinEl();
  // Step 1 (box v41): the one join control, its words where the node stands: Join with no seat, Add on a seat taken
  // without a verified email (by invite), Change once verified. So a node seated by invite completes it here.
  if (step.until === 'email' && el.joinForm) {
    var w = window.spiritElements.joinForm.words(joinFacts);
    box.innerHTML = '<span class="job-manifest-note">' + joinEsc(w.title) + ' on ' + joinEsc((joinFacts.relayUrl || 'no relay').replace(/^https?:\/\//, '')) + '</span>' +
      el.joinForm.html(w);
    el.joinForm.bind(box, { url: function () { return joinFacts.relayUrl; }, ask: joinAsk });
    return;
  }
  if (step.until === 'contact' && el.peerFind) {
    box.innerHTML = '<div class="join-find-list"></div><div class="join-find-note"></div><div class="job-manifest-note join-find-said"></div>';
    el.peerFind.create({
      listHost: box.querySelector('.join-find-list'),
      noteHost: box.querySelector('.join-find-note'),
      addClass: 'join-find-add',
      ask: joinAsk,
      peerPost: function (app, key, body) { return joinApi.peerPost(app, key, body); },
      callDialog: function (id, params) { return joinApi.callDialog(id, params); },
      // The node republishes join-steps once the contact is in the book; nothing to ask here.
      onAdded: function () {},
      say: function (text) { var s = box.querySelector('.join-find-said'); if (s) s.textContent = text; },
    });
    return;
  }
  if (step.until === 'face' && el.faceForm) {
    // The form needs the relay's row (its kept face and verified email): read once, when this step is drawn, which is
    // when the job changed. The node republishes join-steps once a face is accepted.
    var mount = function () {
      el.faceForm.mount(box, {
        seats: joinRelayRow ? [joinRelayRow] : [],
        ask: joinAsk,
        callDialog: function (id, params) { return joinApi.callDialog(id, params); },
        reload: function () { return Promise.resolve(); },
        idPrefix: 'join-face-',
        escape: joinApi.escapeHtml,
      });
    };
    Promise.resolve(joinAsk('relay.get', { key: joinFacts.relayUrl })).then(function (g) {
      var row = (g && g.body && g.body.relay) || null;
      joinRelayRow = row ? Object.assign({ label: row.label || joinFacts.relayUrl.replace(/^https?:\/\//, '') }, row) : null;
      mount();
    }, mount);
    return;
  }
  if (step.until === 'opened') {
    var url = joinFacts.faceUrl;
    box.innerHTML = url
      ? '<a id="join-face-link" href="' + joinEsc(url) + '" target="_blank" rel="noopener">' + joinEsc(url) + '</a>' +
        '<div class="job-manifest-note">Your face does not answer yet: the relay\'s face switch is still being built.</div>'
      : '<div class="job-manifest-note">No face name yet.</div>';
    var link = document.getElementById('join-face-link');
    // Kept as this app's own override; the shell hands the steps again with it (box v42).
    if (link) link.addEventListener('click', function () {
      joinApi.setAppOverride('shell/join', { faceOpened: true });
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
