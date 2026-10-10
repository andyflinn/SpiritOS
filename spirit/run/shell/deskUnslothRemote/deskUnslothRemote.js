// spirit/run/shell/deskUnslothRemote/deskUnslothRemote.js
// THE REMOTE CONTROL OF THE LOCAL AGENT AT THE DESK — goal/G14, and this is its hello world (goal/G14.2).
//
//   Andy, 2026-10-10: "it will be a connect/disconnect switch for Levant to be visible in desk." "this way i can
//   turn it off, so i don't have to waive for you to claim both reds and code." "This will be visible in the brand
//   new deskUnslothRemote shell-app, this is it's hello world and can simultaneously run un the puppet or on my
//   own node."
//
// ONE SWITCH AND A TARGET. The target is this node, or a puppet of it; the switch flips deskUnsloth's connect verb
// on that target and shows what its state verb says. On this node the ask is jobs.api, the loopback door's way to
// a process; on a puppet it is owner.command carrying that same jobs.api ask, which the puppet's owner door runs
// through its own loopback verbs (puppetMode.js). ONE FUNCTION builds both from the target, and one unwraps both
// answers: nothing else differs, which is the point (the box: "One function with the target as its argument;
// nothing else differs").
//
// THE PUPPETS come from puppets.json in this app's own folder, for now: {"puppets": [{name, key}]}. The box: "the
// puppet's key from a small list in the app's own folder for now, until a puppets list exists". A node with no
// such file, or an empty one, offers this node alone — which is what the same app shows when it opens on the
// puppet itself.
//
// NO TICK: `render` is left undefined, so the shell never repaints this screen on the job tick. The state is read
// when the app opens, when the target changes and after every flip, and nothing here moves on its own.

var deskUnslothRemoteApi = null;
var deskUnslothRemoteTargets = [];
var deskUnslothRemoteTarget = null;
var deskUnslothRemoteState = null;
var deskUnslothRemoteBusy = false;

// ── THE ONE FUNCTION: FROM A TARGET TO THE ASK ──────────────────────
//
// target: { kind: 'node' } or { kind: 'puppet', key }. The answer is the payload for api.verb: its `verb` and
// everything beside it. For this node, jobs.api with the ask of deskUnsloth; for a puppet, owner.command to its
// key whose command is that very jobs.api ask, as it would be sent on the puppet's own loopback door.
function deskUnslothRemoteAskFor(target, verb, args) {
  var ask = {};
  ask[String(verb)] = args || {};
  var local = { verb: 'jobs.api', ask: { deskUnsloth: ask } };
  if (!target || target.kind !== 'puppet') return local;
  return { verb: 'owner.command', to: String(target.key || ''), command: 'jobs.api', body: { ask: local.ask } };
}

// THE SAME FUNCTION BACK: what deskUnsloth itself answered. From this node the body is its answer; from a puppet
// the owner door's answer wraps it ({hash, verb, ok, status, body}), and a refusal on the way (no reply, not a
// puppet, not reachable) comes back as that refusal, by name, so the screen can say why.
function deskUnslothRemoteAnswerOf(target, r) {
  var said = r && r.body;
  if (!said || typeof said !== 'object') return { ok: false, error: (r && r.text) || 'no answer' };
  if (!target || target.kind !== 'puppet') return said;
  if (said.ok === false) return said;
  return said.body && typeof said.body === 'object' ? said.body : { ok: false, error: 'the puppet answered nothing' };
}

function deskUnslothRemoteAsk(target, verb, args) {
  var payload = deskUnslothRemoteAskFor(target, verb, args);
  var rest = {};
  Object.keys(payload).forEach(function (k) { if (k !== 'verb') rest[k] = payload[k]; });
  return deskUnslothRemoteApi.verb(payload.verb, rest).then(function (r) {
    return deskUnslothRemoteAnswerOf(target, r);
  }, function (e) {
    return { ok: false, error: String((e && e.message) || e) };
  });
}

// ── THE TARGETS ──────────────────────────────────────────────────────
function deskUnslothRemoteReadTargets() {
  var targets = [{ kind: 'node', name: 'this node' }];
  var raw = null;
  try { raw = deskUnslothRemoteApi.fs.loadFile('puppets.json'); } catch (e) { raw = null; }
  var parsed = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
  var list = parsed && Array.isArray(parsed.puppets) ? parsed.puppets : [];
  list.forEach(function (p) {
    if (!p || typeof p.key !== 'string' || !p.key) return;
    targets.push({ kind: 'puppet', name: String(p.name || p.key.slice(-12)), key: p.key });
  });
  return targets;
}

