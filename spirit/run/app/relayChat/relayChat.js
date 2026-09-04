spirit.shell.activateApp({
  mount: function (container, api) {
    var myName = '';
    var statusEl;

    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<label>Your name<input type="text" id="rc-name" placeholder="andy"></label>' +
        '<button type="button" id="rc-claim">Claim</button>' +
        '<label>To<input type="text" id="rc-to" placeholder="bert"></label>' +
        '<label>Text<input type="text" id="rc-text" placeholder="hello"></label>' +
        '<button type="button" id="rc-send">Send</button>' +
        '<span id="rc-status"></span>' +
      '</div>' +
      '<pre id="rc-log"></pre>';

    statusEl = document.getElementById('rc-status');

    function setStatus(t) { statusEl.textContent = t; }

    function hubPost(path, obj) {
      return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(obj)
      }).then(function (r) {
        return r.text().then(function (t) {
          return { status: r.status, text: t };
        });
      });
    }

    function refreshInbox() {
      if (!myName) return;
      fetch('/api/hub/inbox?name=' + encodeURIComponent(myName))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var lines = (data.messages || []).map(function (m) {
            return m.sentAt + ' ' + m.from + ' → ' + m.to + ': ' + m.text;
          });
          document.getElementById('rc-log').textContent = lines.join('\n') || '(empty)';
        })
        .catch(function (e) { setStatus('inbox failed: ' + e.message); });
    }

    document.getElementById('rc-claim').addEventListener('click', function () {
      var name = document.getElementById('rc-name').value.trim();
      hubPost('/api/hub/claim', { name: name }).then(function (r) {
        setStatus(r.status + ' ' + r.text);
        if (r.status === 201) myName = name;
      });
    });

    document.getElementById('rc-send').addEventListener('click', function () {
      var to = document.getElementById('rc-to').value.trim();
      var text = document.getElementById('rc-text').value;
      hubPost('/api/hub/send', { from: myName, to: to, text: text }).then(function (r) {
        setStatus(r.status + ' ' + r.text);
        document.getElementById('rc-text').value = '';
        refreshInbox();
      });
    });

    setInterval(refreshInbox, 2000);
  },
  render: function () {}
});
