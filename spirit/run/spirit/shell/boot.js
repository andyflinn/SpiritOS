// spirit/run/spirit/shell/boot.js (goal/G41.3: face/shell.js moved into shell/ as the boot)
// THE BOOT OF THE GREEN SHELL'S PAGE (goal/G30.9; since goal/G43.18, box v29, "The shell"; Andy: "boot should solve
// transport issues only, then load whichever shell the node has configured"; Q22, Andy: "ok." to "the link home moves
// into spirit.js, and boot.js keeps only the stream and loading the shell"). spirit.js runs it once the page stands: at
// home, from the node itself; on a face, logged in, over the link spirit.js made (spirit.link). A face logged out never
// loads it: spirit.login draws the one field.
//
// WHAT IT DOES
//   - THE STREAM. At home the node's own (spirit.events); on a face /face/stream, sealed to this page's key when it can
//     seal: the jobs as the loopback page gets them, presence peer by peer, rebuilt into the relay-presence job the apps
//     read. Another device holding it is said, with Connect here; a face replaced by another device is told it was taken.
//     The home node offline: the small red not connected mark shows.
//   - THE PAGE'S PARTS, the home node's own, in its own version (FACE_PARTS), the sheets among them.
//   - THE SHELL THE NODE NAMES (node.shell, at home or face; spirit/app/<name>/<name>.js), drawn in the page's area. The
//     RULE: a shell must be able to replace itself. No desktop of its own (Q23, Andy: "yes." to the old shell apps missing
//     from the green shell for now).
//   - JOIN IS AN APP (goal/G43.26; Andy: "the join icon sits next to all other icons on a shell (SO IT's A FCUKING APP,
//     LIKE IT ALWAYS WAS)"): spirit/app/join/, a tile beside the others; boot does not load it. Boot keeps only the mailed
//     join link's code, which it hands to relay.join.
//   - THE NAVIGATION FRAME, for what still opens as a page (a contact's or a relay's details): its title bar and the api a
//     page is handed.

