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
// THREE TABS SINCE goal/G10.7 (Andy, 2026-10-12: "actually, make that 3 tabs [test] [configure][connect]"): the
// warnings above all three, the chat in [test] once a model is ready, the model selector in [configure], and in
// [connect] the where, the OpenAI compatible server (connection.set) and the switch. The chat works for any target,
// the hosting node and the puppet alike (Andy, 2026-10-10, "go." on running it on 65432): one ask through the chosen
// target, chat.send answering an id at once, the answer arriving as the published object's chat {id, done, text}
// down the stream (goal/G14.5).
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
var deskUnslothRemoteChosen = '';       // the pair in the dropdown, id|quant (goal/G10.9)
var deskUnslothRemoteLoadTimer = null;  // the re-ask while a load runs
var deskUnslothRemoteTab = 'test';      // the tab shown: test, configure or connect (goal/G10.7)
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

// THE CHAT FOLLOWS THE TARGET TOO (Andy, 2026-10-10, lifting his earlier ruling that the chat box shows on the
// hosting node only: "so we should be able to run chat on 65432 just by removing the check", "go."). The send is
// the one ask, through the same function as the switch; the answer comes down the stream on either node.
function deskUnslothRemoteChatAskFor(target, verb, args) {
  return deskUnslothRemoteAskFor(target, verb, args);
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
// SINCE goal/G10.9 AN ENTRY IS A MODEL AND ITS QUANTIZATION, and the desk-recommended mark rides with it. Andy,
// 2026-10-12: "we need to offer a precise selection of models, that includes the quantization/flavor as well?", and
// the mark "with the desk-icon (ICON.THREAD:🧵)", "a mark beside each model in the configure selector".
function deskUnslothRemoteKey(m) { return String((m && m.id) || '') + '|' + String((m && m.quant) || ''); }
function deskUnslothRemoteOptionFor(model) {
  var m = model || {};
  var line = deskUnslothRemoteLineFor(m);
  return [String(m.id || '') + (m.quant ? ' · ' + m.quant : ''), line.icons.join(''), m.recommended ? deskUnslothRemoteIcon('THREAD') : '', m.loaded ? line.mark : ''].filter(Boolean).join(' ');
}

// ── THE WARNINGS, IN EVERY TAB (goal/G10.7) ──────────────────────────
//
//   Andy, 2026-10-12: "the following warning bubbles appear in all 3 tabs": no node with deskUnsloth, no OpenAI
//   compatible server, no model loaded and selected, and "while a model is loading, an ICON.WARNING bubble is
//   displayed, "be patient, a model (name of model) is currently loading."
//
// From the state and the models answer alone, a pure function. Each one hides the ones after it: with no node there
// is no server to speak of, and with no server no model. None means a model is ready, and the test tab shows the chat.
function deskUnslothRemoteWarnings(state, models) {
  var w = deskUnslothRemoteIcon('WARNING');
  if (!state || state.ok === false) {
    return [w + ' No node with deskUnsloth is connected: use the [connect] tab to connect to a node that has deskUnsloth installed.'];
  }
  if (!state.server || state.server.answers !== true) {
    return [w + ' deskUnsloth is not connected to an OpenAI compatible server: use the [connect] tab to connect to an OpenAI compatible server.'];
  }
  var load = (models && models.load) || {};
  if (load.state === 'loading') return [w + ' Be patient, a model (' + String(load.model || '') + ') is currently loading.'];
  var loaded = models && Array.isArray(models.models) && models.models.some(function (m) { return m && m.loaded; });
  if (!loaded) return [w + ' No model is loaded: use the model selector in the [configure] tab to select and load a model.'];
  return [];
}

// THE WHERE DEFAULT (goal/G10.7). Andy, 2026-10-12: "when deskUnsloth does not find desk installed on it's own node,
// it will default to "this" node. if it does find desk is installed on its own node it, will default to the first
// puppet it finds that has deskUnsloth installed." `answered[i]` says whether target i's deskUnsloth answered; with
// none answering, this node.
function deskUnslothRemoteDefaultTarget(targets, hasDesk, answered) {
  if (!hasDesk) return 0;
  for (var i = 0; i < targets.length; i++) {
    if (targets[i] && targets[i].kind === 'puppet' && answered && answered[i]) return i;
  }
  return 0;
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
    // The label of a key is the kernel's alone (apiAuth/G1.11: "one and the same function across our entire system").
    targets.push({ kind: 'puppet', name: String(p.name || spirit.keyTail(p.key)), key: p.key });
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

// THE WARNINGS ABOVE EVERY TAB (goal/G10.7): one box, drawn from the state and the models, hidden when empty.
function deskUnslothRemoteDrawWarnings() {
  var box = document.getElementById('dur-warnings');
  if (!box) return;
  var escape = deskUnslothRemoteApi && deskUnslothRemoteApi.escapeHtml ? deskUnslothRemoteApi.escapeHtml : function (s) { return String(s); };
  var list = deskUnslothRemoteWarnings(deskUnslothRemoteState, deskUnslothRemoteModels);
  box.innerHTML = list.map(function (t) { return '<div class="job-start-error">' + escape(t) + '</div>'; }).join('');
  box.style.display = list.length ? '' : 'none';
}

// THE PAIRS (goal/G18.6). Andy, 2026-10-12: "I want my Account URL/token pairs saved in connection.json, now an array.
// i want to maintain that array in the connect tab."; each named, "good Idea, yes.", the name shown instead of the url.
// One row per pair: the one in use marked, the others with use and remove (deskUnsloth refuses removing the one in
// use). The key is never drawn: deskUnsloth never sends it.
function deskUnslothRemoteDrawPairs() {
  var box = document.getElementById('dur-pairs');
  if (!box) return;
  var escape = deskUnslothRemoteApi && deskUnslothRemoteApi.escapeHtml ? deskUnslothRemoteApi.escapeHtml : function (t) { return String(t); };
  var pairs = (deskUnslothRemoteState && Array.isArray(deskUnslothRemoteState.connections)) ? deskUnslothRemoteState.connections : [];
  box.innerHTML = pairs.length ? pairs.map(function (p) {
    var name = escape(p.name);
    return '<div class="start-job-form">' +
      '<div class="grow"><b>' + name + '</b>' + (p.use ? ' <span class="job-manifest-note">in use</span>' : '') + '</div>' +
      (p.use ? '' : '<button type="button" data-use="' + name + '">use</button> <button type="button" data-remove="' + name + '">remove</button>') +
      '</div>';
  }).join('') : '<div class="job-manifest-note">No server is kept yet: add one below.</div>';
}

// USE AND REMOVE, from a row of the pairs: deskUnsloth answers, and the state and the models are asked again.
function deskUnslothRemotePairPress(event) {
  var t = event && event.target;
  if (!t || !t.getAttribute) return;
  var use = t.getAttribute('data-use');
  var remove = t.getAttribute('data-remove');
  if (!use && !remove) return;
  var target = deskUnslothRemoteTarget;
  var verb = use ? 'connection.use' : 'connection.remove';
  deskUnslothRemoteAsk(target, verb, { name: use || remove }).then(function (said) {
    if (target !== deskUnslothRemoteTarget) return;
    if (!said || said.ok === false) { deskUnslothRemoteSay((said && ((said.extra && said.extra.why) || said.error || said.code)) || verb + ' was refused', true); return; }
    if (use) deskUnslothRemoteSay(said.answers ? 'using ' + use + ': a server answers there' : 'using ' + use + ', but nothing answers there: ' + said.error, !said.answers);
    else deskUnslothRemoteSay(remove + ' is removed', false);
    deskUnslothRemoteLoadState();
    deskUnslothRemoteLoadModels();
  });
}

// EVERYTHING THE STATE DRAWS, in one call: the switch, the warnings, the server bubble and the chat.
function deskUnslothRemoteDrawAll() {
  deskUnslothRemoteDraw();
  deskUnslothRemoteDrawWarnings();
  deskUnslothRemoteDrawPairs();
  deskUnslothRemoteDrawChat();
}

// ── THE THREE TABS (goal/G10.7) ──────────────────────────────────────
//
//   Andy, 2026-10-12: "actually, make that 3 tabs [test] [configure][connect]". The test tab: "if an model is ready
//   in the OpenAI compatible server, the test tab will show the chat interface." The configure tab: "the model
//   selector bubble." The connect tab: the where bubble, the OpenAI compatible server bubble, and "the
//   connect/disconnect "Levant" to the desk bubble."
var DESK_UNSLOTH_REMOTE_TABS = ['test', 'configure', 'connect'];
function deskUnslothRemoteDrawTabs() {
  var strip = document.getElementById('dur-tabs');
  if (strip) {
    strip.innerHTML = DESK_UNSLOTH_REMOTE_TABS.map(function (t) {
      return '<button type="button" data-tab="' + t + '"' + (t === deskUnslothRemoteTab ? ' class="active" aria-pressed="true"' : '') + '>' + t + '</button>';
    }).join('');
  }
  DESK_UNSLOTH_REMOTE_TABS.forEach(function (t) {
    var panel = document.getElementById('dur-tab-' + t);
    if (panel) panel.style.display = t === deskUnslothRemoteTab ? '' : 'none';
  });
}

// THE SERVER BUBBLE'S PRESS (goal/G10.7): the url and the key to deskUnsloth on the chosen node, connection.set; its
// answer says whether a server answers there, and the state is asked again so the warnings follow.
// Since goal/G18.6 it carries the pair's name, checked by the label rule before it is sent (rule/12).
function deskUnslothRemoteSaveServer() {
  var name = document.getElementById('dur-pair-name');
  var url = document.getElementById('dur-server-url');
  var key = document.getElementById('dur-server-key');
  var n = String((name && name.value) || '').trim();
  var u = String((url && url.value) || '').trim();
  var rules = (typeof window !== 'undefined' && window.spiritFieldRules) || null;
  var why = rules ? rules.problem(n) : (n ? '' : 'name required');
  if (why) {
    var bytes = rules ? rules.byteLength(rules.normalize(n)) : 0;
    deskUnslothRemoteSay('the name: ' + why + (rules && bytes > rules.MAX_BYTES ? ' (' + bytes + ' bytes, the limit is ' + rules.MAX_BYTES + ')' : ''), true);
    return;
  }
  if (!u) { deskUnslothRemoteSay('a url is needed, the OpenAI root, for example http://127.0.0.1:8888/v1', true); return; }
  var target = deskUnslothRemoteTarget;
  deskUnslothRemoteAsk(target, 'connection.set', { name: n, url: u, key: String((key && key.value) || '') }).then(function (said) {
    if (target !== deskUnslothRemoteTarget) return;
    if (!said || said.ok === false) { deskUnslothRemoteSay((said && ((said.extra && said.extra.why) || said.error || said.code)) || 'the connection was not set', true); return; }
    deskUnslothRemoteSay(said.answers ? 'connected: a server answers at ' + said.url : 'saved, but nothing answers at ' + said.url + ': ' + said.error, !said.answers);
    if (key) key.value = '';
    deskUnslothRemoteLoadState();
    deskUnslothRemoteLoadModels();
  });
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
  var loadedOne = models.filter(function (m) { return m.loaded; })[0];
  var chosen = models.some(function (m) { return deskUnslothRemoteKey(m) === deskUnslothRemoteChosen; }) ? deskUnslothRemoteChosen
    : deskUnslothRemoteKey(loadedOne || models[0]);
  deskUnslothRemoteChosen = chosen;
  var model = models.filter(function (m) { return deskUnslothRemoteKey(m) === chosen; })[0] || models[0];
  var test = got.test || {};
  var testingThis = test.state === 'running' && test.id === model.id && String(test.quant || '') === String(model.quant || '');
  var line = deskUnslothRemoteLineFor(model);
  var loading = deskUnslothRemoteLoadTimer && !model.loaded;
  box.innerHTML =
    '<div class="start-job-form card">' +
      // THE REFRESH (goal/G10.10). Andy, 2026-10-12: "we need a button to the left of the model-picker that allows me
      // to refresh the model list, so i don't have to re-start the Remote or 11111".
      '<button type="button" id="dur-refresh" title="ask the model list again">' + deskUnslothRemoteIcon('REFRESH') + '</button>' +
      '<label class="field-label grow">Model' +
        '<select id="dur-model">' +
          models.map(function (m) {
            var k = deskUnslothRemoteKey(m);
            return '<option value="' + escape(k) + '"' + (k === chosen ? ' selected' : '') + '>' + escape(deskUnslothRemoteOptionFor(m)) + '</option>';
          }).join('') +
        '</select>' +
      '</label>' +
      (loading
        ? '<span id="dur-mark" title="loading">' + deskUnslothRemoteIcon('LOADING') + '</span>'
        : (line.load
          ? '<button type="button" id="dur-load"' + (deskUnslothRemoteCanLoad(got, model) ? '' : ' disabled title="the studio has not answered yet"') + '>Load</button>'
          : '<span id="dur-mark" title="running">' + line.mark + '</span>')) +
      // THE [test] BUTTON (goal/G10.9): "run it from a [test] button", its outcome the 🧵 and the switch.
      // ARMED FIRST (goal/G10.9): "it should be arm-able, to make sure the disconnect is wanted."
      ' <button type="button" id="dur-test"' + (test.state === 'running' ? ' disabled' : '') + (deskUnslothRemoteTestArmed ? ' data-armed="1"' : '') + '>' +
        (testingThis ? 'testing…' : deskUnslothRemoteTestArmed ? 'test: disconnects Levant, sure?' : 'test') + '</button>' +
      '<span id="dur-icons">' + line.icons.join(' ') + (model.recommended ? ' ' + deskUnslothRemoteIcon('THREAD') : '') + '</span>' +
    '</div>' +
    (test.state && test.state !== 'running' && test.id === model.id && String(test.quant || '') === String(model.quant || '')
      ? '<div class="' + (test.state === 'passed' ? 'job-manifest-note' : 'job-start-error') + '" id="dur-test-result">test ' + escape(test.state) + ': ' + escape(test.why || '') + '</div>' : '') +
    '<div class="job-manifest-note" id="dur-small">' + escape(line.small) + (loading ? ' · loading…' : '') + (got.cached && !loading ? ' · from what was known; asking the studio…' : '') + '</div>';
  document.getElementById('dur-model').addEventListener('change', function (e) {
    // A CHANGED SELECTION SENDS NOTHING (his ruling): it only redraws the line for that model.
    deskUnslothRemoteChosen = e.target.value;
    deskUnslothRemoteDrawModels();
  });
  var load = document.getElementById('dur-load');
  if (load) load.addEventListener('click', deskUnslothRemoteLoad);
  var testButton = document.getElementById('dur-test');
  if (testButton) testButton.addEventListener('click', deskUnslothRemoteTest);
  var refresh = document.getElementById('dur-refresh');
  if (refresh) refresh.addEventListener('click', function () { deskUnslothRemoteLoadModels(); });
  deskUnslothRemoteDrawChatTitle();
}

// THE TEST'S PRESS (goal/G10.9): model.test for the chosen pair, answered at once; the outcome comes back published
// (test, the 🧵 in models, and the switch's connected), so nothing is asked after it.
function deskUnslothRemoteChosenPair() {
  var key = String(deskUnslothRemoteChosen || '');
  var at = key.lastIndexOf('|');
  return at === -1 ? { id: key, quant: '' } : { id: key.slice(0, at), quant: key.slice(at + 1) };
}
// THE ARM (goal/G10.9). Andy, 2026-10-12: "the test button should disconnect Levant from desk before testing, and it
// should be arm-able, to make sure the disconnect is wanted." The first click arms it, the second sends; a click
// elsewhere disarms it where the shell offers that.
var deskUnslothRemoteTestArmed = false;
function deskUnslothRemoteTest() {
  var pair = deskUnslothRemoteChosenPair();
  if (!pair.id) return;
  if (!deskUnslothRemoteTestArmed) {
    deskUnslothRemoteTestArmed = true;
    deskUnslothRemoteDrawModels();
    if (deskUnslothRemoteApi && typeof deskUnslothRemoteApi.armUntilElsewhere === 'function') {
      deskUnslothRemoteApi.armUntilElsewhere(function () { deskUnslothRemoteTestArmed = false; deskUnslothRemoteDrawModels(); });
    }
    return;
  }
  deskUnslothRemoteTestArmed = false;
  deskUnslothRemoteDrawModels();
  var target = deskUnslothRemoteTarget;
  deskUnslothRemoteAsk(target, 'model.test', { id: pair.id, quant: pair.quant }).then(function (said) {
    if (said && said.ok === false) { deskUnslothRemoteSay(said.error || said.code || 'the test was refused', true); return; }
    if (target !== deskUnslothRemoteTarget) return;
    deskUnslothRemoteSay('testing ' + pair.id + (pair.quant ? ' ' + pair.quant : '') + ': it loads first, which can take minutes', false);
  });
}

// ONE models ASK, AT OPEN AND ON A TARGET CHANGE, AND NO POLL AFTER IT. Through the owner door an ask can take
// 20 s (ownerPost's wait) and the first build asked every 2 s on an interval: ten posts outstanding at a time from
// his shell, the relay refusing busy, Desk's own posts starved and the puppet "unreachable" (Andy, 2026-10-10:
// "andy's shell has some request constantly outstanding", "sending in desk no longer works and on 65432 Remote is
// alwas says 11111 unreachable"). Since goal/G14.5 every later change arrives as a published object, so there is
// nothing to poll: one ask for the first paint, a guard against two in flight, and the stream from then on.
var deskUnslothRemoteModelsInFlight = false;
var deskUnslothRemoteContainer = null;

function deskUnslothRemoteLoadModels() {
  if (!deskUnslothRemoteTarget || deskUnslothRemoteModelsInFlight) return Promise.resolve(deskUnslothRemoteModels);
  var target = deskUnslothRemoteTarget;
  deskUnslothRemoteModelsInFlight = true;
  return deskUnslothRemoteAsk(target, 'models', {}).then(function (said) {
    deskUnslothRemoteModelsInFlight = false;
    if (target !== deskUnslothRemoteTarget) return said;
    deskUnslothRemoteModels = said;
    deskUnslothRemoteDrawModels();
    deskUnslothRemoteDrawAll();
    return said;
  }, function (e) {
    deskUnslothRemoteModelsInFlight = false;
    throw e;
  });
}

// MAY LOAD BE OFFERED: only for a model not loaded, and only when the models answer is not `cached` — the studio
// has been heard from just now (Andy, 2026-10-10: "the list should return with a cached flag, so the remote can
// forbid loading until.... unsloth-studio crashed again."). The next published object says when it is.
function deskUnslothRemoteCanLoad(got, model) {
  return !!(got && got.ok !== false && !got.cached && model && !model.loaded);
}

// ── THE PUBLISHED STATE, FROM EITHER NODE (goal/G14.5) ───────────────
//
//   Andy, 2026-10-10: "so deskUnsloth keeps a state, and publishes changes"; on a puppet the node streams it to
//   the master ("inside the puppet, the publisher then publishes to the master as well"), and the master's shell
//   hands it to onPublished with the sender's key. ONE HANDLER FOR BOTH: an object is taken when it is this node's
//   own (from empty, target this node) or streamed from the chosen puppet's key. Nothing is polled after it.
function deskUnslothRemoteTakesPublished(target, meta) {
  var from = String((meta && meta.from) || '');
  if (!target || target.kind !== 'puppet') return from === '';
  return !!from && from === String(target.key || '');
}

var deskUnslothRemoteChatPending = '';   // the chat.send id awaiting its published answer
var deskUnslothRemoteLogSeen = 0;        // the highest log seq drawn (goal/G19.7)

// THE LOG IN THE CHAT (goal/G19.7). Andy, 2026-10-12: "The abort button sit's with the chat in the test tab, where all
// requests, replies, and tool calls should be logged." The published state carries the newest entries; each one not
// yet drawn joins the transcript as a log line, which chat.send never sends to the model.
function deskUnslothRemoteTakeLog(log) {
  if (!Array.isArray(log)) return false;
  var added = false;
  log.forEach(function (e) {
    if (!e || typeof e.seq !== 'number' || e.seq <= deskUnslothRemoteLogSeen) return;
    deskUnslothRemoteLogSeen = e.seq;
    deskUnslothRemoteTranscript.push({ role: 'log', text: String(e.from || '') + ' ' + String(e.kind || '') + ': ' + String(e.text || '') });
    added = true;
  });
  return added;
}

function deskUnslothRemoteApplyPublished(obj) {
  if (!obj || typeof obj !== 'object' || typeof obj.connected !== 'boolean') return;
  deskUnslothRemoteState = { connected: obj.connected, persona: obj.persona || '', model: obj.model || '', server: obj.server || { url: '', answers: false, error: '' }, connections: Array.isArray(obj.connections) ? obj.connections : [], working: obj.working === true };
  // The switch's busy flag is the flip's own (goal/G19.7): a state published mid-flip no longer re-enables it.
  deskUnslothRemoteModels = { active: obj.active || '', activeQuant: obj.activeQuant || '', cached: !!obj.cached, load: obj.load || {}, test: obj.test || {}, models: Array.isArray(obj.models) ? obj.models : [] };
  deskUnslothRemoteTakeLog(obj.log);
  if (deskUnslothRemoteLoadTimer) {
    var over = deskUnslothRemoteLoadOver(deskUnslothRemoteModels, deskUnslothRemoteChosen);
    if (over.over) { deskUnslothRemoteLoadTimer = null; deskUnslothRemoteSay(over.error, !!over.error); }
  }
  if (deskUnslothRemoteChatPending && obj.chat && obj.chat.id === deskUnslothRemoteChatPending && obj.chat.done) {
    deskUnslothRemoteChatPending = '';
    deskUnslothRemoteTranscript.push({ role: 'assistant', text: String(obj.chat.text || '') });
    deskUnslothRemoteChatBusy = false;
  }
  deskUnslothRemoteDrawModels();
  deskUnslothRemoteDrawAll();
}

// IS THE LOAD OVER, from one models answer: loaded, or failed with the studio's words, or the studio unreadable.
// Andy, 2026-10-10, after a load failed live: "your UI must release the hour-glass status. and allow another
// loading attempt." A pure function, so the red can hold it.
function deskUnslothRemoteLoadOver(got, id) {
  if (!got || got.ok === false) return { over: true, error: (got && (got.error || got.code)) || 'the studio could not be read' };
  // id is a pair key (id|quant, goal/G10.9) or a bare id, as before it.
  var bare = String(id || '').split('|')[0];
  var loaded = Array.isArray(got.models) && got.models.some(function (m) { return (deskUnslothRemoteKey(m) === id || m.id === id) && m.loaded; });
  if (loaded) return { over: true, error: '' };
  var l = got.load || {};
  if (l.model === bare && l.state === 'failed') return { over: true, error: l.error || 'the studio did not load it' };
  return { over: false, error: '' };
}

// THE LOAD: one press, the studio swaps the loaded model (lengthy), and the published objects that follow say
// when the chosen one is loaded, or that the load failed: then the hourglass goes, the words are shown, and Load
// is offered again (deskUnslothRemoteApplyPublished). Nothing is asked meanwhile.
function deskUnslothRemoteLoad() {
  var pair = deskUnslothRemoteChosenPair();
  if (!pair.id || deskUnslothRemoteLoadTimer) return;
  var target = deskUnslothRemoteTarget;
  // THE HOURGLASS FROM THE PRESS (goal/G19.7): set before the ask, so an outcome published before the answer arrives
  // ends it (deskUnslothRemoteApplyPublished); set at the answer, it stuck when the refusal came first.
  deskUnslothRemoteLoadTimer = true;
  deskUnslothRemoteSay('', false);
  deskUnslothRemoteDrawModels();
  deskUnslothRemoteAsk(target, 'model.load', { id: pair.id, quant: pair.quant }).then(function (said) {
    if (target !== deskUnslothRemoteTarget) return;
    if (said && said.ok === false) {
      deskUnslothRemoteLoadTimer = null;
      deskUnslothRemoteSay((said.extra && said.extra.why) || said.error || said.code || 'the load was refused', true);
      deskUnslothRemoteDrawModels();
    }
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
    deskUnslothRemoteDrawAll();
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

// ── THE CHAT BOX, IN THE TEST TAB, WHEN A MODEL IS READY (goal/G10.7) ─
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
    if (l.role === 'log') return '<div class="job-manifest-note">' + escape(l.text) + '</div>';
    return '<div><b>' + (l.role === 'assistant' ? escape((deskUnslothRemoteState && deskUnslothRemoteState.persona) || 'model') : 'you') + ':</b> ' + escape(l.text) + '</div>';
  }).join('') + (deskUnslothRemoteChatBusy ? '<div class="job-manifest-note">' + deskUnslothRemoteIcon('LOADING') + '</div>' : '');
  display.scrollTop = display.scrollHeight;
  deskUnslothRemoteDrawAbort();
}

// THE ABORT (goal/G19.7). Andy, 2026-10-12: "an abort button, that is armed and comes alive whenever the model is
// working. i much would prefer manual intervention to automated aborting....." Beside the chat's Send, alive only
// while deskUnsloth says the model works; one press cancels the answer in flight and frees Levant.
function deskUnslothRemoteDrawAbort() {
  var button = document.getElementById('dur-abort');
  if (!button) return;
  button.disabled = !(deskUnslothRemoteState && deskUnslothRemoteState.working === true);
}
function deskUnslothRemoteAbort() {
  if (!deskUnslothRemoteState || deskUnslothRemoteState.working !== true) return;
  var target = deskUnslothRemoteTarget;
  deskUnslothRemoteAsk(target, 'abort', {}).then(function (said) {
    if (target !== deskUnslothRemoteTarget) return;
    if (said && said.ok === false) { deskUnslothRemoteSay((said.extra && said.extra.why) || said.error || said.code || 'the abort was refused', true); return; }
    deskUnslothRemoteSay('aborted: the model is free', false);
  });
}

function deskUnslothRemoteDrawChat() {
  var box = document.getElementById('dur-chat');
  if (!box) return;
  // A MODEL READY is no warning left (goal/G10.7): "if an model is ready in the OpenAI compatible server, the test
  // tab will show the chat interface."
  if (deskUnslothRemoteWarnings(deskUnslothRemoteState, deskUnslothRemoteModels).length) { box.innerHTML = ''; box.style.display = 'none'; return; }
  // Drawn once, then only its title and lines: the box holding the input is the sign it is there.
  if (String(box.innerHTML).indexOf('id="dur-chat-input"') !== -1) { box.style.display = ''; deskUnslothRemoteDrawChatTitle(); deskUnslothRemoteDrawChatLines(); return; }
  box.style.display = '';
  box.innerHTML =
    '<div class="label" id="dur-chat-title"></div>' +
    '<div id="dur-chat-display" class="card" style="height:25vh;overflow-y:auto;white-space:pre-wrap"></div>' +
    '<div class="start-job-form">' +
      '<input type="text" id="dur-chat-input" class="grow" placeholder="one line, Enter sends">' +
      '<button type="button" id="dur-chat-send">Send</button>' +
      ' <button type="button" id="dur-abort" disabled title="cancel the model\'s answer in flight">Abort</button>' +
    '</div>';
  var input = document.getElementById('dur-chat-input');
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); deskUnslothRemoteChatSend(); } });
  document.getElementById('dur-chat-send').addEventListener('click', deskUnslothRemoteChatSend);
  document.getElementById('dur-abort').addEventListener('click', deskUnslothRemoteAbort);
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
  var target = deskUnslothRemoteTarget;
  // The conversation alone goes to the model, never the log's lines (goal/G19.7).
  var conversation = deskUnslothRemoteTranscript.filter(function (l) { return l.role === 'user' || l.role === 'assistant'; });
  var payload = deskUnslothRemoteChatAskFor(target, 'chat.send', { lines: conversation });
  var rest = {};
  Object.keys(payload).forEach(function (k) { if (k !== 'verb') rest[k] = payload[k]; });
  deskUnslothRemoteApi.verb(payload.verb, rest).then(function (r) {
    var said = deskUnslothRemoteAnswerOf(target, r);
    if (!said || said.ok === false || !said.id) throw new Error((said && (said.error || said.code)) || 'the chat was refused');
    // THE ANSWER ARRIVES AS A PUBLISHED OBJECT (goal/G14.5): chat {id, done, text}, taken by
    // deskUnslothRemoteApplyPublished. Nothing is polled, and nothing gives up on it: since goal/G19.7 the model's
    // answer has no timeout, so the chat waits for the answer or for Abort, which publishes it done.
    deskUnslothRemoteChatPending = said.id;
  }).catch(function (e) {
    deskUnslothRemoteTranscript.push({ role: 'assistant', text: '(' + String((e && e.message) || e) + ')' });
    deskUnslothRemoteChatBusy = false;
    deskUnslothRemoteDrawChatLines();
  });
}

