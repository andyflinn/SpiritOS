// spirit/run/shell/deskUnslothRemote/deskUnslothRemote.js
// THE REMOTE CONTROL OF THE LOCAL AGENT AT THE DESK — goal/G14. Its hello world was the switch (goal/G14.2); the
// model line and the chat box came with goal/G14.4.
//
//   Andy, 2026-10-10: "it will be a connect/disconnect switch for Levant to be visible in desk." "this way i can
//   turn it off, so i don't have to waive for you to claim both reds and code." "This will be visible in the brand
//   new deskUnslothRemote shell-app, this is it's hello world and can simultaneously run un the puppet or on my
//   own node."
//   goal/G14.4: "Model [model selector dropdown, showing currently loaded by default] [Load][ICON.EYE] [ICON.THINK]
//   [ICON.MUSIC] etc... in small-print: flavor, GB size etc.... The dropdown will only show models that unsloth has
//   cached locally. The [Load] button will only be displayed if the models is not running, otherwise that spot
//   shows the RUNNING icon." "ICON.VIEW for vision". On choosing: "No. because the loading process is lengthy,
//   changing the selection only will bring more detailed info." The chat box: "sticky, at the bottom of the window
//   (panel)", "Title Line containing model info / Fixed height scrolling display, height 25% of the windows /
//   [input string box][send-button]", "Enter = send, one line only", "the chat will only be shown on the node that
//   hosts deskUnsloth....".
//
// ONE TARGET, ONE FUNCTION. The target is this node, or a puppet of it; every ask of deskUnsloth goes through
// deskUnslothRemoteAskFor: jobs.api on this node, owner.command carrying that same jobs.api ask on a puppet, which
// the puppet's owner door runs through its own loopback verbs (puppetMode.js). One function unwraps both answers.
//
// THE PUPPETS come from puppets.json in this app's own folder, for now: {"puppets": [{name, key}]}. A node with no
// such file offers this node alone — which is what the same app shows when it opens on the puppet itself.
//
// THE CHAT BOX IS DRAWN ONLY WHERE deskUnsloth RUNS: the app knows because its own node answers the state ask (on
// the owner's node that ask is app-not-served). It speaks to deskUnsloth on its own node, never through the owner
// door, in two asks: chat.send gives an id at once, chat.answer is asked every second until done — a process answers
// within 12 s (appClient DOOR_WAIT_MS) and a model answer can take longer.
//
// NO TICK: `render` is left undefined. The state and the models are read when the app opens, when the target
// changes and after a press; a load in progress is re-asked every two seconds until the studio is done, and a chat
// answer every second until it is there. Nothing else moves on its own.

var deskUnslothRemoteApi = null;
var deskUnslothRemoteTargets = [];
var deskUnslothRemoteTarget = null;
var deskUnslothRemoteState = null;
var deskUnslothRemoteBusy = false;
var deskUnslothRemoteModels = null;     // the last models answer for the target, or null
var deskUnslothRemoteChosen = '';       // the id in the dropdown
var deskUnslothRemoteLoadTimer = null;  // the re-ask while a load runs
var deskUnslothRemoteLocal = false;     // this node hosts deskUnsloth: the chat box is drawn
var deskUnslothRemoteTranscript = [];   // the chat box's lines, the page's own: [{role, text}]
var deskUnslothRemoteChatBusy = false;

function deskUnslothRemoteIcon(name) {
  var table = (typeof spirit !== 'undefined' && spirit.core && spirit.core.const && spirit.core.const.ICON) || {};
  return table[name] || '';
}

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

