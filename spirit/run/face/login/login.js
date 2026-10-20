// spirit/run/face/login/login.js
// THE FACE'S LOGIN APP (goal/G30.9), the counterpart of the node's Join app: it draws what the face shell hands it
// (onSteps: the facts, the open step, the done steps) and decides nothing. One field, Log in: it takes the member's
// verified email or the token from the mail, and the page never says which it got. The relay answers both the same
// unless it was a good token. After login: waiting for plumbing, and Log out.

(function () {
  var api = null;
  var pane = null;
  var shown = '';

  function draw(h) {
    var said = JSON.stringify(h);
    if (said === shown) return;
    // Handed something new while he types in the field: drawn once he leaves it.
    if (pane.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    shown = said;
    if (h.open === 'login') {
      pane.innerHTML =
        '<div class="face-card">' +
          '<div class="face-row"><label for="face-login-field">Log in:</label>' +
          '<input id="face-login-field" type="text" autocomplete="email" autofocus>' +
          '<button type="button" id="face-login-go">Log in</button></div>' +
          '<div class="face-note" id="face-login-said"></div>' +
        '</div>';
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
      return;
    }
    pane.innerHTML =
      '<div class="face-card">' +
        '<div>Logged in as ' + escape(h.facts.face) + '.</div>' +
        '<div class="face-note">Waiting for plumbing: reaching your home node comes next.</div>' +
        '<div class="face-row" style="margin-top:12px"><button type="button" id="face-logout">Log out</button></div>' +
      '</div>';
    document.getElementById('face-logout').addEventListener('click', function () { api.post('logout').then(api.refresh, api.refresh); });
  }

  function escape(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.faceShell.activateApp({
    mount: function (container, shellApi) { pane = container; api = shellApi; },
    onSteps: function (h) { if (pane) draw(h); },
  });
}());
