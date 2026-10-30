// spirit/run/shell/boot.js (goal/G41.3: face/shell.js moved into shell/ as the boot)
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
//   - THE PAGE'S PARTS are the home node's own, in its own version: a list of its sheets and scripts written here
//     (FACE_PARTS), fetched over the link once the families are bound, never the old home page read for them and
//     never kernel.js (goal/G40.7). spirit.js asks through this link (window.spirit.transport) and takes its events from
//     the face's own stream.
//   - THE STREAM is /face/stream (sealed to this page's key when it can seal): the jobs as the loopback shell gets them,
//     presence peer by peer, rebuilt here into the relay-presence job the apps read. Another device holding it is said,
//     with Connect here; a face replaced by another device is told it was taken.
//   - CONTACTS is the one app in this item, loaded from the start (Files comes later; every other app one by one).
//   - The home node offline: the shell stays, and the small red not connected mark shows, as the local shell's does.
// On the home node itself the link is the node's own door: no transport is set and spirit.js asks the node itself.

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
  // Every call here is { call, args }, the name and the arguments apart (goal/G41.15), the relay's own door and the node's.
  function post(verb, body) {
    return fetch('/face/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ call: String(verb), args: body || {} }) })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
  }
  // On the home node: no relay login, the node says who it is, and its owner is the one at this screen.
  function homeState() {
    return fetch('/api/spirit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call: 'node.card', args: {} }) })
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

  // A REQUEST TOO LARGE FOR ONE TRIP GOES IN PIECES (goal/G33.1). Andy: "not saved: Body too large: 23608 of 23552": the
  // relay takes one request up to BODY_MAX. A larger one goes as {piece: {id, n, of, text}}, text a run of base64 of its
  // bytes, each piece its own call; the home node (js/faceHome.js) answers 202 to each but the last and the whole request
  // on the last, whose answer is this call's. The relay passes the pieces on and reads none of them.
  // Named apart from post(verb, body) above, the relay's /face/api: one function name each (a second declaration
  // replaced the first and sent the face's state check to /face/call, goal/G33.1).
  function postCall(text) {
    var once = function (t) { return fetch('/face/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: t }); };
    var BODY_MAX = (window.spirit && window.spirit.limits && window.spirit.limits.BODY_MAX) || 23552;
    var bytes = new TextEncoder().encode(text);
    if (bytes.length <= BODY_MAX - 1024) return once(text);
    var b64 = spirit.seal.toB64(bytes);
    var size = BODY_MAX - 1024;
    var of = Math.ceil(b64.length / size);
    var idBytes = new Uint8Array(12);
    crypto.getRandomValues(idBytes);
    var id = Array.prototype.map.call(idBytes, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    function next(n) {
      return once(JSON.stringify({ piece: { id: id, n: n, of: of, text: b64.slice(n * size, (n + 1) * size) } })).then(function (r) {
        if (n === of - 1 || r.status !== 202) return r;
        return next(n + 1);
      });
    }
    return next(0);
  }

  // One request to the home node through the relay: { status, type, bytes }. Sealed when this page can seal.
  function call(request) {
    var sending = link.sealed
      ? spirit.seal.seal(link.node.sealKey, link.key.publicKey, link.node.publicKey, JSON.stringify(request))
          .then(function (s) { s.k = link.key.publicKey; return s; })
      : Promise.resolve(request);
    return sending.then(function (body) {
      return postCall(JSON.stringify(body));
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
            return spirit.seal.open(link.key.privateKey, link.key.publicKey, link.node.publicKey, link.key.publicKey, l);
          }).then(function (got) {
            if (!got) throw new Error('an answer did not open');
            if (!head) head = JSON.parse(got.text);
            else parts.push(spirit.seal.fromB64(got.text));
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
    return spirit.seal.seal(link.node.sealKey, link.key.publicKey, link.node.publicKey, JSON.stringify(request)).then(function (s) {
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
          return spirit.seal.open(link.key.privateKey, link.key.publicKey, link.node.publicKey, link.key.publicKey, l);
        }).then(function (got) {
          if (!got) throw new Error('an answer did not open');
          if (!head) { head = JSON.parse(got.text); return; }
          var piece = spirit.seal.fromB64(got.text);
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

  // A SAVE LARGER THAN ONE TRIP GOES IN PARTS (goal/G33.10). Andy: "no size limits on it's loadFile and saveFile....":
  // the file's bytes go as {upload: {id, n, of, size, path, bytes}}, each part sealed on its own by call() and sent as its
  // own call, one after the other; the home node (js/faceHome.js) appends each to a work file in the system temp folder
  // and answers 202 to each but the last, whose answer is the save's. UPLOAD_PART keeps a sealed part inside one trip.
  var UPLOAD_PART = 8192;
  function uploadSave(args) {
    var bytes = new TextEncoder().encode(String(args.content));
    var of = Math.max(1, Math.ceil(bytes.length / UPLOAD_PART));
    var idBytes = new Uint8Array(12);
    crypto.getRandomValues(idBytes);
    var id = Array.prototype.map.call(idBytes, function (x) { return (x < 16 ? '0' : '') + x.toString(16); }).join('');
    function next(n) {
      var part = { id: id, n: n, of: of, size: bytes.length, path: String(args.path), bytes: spirit.seal.toB64(bytes.subarray(n * UPLOAD_PART, (n + 1) * UPLOAD_PART)) };
      return call({ upload: part }).then(function (r) {
        if (n === of - 1 || r.status !== 202) return r;
        return next(n + 1);
      });
    }
    return next(0);
  }

  function ask(verb, args) {
    // AT HOME THE FACE IS A LOCAL CLIENT (goal/G40.10; Andy: "why would there be ANY door on the home node for the relay
    // face"): it asks its node through spirit.js, the family's verb by its name, as every local client does; the relay's
    // /face/call and the seal are a relay's only. Answered as a call is answered here, { status, text, body }.
    if (state && state.home) {
      var name = String(verb);
      var dot = name.indexOf('.');
      var fam = dot > 0 ? spirit[name.slice(0, dot)] : null;
      var fn = fam && typeof fam[name.slice(dot + 1)] === 'function' ? fam[name.slice(dot + 1)] : null;
      if (!fn) return Promise.resolve({ status: 400, text: '', body: { ok: false, code: 'no-such-verb', error: 'no verb ' + name } });
      return spirit.outcome(fn(args || {})).then(function (o) { return { status: o.status, text: o.body == null ? '' : JSON.stringify(o.body), body: o.body }; });
    }
    if (String(verb) === 'fs.save' && args && typeof args.content === 'string' && new TextEncoder().encode(args.content).length > UPLOAD_PART) {
      return uploadSave(args).then(function (r) {
        var text = bytesText(r.bytes);
        var body = null;
        try { body = JSON.parse(text); } catch (e) { body = null; }
        return { status: r.status, text: text, body: body };
      });
    }
    // The name and the arguments apart (goal/G41.15): faceHome hands args to the verb as they came.
    return call({ call: String(verb), args: args || {} }).then(function (r) {
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
  // The kernel's jobs.subscribe on a face (window.spirit.transport.events): what is known now, then every update.
  function events(handlers) {
    var h = handlers || {};
    // AT HOME THE EVENTS ARE THE NODE'S OWN STREAM, spirit.events (goal/G40.10): there is no face stream on loopback.
    // The jobs as they come are kept here too, so the apps read them as on a relay.
    if (state && state.home) {
      return spirit.events.subscribe({
        onSnapshot: function (jobs) { (jobs || []).forEach(function (j) { if (j && j.id) jobsById[j.id] = j; }); if (h.onSnapshot) h.onSnapshot(jobsList()); },
        onUpdate: function (job) { if (job && job.id) jobsById[job.id] = job; if (h.onUpdate) h.onUpdate(job); },
        onDelete: function (id) { delete jobsById[id]; if (h.onDelete) h.onDelete(id); },
        onConnection: h.onConnection, onRelayEvent: h.onRelayEvent, onContactRename: h.onContactRename, onPacket: h.onPacket,
      });
    }
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
      return spirit.seal.open(link.key.privateKey, link.key.publicKey, link.node.publicKey, link.key.publicKey, got)
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
  // WHAT THE FACE LOADS FROM HOME (goal/G40.7; Andy: "execute a hard-Coded download/fetch of all those scripts rather
  // than stealing them from index.html ... but do not download kernel.js"): in order, the home page's sheets and
  // scripts but the old shell, spirit.js (inline in this page, first), kernel.js and CodeMirror (loaded when an app
  // needs it). A part added to the face is added here. Not on it, by rule (goal/G40.8): listSearch.js ("list search is
  // deprecated, and forbidden in face"), the contact selector built on it, and the deprecated header element.
  // ONLY WHAT BOOT RUNS ITSELF (goal/G41.3; Andy: boot preloads only the home and Join components, every app bootstraps
  // its own): spirit's libraries, the sheet, the navigation every app is a page on, and Join's steps, which boot works
  // out. Every other element is loaded by the app that draws with it, through spirit.require; the cache by spirit.js.
  var FACE_PARTS = [
    'spirit/ownerBadge.js',
    'spirit/fieldRules.js',
    'spirit/probabilityStringMatch.js',
    'spirit/probabilityStringObjectMatch.js',
    'spirit/probabilityBucket.js',
    'spirit/lever.js',
    'spirit/peerFile.js',
    'spirit/limits.js',
    'spirit/client/packet.js',
    'spirit/client/apiTreeIndex.js',
    'shell.css',
    'shell/js/joinSteps.js',
    'shell/navigationWrapper.js',
  ];
  function loadParts() {
    return FACE_PARTS.reduce(function (chain, p) {
      return chain.then(function () { return fileText(p); }).then(function (text) { inject(p, text); }, function () { /* one part missing is said by the app that needs it */ });
    }, Promise.resolve()).then(function () {
      // The face's green stays last, over the home node's sheets.
      var green = document.querySelector('link[href="/shell/face.css"]');
      if (green) document.head.appendChild(green);
    });
  }

  // ── APPS, LOADED WHEN OPENED ────────────────────────────────────────────────────────────────────────────────────
  // WHICH APPS THE FACE HAS IS THE HOME NODE'S DATA (goal/G30.16, G30.21): an app is a shell/<app>/<app>.js whose
  // sidecar's face part says app: true, with the name and icon the face draws. The scripts are found in data.files, the
  // file tree already in the page (shell/shared/js/spiritData.js); each one's face part is asked once (fs.annotations), and each
  // icon is drawn as its answer arrives. An app's script loads when it is opened. The home shell's .json manifests are
  // not read here. This file, served by the relay, only logs in and holds the link, so a new app on the face needs no tag.
  var apps = {};          // id -> { id, manifest, behavior }
  var loadingId = '';
  var armed = null;
  // THE SHELL'S ONE STACK IS THE NAVIGATION (goal/G40.8; Andy: "the stack only holds ONLY navigation", "so the shell does
  // ALL the wrapping? agreed."): shell/navigationWrapper.js, one of the parts from home, attached once they are in.
  // Every app opened is a page pushed on it, a detail an app opens is one too; the title bar and back are its.
  function navigation() { return (window.spirit.elements && window.spirit.elements.navigation) || null; }

  function manifestOf(id) {
    if (apps[id] && apps[id].manifest) return Promise.resolve(apps[id]);
    var name = id.split('/').pop();
    return fileText(id + '/' + name + '.json').then(function (m) {
      if (!apps[id]) apps[id] = { id: id, manifest: JSON.parse(m), behavior: null };
      return apps[id];
    });
  }
  // The face's apps, each icon drawn as its face part arrives; nothing waits for the rest. An app whose face part is
  // written again (the Apps app tells the face, spirit.shell.faceApp) is read again, so it comes or goes; one already
  // open stays until closed.
  // THE SERVER IT NEEDS, from its manifest beside the face part (goal/G27.16, on the face since goal/G41.1).
  function readFace(id) {
    var name = id.split('/').pop();
    var own = fileText(id + '/' + name + '.json').then(function (t) { try { return JSON.parse(t) || {}; } catch (e) { return {}; } }, function () { return {}; });
    // Join and the login app are boot's own: Join drawn by its open step, login only off loopback; never app icons
    // (Andy: "the login-app should not show in face-loopback mode").
    if (id === JOIN || id === 'shell/login') return Promise.resolve();
    return Promise.all([Promise.resolve(ask('fs.annotations', { path: id + '/' + name + '.js' })), own]).then(function (got) {
      var r = got[0];
      var face = (r && r.status === 200 && r.body && r.body.face) || null;
      var mf = got[1] || {};
      // AN INTRINSIC APP SHOWS ON EVERY FACE (goal/G41.1, box v17: "minimal == intrinsic"), its face mark or not; what the
      // node's face part does not name, its manifest does (its icon a key into the icon table).
      // AN APP NAMING A SERVER RIDES WITH IT (box v14): no row in Apps, no face mark of its own; it shows while its server
      // runs (serverUp, as the desktop draws).
      if (face && (face.app === true || face.intrinsic === true || (typeof mf.server === 'string' && mf.server !== ''))) {
        var m = { name: String(face.name || mf.name || name), icon: String(face.icon || mf.icon || ''), description: String(face.description || mf.description || ''),
          server: typeof mf.server === 'string' ? mf.server : '', hidden: mf.hidden === true, type: String(mf.type || '') };
        if (apps[id]) apps[id].manifest = m;
        else apps[id] = { id: id, manifest: m, behavior: null };
      } else if (apps[id]) { delete apps[id]; closePages(id); }
      hand();
    }, function () { /* no answer: the app is not shown */ });
  }
  // AN APP SHOWS ONLY WHILE ITS SERVER RUNS (goal/G27.16; on the face since goal/G41.1, box v14): an app naming a server
  // shows while a server job of that module is running or pending (between restarts); one naming none always shows.
  function serverUp(app) {
    var s = app && app.manifest && app.manifest.server;
    if (!s) return true;
    var module = 'process/js/' + s;
    return Object.keys(jobsById).some(function (k) {
      var j = jobsById[k];
      return !!j && j.kind === 'server' && j.module === module && (j.status === 'running' || j.status === 'pending');
    });
  }
  // THE PAGES OF AN APP THAT ARE OPEN, so a stopped server or a face mark gone closes them.
  var pagesOf = {};
  function closePages(id) {
    (pagesOf[id] || []).forEach(function (p) { try { p.close(); } catch (e) { /* closed already */ } });
    delete pagesOf[id];
  }
  // AN APP'S FACE PART STREAMED (goal/G41.1, box v15): a shell app is read again, so it comes or goes at once.
  function followFace(job) {
    var p = job && job.type === 'app-face' && job.data ? String(job.data.path || '') : '';
    var m = /^(shell\/([^/]+))\/\2\.js$/.exec(p);
    if (m) readFace(m[1]);
  }
  // A SERVER STARTED OR STOPPED: the desktop drawn again, and the open pages of every app whose server went closed.
  var serversShown = '';
  function followServers() {
    var now = Object.keys(apps).filter(function (id) { return serverUp(apps[id]); }).sort().join(',');
    if (now === serversShown) return;
    serversShown = now;
    Object.keys(apps).forEach(function (id) { if (!serverUp(apps[id])) closePages(id); });
    hand();
  }
  function listApps() {
    var D = window.spirit.data;
    if (!D) return;
    var SCRIPT = /^(shell\/([^/]+))\/\2\.js$/;
    var read = Object.create(null);   // the apps already asked, so another file's change asks nothing again
    function look() {
      Object.keys(D.branch('files')).forEach(function (k) {
        var m = SCRIPT.exec(k);
        if (m && !read[m[1]]) { read[m[1]] = true; readFace(m[1]); }
      });
    }
    D.watch('files', look);
    look();
  }

  // ── JOIN, DECIDED HERE (goal/G40.10; Andy: "it doesn't take the screen in the old shell, it just places the icon next
  // to the other icons ... screen is only taken over when the emails join-link navigates directly into the join app") ──
  // At home only: the face shell hears the node's join-steps job, works out the open step with joinSteps.js, and hands
  // Join its steps (onSteps) on mount and on every change; Join decides nothing. While a step is open Join is an icon on
  // the home screen beside the apps, named and marked by the open step. Its one fact, face opened, is its own state.
  var JOIN = 'shell/join';
  var JOIN_STATE = 'relay-state/shell/join/state.json';
  var joinJob = null;          // the join-steps job's data
  var joinStepList = null;     // Join's manifest's steps
  var joinFaceOpened = false;
  function joinNow() {
    var S = window.spirit.elements && window.spirit.elements.joinSteps;
    if (!S || !joinJob || !joinStepList) return null;
    var facts = S.fromJob(joinJob, joinFaceOpened);
    var open = S.current(joinStepList, facts);
    return { facts: facts, open: open ? open.until : null, done: joinStepList.map(function (st) { return S.done(st, facts); }) };
  }
  function joinOpenStep() {
    var now = joinNow();
    if (!now || !now.open) return null;
    return joinStepList.filter(function (st) { return st.until === now.open; })[0] || null;
  }
  function handJoin() {
    var app = apps[JOIN];
    var now = joinNow();
    if (now && app && app.behavior && typeof app.behavior.onSteps === 'function') { try { app.behavior.onSteps(now); } catch (e) { /* Join's own fault */ } }
  }
  function joinChanged() { if (!desktop.hidden) drawDesktop(); handJoin(); }
  function joinReadFact() {
    return Promise.resolve(spirit.fs.loadFile(JOIN_STATE)).then(function (text) {
      var st = {};
      try { st = JSON.parse(text || '{}') || {}; } catch (e) { st = {}; }
      joinFaceOpened = st.faceOpened === true;
    }, function () { joinFaceOpened = false; });
  }
  function startJoin() {
    fileText(JOIN + '/join.json').then(function (m) { joinStepList = (JSON.parse(m) || {}).steps || []; joinChanged(); }, function () { joinStepList = []; });
    joinReadFact().then(joinChanged);
    var take = function (job) { if (job && job.type === 'join-steps') { joinJob = job.data || {}; joinChanged(); } };
    events({ onSnapshot: function (jobs) { (jobs || []).forEach(take); }, onUpdate: take });
    // Join's fact changed (it writes its state file): the file tree says so, and it is read again.
    if (window.spirit.data) window.spirit.data.watch('files/' + JOIN_STATE, function () { joinReadFact().then(joinChanged); });
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

  // THE API A PAGE IS HANDED, by its page on the navigation (nav): close, title and visibility are its page's.
  function apiFor(page) {
    var api = {
      escapeHtml: spirit.escapeHtml,
      // A face app's call to its home node, over this link (goal/G40.7: no kernel on a face).
      verb: function (name, args) { return ask(name, args); },
      sendMessagePacket: function (packetApp, toId, body, opts) {
        var envelope = window.spirit.packet || null;
        if (!envelope) return Promise.resolve({ status: 0, text: '{"error":"spirit/client/packet.js is not loaded"}' });
        var made = envelope.encode(packetApp, body, { re: (opts && opts.re) || '' });
        if (!made.ok) return Promise.resolve({ status: 400, text: JSON.stringify({ error: made.error }) });
        var args = { to: toId, text: made.text };
        if (opts && Number(opts.patienceMs) > 0) args.patienceMs = Number(opts.patienceMs);
        return ask('peer.post', args);
      },
      peerPost: function (packetApp, toId, body, opts) {
        return api.sendMessagePacket(packetApp, toId, body, opts).then(function (r) {
          var said = null;
          try { said = JSON.parse(r.text); } catch (e) { said = null; }
          var text = (said && typeof said.text === 'string') ? said.text : '';
          var envelope = window.spirit.packet || null;
          var decoded = (envelope && text) ? envelope.decode(text) : null;
          var reached = r.status === 200 && !!(said && said.ok);
          var answeredYes = !decoded || !decoded.body || decoded.body.ok === undefined || !!decoded.body.ok;
          return { ok: reached && answeredYes, status: r.status, hash: (said && said.hash) || '', body: decoded ? decoded.body : null,
            reply: text, from: (said && said.from) || '', error: (said && said.error) || (r.status === 200 ? '' : r.text) };
        });
      },
      launchApp: function (id, params) { openApp(id, params || null); },
      // An app opened as another page. Nothing is handed back (goal/G40.8: "the stack doesn't need to handle results"):
      // what the page changes reaches every view on the stream. Answers once the page is up.
      callDialog: function (id, params) { return openApp(id, params || null); },
      closeDialog: function () { page.close(); },
      setScreenTitle: function (text) { page.setTitle(text); },
      setScreenMark: function () {},
      addTitlebarLink: function () {},
      armUntilElsewhere: function (disarm) { if (typeof disarm === 'function') armed = { disarm: disarm, at: currentClick }; },
      isVisible: function () { return page.isTop(); },
      onJobs: function (fn) {
        return events({
          onSnapshot: function () { fn(jobsById, null, { visible: page.isTop() }); },
          onUpdate: function (job) { fn(jobsById, job, { visible: page.isTop() }); },
        });
      },
      onFiles: function () { return function () {}; },
      // What a relay the home node owns did, as the old shell hands it (goal/G30.15): Relay Details redraws on it.
      onRelayEvent: function (fn) { return events({ onRelayEvent: fn }); },
      ui: { elements: window.spirit.elements || {} },
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

  // THE FRAME THE NAVIGATION DRAWS IN: the title bar, the app area, the desktop when no page is up.
  function shownFrame() { if (loginPane) loginPane.hidden = true; desktop.hidden = true; container.hidden = false; }
  function showDesktop() { if (loginPane) loginPane.hidden = true; container.hidden = true; desktop.hidden = false; drawDesktop(); }
  function attachNavigation() {
    var n = navigation();
    if (n) n.attach({ title: title, content: content, shown: shownFrame, empty: showDesktop, apiFor: apiFor });
  }
  // AN APP IS A PAGE THE SHELL PUSHES (goal/G40.8): its name in the title bar, its mount drawing into the page's box. A
  // popped page is thrown away, so an app opened again mounts afresh.
  function openApp(id, params) {
    return loadApp(id).then(function (app) {
      if (!app.behavior) throw new Error(id + ' did not activate');
      if (!navigation()) throw new Error('the face has not loaded its navigation yet');
      var m = app.manifest || {};
      var handle = window.spirit.elements.navigation.push({ title: m.name || id, mount: function (box, page) {
        app.behavior.mount(box, page.api);
        if (typeof app.behavior.open === 'function') app.behavior.open(params);
        if (typeof app.behavior.render === 'function') app.behavior.render();
        if (id === JOIN) handJoin();
      } });
      if (handle && typeof handle.close === 'function') (pagesOf[id] = pagesOf[id] || []).push(handle);
    }).catch(function (e) { say(String(e.message || e)); });
  }
  function loginOpen() { return !!(loginPane && !loginPane.hidden); }
  document.getElementById('app-close').addEventListener('click', function () {
    if (loginOpen()) { showDesktop(); return; }
    if (navigation()) navigation().back();
  });
  document.getElementById('app-home').addEventListener('click', function () {
    if (navigation()) navigation().home();
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
    // At home there is nothing to log in to (goal/G40.10; Andy: "on loopback, home is not required, period"): the face's
    // apps alone.
    if (step && !(state && state.home)) icon(step.icon, step.name, openLogin);
    // At home, Join beside the apps while a step is open, as its open step (goal/G40.10).
    var js = state && state.home ? joinOpenStep() : null;
    if (js) icon(String(js.icon || ''), js.name, function () { openApp(JOIN, null); });
    Object.keys(apps).forEach(function (id) {
      var m = apps[id].manifest || {};
      if (m.hidden || m.type === 'dialog') return;
      if (!serverUp(apps[id])) return;
      // The face part holds the glyph itself (goal/G30.21: icons as themselves).
      var glyph = String(m.icon || '');
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

  // THE LOGIN IS NO PAGE: it comes before the link to home, so before the navigation the face loads from home. It is the
  // one screen outside the stack, shown over an empty app area; back leaves it for the desktop.
  function openLogin() {
    if (!loginPane) { loginPane = document.createElement('div'); loginPane.className = 'fill'; content.appendChild(loginPane); }
    if (navigation()) navigation().home();
    loginPane.hidden = false;
    title.textContent = manifest.name || 'Log in';
    desktop.hidden = true;
    container.hidden = false;
    if (login) { if (!loginMounted) mountLogin(); return; }
    var s = document.createElement('script');
    s.src = '/shell/login/login.js';
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
      // The home node's keys, from faceHome itself (goal/G30.10): node.card carries no seal key. The seal is loaded now,
      // logged in and linking (goal/G40.6), by the one loader.
      : spirit.require('shell/seal.js').then(function () { return call({ keys: 1 }); }).then(function (r) {
          var keys = null;
          try { keys = JSON.parse(bytesText(r.bytes)); } catch (e) { keys = null; }
          if (r.status !== 200 || !keys || !keys.publicKey) throw new Error('the home node did not answer');
          link.node = { publicKey: keys.publicKey, sealKey: keys.sealKey || '' };
          // The tab says whose face this is: the ID's label after the 🤓 (goal/G30.15).
          if (keys.name) document.title = String(keys.name);
          return spirit.seal && link.node.sealKey ? spirit.seal.supported() : false;
        }).then(function (can) {
          if (!can) { say('This browser cannot seal: your traffic is readable on the relay.'); return null; }
          return spirit.seal.newKey().then(function (key) { link.key = key; link.sealed = true; });
        });
    // AT HOME THE STREAM WAITS FOR THE PARTS (goal/G40.10): the node hands the file tree once, as a stream opens, and a
    // part that subscribes as it loads (the data cache) would open it before the parts that read the tree (its
    // translators) are in, and lose it. So at home the subscriptions made while the parts load are held, and released
    // onto spirit.events once they are all in. On a relay the face's own stream opens after the parts already.
    var held = [];
    ready.then(function () {
      if (!home) window.spirit.transport = { ask: ask, events: events, file: file };
      if (home) {
        setConnected(true);
        window.spirit.transport = { events: function (h) { held.push(h); return function () { held = held.filter(function (x) { return x !== h; }); }; } };
      }
      // The spirit object (goal/G32.1), inline in this page, gets its families once the node can be reached, and the
      // parts load once they are there (goal/G40.7: "fetch the damn api's from home" first).
      var parts = function () { return loadParts(); };
      return Promise.resolve(window.spirit.start()).then(parts, parts);
    }).then(function () {
      if (home) {
        var waiting = held;
        held = [];
        delete window.spirit.transport;
        waiting.forEach(function (h) { spirit.events.subscribe(h); });
      }
      Object.assign(window.spirit.shell = window.spirit.shell || {}, { activateApp: activateApp, factRow: factRow, faceApp: readFace });
      attachNavigation();
      link.loaded = true;
      openStream(false);
      listApps();
      // The servers' jobs as they change: an app comes or goes with its server (goal/G27.16).
      events({ onSnapshot: followServers, onUpdate: function (job) { followFace(job); followServers(); }, onDelete: followServers });
      if (home) startJoin();
      // The mailed join link, at home and on a relay face alike, once logged in (goal/G40.10, box v25).
      joinFromLink();
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
    var esc = spirit.escapeHtml;
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

  // THE LOGIN APP HANDS ITSELF OVER on the one spirit object, nothing on window (goal/G40.7).
  (window.spirit.shell = window.spirit.shell || {}).activateLogin = function (behavior) { login = behavior; mountLogin(); };
  // THE CALLER'S LINK (goal/G40.10, box v25; Andy: "the join-app-link, which only the shell really knows"): this page,
  // opening Join; the relay adds its code and key to it and mails it. At home the node's /face.html, on a relay this face.
  window.spirit.shell.joinLink = function () {
    return window.location.origin + window.location.pathname + '?app=join';
  };

  // THE MAILED JOIN LINK (goal/G40.10; Andy: "break the join feature in the old shell and have that only work in the
  // face-shell"): the relay mails /face.html?join=<code>&app=join. Read here, before the address is cleared; at home, once
  // the face is up, the code goes to relay.join and the app named beside it opens, whatever the join said.
  // THE LINK NAMES ITS RELAY (goal/G40.10, box v15): &relay=<its key>; the code goes to the relay this node lists under
  // that key (joinSteps.linkRelay), never to the first relay it lists.
  var joinCode = '';
  var joinRelayKey = '';
  var appFromAddress = '';
  try { var q = new URLSearchParams(window.location.search); joinCode = q.get('join') || ''; joinRelayKey = q.get('relay') || ''; appFromAddress = q.get('app') || ''; } catch (e) { joinCode = ''; }
  function joinFromLink() {
    var openNamed = function () { if (/^[A-Za-z0-9_-]+$/.test(appFromAddress)) openApp('shell/' + appFromAddress, null); };
    if (!joinCode) { openNamed(); return; }
    var code = joinCode;
    joinCode = '';
    var S = window.spirit.elements && window.spirit.elements.joinSteps;
    Promise.resolve(spirit.contact.search({ q: '*', relay: 'yes' })).then(function (s) {
      var url = S ? S.linkRelay(joinRelayKey, (s && s.items) || []) : '';
      if (!url) throw new Error('this node lists no relay that sent this link');
      return ask('relay.join', { url: url, email: '', code: code });
    }).then(function (r) {
      var b = (r && r.body) || {};
      // 200 is an email change on a seat already held, 201 a new seat (goal/G30.1, box v31).
      say(b.ok && r.status === 200 ? 'Email address verified on ' + (b.url || 'the relay') + '.'
        : b.ok ? 'Joined ' + (b.url || 'the relay') + (b.label ? ' as ' + b.label : '') + '.'
        : 'The join did not finish: ' + (b.error || 'no answer') + '. Ask again with your email.');
      openNamed();
    }, function (e) { say('The join did not finish: ' + ((e && e.message) || 'this node did not answer') + '.'); openNamed(); });
  }
  var fromLink = (window.location.search || '').length > 1;
  if (fromLink) { try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* the token is spent */ } }
  fetch('/shell/login/login.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
    manifest = m || {};
    steps = Array.isArray(manifest.steps) ? manifest.steps : [];
    return refresh();
  }).then(function () {
    // Logged out, the login app takes the screen at once, as Join does on a new node; the mailed link opens it too.
    if (!(state && state.home) && (fromLink || !state.loggedIn)) openLogin();
  });
}());