// The chat never crosses the owner door: it is this node's deskUnsloth or nothing.
function deskUnslothRemoteChatAskFor(verb, args) {
  return deskUnslothRemoteAskFor({ kind: 'node' }, verb, args);
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

// ── THE LINE FOR ONE MODEL, FROM THE models ANSWER AND NOTHING ELSE ──
//
// His sketch, piece by piece: the Load button only when the model is not loaded, the running mark (ON, the green
// circle: the table has no RUNNING) in its place when it is; VIEW for vision, THINK for reasoning, MUSIC for audio;
// small print with the flavor (quant) and the size in GB to one decimal. No ask is made here: a changed selection
// only redraws.
function deskUnslothRemoteLineFor(model) {
  var m = model || {};
  var icons = [];
  if (m.vision) icons.push(deskUnslothRemoteIcon('VIEW'));
  if (m.reasoning) icons.push(deskUnslothRemoteIcon('THINK'));
  if (m.audio) icons.push(deskUnslothRemoteIcon('MUSIC'));
  var gb = (Number(m.bytes) || 0) / 1e9;
  var small = [m.quant || '', gb ? gb.toFixed(1) + ' GB' : '', m.task && m.task !== 'text-generation' ? m.task : '']
    .filter(Boolean).join(' · ');
  return {
    load: !m.loaded,
    mark: m.loaded ? deskUnslothRemoteIcon('ON') : '',
    icons: icons,
    small: small,
  };
}

// EACH ENTRY OF THE DROPDOWN CARRIES ITS ICONS (Andy, 2026-10-10: "it would mean you can show cached and current
// model capabilities in the drop-down, as far as you know it. / dropdown list / model1 - capability icons / model2
// - capability icons...."): the id, the icons the studio or the cache know of it, and the loaded mark.
function deskUnslothRemoteOptionFor(model) {
  var m = model || {};
  var line = deskUnslothRemoteLineFor(m);
  return [String(m.id || ''), line.icons.join(''), m.loaded ? line.mark : ''].filter(Boolean).join(' ');
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

// THE MODEL LINE: the dropdown of cached models, the loaded one selected unless the person chose another, then the
// Load button or the running mark, the icons, the small print. Redrawn from the last models answer; the select
// keeps the chosen id so a redraw after a poll does not jump the selection.
function deskUnslothRemoteDrawModels() {
  var box = document.getElementById('dur-models');
  if (!box) return;
  var escape = deskUnslothRemoteApi && deskUnslothRemoteApi.escapeHtml ? deskUnslothRemoteApi.escapeHtml : function (s) { return String(s); };
  var got = deskUnslothRemoteModels;
  if (!got || got.ok === false || !Array.isArray(got.models)) {
    box.innerHTML = got && got.ok === false
      ? '<div class="job-start-error">the studio could not be read: ' + escape(got.error || got.code || 'no answer') + '</div>'
      : '';
    return;
  }
  var models = got.models;
  if (!models.length) { box.innerHTML = '<div class="job-manifest-note">the studio has no model cached</div>'; return; }
  var chosen = models.some(function (m) { return m.id === deskUnslothRemoteChosen; }) ? deskUnslothRemoteChosen : (got.active || models[0].id);
  deskUnslothRemoteChosen = chosen;
  var model = models.filter(function (m) { return m.id === chosen; })[0] || models[0];
  var line = deskUnslothRemoteLineFor(model);
  var loading = deskUnslothRemoteLoadTimer && !model.loaded;
  box.innerHTML =
    '<div class="start-job-form card">' +
      '<label class="field-label grow">Model' +
        '<select id="dur-model">' +
          models.map(function (m) {
            return '<option value="' + escape(m.id) + '"' + (m.id === chosen ? ' selected' : '') + '>' + escape(deskUnslothRemoteOptionFor(m)) + '</option>';
          }).join('') +
        '</select>' +
      '</label>' +
      (loading
        ? '<span id="dur-mark" title="loading">' + deskUnslothRemoteIcon('LOADING') + '</span>'
        : (line.load
          ? '<button type="button" id="dur-load"' + (deskUnslothRemoteCanLoad(got, model) ? '' : ' disabled title="the studio has not answered yet"') + '>Load</button>'
          : '<span id="dur-mark" title="running">' + line.mark + '</span>')) +
      '<span id="dur-icons">' + line.icons.join(' ') + '</span>' +
    '</div>' +
    '<div class="job-manifest-note" id="dur-small">' + escape(line.small) + (loading ? ' · loading…' : '') + (got.cached && !loading ? ' · from what was known; asking the studio…' : '') + '</div>';
  document.getElementById('dur-model').addEventListener('change', function (e) {
    // A CHANGED SELECTION SENDS NOTHING (his ruling): it only redraws the line for that model.
    deskUnslothRemoteChosen = e.target.value;
    deskUnslothRemoteDrawModels();
  });
  var load = document.getElementById('dur-load');
  if (load) load.addEventListener('click', deskUnslothRemoteLoad);
  deskUnslothRemoteDrawChatTitle();
}

var deskUnslothRemoteFreshTries = 0;
function deskUnslothRemoteLoadModels() {
  if (!deskUnslothRemoteTarget) return Promise.resolve();
  var target = deskUnslothRemoteTarget;
  return deskUnslothRemoteAsk(target, 'models', {}).then(function (said) {
    if (target !== deskUnslothRemoteTarget) return said;
    deskUnslothRemoteModels = said;
    deskUnslothRemoteDrawModels();
    // A CACHED ANSWER IS ASKED AGAIN after a moment, until the studio has been heard from (or it has not answered
    // ten times over: then the line stays as known, Load withheld, and the next open asks again).
    if (said && said.cached && !deskUnslothRemoteLoadTimer && deskUnslothRemoteFreshTries < 10) {
      deskUnslothRemoteFreshTries++;
      setTimeout(function () { if (target === deskUnslothRemoteTarget) deskUnslothRemoteLoadModels(); }, 2000);
    } else if (said && !said.cached) {
      deskUnslothRemoteFreshTries = 0;
    }
    return said;
  });
}

// MAY LOAD BE OFFERED: only for a model not loaded, and only when the models answer is not `cached` — the studio
// has been heard from just now (Andy, 2026-10-10: "the list should return with a cached flag, so the remote can
// forbid loading until.... unsloth-studio crashed again."). A cached answer is re-asked after a moment until the
// refresh behind it has landed.
function deskUnslothRemoteCanLoad(got, model) {
  return !!(got && got.ok !== false && !got.cached && model && !model.loaded);
}

// IS THE LOAD OVER, from one models answer: loaded, or failed with the studio's words, or the studio unreadable.
// Andy, 2026-10-10, after a load failed live: "your UI must release the hour-glass status. and allow another
// loading attempt." A pure function, so the red can hold it.
function deskUnslothRemoteLoadOver(got, id) {
  if (!got || got.ok === false) return { over: true, error: (got && (got.error || got.code)) || 'the studio could not be read' };
  var loaded = Array.isArray(got.models) && got.models.some(function (m) { return m.id === id && m.loaded; });
  if (loaded) return { over: true, error: '' };
  var l = got.load || {};
  if (l.model === id && l.state === 'failed') return { over: true, error: l.error || 'the studio did not load it' };
  return { over: false, error: '' };
}

// THE LOAD: one press, the studio swaps the loaded model (lengthy), and the line is re-asked every two seconds
// until models says the chosen one is loaded, or that the load failed: then the hourglass goes, the words are
// shown, and Load is offered again. The switch's state is re-read when loaded: deskUnsloth's model followed.
function deskUnslothRemoteLoad() {
  var id = deskUnslothRemoteChosen;
  if (!id || deskUnslothRemoteLoadTimer) return;
  deskUnslothRemoteAsk(deskUnslothRemoteTarget, 'model.load', { id: id }).then(function (said) {
    if (said && said.ok === false) { deskUnslothRemoteSay(said.error || said.code || 'the load was refused', true); return; }
    deskUnslothRemoteSay('', false);
    deskUnslothRemoteLoadTimer = setInterval(function () {
      deskUnslothRemoteLoadModels().then(function (got) {
        var over = deskUnslothRemoteLoadOver(got, id);
        if (!over.over) return;
        clearInterval(deskUnslothRemoteLoadTimer);
        deskUnslothRemoteLoadTimer = null;
        deskUnslothRemoteSay(over.error, !!over.error);
        deskUnslothRemoteDrawModels();
        if (!over.error) deskUnslothRemoteLoadState();
      });
    }, 2000);
    deskUnslothRemoteDrawModels();
  });
}

function deskUnslothRemoteLoadState() {
  if (!deskUnslothRemoteTarget) return Promise.resolve();
  deskUnslothRemoteBusy = true;
  deskUnslothRemoteDraw();
  return deskUnslothRemoteAsk(deskUnslothRemoteTarget, 'state', {}).then(function (said) {
    deskUnslothRemoteState = said;
    deskUnslothRemoteBusy = false;
    deskUnslothRemoteSay(said && said.ok === false ? (said.error || said.code || 'no answer') : '', true);
    deskUnslothRemoteDraw();
    if (deskUnslothRemoteTarget.kind === 'node') {
      // THIS NODE HOSTS deskUnsloth when its own state ask is answered: then, and only then, the chat box.
      deskUnslothRemoteLocal = !!(said && said.ok !== false);
      deskUnslothRemoteDrawChat();
    }
    return said;
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
    return deskUnslothRemoteLoadState();
  });
}

// ── THE CHAT BOX, ON THE HOSTING NODE ONLY ───────────────────────────
function deskUnslothRemoteDrawChatTitle() {
  var title = document.getElementById('dur-chat-title');
  if (!title) return;
  var got = deskUnslothRemoteModels;
  var active = got && Array.isArray(got.models) ? got.models.filter(function (m) { return m.loaded; })[0] : null;
  var escape = deskUnslothRemoteApi && deskUnslothRemoteApi.escapeHtml ? deskUnslothRemoteApi.escapeHtml : function (s) { return String(s); };
  title.innerHTML = active
    ? escape(active.id) + ' <span class="job-manifest-note">' + escape(deskUnslothRemoteLineFor(active).small) + '</span>'
    : '<span class="job-manifest-note">no model loaded</span>';
}

function deskUnslothRemoteDrawChatLines() {
  var display = document.getElementById('dur-chat-display');
  if (!display) return;
  var escape = deskUnslothRemoteApi && deskUnslothRemoteApi.escapeHtml ? deskUnslothRemoteApi.escapeHtml : function (s) { return String(s); };
  display.innerHTML = deskUnslothRemoteTranscript.map(function (l) {
    return '<div><b>' + (l.role === 'assistant' ? escape((deskUnslothRemoteState && deskUnslothRemoteState.persona) || 'model') : 'you') + ':</b> ' + escape(l.text) + '</div>';
  }).join('') + (deskUnslothRemoteChatBusy ? '<div class="job-manifest-note">' + deskUnslothRemoteIcon('LOADING') + '</div>' : '');
  display.scrollTop = display.scrollHeight;
}

function deskUnslothRemoteDrawChat() {
  var box = document.getElementById('dur-chat');
  if (!box) return;
  if (!deskUnslothRemoteLocal) { box.innerHTML = ''; box.style.display = 'none'; return; }
  if (document.getElementById('dur-chat-input')) { deskUnslothRemoteDrawChatTitle(); deskUnslothRemoteDrawChatLines(); return; }
  box.style.display = '';
  box.innerHTML =
    '<div class="label" id="dur-chat-title"></div>' +
    '<div id="dur-chat-display" class="card" style="height:25vh;overflow-y:auto;white-space:pre-wrap"></div>' +
    '<div class="start-job-form">' +
      '<input type="text" id="dur-chat-input" class="grow" placeholder="one line, Enter sends">' +
      '<button type="button" id="dur-chat-send">Send</button>' +
    '</div>';
  var input = document.getElementById('dur-chat-input');
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); deskUnslothRemoteChatSend(); } });
  document.getElementById('dur-chat-send').addEventListener('click', deskUnslothRemoteChatSend);
  deskUnslothRemoteDrawChatTitle();
  deskUnslothRemoteDrawChatLines();
}

