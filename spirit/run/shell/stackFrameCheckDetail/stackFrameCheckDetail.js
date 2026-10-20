// spirit/run/shell/stackFrameCheckDetail/stackFrameCheckDetail.js
// ONE STACK-FRAME DOOR, AS A DIALOG (goal/G27.2).
//
// DECIDED BY ANDY, 2026-10-17, in goal/G27.2's box, not this file's to undo:
//   D1. the door's detail is this shell dialog, opened from the Stacks pane with
//       callDialog('shell/stackFrameCheckDetail', { id }); the pane draws no detail of its own.
//   D2. it reads and writes the door only through the plugin's verbs (stackFrameChecks.doors, update, run, runState,
//       remove), by name (desk.<verb>) to the desk server, as deskDetails asks.
//   D3. its chat is the chat of the door's item (the door's `item`), the shared chat element (shell/shared/js/deskChat.js).
//   D5. Run runs this one door at once, in the plugin, outside deskVerify's queue; the plugin hands the verdict to
//       deskVerify as a record only. So the run, its time and its verdict show here; there is no Verifier console to go to.
//   D7. a door is deleted here alone: Remove, armed by its first press and sent by the second, strikes the door and
//       deletes its item (the plugin does both), and the dialog closes.
//
// The fields are the shared door fields (shell/shared/js/deskDoorFields.js), as the pane's add form uses them; both
// shared elements load on demand (Andy, 2026-10-17: "it is ok for apps to know about other apps and their shared
// elements").

var sdApi = null;
var sdBody = null;
var sdId = '';
var sdDoor = null;       // the door as the plugin last read it
var sdRun = null;        // its last runState
var sdTicker = null;     // the elapsed-time tick while its run is under way
var sdTicks = 0;
var sdArmed = '';        // the armed button's id
var sdChat = null;       // the mounted chat of its item
var SD_PRE = 'sfcd-';
var SD_SHARED = { deskDoorFields: '/shell/shared/js/deskDoorFields.js', createDeskChat: '/shell/shared/js/deskChat.js' };

