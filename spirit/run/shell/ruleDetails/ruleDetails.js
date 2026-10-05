// spirit/run/shell/ruleDetails/ruleDetails.js
// ONE RULE OF THE DESK, AS A DIALOG — goal/G6.4, beside deskDetails.
//
//   Andy, FACE.md (ruleDetails): the header area "it's upper edge sticks to the the lower edge of the shell's titlebar,
//   when the user scrolls down in the dialog"; the version button his alone: "i prefer to negotiate, and create an
//   updated version with one button/verb that belongs to me."; no older versions shown: "No. the agents know it, and
//   can bring it up, if neccessary."; the text box "does NOT have triggers like cap and split, because the text is
//   edited by the user."
//
// WHAT COMES FROM WHERE. open({key}) asks the desk server rule.get and the rule's chat (item.chat under the rule's
// key), through jobs.api as deskDetails does. The textbox is his: it shows his draft when there is one, else the
// rule's text, and every change is saved as his draft (rule.draft) until Version makes it the rule (rule.version).
// Activate and Delete are each one version with that status, both armed: the first press asks, the second sends.

var rdApi = null;
var rdKey = '';
var rdRule = null;           // the rule as the server last said it
var rdChat = [];
var rdChatMore = false;
var rdArmed = '';            // the id of the armed button, pressed once
var rdNote = '';

function rdEsc(s) { return rdApi.escapeHtml(String(s == null ? '' : s)); }

// The one way to the desk server: jobs.api on the loopback door.
function rdAsk(verb, args) {
  var desk = {};
  desk[verb] = args;
  return Promise.resolve(rdApi.verb('jobs.api', { ask: { desk: desk } })).then(function (r) {
    var body = (r && r.body) || {};
    if (body.ok === false) { var e = new Error(String(body.code || 'refused') + (body.error ? ' (' + body.error + ')' : '')); e.refused = true; throw e; }
    return body;
  });
}
// A write of Andy's; a refusal shows under the chat input.
function rdWrite(verb, args) {
  return rdAsk(verb, args).then(function () { rdNote = ''; return true; }, function (e) {
    rdNote = 'Not taken: ' + e.message;
    rdPaint();
    return false;
  });
}
function rdDisarm() { rdArmed = ''; rdPaint(); }

// ── THE FRAME, DRAWN ONCE PER OPEN: the inputs are never repainted, so his typing survives every paint.
function rdFrame() {
  var el = document.getElementById('rd-body');
  if (!el) return;
  el.innerHTML =
    '<div id="rd-bars" style="padding-bottom:2px">' +
      '<div id="rd-head" style="font-size:1.25em;font-weight:bold"></div>' +
      '<div class="start-job-form card" id="rd-buttons"></div>' +
    '</div>' +
    '<div class="start-job-form card"><label class="field-label grow">Rule' +
      '<textarea id="rd-text" rows="12" placeholder="the rule, as it should read"></textarea></label></div>' +
    '<div class="start-job-form card"><label class="field-label grow">Say' +
      '<textarea id="rd-say" rows="3" placeholder="under this rule"></textarea></label>' +
      '<button type="button" id="rd-say-send">Send</button></div>' +
    '<div id="rd-error" class="job-start-error"></div>' +
    '<div class="stat-tile wide"><div class="label">Chat, newest first</div><div id="rd-chat"></div></div>';
  rdHeader();
}
// THE HEADER AREA IS THE SHELL'S (goal/G6.1): the block written as #rd-bars moves into the app header, which sticks it
// under the titlebar, and takes its id. As deskDetails' ddHeader.
function rdHeader() {
  var old = document.getElementById('rd-bars');
  var els = rdApi && rdApi.ui && rdApi.ui.elements;
  if (!old || !els || typeof els.createAppHeader !== 'function') return;
  var head = els.createAppHeader();
  head.id = 'rd-bars';
  head.style.paddingBottom = '2px';
  while (old.firstChild) head.appendChild(old.firstChild);
  if (old.parentNode) old.parentNode.replaceChild(head, old);
}

function rdHeadHtml() {
  if (!rdRule) return rdEsc(rdKey);
  return rdEsc(rdRule.key || rdKey) + ' — ' + rdEsc(rdRule.label || '') +
    ' <span class="job-manifest-note">' + rdEsc(rdRule.type || '') + ', ' + rdEsc(rdRule.status || '') + '</span>';
}
function rdButtonsHtml() {
  var armedButton = function (id, label, sure) {
    return '<button type="button" id="' + id + '"' + (rdArmed === id ? ' data-armed="1"' : '') + '>' + (rdArmed === id ? sure : label) + '</button>';
  };
  return '<button type="button" id="rd-version">Version</button>' +
    armedButton('rd-activate', 'Activate', 'Activate: sure?') +
    armedButton('rd-delete', 'Delete', 'Delete: sure?');
}