function deskUnslothRemoteChatSend() {
  var input = document.getElementById('dur-chat-input');
  if (!input || deskUnslothRemoteChatBusy) return;
  var text = String(input.value || '').replace(/[\r\n]+/g, ' ').trim();
  if (!text) return;
  input.value = '';
  deskUnslothRemoteTranscript.push({ role: 'user', text: text });
  deskUnslothRemoteChatBusy = true;
  deskUnslothRemoteDrawChatLines();
  var payload = deskUnslothRemoteChatAskFor('chat.send', { lines: deskUnslothRemoteTranscript.slice() });
  var rest = {};
  Object.keys(payload).forEach(function (k) { if (k !== 'verb') rest[k] = payload[k]; });
  deskUnslothRemoteApi.verb(payload.verb, rest).then(function (r) {
    var said = deskUnslothRemoteAnswerOf({ kind: 'node' }, r);
    if (!said || said.ok === false || !said.id) throw new Error((said && (said.error || said.code)) || 'the chat was refused');
    return new Promise(function (resolve, reject) {
      var timer = setInterval(function () {
        var p = deskUnslothRemoteChatAskFor('chat.answer', { id: said.id });
        var q = {}; Object.keys(p).forEach(function (k) { if (k !== 'verb') q[k] = p[k]; });
        deskUnslothRemoteApi.verb(p.verb, q).then(function (r2) {
          var a = deskUnslothRemoteAnswerOf({ kind: 'node' }, r2);
          if (a && a.ok === false) { clearInterval(timer); reject(new Error(a.error || a.code || 'no answer')); return; }
          if (a && a.done) { clearInterval(timer); resolve(String(a.text || '')); }
        }, function (e) { clearInterval(timer); reject(e); });
      }, 1000);
    });
  }).then(function (answer) {
    deskUnslothRemoteTranscript.push({ role: 'assistant', text: answer });
  }, function (e) {
    deskUnslothRemoteTranscript.push({ role: 'assistant', text: '(' + String((e && e.message) || e) + ')' });
  }).then(function () {
    deskUnslothRemoteChatBusy = false;
    deskUnslothRemoteDrawChatLines();
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    deskUnslothRemoteApi = api;
    deskUnslothRemoteTargets = deskUnslothRemoteReadTargets();
    deskUnslothRemoteTarget = deskUnslothRemoteTargets[0];

    var escape = api.escapeHtml || function (s) { return String(s); };
    // The panel is a column: the controls above, the chat box stuck to the bottom edge (his "sticky").
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.minHeight = '100%';
    container.innerHTML =
      '<div class="stat-tile wide" style="flex:1 1 auto">' +
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
        '<div id="dur-models"></div>' +
      '</div>' +
      '<div class="stat-tile wide" id="dur-chat" style="position:sticky;bottom:0;display:none"></div>';

    document.getElementById('dur-target').addEventListener('change', function (e) {
      deskUnslothRemoteTarget = deskUnslothRemoteTargets[Number(e.target.value)] || deskUnslothRemoteTargets[0];
      deskUnslothRemoteState = null;
      deskUnslothRemoteModels = null;
      deskUnslothRemoteChosen = '';
      if (deskUnslothRemoteLoadTimer) { clearInterval(deskUnslothRemoteLoadTimer); deskUnslothRemoteLoadTimer = null; }
      deskUnslothRemoteDrawModels();
      deskUnslothRemoteLoadState();
      deskUnslothRemoteLoadModels();
    });
    document.getElementById('dur-switch').addEventListener('click', deskUnslothRemoteFlip);
    deskUnslothRemoteLoadState();
    deskUnslothRemoteLoadModels();
  },
});
