// spirit/run/shell/join/join.js
// THE JOIN ICON ON A NEW NODE (goal/G30.1, box v32). While the node holds no seat on any relay, the desktop shows this
// app beside the Spirit group (its manifest says untilSeated; shell.js renderDesktop decides). It holds only the
// join form, the shell element joinForm (box v33), aimed at the first relay this node lists, which is the kept seed
// (noderoutes.net). The relay mails a link to this node; opening it takes the seat (shell.js joinFromLink), and with
// a seat held the icon is gone. No new verb: the same relay.join natterDetails' form asks.

var joinApi = null;
var joinUrl = '';

// The first relay on this node's list, in list order (relay.search with '*' keeps it): the kept seed on a new node.
function joinFindRelay() {
  return joinApi.verb('relay.search', { q: '*' }).then(function (r) {
    var items = (r && r.body && r.body.items) || [];
    joinUrl = items.length ? String(items[0].key || '') : '';
    var where = document.getElementById('join-where');
    if (where) where.textContent = joinUrl ? 'on ' + joinUrl.replace(/^https?:\/\//, '') : 'this node lists no relay';
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    joinApi = api;
    var form = window.spiritElements && window.spiritElements.joinForm;
    container.innerHTML =
      '<div class="stat-tile wide" id="join-body">' +
        '<div class="label">Join a relay <span id="join-where" class="job-manifest-note"></span></div>' +
        '<div class="job-manifest-note">Type your email. The relay mails you a link; open it on this computer and this node takes its seat.</div>' +
        (form ? form.html({ label: 'Your email', button: 'Join' }) : '<div class="job-start-error">the join form did not load</div>') +
      '</div>';
    if (form) form.bind(document.getElementById('join-body'), { url: function () { return joinUrl; }, ask: function (v, a) { return joinApi.verb(v, a); } });
    joinFindRelay();
  },
});