(function () {
  var desktop = document.getElementById('desktop');
  var container = document.getElementById('app-container');
  var content = document.getElementById('app-content');
  var title = document.getElementById('app-title');
  var offline = document.getElementById('app-offline');
  var banner = document.getElementById('face-banner');
  // WHERE THE PAGE STANDS, AS spirit.js FOUND IT (goal/G43.18, box v29: the login is spirit.login, the link spirit.link).
  var state = window.spirit.face || { home: true, loggedIn: true };
  var link = { up: null, loaded: false };   // up: null until first known; the keys are spirit.link's

  function say(text, action) {
    banner.innerHTML = '';
    banner.hidden = !text;
    if (!text) return;
    var words = document.createElement('span');
    words.textContent = text;
    banner.appendChild(words);
    if (action) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = action.label;
      b.addEventListener('click', action.run);
      banner.appendChild(b);
    }
  }

  // A verb of the home node, { status, text, body }: at home the family's own function on the spirit object, as every
  // local client asks (goal/G40.10); on a face, through the link.
  function ask(verb, args) {
    if (state.home) {
      var name = String(verb);
      var dot = name.indexOf('.');
      var fam = dot > 0 ? spirit[name.slice(0, dot)] : null;
      var fn = fam && typeof fam[name.slice(dot + 1)] === 'function' ? fam[name.slice(dot + 1)] : null;
      if (!fn) return Promise.resolve({ status: 400, text: '', body: { ok: false, code: 'no-such-verb', error: 'no verb ' + name } });
      return spirit.outcome(fn(args || {})).then(function (o) { return { status: o.status, text: o.body == null ? '' : JSON.stringify(o.body), body: o.body }; });
    }
    return spirit.link.ask(verb, args || {});
  }
  // A file of the home node, as text: by the node's own GET at home, through the link on a face.
  function fileText(path) {
    var clean = String(path).replace(/^\/+/, '');
    var got = state.home
      ? fetch('/' + clean).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); })
      : spirit.link.call({ get: clean }).then(function (r) { return { status: r.status, text: new TextDecoder().decode(r.bytes) }; });
    return got.then(function (r) {
      if (r.status !== 200) throw new Error(clean + ' answered ' + r.status);
      return r.text;
    });
  }

  // ── THE STREAM, AND WHAT THE APPS SUBSCRIBE TO ──────────────────────────────────────────────────────────────────
  var subscribers = [];
  // THE FACE LINK'S SNAPSHOT: what this face's stream hands a subscriber that comes late, as spirit.js's own stream keeps
  // its own (spirit.events). It is the stream, not a store: every reader reads the jobs from the jobs family's cache
  // (spirit.data.jobs.data, goal/G41.28), which this stream feeds.
  var linkJobs = {};
  var presence = {};
  var streamStopped = false;
  var retry = null;

  function setConnected(up) {
    if (link.up === up) return;
    link.up = up;
    if (offline) offline.hidden = !!up;
    subscribers.slice().forEach(function (h) { if (h.onConnection) { try { h.onConnection(up); } catch (e) { /* one app's fault */ } } });
  }
  function jobsList() { return Object.keys(linkJobs).map(function (k) { return linkJobs[k]; }); }
  function update(job) {
    linkJobs[job.id] = job;
    subscribers.slice().forEach(function (h) { if (h.onUpdate) { try { h.onUpdate(job); } catch (e) { /* one app's fault */ } } });
  }
  // The kernel's jobs.subscribe on a face (window.spirit.transport.events): what is known now, then every update.
  function events(handlers) {
    var h = handlers || {};
    // AT HOME THE EVENTS ARE THE NODE'S OWN STREAM, spirit.events (goal/G40.10): there is no face stream on loopback,
    // and nothing is kept here.
    if (state.home) return spirit.events.subscribe(h);
    subscribers.push(h);
    if (h.onSnapshot) { try { h.onSnapshot(jobsList()); } catch (e) { /* one app's fault */ } }
    if (h.onConnection) { try { h.onConnection(link.up); } catch (e) { /* one app's fault */ } }
    return function unsubscribe() { subscribers = subscribers.filter(function (x) { return x !== h; }); };
  }
  function deliver(ev) {
    if (!ev || typeof ev !== 'object') return;
    if (ev.event === 'job-updated' && ev.data && ev.data.id) update(ev.data);
    else if (ev.event === 'presence' && ev.data && ev.data.key) {
      presence[ev.data.key] = { present: ev.data.present === true, at: ev.data.at };
      var table = {};
      Object.keys(presence).forEach(function (k) { table[k] = presence[k]; });
      update({ id: 'face-presence', type: 'relay-presence', data: { presence: table } });
    } else if (ev.event === 'job-deleted' && ev.data) {
      // A job gone (goal/G41.33): to the kernel's subscribers, as the loopback stream hands it.
      delete linkJobs[ev.data];
      subscribers.slice().forEach(function (h) { if (h.onDelete) { try { h.onDelete(ev.data); } catch (e) { /* one app's fault */ } } });
    } else if (ev.event === 'relay-event' && ev.data) {
      // What a relay the home node owns did (goal/G30.15): to the kernel's subscribers, as the loopback stream hands it.
      subscribers.slice().forEach(function (h) { if (h.onRelayEvent) { try { h.onRelayEvent(ev.data); } catch (e) { /* one app's fault */ } } });
    } else if (ev.event === 'contact.rename' && ev.data && ev.data.key) {
      // A contact renamed at home (goal/G30.19): to the kernel's subscribers, as the loopback stream hands it.
      subscribers.slice().forEach(function (h) { if (h.onContactRename) { try { h.onContactRename(ev.data); } catch (e) { /* one app's fault */ } } });
    } else if (ev.event === 'taken') {
      streamStopped = true;
      setConnected(false);
      say('This face was taken by another device.', { label: 'Connect here', run: function () { say(''); streamStopped = false; openStream(true); } });
    }
  }
  function later() {
    if (streamStopped || retry) return;
    retry = setTimeout(function () { retry = null; openStream(false); }, 5000);
  }
  function openStream(here) {
    if (state.home) return;
    var L = spirit.link;
    var q = [];
    if (L.sealed) q.push('key=' + encodeURIComponent(L.key.publicKey));
    if (here) q.push('here=1');
    var chain = Promise.resolve();
    var held = '';
    function line(l) {
      var got = null;
      try { got = JSON.parse(l); } catch (e) { return Promise.resolve(); }
      if (got && got.type === 'refused') {
        streamStopped = true;
        if (got.code === 'face-elsewhere') {
          setConnected(false);
          say('Your face is open on another device; connecting here ends it there.', { label: 'Connect here', run: function () { say(''); streamStopped = false; openStream(true); } });
        } else if (got.status === 401) { window.location.reload(); } else { setConnected(false); streamStopped = false; later(); }
        return Promise.resolve();
      }
      setConnected(true);
      if (!L.sealed) { deliver(got); return Promise.resolve(); }
      return spirit.seal.open(L.key.privateKey, L.key.publicKey, L.node.publicKey, L.key.publicKey, got)
        .then(function (o) { if (o) deliver(JSON.parse(o.text)); });
    }
    fetch('/face/stream' + (q.length ? '?' + q.join('&') : ''), { credentials: 'same-origin' }).then(function (r) {
      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) return;
          held += decoder.decode(step.value, { stream: true });
          var parts = held.split('\n');
          held = parts.pop();
          parts.filter(Boolean).forEach(function (l) { chain = chain.then(function () { return line(l); }); });
          return pump();
        });
      }
      return pump();
    }).then(function () { return chain; }, function () { return chain; }).then(function () {
      if (!streamStopped) { setConnected(false); later(); }
    });
  }

  // ── THE HOME NODE'S PAGE PARTS, IN ITS OWN VERSION ──────────────────────────────────────────────────────────────
  function inject(path, text) {
    if (/\.css$/.test(path)) {
      var style = document.createElement('style');
      style.textContent = text;
      document.head.appendChild(style);
      return;
    }
    var s = document.createElement('script');
    s.textContent = text + '\n//# sourceURL=' + path;
    document.body.appendChild(s);
  }
  // WHAT THE PAGE LOADS FROM HOME UP FRONT: THE SHEETS ALONE (goal/G43.18, box v29: "boot.js, shell.css, face.css and every
  // other part of the shell come from the home node over that link"), the face's green last, over the shell's. NO SCRIPT
  // (goal/G43.27; Andy: "spirit.js still seems to be loading all sorts of shit that it doesn't need yet.", "wsl, I SAID,
  // make sure that spirit.js does NOT load all that shit!!!!!!!!!"): every script comes when what draws with it requires
  // it, through spirit.require, once (goal/G43.24: "every element that accesses ANY api must require them themselves").
  // The list of goal/G40.7 that fetched spirit's libraries, Join's steps and the navigation here is gone.
  var FACE_PARTS = [
    'shell.css',
    'shell/face.css',
  ];
  // Asked all at once, run in their order: a part missing is said by the app that needs it.
  function loadParts() {
    var asked = FACE_PARTS.map(function (p) { return fileText(p).then(function (t) { return t; }, function () { return null; }); });
    return asked.reduce(function (chain, got, i) {
      return chain.then(function () { return got; }).then(function (text) { if (text != null) inject(FACE_PARTS[i], text); });
    }, Promise.resolve());
  }

  // ── THE NAVIGATION FRAME (goal/G40.8) ───────────────────────────────────────────────────────────────────────────
  // shell/navigationWrapper.js, one of the parts from home: what still opens as a page, a contact's or a relay's details,
  // is pushed on it, under the title bar with Back and Home; with no page up, the shell's area shows.
  function navigation() { return (window.spirit.elements && window.spirit.elements.navigation) || null; }
  // NO API IS HANDED TO A PAGE (goal/G43.24; Andy: "every element that accesses ANY api must require them themselves"):
  // what opens on the navigation reaches its verbs through the spirit object, and an arming button disarms itself.
  function shownFrame() { desktop.hidden = true; container.hidden = false; }
  function showShell() { container.hidden = true; desktop.hidden = false; }
  function attachNavigation() {
    var n = navigation();
    if (n) n.attach({ title: title, content: content, shown: shownFrame, empty: showShell });
  }
  document.getElementById('app-close').addEventListener('click', function () { if (navigation()) navigation().back(); });
  document.getElementById('app-home').addEventListener('click', function () { if (navigation()) navigation().home(); showShell(); });

  // ── THE SHELL THE NODE NAMES (goal/G43.18, box v29) ────────────────────────────────────────────────────────────
  // node.shell({ at }) names it, spirit/app/<name>/<name>.js; it is loaded and handed the page's area, the shell's
  // element made there when it has one (spirit.elements.<name>.create). No shell named, or no answer: the shell app; one that does not load is said
  // in the banner.
  function loadShell() {
    var at = state.home ? 'home' : 'face';
    return Promise.resolve(spirit.ready).then(function (s) { return s.node.shell({ at: at }); }).then(function (r) {
      return String((r && r.name) || 'shell');
    }, function () { return 'shell'; }).then(function (name) {
      if (!/^[A-Za-z0-9_-]+$/.test(name)) name = 'shell';
      return spirit.require('spirit/app/' + name + '/' + name + '.js').then(function () {
        var E = window.spirit.elements && window.spirit.elements[name];
        desktop.innerHTML = '';
        // THE SHELL'S AREA IS NO DESKTOP GRID (Andy, of his face.html: "all icons of the app.search are in a thin strip in the left
        // of my browser window"): a fill column the shell lays itself out in (face.css, #desktop.shell-area).
        desktop.classList.add('shell-area');
        desktop.hidden = false;
        if (E && typeof E.create === 'function') E.create(desktop);
      });
    }).then(null, function (e) { say('The shell could not be loaded: ' + ((e && e.message) || e)); });
  }

  // ── STARTED ─────────────────────────────────────────────────────────────────────────────────────────────────────
  function start() {
    var home = !!state.home;
    if (!home) spirit.link.onDown(function () { setConnected(false); });
    // AT HOME THE STREAM WAITS FOR THE PARTS (goal/G40.10): the node hands the file tree once, as a stream opens, and a
    // part that subscribes as it loads (the data cache) would open it before the parts that read the tree (its
    // translators) are in, and lose it. So at home the subscriptions made while the parts load are held, and released
    // onto spirit.events once they are all in. On a relay the face's own stream opens after the parts already.
    var held = [];
    if (home) {
      setConnected(true);
      window.spirit.transport = { events: function (h) { held.push(h); return function () { held = held.filter(function (x) { return x !== h; }); }; } };
    } else {
      window.spirit.transport.events = events;
    }
    // The spirit object is started once the node can be reached (goal/G32.1; since goal/G43.27 it asks no api, each family binding when first called), and the sheets load once they are
    // there; then what boot.js draws with, each required by it: the navigation frame, the file tree's row element, and the
    // jobs family's cache manager (goal/G41.28).
    var parts = function () {
      return loadParts().then(function () { return Promise.all([window.spirit.require('shell/navigationWrapper.js'), window.spirit.require('spirit/element/search/file/rowElement.js'), window.spirit.cacheManager('jobs')]); })
        .then(null, function () { /* a part missing is said by what needs it */ });
    };
    return Promise.resolve(window.spirit.start()).then(parts, parts).then(function () {
      if (home) {
        var waiting = held;
        held = [];
        delete window.spirit.transport;
        waiting.forEach(function (h) { spirit.events.subscribe(h); });
      }
      Object.assign(window.spirit.shell = window.spirit.shell || {}, { factRow: factRow });
      attachNavigation();
      link.loaded = true;
      openStream(false);
      joinFromLink();
      return loadShell();
    }, function (e) {
      setConnected(false);
      say(String((e && e.message) || e));
    });
  }

  // The old shell's fact row (spirit/client/shell.js factRow), the same markup, for the dialogs that draw with it
  // (Relay Details, Contact): pairs of [label, value], escaped.
  function factRow(pairs) {
    var esc = spirit.escapeHtml;
    return '<div class="fact-row">' + (pairs || []).map(function (pair) {
      return '<div class="fact">' +
        '<span class="fact-label">' + esc(String(pair[0])) + '</span>' +
        '<span class="fact-value">' + esc(String(pair[1])) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  // THE CALLER'S LINK (goal/G40.10, box v25; Andy: "the join-app-link, which only the shell really knows"): this page,
  // opening Join; the relay adds its code and key to it and mails it. At home the node's /face.html, on a relay this face.
  (window.spirit.shell = window.spirit.shell || {}).joinLink = function () {
    return window.location.origin + window.location.pathname + '?app=join';
  };

  // THE MAILED JOIN LINK (goal/G40.10): the relay mails /face.html?join=<code>&relay=<its key>&app=join. Read here, before
  // the address is cleared; once the page is up the code goes to relay.join, at the relay this node lists under that key
  // (joinSteps.linkRelay).
  var joinCode = '';
  var joinRelayKey = '';
  try { var q = new URLSearchParams(window.location.search); joinCode = q.get('join') || ''; joinRelayKey = q.get('relay') || ''; } catch (e) { joinCode = ''; }
  function joinFromLink() {
    if (!joinCode) return;
    var code = joinCode;
    joinCode = '';
    // Join's steps come with the link that needs them (goal/G43.27), required here.
    Promise.all([window.spirit.require('spirit/element/joinSteps.js'), Promise.resolve(spirit.ready).then(function (sp) { return sp.contact.search({ q: '*', relay: 'yes' }); })]).then(function (got) {
      var S = window.spirit.element && window.spirit.element.joinSteps;
      var s = got[1];
      var url = S ? S.linkRelay(joinRelayKey, (s && s.items) || []) : '';
      if (!url) throw new Error('this node lists no relay that sent this link');
      return ask('relay.join', { url: url, email: '', code: code });
    }).then(function (r) {
      var b = (r && r.body) || {};
      // 200 is an email change on a seat already held, 201 a new seat (goal/G30.1, box v31).
      say(b.ok && r.status === 200 ? 'Email address verified on ' + (b.url || 'the relay') + '.'
        : b.ok ? 'Joined ' + (b.url || 'the relay') + (b.label ? ' as ' + b.label : '') + '.'
        : 'The join did not finish: ' + (b.error || 'no answer') + '. Ask again with your email.');
    }, function (e) { say('The join did not finish: ' + ((e && e.message) || 'this node did not answer') + '.'); });
  }
  if ((window.location.search || '').length > 1) { try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* the token is spent */ } }
  if (!state.home && spirit.link && !spirit.link.sealed) say('This browser cannot seal: your traffic is readable on the relay.');
  start();
}());
