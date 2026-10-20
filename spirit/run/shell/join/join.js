// spirit/run/shell/join/join.js
// THE JOIN APP (goal/G30.1, box v39): it walks a new user from joining a relay to opening his face, as one to-do list.
// The steps are its manifest's (join.json), each with its name, icon and the fact that ends it; joinSteps
// (shell/js/joinSteps.js) says which are done, the same answer the shell draws this app's tile by. Done steps are
// ticked; every open step up to the first one that counts is expanded with its form, so the optional Find someone
// never stands in the way of the step after it. The forms are the shell elements: joinForm, peerFind, faceForm.
//
// It goes exactly this far: the last step is a link to his face URL, ticked once he has opened it, kept as this app's
// own override (faceOpened); the face answers once the face switch is built, which is not in this item.

var joinApi = null;
var joinFacts = null;
var joinRelayRow = null;

// The shell elements this app is made of, as index.html hands them out.
function joinEl() {
  var w = window.spiritElements || {};
  return { steps: w && window.spiritElements.joinSteps, joinForm: w && window.spiritElements.joinForm,
    peerFind: w && window.spiritElements.peerFind, faceForm: w && window.spiritElements.faceForm };
}
function joinIcon(name) { return spirit.core.const.ICON[name] || ''; }
function joinEsc(s) { return joinApi.escapeHtml(String(s == null ? '' : s)); }
function joinAsk(verb, args) { return joinApi.verb(verb, args); }
// The steps, read once from this app's own manifest, as the shell reads it.
var joinStepList = null;
function joinSteps() {
  if (joinStepList) return joinStepList;
  try { joinStepList = (JSON.parse(spirit.core.fs.loadFile('shell/join/join.json')) || {}).steps || []; } catch (e) { joinStepList = []; }
  return joinStepList;
}

function joinOpened() { return !!(joinApi.getAppOverride('shell/join') || {}).faceOpened; }

// THE APP CARRIES ITS OWN LISTENER (goal/G30.1, box v40; Andy, 2026-10-20: "does the fucking new element even carry its
// own listener, that keeps the screen untouched until a streamed event actually affects it?", then "FIX IT RIGHT").
// It hears the node's join-steps job on the jobs stream and draws only when that job says something new; it asks the
// node nothing about the steps, and the shell's render does nothing here. A change that arrives while a field in the
// list has focus waits until the focus leaves the list, so nothing he is typing is wiped.
var joinData = null;      // the job's facts as last heard
var joinShown = '';       // what the list was last drawn from
var joinWaiting = false;  // a change heard while he was typing
function joinTake(job) {
  if (!job || job.type !== 'join-steps') return;
  joinData = job.data || {};
  joinShow(false);
}
// Drawn from the last job heard, with this app's own faceOpened. `forced` after something he did here (the link opened):
// drawn even while unchanged, never while he is typing in the list.
function joinShow(forced) {
  var steps = joinEl().steps;
  if (!steps || !joinData) return;
  var said = JSON.stringify([joinData, joinOpened()]);
  if (said === joinShown && forced !== true) return;
  var host = document.getElementById('join-list');
  if (host && host.contains(document.activeElement)) { joinWaiting = true; return; }
  joinShown = said;
  joinWaiting = false;
  joinFacts = steps.fromJob(joinData, joinOpened());
  joinDraw();
}
function joinReload() { joinShow(true); }

function joinDraw() {
  var host = document.getElementById('join-list');
  if (!host) return;
  var steps = joinEl().steps;
  var list = joinSteps();
  if (!steps || !joinFacts) { host.innerHTML = '<div class="job-manifest-note">Asking this node where you stand…</div>'; return; }
  var current = steps.current(list, joinFacts);
  var reached = false;
  host.innerHTML = '<ol class="join-steps">' + list.map(function (s, i) {
    var done = steps.done(s, joinFacts);
    // Every open step up to and including the first one that counts is expanded.
    var open = !done && !reached;
    if (s === current) reached = true;
    return '<li class="stat-tile wide">' +
      '<div class="label">' + (done ? joinIcon('CHECKED') : joinIcon('UNCHECKED')) + ' ' + joinIcon(s.icon) + ' ' + joinEsc(s.name) +
        (s.optional ? ' <span class="job-manifest-note">(optional)</span>' : '') + '</div>' +
      (open ? '<div class="job-manifest-note">' + joinEsc(s.text || '') + '</div><div id="join-step-' + i + '"></div>' : '') +
      '</li>';
  }).join('') + '</ol>' +
  (current ? '' : '<div class="job-manifest-note">' + joinIcon('CHECKED') + ' Every step is done.</div>');
  list.forEach(function (s, i) {
    var box = document.getElementById('join-step-' + i);
    if (box) joinForm(s, box);
  });
}

// The form each step draws, from the shell elements.
function joinForm(step, box) {
  var el = joinEl();
  if (step.until === 'seated' && el.joinForm) {
    box.innerHTML = '<span class="job-manifest-note">on ' + joinEsc((joinFacts.relayUrl || 'no relay').replace(/^https?:\/\//, '')) + '</span>' +
      el.joinForm.html({ label: 'Your email', button: 'Join' });
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
    if (link) link.addEventListener('click', function () {
      joinApi.setAppOverride('shell/join', { faceOpened: true });
      joinReload();
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
    // A change heard while he typed is drawn once the focus has left the list.
    document.getElementById('join-list').addEventListener('focusout', function () {
      setTimeout(function () { if (joinWaiting) joinShow(true); }, 0);
    });
    // The node's join-steps job: the snapshot has it now, every update after that is news.
    spirit.core.jobs.subscribe({
      onSnapshot: function (jobs) { (jobs || []).forEach(joinTake); },
      onUpdate: joinTake,
    });
  },
  // The shell's messages are not this app's news: it draws from the join-steps job alone.
  render: function () {},
});
