// spirit/run/face/login/login.js
// THE FACE'S LOGIN APP (goal/G30.9), the counterpart of the node's Join app, drawn as Join draws: every step a bullet,
// done ones ticked, the open one expanded with its form. It draws what the shell hands it (onSteps: the facts, the
// open step, the done steps) and decides nothing. One field, Log in: it takes the member's verified email or the token
// from the mail, and the page never says which it got; it says that a relay owner who swaps face.html or this app could
// read what the face shows (goal/G30.11). After login: the home node, reached sealed or not (the shell decides and hands
// it over), and Log out (on the face; on the home node its owner is logged in and there is nothing to log out of).

(function () {
  var api = null;
  var pane = null;
  var shown = '';
  var steps = [];

  function escape(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function draw(h) {
    var said = JSON.stringify(h);
    if (said === shown) return;
    // Handed something new while he types in the field: drawn once he leaves it.
    if (pane.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    shown = said;
    var reached = false;
    pane.innerHTML = '<ol class="join-steps">' + steps.map(function (s, i) {
      var done = !!h.done[i];
      var open = !done && !reached;
      if (s.until === h.open) reached = true;
      return '<li class="stat-tile wide">' +
        '<div class="label">' + (done ? '☑️' : '⬜') + ' ' + escape(s.icon || '') + ' ' + escape(s.name) + '</div>' +
        (open ? '<div class="job-manifest-note">' + escape(s.text || '') + '</div><div id="face-step-' + escape(s.until) + '"></div>' : '') +
        '</li>';
    }).join('') + '</ol>';

    var login = document.getElementById('face-step-login');
    if (login) {
      login.innerHTML =
        '<div class="start-job-form card">' +
          '<label class="field-label grow">Log in<input id="face-login-field" type="text" autocomplete="email" autofocus></label>' +
          '<button type="button" id="face-login-go">Log in</button>' +
        '</div>' +
        '<div class="job-manifest-note" id="face-login-said"></div>';
      var go = function () {
        var field = document.getElementById('face-login-field');
        var out = document.getElementById('face-login-said');
        var text = String(field.value || '').trim();
        if (!text) return;
        api.post('login', { text: text }).then(function (r) {
          if (r && r.loggedIn) { api.refresh(); return; }
          // The same words for every other answer, so the page never says which it got.
          out.textContent = 'If that matched, check your mail for the token and the link.';
        }, function () { out.textContent = 'The relay did not answer; try again.'; });
      };
      document.getElementById('face-login-go').addEventListener('click', go);
      document.getElementById('face-login-field').addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    }
    // The last step stays drawn once done: who is logged in, how the home node is reached, and Log out.
    var last = steps[steps.length - 1];
    var linkStep = document.getElementById('face-step-link');
    if (!linkStep && last && last.until === 'link' && h.done[steps.length - 1]) {
      pane.querySelector('.join-steps').insertAdjacentHTML('beforeend', '<li class="stat-tile wide"><div id="face-step-link"></div></li>');
      linkStep = document.getElementById('face-step-link');
    }
    if (linkStep) {
      var how = h.facts.home ? 'This is your home node.'
        : !h.facts.up ? 'Your home node is not connected; this face reconnects by itself.'
        : h.facts.sealed ? 'Connected to your home node over a sealed link.'
        : 'Connected to your home node unsealed: this browser cannot seal, so your traffic is readable on the relay.';
      linkStep.innerHTML =
        '<div class="job-manifest-note">Logged in as ' + escape(h.facts.face) + '. ' + escape(how) + '</div>' +
        (h.facts.home ? '' : '<div class="start-job-form card"><button type="button" id="face-logout">Log out</button></div>');
      // TWO PRESSES (goal/G30.15): the first arms it, a press anywhere else disarms it (the shell's armUntilElsewhere),
      // the second logs out.
      var out = document.getElementById('face-logout');
      if (out) out.addEventListener('click', function () {
        if (out.getAttribute('data-armed') !== '1') {
          out.setAttribute('data-armed', '1');
          out.classList.add('armed');
          out.textContent = 'Log out? Press again';
          if (typeof api.armUntilElsewhere === 'function') api.armUntilElsewhere(function () {
            out.removeAttribute('data-armed');
            out.classList.remove('armed');
            out.textContent = 'Log out';
          });
          return;
        }
        api.post('logout').then(function () { window.location.reload(); }, api.refresh);
      });
    }
  }

  window.faceShell.activateApp({
    mount: function (container, shellApi) {
      pane = container;
      api = shellApi;
      fetch('/face/login/login.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); })
        .then(function (m) { steps = (m && m.steps) || []; shown = ''; api.refresh(); });
    },
    onSteps: function (h) { if (pane && steps.length) draw(h); },
  });
}());