// CHAT LINES AS deskDetails DRAWS THEM (goal/G6.2): every line a bubble, left-aligned, 1em apart; line breaks kept,
// short times, '- ' lines as a list, backquoted text as code, still escaped.
function rdTime(at) {
  var d = new Date(at);
  if (isNaN(d.getTime())) return rdEsc(at);
  var two = function (n) { return (n < 10 ? '0' : '') + n; };
  return two(d.getHours()) + ':' + two(d.getMinutes());
}
function rdLineHtml(text) {
  var out = [];
  var list = [];
  var flush = function () { if (list.length) { out.push('<ul style="margin:2px 0 2px 18px">' + list.join('') + '</ul>'); list = []; } };
  String(text || '').split('\n').forEach(function (raw) {
    var line = rdEsc(raw).replace(/`([^`]+)`/g, '<code>$1</code>');
    if (/^- /.test(raw)) { list.push('<li>' + line.slice(2) + '</li>'); return; }
    flush();
    out.push(line);
  });
  flush();
  return out.join('<br>').replace(/<br>(<ul)/g, '$1').replace(/(<\/ul>)<br>/g, '$1');
}
function rdChatHtml() {
  if (!rdChat.length) return '<div class="job-manifest-note">Nothing said here yet.</div>';
  var older = rdChatMore ? '<div class="job-manifest-note">Older lines are not shown.</div>' : '';
  return rdChat.slice().reverse().map(function (l) {
    var his = l.by === 'andy';
    var look = his
      ? ' style="margin:1em 0;padding:6px 10px;background:#000;color:#fff;border-radius:var(--spirit-radius,8px)"'
      : ' style="margin:1em 0;padding:6px 10px;background:rgba(255,255,255,0.08);border-radius:var(--spirit-radius,8px)"';
    return '<div' + look + '><b>' + rdEsc(his ? 'you' : l.by) + '</b> <span class="job-manifest-note">' + rdTime(l.at) + '</span> ' +
      rdLineHtml(l.text) + '</div>';
  }).join('') + older;
}

function rdSet(id, html) { var el = document.getElementById(id); if (el) el.innerHTML = html; }
// Repaints everything but the two textboxes.
function rdPaint() {
  rdSet('rd-head', rdHeadHtml());
  rdSet('rd-buttons', rdButtonsHtml());
  rdSet('rd-chat', rdChatHtml());
  var err = document.getElementById('rd-error');
  if (err) err.textContent = rdNote;
  if (rdRule && typeof rdApi.setScreenTitle === 'function') rdApi.setScreenTitle(rdKey + ' — ' + (rdRule.label || ''));
}
// The textbox takes the server's words only when the rule is (re)read: his draft over the rule's text.
function rdFill() {
  var box = document.getElementById('rd-text');
  if (box && rdRule) box.value = rdRule.draft ? String(rdRule.draft) : String(rdRule.text || '');
}
function rdText() { var el = document.getElementById('rd-text'); return el ? String(el.value || '') : ''; }

// The rule and its chat as the server has them now: at open, and after each of his versions.
function rdLoadRule() {
  var key = rdKey;
  return rdAsk('rule.get', { key: key }).then(function (r) {
    if (rdKey !== key) return;
    rdRule = r;
    rdFill();
    rdPaint();
  });
}
function rdLoadChat() {
  var key = rdKey;
  return rdAsk('item.chat', { id: key }).then(function (c) {
    if (rdKey !== key) return;
    rdChat = c.chat || [];
    rdChatMore = !!c.chatMore;
    rdPaint();
  });
}
function rdLoad() {
  return Promise.all([rdLoadRule(), rdLoadChat()]).then(null, function (e) {
    rdNote = (e && e.refused ? 'Refused: ' : 'The desk server did not answer: ') + e.message;
    rdPaint();
  });
}

// ONE VERSION, ONE PRESS (rule.version {key, text, status}): the textbox as it stands, with the status given.
function rdVersion(status) {
  if (!rdRule) return;
  rdWrite('rule.version', { key: rdKey, text: rdText(), status: status }).then(function (taken) { if (taken) rdLoadRule(); });
}

var rdSending = false;
function rdSay() {
  var el = document.getElementById('rd-say');
  var text = el ? String(el.value || '').trim() : '';
  if (!text || rdSending) return;
  rdSending = true;
  rdWrite('chat.add', { id: rdKey, text: text }).then(function (taken) {
    rdSending = false;
    if (taken && el) el.value = '';
    if (taken) rdLoadChat();
  });
}

spirit.shell.activateApp({
  mount: function (container, api) {
    rdApi = api;
    container.innerHTML = '<div id="rd-body" class="stack"></div>';
    var body = document.getElementById('rd-body');
    body.addEventListener('click', function (event) {
      var id = event.target && event.target.id;
      if (id === 'rd-version') { rdVersion(rdRule ? rdRule.status : ''); return; }
      if (id === 'rd-activate' || id === 'rd-delete') {
        if (rdArmed !== id) {
          rdArmed = id;
          rdPaint();
          if (typeof rdApi.armUntilElsewhere === 'function') rdApi.armUntilElsewhere(rdDisarm);
          return;
        }
        rdArmed = '';
        rdVersion(id === 'rd-activate' ? 'active' : 'deleted');
        return;
      }
      if (id === 'rd-say-send') rdSay();
    });
    // HIS DRAFT, SAVED AS HE GOES (rule.draft; rule.get reads it back) until his Version.
    body.addEventListener('change', function (event) {
      if (event.target && event.target.id === 'rd-text' && rdKey) rdWrite('rule.draft', { key: rdKey, text: rdText() });
    });
    // The desk server's changes: a publish naming this rule reads it again (its chat and its versions).
    if (typeof api.onPublished === 'function') {
      api.onPublished(function (obj) {
        if (!rdKey || !obj) return;
        var said = '';
        try { said = JSON.stringify(obj); } catch (e) { said = ''; }
        if (said.indexOf('"' + rdKey + '"') === -1) return;
        rdLoadChat();
      }, 'desk');
    }
  },

  // Every call: which rule this is. Nothing stale from the last one.
  open: function (params) {
    rdKey = String((params && params.key) || '');
    rdRule = null;
    rdChat = [];
    rdChatMore = false;
    rdArmed = '';
    rdNote = '';
    rdFrame();
    rdPaint();
    return rdLoad();
  },
});
