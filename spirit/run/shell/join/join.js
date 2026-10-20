// spirit/run/shell/join/join.js
// THE JOIN ICON ON A NEW NODE (goal/G30.1, box v32). While the node holds no seat on any relay, the desktop shows this
// app beside the Spirit group (its manifest says untilSeated; shell.js renderDesktop decides). It holds only the
// email form: relay.join with the email, aimed at the first relay this node lists, which is the kept seed
// (noderoutes.net). The relay mails a link to this node; opening it takes the seat (shell.js joinFromLink), and
// with a seat held the icon is gone. No new verb: the same relay.join natterDetails' form asks.

var joinApi = null;
var joinUrl = '';

function joinSay(text, bad) {
  var out = document.getElementById('join-out');
  if (!out) return;
  out.className = 'job-manifest-note ' + (bad ? 'is-error' : 'is-token');
  out.textContent = text;
}

// The first relay on this node's list, in list order (relay.search with '*' keeps it): the kept seed on a new node.
function joinFindRelay() {
  return joinApi.verb('relay.search', { q: '*' }).then(function (r) {
    var items = (r && r.body && r.body.items) || [];
    joinUrl = items.length ? String(items[0].key || '') : '';
    var where = document.getElementById('join-where');
    if (where) where.textContent = joinUrl ? 'on ' + joinUrl.replace(/^https?:\/\//, '') : 'this node lists no relay';
  });
}

function joinGo(button) {
  var email = String((document.getElementById('join-email') || {}).value || '').trim();
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) { joinSay('type your email address', true); return; }
  if (!joinUrl) { joinSay('this node lists no relay to join', true); return; }
  button.disabled = true;
  joinApi.verb('relay.join', { url: joinUrl, email: email, code: '' }).then(function (r) {
    var said = (r && r.body) || {};
    // Andy (goal/G30.1): "an email in your inbox contains a confirmation link for the entered email".
    if (said.ok) joinSay('An email in your inbox at ' + email + ' holds a confirmation link. Open it on this computer within 10 minutes.', false);
    else joinSay(said.error || ('the relay did not answer (' + ((r && r.status) || 'no status') + ')'), true);
  }, function (e) { joinSay(String((e && e.message) || e), true); }).then(function () { button.disabled = false; });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    joinApi = api;
    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<div class="label">Join a relay <span id="join-where" class="job-manifest-note"></span></div>' +
        '<div class="job-manifest-note">Type your email. The relay mails you a link; open it on this computer and this node takes its seat.</div>' +
        '<div class="start-job-form card">' +
          '<label class="field-label grow">Your email' +
            '<input type="email" id="join-email" placeholder="you@example.org" autocomplete="email"></label>' +
          '<button type="button" id="join-go">Join</button>' +
        '</div>' +
        '<div id="join-out" class="job-manifest-note"></div>' +
      '</div>';
    document.getElementById('join-go').addEventListener('click', function (e) { joinGo(e.currentTarget); });
    document.getElementById('join-email').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') joinGo(document.getElementById('join-go'));
    });
    joinFindRelay();
  },
});
