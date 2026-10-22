// spirit/run/face/shell.js
// THE NEW SHELL IN THE MAKING (goal/G30.9): the lazy-load shell face.html boots, on a member's face and on the home
// node alike (Andy: "this is going to be the new shell, that works equally on both the home-node AND the face"). It
// has the shell's look and feel: the desktop of app icons, the app screen under a title bar with Back and Home.
//
// DECIDED ONCE, HERE, as the node's shell does for Join: the shell asks where the user stands, works out the open step,
// names the login app's icon by it and hands it to the app's onSteps. On the face it asks the relay (POST /face/api
// { verb: 'state' }); on the home node, which has no relay login, it asks the node who it is (node.card) and the user
// is its owner, logged in. Logged out, the login app opens at once and takes the screen. The mailed link (/?<token>)
// was logged in by the relay before this page loaded; the token leaves the address bar.
//
// AFTER LOGIN, THE HOME NODE (goal/G30.11, Andy's box). The relay serves face.html and the login app, nothing else;
// everything else comes from the home node, in its own version, over a sealed link:
//   - THE LINK. node.card (asked once, unsealed: it is public) gives the home node's key and seal key. A browser whose
//     WebCrypto has X25519 makes one key for this page (face/seal.js), kept in memory, lost with the session, and every
//     request is sealed to the home node and every answer opened with it; without X25519 the face runs unsealed and
//     says its traffic is readable on the relay.
//   - EVERY CALL ASYNCHRONOUS (the box: "the face shell makes every call asynchronously"): no synchronous request here.
//   - THE PAGE'S PARTS are the home node's own: its index.html is read and its sheets and scripts loaded in order, all
//     but the old shell (js/client/shell.js) and CodeMirror, which loads when an app needs it. kernel.js is told to ask
//     through this link (window.spiritTransport) and to take its events from the face's own stream.
//   - THE STREAM is /face/stream (sealed to this page's key when it can seal): the jobs as the loopback shell gets them,
//     presence peer by peer, rebuilt here into the relay-presence job the apps read. Another device holding it is said,
//     with Connect here; a face replaced by another device is told it was taken.
//   - CONTACTS is the one app in this item, loaded from the start (Files comes later; every other app one by one).
//   - The home node offline: the shell stays, and the small red not connected mark shows, as the local shell's does.
// On the home node itself the link is the node's own door: no transport is set and kernel.js asks as it always has.

