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

// The facts, and the relay row the face step needs (relay.get carries its face and verified email).
var joinLoadedAt = 0;
function joinLoad() {
  joinLoadedAt = Date.now();
  var steps = joinEl().steps;
  if (!steps) { joinDraw(); return Promise.resolve(); }
  return steps.facts(joinAsk, joinOpened()).then(function (f) {
    joinFacts = f;
    if (!f.seated || !f.relayUrl) { joinRelayRow = null; return null; }
    return Promise.resolve(joinAsk('relay.get', { key: f.relayUrl })).then(function (g) {
      var row = (g && g.body && g.body.relay) || null;
      joinRelayRow = row ? Object.assign({ label: row.label || f.relayUrl.replace(/^https?:\/\//, '') }, row) : null;
    });
  }).then(joinDraw, joinDraw);
}

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
      onAdded: function () { joinLoad(); },
      say: function (text) { var s = box.querySelector('.join-find-said'); if (s) s.textContent = text; },
    });
    return;
  }
  if (step.until === 'face' && el.faceForm) {
    el.faceForm.mount(box, {
      seats: joinRelayRow ? [joinRelayRow] : [],
      ask: joinAsk,
      callDialog: function (id, params) { return joinApi.callDialog(id, params); },
      reload: joinLoad,
      idPrefix: 'join-face-',
      escape: joinApi.escapeHtml,
    });
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
      joinLoad();
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
        '<div id="join-list"></div>' +
      '</div>';
    joinLoad();
  },
  // Opened again later: asked again, at most every few seconds, so a step done elsewhere shows ticked.
  render: function () {
    if (Date.now() - joinLoadedAt < 3000) return;
    joinLoad();
  },
});