function sdEsc(s) { return sdApi && sdApi.escapeHtml ? sdApi.escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function sdWhen(iso) { return iso ? String(iso).replace('T', ' ').replace(/\.\d+Z$/, 'Z') : ''; }
function sdElements() { return (typeof window !== 'undefined' && window.spiritElements) || {}; }
// A shared element, loaded once per page when it is not there yet.
function sdNeed(name, done) {
  if (sdElements()[name]) { done(); return; }
  if (typeof document === 'undefined' || typeof document.createElement !== 'function' || !document.body) return;
  var script = document.createElement('script');
  script.src = SD_SHARED[name];
  script.onload = done;
  document.body.appendChild(script);
}

// The one way to the desk server: its verb by name on the loopback door (desk.<verb>, goal/G30.6), as deskDetails asks.
function sdAsk(verb, args) {
  return Promise.resolve(sdApi.verb('desk.' + verb, args)).then(function (r) {
    var body = (r && r.body) || {};
    if (body.ok === false) {
      var x = body.extra || {};
      throw new Error(x.why ? String(x.why) : String(body.code || 'refused') + (body.error ? ' (' + body.error + ')' : ''));
    }
    return body;
  });
}
function sdSay(text) { var el = document.getElementById('sfcd-note'); if (el) el.textContent = String(text || ''); }
function sdErr(e) { return (e && e.message) || String(e); }

// The frame, drawn once per open: the door's fields, its buttons, the note, its run, then its item's chat.
// Every block a leading 1em; each button 1em after itself (the desk's UI rules).
function sdFrame() {
  var F = sdElements().deskDoorFields;
  var armed = sdArmed === 'sfcd-remove';
  sdBody.innerHTML =
    '<div class="stat-tile wide" style="margin-top:1em"><div class="label" id="sfcd-head">Door ' + sdEsc(sdId) + '</div>' +
      '<div class="start-job-form card" style="margin-top:1em">' + (F ? F.html(SD_PRE) : '<div class="job-manifest-note">Loading the door\'s fields.</div>') +
        '<div style="margin-top:1em"><button type="button" id="sfcd-save" style="margin-right:1em">Save</button>' +
        '<button type="button" id="sfcd-run" style="margin-right:1em">Run</button>' +
        '<button type="button" id="sfcd-remove" data-armed="' + (armed ? '1' : '') + '" style="margin-right:1em">' + (armed ? 'Remove: sure?' : 'Remove') + '</button></div>' +
        '<div class="job-manifest-note" style="margin-top:1em">Run checks this one door at once, here; its verdict also goes to deskVerify as a record. ' +
          'Remove strikes the door from the list and deletes its item.</div></div>' +
      '<div id="sfcd-note" class="job-start-error" style="margin-top:1em"></div>' +
      '<div id="sfcd-state" style="margin-top:1em"></div>' +
    '</div>' +
    '<div id="sfcd-chat"></div>';
}
function sdFill() {
  var F = sdElements().deskDoorFields;
  var head = document.getElementById('sfcd-head');
  if (head) head.textContent = 'Door ' + sdId + (sdDoor && sdDoor.item ? ', asked by ' + sdDoor.item : '');
  if (!F || !sdDoor) return;
  F.fill(SD_PRE, sdDoor);
  F.check(SD_PRE, 'sfcd-save');
}
function sdDrawRemove() {
  var b = document.getElementById('sfcd-remove');
  if (!b) return;
  var armed = sdArmed === 'sfcd-remove';
  b.textContent = armed ? 'Remove: sure?' : 'Remove';
  if (b.setAttribute) b.setAttribute('data-armed', armed ? '1' : '');
}
function sdDisarm() { sdArmed = ''; sdDrawRemove(); }

// ── ITS RUN ──────────────────────────────────────────────────────────
function sdStopTicking() { if (sdTicker) { clearTimeout(sdTicker); sdTicker = null; } }
function sdDrawRun() {
  var el = document.getElementById('sfcd-state');
  if (!el) return;
  var r = sdRun;
  if (!r) { el.innerHTML = '<div class="job-manifest-note">Reading its last run.</div>'; return; }
  if (r.running) {
    var secs = Math.max(0, Math.round((Date.now() - Date.parse(r.startedAt)) / 1000)) || 0;
    el.innerHTML = '<div class="label">Its run</div><div>running, ' + secs + ' s, since ' + sdEsc(sdWhen(r.startedAt)) + '</div>';
    return;
  }
  var v = r.verdict || {};
  var head;
  if (!r.endedAt) head = '<div class="job-manifest-note">never run' + (v.why && v.why !== 'never run' ? ': ' + sdEsc(v.why) : '') + '</div>';
  else if (!v.ran) head = '<div class="job-start-error">' + (r.stopped ? 'stopped' : 'no verdict') + (v.why ? ': ' + sdEsc(v.why) : '') + ', ' + sdEsc(sdWhen(r.endedAt)) + '</div>';
  else if (v.green) head = '<div class="job-manifest-note">green: ' + v.of + ' production call(s), every one through the gate, ' + sdEsc(sdWhen(r.endedAt)) + '</div>';
  else head = '<div class="job-start-error">red: ' + v.around + ' path(s) around the gate, of ' + v.of + ' production call(s), ' + sdEsc(sdWhen(r.endedAt)) + '</div>';
  // ONE LINE PER VIOLATOR (goal/G22.3), made by the server half (violators.js); the raw paths folded below them.
  var said = (Array.isArray(v.violators) ? v.violators : []).map(function (p) { return '<div class="sfc-violator" style="margin-top:0.25em">' + sdEsc(p) + '</div>'; }).join('');
  var saidLeft = Number(v.violatorsLeft) > 0 ? '<div class="job-manifest-note">and ' + v.violatorsLeft + ' more violator(s)</div>' : '';
  var raw = Array.isArray(v.paths) ? v.paths : [];
  var paths = raw.map(function (p) { return '<div class="sfc-path" style="margin-top:0.25em">' + sdEsc(p) + '</div>'; }).join('');
  var left = Number(v.pathsLeft) > 0 ? '<div class="job-manifest-note">and ' + v.pathsLeft + ' more, kept with the run</div>' : '';
  var folded = raw.length ? '<details style="margin-top:1em"><summary class="job-manifest-note">raw paths (' + (raw.length + (Number(v.pathsLeft) || 0)) + ')</summary>' + paths + left + '</details>' : '';
  el.innerHTML = '<div class="label">Its run</div>' + head + (v.ran && v.why ? '<div class="job-manifest-note">' + sdEsc(v.why) + '</div>' : '') + said + saidLeft + folded;
}
// While its run is under way the elapsed time ticks each second, and every fifth tick asks again in case a published
// end was missed; the plugin's publish is what normally says it ended.
function sdTick() {
  sdStopTicking();
  if (!sdRun || !sdRun.running || !sdId) return;
  sdTicker = setTimeout(function () {
    sdTicker = null;
    sdTicks++;
    if (sdTicks % 5 === 0) sdReadRun(); else { sdDrawRun(); sdTick(); }
  }, 1000);
}
function sdReadRun() {
  var id = sdId;
  if (!id) return Promise.resolve();
  return sdAsk('stackFrameChecks.runState', { id: id }).then(function (r) {
    if (sdId !== id) return;
    sdRun = r || null;
    sdDrawRun();
    sdTick();
  }, function (e) { if (sdId === id) sdSay('Its run could not be read: ' + sdErr(e)); });
}
// The door as the plugin holds it, read from its list.
function sdReadDoor() {
  var id = sdId;
  return sdAsk('stackFrameChecks.doors', {}).then(function (r) {
    if (sdId !== id) return;
    sdDoor = ((r && r.doors) || []).filter(function (d) { return d && d.id === id; })[0] || null;
    if (!sdDoor) { sdSay('The list has no door ' + id + ' any more.'); return; }
    sdFill();
    sdMountChat();
  }, function (e) { if (sdId === id) sdSay('The door could not be read: ' + sdErr(e)); });
}
// ITS ITEM'S CHAT (D3), mounted once the door names its item.
function sdMountChat() {
  if (sdChat || !sdDoor || !sdDoor.item) return;
  var item = sdDoor.item;
  var id = sdId;
  sdNeed('createDeskChat', function () {
    var make = sdElements().createDeskChat;
    var el = document.getElementById('sfcd-chat');
    if (sdChat || sdId !== id || typeof make !== 'function' || !el) return;
    sdChat = make(el, { id: item, ask: sdAsk, escape: sdEsc, title: 'Chat of ' + item + ', the door\'s item',
      onPublished: function (fn) { return typeof sdApi.onPublished === 'function' ? sdApi.onPublished(fn, 'desk') : null; } });
  });
}

// ── ITS BUTTONS ──────────────────────────────────────────────────────
function sdSave() {
  var F = sdElements().deskDoorFields;
  if (!F) return;
  var id = sdId;
  var wrong = F.FIELDS.map(function (f) { return F.why(SD_PRE, f); }).filter(Boolean)[0];
  if (wrong) { sdSay('Not saved: ' + wrong); return; }
  var d = F.door(SD_PRE);
  sdSay('Sent; waiting for the desk.');
  sdAsk('stackFrameChecks.update', { id: id, gate: d.gate, endpoint: d.endpoint, paths: d.paths, suites: d.suites }).then(function () {
    sdSay('Saved. Its last verdict is cleared: it described the door as it was.');
    sdReadRun();
  }, function (e) { sdSay('Not saved: ' + sdErr(e)); });
}
function sdRunIt() {
  var id = sdId;
  sdSay('Starting its run.');
  sdAsk('stackFrameChecks.run', { id: id }).then(function (r) {
    sdSay((r && r.said) || ('Door ' + id + ' is running.'));
    sdReadRun();
  }, function (e) { sdSay('Not started: ' + sdErr(e)); });
}
function sdRemove() {
  var id = sdId;
  sdAsk('stackFrameChecks.remove', { id: id }).then(function () {
    if (typeof sdApi.closeDialog === 'function') sdApi.closeDialog({ removed: id });
  }, function (e) { sdSay('Not removed: ' + sdErr(e)); });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    sdApi = api;
    sdBody = container;
    // One listener of each on the container, which is repainted at every open.
    container.addEventListener('click', function (event) {
      var t = event && event.target;
      var id = t && t.id;
      if (id === 'sfcd-save') { sdDisarm(); sdSave(); return; }
      if (id === 'sfcd-run') { sdDisarm(); sdRunIt(); return; }
      if (id === 'sfcd-remove') {
        // ARMED (D7, and his rule for every armed button, armedButtons.js): the first press arms and asks, a click
        // anywhere else disarms, the second press removes.
        if (sdArmed !== id) {
          sdArmed = id;
          sdDrawRemove();
          if (typeof api.armUntilElsewhere === 'function') api.armUntilElsewhere(sdDisarm);
          return;
        }
        sdArmed = '';
        sdDrawRemove();
        sdRemove();
      }
    });
    container.addEventListener('input', function (event) {
      var t = event && event.target;
      var F = sdElements().deskDoorFields;
      var f = t && t.getAttribute ? t.getAttribute('data-field') : null;
      if (F && F.FIELDS.indexOf(f) !== -1) F.check(SD_PRE, 'sfcd-save');
    });
    // The plugin's own publishes ({ plugin: 'stackFrameChecks', data: { what, id } }): this door changed or its run
    // started or ended.
    if (typeof api.onPublished === 'function') {
      api.onPublished(function (obj) {
        if (!obj || obj.plugin !== 'stackFrameChecks' || !sdId) return;
        var data = obj.data || {};
        if (data.id && data.id !== sdId) return;
        if (data.what === 'run') sdReadRun();
        else { sdReadDoor(); sdReadRun(); }
      }, 'desk');
    }
  },

  // Every call: which door this is. Nothing stale from the last one.
  open: function (params) {
    sdId = String((params && params.id) || '');
    sdDoor = null;
    sdRun = null;
    sdArmed = '';
    sdTicks = 0;
    sdStopTicking();
    if (sdChat && typeof sdChat.destroy === 'function') sdChat.destroy();
    sdChat = null;
    sdFrame();
    sdDrawRun();
    var first = Promise.all([sdReadDoor(), sdReadRun()]);
    // Its fields arrive with the shared element: drawn again then, the door's values put back.
    if (!sdElements().deskDoorFields) {
      var id = sdId;
      sdNeed('deskDoorFields', function () {
        if (sdId !== id) return;
        if (sdChat && typeof sdChat.destroy === 'function') sdChat.destroy();
        sdChat = null;
        sdFrame(); sdFill(); sdDrawRun(); sdMountChat();
      });
    }
    return first;
  },
});