(function () {
  var desktop = document.getElementById('desktop');
  var container = document.getElementById('app-container');
  var content = document.getElementById('app-content');
  var title = document.getElementById('app-title');
  var offline = document.getElementById('app-offline');
  var banner = document.getElementById('face-banner');
  var steps = [];
  var manifest = {};
  var state = null;      // { loggedIn, face, home }
  var login = null;      // the login app once its script has loaded: { mount, onSteps }
  var loginMounted = false;
  var loginPane = null;
  var link = { up: null, sealed: false, key: null, node: null, loaded: false, starting: false };   // up: null until first known

  // ── THE RELAY'S OWN API: login, state, logout ───────────────────────────────────────────────────────────────────
  function post(verb, body) {
    var payload = { verb: verb };
    Object.keys(body || {}).forEach(function (k) { payload[k] = body[k]; });
    return fetch('/face/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }
  // On the home node: no relay login, the node says who it is, and its owner is the one at this screen.
  function homeState() {
    return fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verb: 'node.card' }) })
      .then(function (r) { return r.json(); })
      .then(function (b) { return { loggedIn: true, face: String((b && b.name) || 'this node'), home: true }; });
  }

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

  // ── THE LINK TO THE HOME NODE ───────────────────────────────────────────────────────────────────────────────────
  function bytesText(bytes) { return new TextDecoder().decode(bytes); }
  function lines(text) { return String(text || '').split('\n').filter(Boolean); }

  // One request to the home node through the relay: { status, type, bytes }. Sealed when this page can seal.
  function call(request) {
    var sending = link.sealed
      ? window.faceSeal.seal(link.node.sealKey, link.key.publicKey, link.node.publicKey, JSON.stringify(request))
          .then(function (s) { s.k = link.key.publicKey; return s; })
      : Promise.resolve(request);
    return sending.then(function (body) {
      return fetch('/face/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    }).then(function (r) {
      if (r.status === 503 || r.status === 504) setConnected(false);
      if (!link.sealed || r.status !== 200) {
        return r.arrayBuffer().then(function (b) { return { status: r.status, type: r.headers.get('Content-Type') || '', bytes: new Uint8Array(b) }; });
      }
      return r.text().then(function (text) {
        var head = null;
        var parts = [];
        return lines(text).reduce(function (chain, l) {
          return chain.then(function () {
            return window.faceSeal.open(link.key.privateKey, link.key.publicKey, link.node.publicKey, link.key.publicKey, l);
          }).then(function (got) {
            if (!got) throw new Error('an answer did not open');
            if (!head) head = JSON.parse(got.text);
            else parts.push(window.faceSeal.fromB64(got.text));
          });
        }, Promise.resolve()).then(function () {
          var size = parts.reduce(function (n, p) { return n + p.length; }, 0);
          var all = new Uint8Array(size);
          var at = 0;
          parts.forEach(function (p) { all.set(p, at); at += p.length; });
          return { status: (head && head.status) || 502, type: (head && head.type) || '', bytes: all };
        });
      });
    });
  }

  // A FILE OF THE HOME NODE, PIECE BY PIECE (goal/G30.16): the same sealed answer as call(), each line opened as it
  // arrives and its bytes handed to onPiece, so a viewer can show it before the last piece is in. -> { status, type, bytes }
  function file(path, onPiece) {
    var each = typeof onPiece === 'function' ? onPiece : function () {};
    var request = { get: String(path || '').replace(/^\/+/, '') };
    if (!link.sealed) return call(request).then(function (r) { if (r.status === 200) each(r.bytes); return r; });
    return window.faceSeal.seal(link.node.sealKey, link.key.publicKey, link.node.publicKey, JSON.stringify(request)).then(function (s) {
      s.k = link.key.publicKey;
      return fetch('/face/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(s) });
    }).then(function (r) {
      if (r.status !== 200 || !r.body || typeof r.body.getReader !== 'function') {
        return call(request).then(function (whole) { if (whole.status === 200) each(whole.bytes); return whole; });
      }
      var reader = r.body.getReader();
      var decoder = new TextDecoder();
      var held = '';
      var head = null;
      var parts = [];
      var chain = Promise.resolve();
      function open(l) {
        chain = chain.then(function () {
          return window.faceSeal.open(link.key.privateKey, link.key.publicKey, link.node.publicKey, link.key.publicKey, l);
        }).then(function (got) {
          if (!got) throw new Error('an answer did not open');
          if (!head) { head = JSON.parse(got.text); return; }
          var piece = window.faceSeal.fromB64(got.text);
          parts.push(piece);
          if ((head.status || 0) === 200) each(piece);
        });
      }
      function pump() {
        return reader.read().then(function (step) {
          if (step.done) { if (held) open(held); return chain; }
          held += decoder.decode(step.value, { stream: true });
          var cut = held.split('\n');
          held = cut.pop();
          cut.filter(Boolean).forEach(open);
          return pump();
        });
      }
      return pump().then(function () {
        var size = parts.reduce(function (n, p) { return n + p.length; }, 0);
        var all = new Uint8Array(size);
        var at = 0;
        parts.forEach(function (p) { all.set(p, at); at += p.length; });
        return { status: (head && head.status) || 502, type: (head && head.type) || '', bytes: all };
      });
    });
  }

  function ask(verb, args) {
    var request = { verb: String(verb) };
    Object.keys(args || {}).forEach(function (k) { request[k] = args[k]; });
    return call(request).then(function (r) {
      var text = bytesText(r.bytes);
      var body = null;
      try { body = JSON.parse(text); } catch (e) { body = null; }
      return { status: r.status, text: text, body: body };
    });
  }

  // A file of the home node, as text: through the link on a face, by the node's own GET at home.
  function fileText(path) {
    var clean = String(path).replace(/^\/+/, '');
    var got = state && state.home
      ? fetch('/' + clean).then(function (r) { return r.text().then(function (t) { return { status: r.status, text: t }; }); })
      : call({ get: clean }).then(function (r) { return { status: r.status, text: bytesText(r.bytes) }; });
    return got.then(function (r) {
      if (r.status !== 200) throw new Error(clean + ' answered ' + r.status);
      return r.text;
    });
  }

  // ── THE STREAM, AND WHAT THE APPS SUBSCRIBE TO ──────────────────────────────────────────────────────────────────
  var subscribers = [];
  var jobsById = {};
  var presence = {};
  var streamStopped = false;
  var retry = null;

  function setConnected(up) {
    if (link.up === up) return;
    link.up = up;
    if (offline) offline.hidden = !!up;
    subscribers.slice().forEach(function (h) { if (h.onConnection) { try { h.onConnection(up); } catch (e) { /* one app's fault */ } } });
    hand();
  }
  function jobsList() { return Object.keys(jobsById).map(function (k) { return jobsById[k]; }); }
  function update(job) {
    jobsById[job.id] = job;
    subscribers.slice().forEach(function (h) { if (h.onUpdate) { try { h.onUpdate(job); } catch (e) { /* one app's fault */ } } });
  }
  // The kernel's jobs.subscribe on a face (window.spiritTransport.events): what is known now, then every update.
  function events(handlers) {
    var h = handlers || {};
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
    if (state && state.home) return;
    var q = [];
    if (link.sealed) q.push('key=' + encodeURIComponent(link.key.publicKey));
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
        } else if (got.status === 401) { refresh(); } else { setConnected(false); streamStopped = false; later(); }
        return Promise.resolve();
      }
      setConnected(true);
      if (!link.sealed) { deliver(got); return Promise.resolve(); }
      return window.faceSeal.open(link.key.privateKey, link.key.publicKey, link.node.publicKey, link.key.publicKey, got)
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
  function loadParts() {
    return fileText('index.html').then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var parts = Array.prototype.map.call(doc.querySelectorAll('link[rel="stylesheet"][href], script[src]'), function (el) {
        return String(el.getAttribute('href') || el.getAttribute('src') || '').replace(/^\/+/, '');
      }).filter(function (p) {
        // The old shell stays on loopback; CodeMirror loads when an app needs it.
        return p && p !== 'js/client/shell.js' && p.indexOf('shell/node_modules/') !== 0;
      });
      return parts.reduce(function (chain, p) {
        return chain.then(function () { return fileText(p); }).then(function (text) { inject(p, text); }, function () { /* one part missing is said by the app that needs it */ });
      }, Promise.resolve()).then(function () {
        // The face's green stays last, over the home node's sheets.
        var green = document.querySelector('link[href="/face/face.css"]');
        if (green) document.head.appendChild(green);
      });
    });
  }

  // ── APPS, LOADED WHEN OPENED ────────────────────────────────────────────────────────────────────────────────────
  // WHICH APPS THE FACE HAS IS THE HOME NODE'S DATA (goal/G30.16, G30.20): its own file, face.json beside
  // preferences.json, {"apps": ["shell/contacts", ...]}, separate from the node's include list (Andy: "A Separate
  // included list"). Each app's manifest is read as it comes and its icon drawn at once; an app's script loads when it
  // is opened. This file, served by the relay, only logs in and holds the link, so a new app on the face needs no tag.
  var apps = {};          // id -> { id, manifest, behavior, pane, api, result }
  var loadingId = '';
  var stack = [];         // ids on screen, newest last
  var active = '';
  var pendingDialog = null;
  var armed = null;

  function manifestOf(id) {
    if (apps[id] && apps[id].manifest) return Promise.resolve(apps[id]);
    var name = id.split('/').pop();
    return fileText(id + '/' + name + '.json').then(function (m) {
      if (!apps[id]) apps[id] = { id: id, manifest: JSON.parse(m), behavior: null, pane: null, api: null, result: null };
      return apps[id];
    });
  }
  // The face's apps from face.json, each icon drawn as its manifest arrives; nothing waits for the rest. No file, no
  // apps.
  function listApps() {
    return fileText('face.json').then(function (t) {
      var list = JSON.parse(t);
      (list && Array.isArray(list.apps) ? list.apps : []).forEach(function (a) {
        var id = String(a || '');
        if (id.indexOf('shell/') !== 0 || id.split('/').length !== 2) return;
        manifestOf(id).then(function () { hand(); }, function () { /* an app without a manifest is not shown */ });
      });
    }, function () { /* no face.json on the home node: the face has no apps */ });
  }

  function loadApp(id) {
    if (apps[id] && apps[id].behavior) return Promise.resolve(apps[id]);
    var name = id.split('/').pop();
    return manifestOf(id).then(function () {
      return fileText(id + '/' + name + '.js');
    }).then(function (code) {
      loadingId = id;
      inject(id + '/' + name + '.js', code);
      loadingId = '';
      return apps[id];
    });
  }

  function apiFor(app) {
    var api = {
      escapeHtml: spirit.core.util.escapeHtml,
      verb: function (name, args) { return spirit.core.ask(name, args); },
      sendMessagePacket: function (packetApp, toId, body, opts) {
        var envelope = window.spiritPacket || null;
        if (!envelope) return Promise.resolve({ status: 0, text: '{"error":"js/client/packet.js is not loaded"}' });
        var made = envelope.encode(packetApp, body, { re: (opts && opts.re) || '' });
        if (!made.ok) return Promise.resolve({ status: 400, text: JSON.stringify({ error: made.error }) });
        var args = { to: toId, text: made.text };
        if (opts && Number(opts.patienceMs) > 0) args.patienceMs = Number(opts.patienceMs);
        return spirit.core.ask('peer.post', args);
      },
      peerPost: function (packetApp, toId, body, opts) {
        return api.sendMessagePacket(packetApp, toId, body, opts).then(function (r) {
          var said = null;
          try { said = JSON.parse(r.text); } catch (e) { said = null; }
          var text = (said && typeof said.text === 'string') ? said.text : '';
          var envelope = window.spiritPacket || null;
          var decoded = (envelope && text) ? envelope.decode(text) : null;
          var reached = r.status === 200 && !!(said && said.ok);
          var answeredYes = !decoded || !decoded.body || decoded.body.ok === undefined || !!decoded.body.ok;
          return { ok: reached && answeredYes, status: r.status, hash: (said && said.hash) || '', body: decoded ? decoded.body : null,
            reply: text, from: (said && said.from) || '', error: (said && said.error) || (r.status === 200 ? '' : r.text) };
        });
      },
      launchApp: function (id, params) { openApp(id, params || null); },
      callDialog: function (id, params) {
        return new Promise(function (resolve) { pendingDialog = { id: id, resolve: resolve }; openApp(id, params || null); });
      },
      setDialogResult: function (result) { app.result = result === undefined ? null : result; },
      closeDialog: function (result) { if (result !== undefined) app.result = result; if (active === app.id) back(); },
      setScreenTitle: function (text) { if (active === app.id) title.textContent = String(text == null ? '' : text); },
      setScreenMark: function () {},
      addTitlebarLink: function () {},
      armUntilElsewhere: function (disarm) { if (typeof disarm === 'function') armed = { disarm: disarm, at: currentClick }; },
      isVisible: function () { return active === app.id; },
      onJobs: function (fn) {
        return events({
          onSnapshot: function () { fn(jobsById, null, { visible: active === app.id }); },
          onUpdate: function (job) { fn(jobsById, job, { visible: active === app.id }); },
        });
      },
      onFiles: function () { return function () {}; },
      // What a relay the home node owns did, as the old shell hands it (goal/G30.15): Relay Details redraws on it.
      onRelayEvent: function (fn) { return events({ onRelayEvent: fn }); },
      ui: { elements: window.spiritElements || {} },
    };
    return api;
  }

  var currentClick = null;
  // As the old shell does: the click is stamped on the way down, and an armed button is disarmed on the way up, after
  // its own handler ran, by any click but the one that armed it. So the confirming press acts before the disarm.
  document.addEventListener('click', function (e) { currentClick = e; }, true);
  document.addEventListener('click', function (e) {
    if (armed && armed.at !== e) { var a = armed; armed = null; try { a.disarm(); } catch (x) { /* harmless twice */ } }
  }, false);

  function show(id) {
    active = id;
    var app = apps[id];
    Object.keys(apps).forEach(function (k) { if (apps[k].pane) apps[k].pane.hidden = k !== id; });
    if (loginPane) loginPane.hidden = id !== 'login';
    title.textContent = id === 'login' ? (manifest.name || 'Log in') : ((app && app.manifest && app.manifest.name) || id);
    desktop.hidden = true;
    container.hidden = false;
  }
  function openApp(id, params) {
    return loadApp(id).then(function (app) {
      if (!app.behavior) throw new Error(id + ' did not activate');
      if (!app.pane) {
        app.pane = document.createElement('div');
        content.appendChild(app.pane);
        app.api = apiFor(app);
        app.behavior.mount(app.pane, app.api);
      }
      app.result = null;
      if (stack[stack.length - 1] !== id) stack.push(id);
      show(id);
      if (typeof app.behavior.open === 'function') app.behavior.open(params);
      if (typeof app.behavior.render === 'function') app.behavior.render();
    }).catch(function (e) { say(String(e.message || e)); });
  }
  function back() {
    var leaving = stack.pop();
    var app = apps[leaving];
    if (pendingDialog && pendingDialog.id === leaving) { var p = pendingDialog; pendingDialog = null; p.resolve(app ? app.result : null); }
    var under = stack[stack.length - 1];
    if (under) show(under); else showDesktop();
  }
  function showDesktop() { stack = []; active = ''; container.hidden = true; desktop.hidden = false; drawDesktop(); }
  document.getElementById('app-close').addEventListener('click', back);
  document.getElementById('app-home').addEventListener('click', function () {
    while (stack.length) { var id = stack[stack.length - 1]; if (pendingDialog && pendingDialog.id === id) back(); else stack.pop(); }
    showDesktop();
  });

  // ── THE LOGIN APP AND THE DESKTOP ───────────────────────────────────────────────────────────────────────────────
  function done(step) {
    if (step.until === 'login') return !!(state && state.loggedIn);
    if (step.until === 'link') return !!(state && state.loggedIn && link.loaded && (state.home || link.up));
    return false;
  }
  function handed() {
    var open = steps.filter(function (s) { return !done(s); })[0] || null;
    return { facts: { face: state ? state.face : '', loggedIn: !!(state && state.loggedIn), home: !!(state && state.home), up: !!(state && state.home) || link.up, sealed: link.sealed },
      open: open ? open.until : null, done: steps.map(done) };
  }
  function icon(glyph, label, onOpen) {
    var el = document.createElement('div');
    el.className = 'app-icon';
    el.innerHTML = '<span class="icon"></span><span class="label"></span>';
    el.querySelector('.icon').textContent = glyph || '';
    el.querySelector('.label').textContent = label;
    el.addEventListener('click', onOpen);
    desktop.appendChild(el);
  }
  function drawDesktop() {
    var h = handed();
    var step = steps.filter(function (s) { return s.until === h.open; })[0] || steps[steps.length - 1];
    desktop.innerHTML = '';
    if (step) icon(step.icon, step.name, openLogin);
    Object.keys(apps).forEach(function (id) {
      var m = apps[id].manifest || {};
      if (m.hidden || m.type === 'dialog') return;
      var glyph = (window.spirit && spirit.core && spirit.core.const && spirit.core.const.ICON && spirit.core.const.ICON[m.icon]) || m.icon || '';
      icon(glyph, m.name || id, function () { openApp(id, null); });
    });
  }
  function hand() {
    if (!desktop.hidden) drawDesktop();
    if (login && loginMounted && typeof login.onSteps === 'function') login.onSteps(handed());
  }

  // Asked again after the login app logs in or out.
  function refresh() {
    return post('state').then(function (s) { state = s; }, function () { return homeState().then(function (s) { state = s; }, function () { state = { loggedIn: false }; }); })
      .then(function () { hand(); if (state && state.loggedIn) start(); });
  }

  function openLogin() {
    if (!loginPane) { loginPane = document.createElement('div'); content.appendChild(loginPane); }
    if (stack[stack.length - 1] !== 'login') stack.push('login');
    show('login');
    if (login) { if (!loginMounted) mountLogin(); return; }
    var s = document.createElement('script');
    s.src = '/face/login/login.js';
    document.body.appendChild(s);
  }
  function mountLogin() {
    loginMounted = true;
    // armUntilElsewhere: the shell's two-press rule, for Log out (goal/G30.15).
    login.mount(loginPane, { post: post, refresh: refresh, armUntilElsewhere: function (disarm) { if (typeof disarm === 'function') armed = { disarm: disarm, at: currentClick }; } });
    hand();
  }

  // ── LOGGED IN: THE LINK, THE PARTS, THE STREAM, CONTACTS ────────────────────────────────────────────────────────
  function start() {
    if (link.starting) return;
    link.starting = true;
    var home = !!(state && state.home);
    if (state && state.face) document.title = String(state.face);
    var ready = home
      ? Promise.resolve()
      // The home node's keys, from faceHome itself (goal/G30.10): node.card carries no seal key.
      : call({ keys: 1 }).then(function (r) {
          var keys = null;
          try { keys = JSON.parse(bytesText(r.bytes)); } catch (e) { keys = null; }
          if (r.status !== 200 || !keys || !keys.publicKey) throw new Error('the home node did not answer');
          link.node = { publicKey: keys.publicKey, sealKey: keys.sealKey || '' };
          // The tab says whose face this is: the ID's label after the 🤓 (goal/G30.15).
          if (keys.name) document.title = String(keys.name);
          return window.faceSeal && link.node.sealKey ? window.faceSeal.supported() : false;
        }).then(function (can) {
          if (!can) { say('This browser cannot seal: your traffic is readable on the relay.'); return null; }
          return window.faceSeal.newKey().then(function (key) { link.key = key; link.sealed = true; });
        });
    ready.then(function () {
      if (!home) window.spiritTransport = { ask: ask, events: events, file: file };
      if (home) setConnected(true);
      return loadParts();
    }).then(function () {
      window.spirit.shell = { activateApp: activateApp, factRow: factRow };
      link.loaded = true;
      openStream(false);
      listApps();
    }).then(function () { hand(); }, function (e) {
      link.starting = false;
      setConnected(false);
      say(String((e && e.message) || e));
      setTimeout(function () { if (!link.loaded) start(); }, 5000);
    });
  }

  // The old shell's fact row (js/client/shell.js factRow), the same markup, for the dialogs that draw with it
  // (Relay Details, Contact): pairs of [label, value], escaped.
  function factRow(pairs) {
    var esc = spirit.core.util.escapeHtml;
    return '<div class="fact-row">' + (pairs || []).map(function (pair) {
      return '<div class="fact">' +
        '<span class="fact-label">' + esc(String(pair[0])) + '</span>' +
        '<span class="fact-value">' + esc(String(pair[1])) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  function activateApp(behavior) {
    if (loadingId && apps[loadingId]) apps[loadingId].behavior = behavior;
  }

  window.faceShell = {
    activateApp: function (behavior) { login = behavior; mountLogin(); },
  };

  var fromLink = (window.location.search || '').length > 1;
  if (fromLink) { try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* the token is spent */ } }
  fetch('/face/login/login.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
    manifest = m || {};
    steps = Array.isArray(manifest.steps) ? manifest.steps : [];
    return refresh();
  }).then(function () {
    // Logged out, the login app takes the screen at once, as Join does on a new node; the mailed link opens it too.
    if (fromLink || !state.loggedIn) openLogin();
  });
}());
