// spirit/run/face/shell.js
// THE FACE SHELL (goal/G30.9): the lazy-load version of the shell that face.html boots on a member's face. Logged out
// it is empty but for the login app, the counterpart of the node's Join app: a steps app whose manifest lists its
// steps. As the node's shell does for Join, this shell decides where the user stands, once: it asks the relay
// (POST /face/api { verb: 'state' }), works out the open step, names the tile by it, and hands it to the app's onSteps.
// The app's script loads only when the app is opened. The mailed link (/?<token>) opens the login app: the relay has
// logged the token in by the time this page loads, and the token leaves the address bar.
//
// The face-compatible apps (face:true in their manifest) come with the plumbing item; until then the login app is the
// only one.

(function () {
  var desktop = document.getElementById('face-desktop');
  var pane = document.getElementById('face-app');
  var steps = [];
  var state = null;
  var app = null;        // the login app once its script has loaded: { mount, onSteps }
  var mounted = false;

  function post(verb, body) {
    var payload = { verb: verb };
    Object.keys(body || {}).forEach(function (k) { payload[k] = body[k]; });
    return fetch('/face/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); });
  }

  function done(step) {
    if (step.until === 'login') return !!(state && state.loggedIn);
    return false; // plumbing: the next item
  }
  function handed() {
    var open = steps.filter(function (s) { return !done(s); })[0] || null;
    return { facts: { face: state ? state.face : '', loggedIn: !!(state && state.loggedIn) }, open: open ? open.until : null,
      done: steps.map(done) };
  }

  function drawTile() {
    var h = handed();
    var step = steps.filter(function (s) { return s.until === h.open; })[0];
    desktop.innerHTML = '';
    if (!step) return;
    var tile = document.createElement('button');
    tile.className = 'face-tile';
    tile.innerHTML = '<span class="face-icon"></span><span class="face-name"></span>';
    tile.querySelector('.face-icon').textContent = step.icon || '';
    tile.querySelector('.face-name').textContent = step.name;
    tile.addEventListener('click', openApp);
    desktop.appendChild(tile);
  }

  function hand() {
    drawTile();
    if (app && mounted && typeof app.onSteps === 'function') app.onSteps(handed(), steps);
  }

  // Asked of the relay: where the user stands. Again after the app logs in or out.
  function refresh() {
    return post('state').then(function (s) { state = s; hand(); }, function () { state = { loggedIn: false }; hand(); });
  }

  // The app's script, loaded on first open; it calls window.faceShell.activateApp.
  function openApp() {
    pane.hidden = false;
    desktop.hidden = true;
    if (app) { if (!mounted) mount(); return; }
    var s = document.createElement('script');
    s.src = '/face/login/login.js';
    document.body.appendChild(s);
  }
  function mount() {
    mounted = true;
    app.mount(pane, { post: post, refresh: refresh, back: function () { pane.hidden = true; desktop.hidden = false; } });
    hand();
  }

  window.faceShell = {
    activateApp: function (behavior) { app = behavior; mount(); },
  };

  var fromLink = (window.location.search || '').length > 1;
  if (fromLink) { try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* the token is spent */ } }
  fetch('/face/login/login.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
    steps = (m && Array.isArray(m.steps)) ? m.steps : [];
    return refresh();
  }).then(function () { if (fromLink) openApp(); });
}());