// THE WHERE DEFAULT, CHOSEN AT OPEN (goal/G10.7): whether desk runs on this node (its api), then each puppet in
// order asked for deskUnsloth's state; the first that answers is the target. One ask at a time, as the models ask.
// ITS OWN NODE FIRST (goal/G10.10). Andy, 2026-10-12: "if deskUnsloth lives on the same node as the Remote, we'll just
// automatically configure it to the same node, and never show this bubble." So deskUnsloth answering on this node is
// the target, and the where bubble is hidden; otherwise the choice of goal/G10.7 stands and the bubble shows.
var deskUnslothRemoteOwnNode = false;
function deskUnslothRemoteChooseTarget() {
  return deskUnslothRemoteAsk({ kind: 'node' }, 'state', {}).then(function (said) {
    deskUnslothRemoteOwnNode = !!(said && said.ok !== false && typeof said.connected === 'boolean');
    var where = document.getElementById('dur-where');
    if (where) where.style.display = deskUnslothRemoteOwnNode ? 'none' : '';
    return deskUnslothRemoteOwnNode ? 0 : deskUnslothRemoteChooseAmongPuppets();
  });
}
function deskUnslothRemoteChooseAmongPuppets() {
  var targets = deskUnslothRemoteTargets;
  return Promise.resolve(deskUnslothRemoteApi.verb('jobs.api', { ask: 'api' })).then(function (r) {
    var apps = r && r.status === 200 && r.body && typeof r.body === 'object' ? r.body : {};
    return !!apps.desk;
  }, function () { return false; }).then(function (hasDesk) {
    var answered = [];
    if (!hasDesk) return deskUnslothRemoteDefaultTarget(targets, false, answered);
    var i = 0;
    var next = function () {
      while (i < targets.length && targets[i].kind !== 'puppet') i++;
      if (i >= targets.length) return Promise.resolve(deskUnslothRemoteDefaultTarget(targets, true, answered));
      var at = i++;
      return deskUnslothRemoteAsk(targets[at], 'state', {}).then(function (said) {
        answered[at] = !!(said && said.ok !== false);
        return answered[at] ? deskUnslothRemoteDefaultTarget(targets, true, answered) : next();
      });
    };
    return next();
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    deskUnslothRemoteApi = api;
    deskUnslothRemoteContainer = container;
    deskUnslothRemoteTargets = deskUnslothRemoteReadTargets();
    deskUnslothRemoteTarget = deskUnslothRemoteTargets[0];

    var escape = api.escapeHtml || function (s) { return String(s); };
    // THE COLUMN IS AN INNER WRAPPER'S, NEVER THE CONTAINER'S (goal/G18.1). The shell hides an app it leaves with
    // hidden = true on this container (shell.js switchTo), and an inline display beats hidden: set here, it kept the
    // Remote on screen under every app. Andy, 2026-10-12: "every panel in desk and desk details now shows the
    // deskUnslothRemote. Needs fixing ASAP".
    // THE FRAME (goal/G10.7): the tab strip, the warnings above every tab, then one panel per tab, each filled below.
    container.innerHTML =
      '<div style="display:flex;flex-direction:column;min-height:100%">' +
      '<div class="stat-tile wide" style="flex:1 1 auto">' +
        '<div class="label">The local agent at the desk</div>' +
        '<div id="dur-tabs" class="start-job-form"></div>' +
        '<div id="dur-warnings" style="display:none"></div>' +
        '<div id="dur-note" class="job-manifest-note"></div>' +
        '<div id="dur-tab-test"></div>' +
        '<div id="dur-tab-configure"></div>' +
        '<div id="dur-tab-connect"></div>' +
      '</div>' +
      '</div>';
    // [test]: the chat, sticky at the bottom (his "sticky"), drawn only when a model is ready.
    document.getElementById('dur-tab-test').innerHTML =
      '<div class="stat-tile wide" id="dur-chat" style="position:sticky;bottom:0;display:none"></div>';
    // [configure]: the model selector bubble.
    document.getElementById('dur-tab-configure').innerHTML = '<div id="dur-models"></div>';
    // [connect]: where, the OpenAI compatible server, and the switch, in his order; where is "the first one that
    // needs setting properly".
    document.getElementById('dur-tab-connect').innerHTML =
      '<div class="start-job-form card" id="dur-where">' +
        '<label class="field-label grow">select the node where your local agent lives' +
          '<select id="dur-target">' +
            deskUnslothRemoteTargets.map(function (t, i) {
              return '<option value="' + i + '">' + escape(t.name) + '</option>';
            }).join('') +
          '</select>' +
        '</label>' +
      '</div>' +
      // THE PAIRS AND THE ADD FORM (goal/G18.6): the servers kept, by name, and a new one or a new key for one.
      '<div class="stat-tile wide"><div class="label">OpenAI compatible servers</div><div id="dur-pairs"></div></div>' +
      '<div class="start-job-form card">' +
        '<label class="field-label">name<input type="text" id="dur-pair-name" data-field="label" placeholder="openai"></label>' +
        '<label class="field-label grow">url' +
          '<input type="text" id="dur-server-url" placeholder="http://127.0.0.1:8888/v1">' +
        '</label>' +
        '<label class="field-label">key<input type="password" id="dur-server-key" placeholder="the server key"></label>' +
        '<button type="button" id="dur-server-save">Save and use</button>' +
      '</div>' +
      '<div class="job-manifest-note">Connected, the agent reads the desk and answers what is addressed to it, ' +
        'and the desk counts it live. Disconnected, it stops reading and signs off at once, so a phase that ' +
        'waits for a second agent does not wait for it.</div>' +
      '<div class="start-job-form card">' +
        '<div class="grow" id="dur-state">asking…</div>' +
        '<button type="button" id="dur-switch" disabled>Connect</button>' +
      '</div>';
    deskUnslothRemoteDrawTabs();

    document.getElementById('dur-tabs').addEventListener('click', function (e) {
      var t = e && e.target && e.target.getAttribute ? e.target.getAttribute('data-tab') : null;
      if (!t || DESK_UNSLOTH_REMOTE_TABS.indexOf(t) === -1) return;
      deskUnslothRemoteTab = t;
      deskUnslothRemoteDrawTabs();
    });
    document.getElementById('dur-target').addEventListener('change', function (e) {
      deskUnslothRemoteTarget = deskUnslothRemoteTargets[Number(e.target.value)] || deskUnslothRemoteTargets[0];
      deskUnslothRemoteState = null;
      deskUnslothRemoteModels = null;
      deskUnslothRemoteChosen = '';
      deskUnslothRemoteLoadTimer = null;
      // THE CHAT AND THE FLAGS WERE THE OLD TARGET'S (goal/G19.7): its transcript, its log, an answer it still owed
      // and a flip in flight are not the new target's.
      deskUnslothRemoteTranscript = [];
      deskUnslothRemoteLogSeen = 0;
      deskUnslothRemoteChatBusy = false;
      deskUnslothRemoteChatPending = '';
      deskUnslothRemoteBusy = false;
      deskUnslothRemoteTestArmed = false;
      deskUnslothRemoteDrawChatLines();
      var url = document.getElementById('dur-server-url');
      if (url) url.value = '';
      deskUnslothRemoteDrawModels();
      deskUnslothRemoteLoadState();
      deskUnslothRemoteLoadModels();
    });
    document.getElementById('dur-switch').addEventListener('click', deskUnslothRemoteFlip);
    document.getElementById('dur-server-save').addEventListener('click', deskUnslothRemoteSaveServer);
    document.getElementById('dur-pairs').addEventListener('click', deskUnslothRemotePairPress);
    // THE STREAM (goal/G14.5): every change of deskUnsloth's state, local or from the chosen puppet, through one
    // handler; the asks below paint the first time and are not repeated.
    if (typeof api.onPublished === 'function') {
      api.onPublished(function (obj, meta) {
        if (!deskUnslothRemoteTakesPublished(deskUnslothRemoteTarget, meta || { from: '' })) return;
        deskUnslothRemoteApplyPublished(obj);
      }, 'deskUnsloth');
    }
    deskUnslothRemoteDrawAll();
    deskUnslothRemoteChooseTarget().then(function (i) {
      deskUnslothRemoteTarget = deskUnslothRemoteTargets[i] || deskUnslothRemoteTargets[0];
      document.getElementById('dur-target').value = String(i);
      deskUnslothRemoteLoadState();
      deskUnslothRemoteLoadModels();
    });
  },
});