// ── THE SCREEN ───────────────────────────────────────────────────────
function deskUnslothRemoteSay(text, isError) {
  var el = document.getElementById('dur-note');
  if (!el) return;
  el.textContent = text || '';
  el.className = isError ? 'job-start-error' : 'job-manifest-note';
}

function deskUnslothRemoteDraw() {
  var button = document.getElementById('dur-switch');
  var state = document.getElementById('dur-state');
  if (!button || !state) return;
  var s = deskUnslothRemoteState;
  if (!s || s.ok === false) {
    state.textContent = 'not reachable';
    button.textContent = 'Connect';
    button.disabled = true;
    return;
  }
  var who = s.persona || 'the agent';
  state.textContent = who + ' is ' + (s.connected ? 'connected to the desk' : 'disconnected from the desk') +
    (s.model ? ' (' + s.model + ')' : '');
  button.textContent = s.connected ? 'Disconnect ' + who : 'Connect ' + who;
  button.disabled = deskUnslothRemoteBusy;
}

function deskUnslothRemoteLoad() {
  if (!deskUnslothRemoteTarget) return Promise.resolve();
  deskUnslothRemoteBusy = true;
  deskUnslothRemoteDraw();
  return deskUnslothRemoteAsk(deskUnslothRemoteTarget, 'state', {}).then(function (said) {
    deskUnslothRemoteState = said;
    deskUnslothRemoteBusy = false;
    deskUnslothRemoteSay(said && said.ok === false ? (said.error || said.code || 'no answer') : '', true);
    deskUnslothRemoteDraw();
  });
}

function deskUnslothRemoteFlip() {
  if (deskUnslothRemoteBusy || !deskUnslothRemoteState || deskUnslothRemoteState.ok === false) return;
  var on = !deskUnslothRemoteState.connected;
  deskUnslothRemoteBusy = true;
  deskUnslothRemoteDraw();
  deskUnslothRemoteAsk(deskUnslothRemoteTarget, 'connect', { on: on }).then(function (said) {
    deskUnslothRemoteBusy = false;
    if (said && said.ok === false) {
      deskUnslothRemoteSay(said.error || said.code || 'the switch was not flipped', true);
      deskUnslothRemoteDraw();
      return;
    }
    // RE-ASKED, NOT ASSUMED: the state shown is what the agent says of itself after the flip.
    return deskUnslothRemoteLoad();
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    deskUnslothRemoteApi = api;
    deskUnslothRemoteTargets = deskUnslothRemoteReadTargets();
    deskUnslothRemoteTarget = deskUnslothRemoteTargets[0];

    var escape = api.escapeHtml || function (s) { return String(s); };
    container.innerHTML =
      '<div class="stat-tile wide">' +
        '<div class="label">The local agent at the desk</div>' +
        '<div class="job-manifest-note">Connected, the agent reads the desk and answers what is addressed to it, ' +
          'and the desk counts it live. Disconnected, it stops reading and signs off at once, so a phase that ' +
          'waits for a second agent does not wait for it.</div>' +
        '<div class="start-job-form card">' +
          '<label class="field-label grow">Where' +
            '<select id="dur-target">' +
              deskUnslothRemoteTargets.map(function (t, i) {
                return '<option value="' + i + '">' + escape(t.name) + '</option>';
              }).join('') +
            '</select>' +
          '</label>' +
        '</div>' +
        '<div class="start-job-form card">' +
          '<div class="grow" id="dur-state">asking…</div>' +
          '<button type="button" id="dur-switch" disabled>Connect</button>' +
        '</div>' +
        '<div id="dur-note" class="job-manifest-note"></div>' +
      '</div>';

    document.getElementById('dur-target').addEventListener('change', function (e) {
      deskUnslothRemoteTarget = deskUnslothRemoteTargets[Number(e.target.value)] || deskUnslothRemoteTargets[0];
      deskUnslothRemoteState = null;
      deskUnslothRemoteLoad();
    });
    document.getElementById('dur-switch').addEventListener('click', deskUnslothRemoteFlip);
    deskUnslothRemoteLoad();
  },
});
