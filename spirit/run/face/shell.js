// spirit/run/face/shell.js
// THE NEW SHELL IN THE MAKING (goal/G30.9): the lazy-load shell face.html boots, on a member's face and on the home
// node alike (Andy: "this is going to be the new shell, that works equally on both the home-node AND the face"). It
// has the shell's look and feel: the desktop of app icons, the app screen under a title bar with Back and Home. For
// now its one app is the login app, the counterpart of the node's Join app: a steps app whose manifest lists its steps.
//
// DECIDED ONCE, HERE, as the node's shell does for Join: the shell asks where the user stands, works out the open step,
// names the icon by it and hands it to the app's onSteps. On the face it asks the relay (POST /face/api { verb:
// 'state' }); on the home node, which has no relay login, it asks the node who it is (node.card) and the user is its
// owner, logged in. Logged out, the login app opens at once and takes the screen, as Join does on a new node. The
// app's script loads only when it is opened. The mailed link (/?<token>) was logged in by the relay before this page
// loaded; the token leaves the address bar.
//
// The Spirit group and the face-compatible apps (face:true) come later, with the plumbing.

(function () {
  var desktop = document.getElementById('desktop');
  var container = document.getElementById('app-container');
  var content = document.getElementById('app-content');
  var title = document.getElementById('app-title');
  var steps = [];
  var manifest = {};
  var state = null;      // { loggedIn, face, home }
  var app = null;        // the login app once its script has loaded: { mount, onSteps }
  var mounted = false;

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

  function done(step) {
    if (step.until === 'login') return !!(state && state.loggedIn);
    return false; // plumbing: the next item
  }
  function handed() {
    var open = steps.filter(function (s) { return !done(s); })[0] || null;
    return { facts: { face: state ? state.face : '', loggedIn: !!(state && state.loggedIn), home: !!(state && state.home) },
      open: open ? open.until : null, done: steps.map(done) };
  }

  // The desktop: the login app's icon, named and marked by its open step, as the node shell draws an app icon.
  function drawDesktop() {
    var h = handed();
    var step = steps.filter(function (s) { return s.until === h.open; })[0];
    desktop.innerHTML = '';
    if (!step) return;
    var icon = document.createElement('div');
    icon.className = 'app-icon';
    icon.innerHTML = '<span class="icon"></span><span class="label"></span>';
    icon.querySelector('.icon').textContent = step.icon || '';
    icon.querySelector('.label').textContent = step.name;
    icon.addEventListener('click', openApp);
    desktop.appendChild(icon);
  }

  function hand() {
    drawDesktop();
    if (app && mounted && typeof app.onSteps === 'function') app.onSteps(handed());
  }

  // Asked again after the app logs in or out.
  function refresh() {
    return post('state').then(function (s) { state = s; }, function () { return homeState().then(function (s) { state = s; }, function () { state = { loggedIn: false }; }); })
      .then(hand);
  }

  function openApp() {
    title.textContent = manifest.name || 'Log in';
    desktop.hidden = true;
    container.hidden = false;
    if (app) { if (!mounted) mount(); return; }
    var s = document.createElement('script');
    s.src = '/face/login/login.js';
    document.body.appendChild(s);
  }
  function showDesktop() { container.hidden = true; desktop.hidden = false; }
  document.getElementById('app-close').addEventListener('click', showDesktop);
  document.getElementById('app-home').addEventListener('click', showDesktop);

  function mount() {
    mounted = true;
    app.mount(content, { post: post, refresh: refresh });
    hand();
  }

  window.faceShell = {
    activateApp: function (behavior) { app = behavior; mount(); },
  };

  var fromLink = (window.location.search || '').length > 1;
  if (fromLink) { try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* the token is spent */ } }
  fetch('/face/login/login.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
    manifest = m || {};
    steps = Array.isArray(manifest.steps) ? manifest.steps : [];
    return refresh();
  }).then(function () {
    // Logged out, the login app takes the screen at once, as Join does on a new node; the mailed link opens it too.
    if (fromLink || !state.loggedIn) openApp();
  });
}());
