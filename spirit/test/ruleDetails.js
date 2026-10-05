'use strict';

// goal/G6.4: ruleDetails, the new dialog app: header area, version, activate and delete, the textbox as draft, the
// rule chat.
//   The box: "The header area (goal/G6.1), its top edge held under the titlebar: title key and label; buttons: the
//   version button, his alone (rule.version {key, text, status}: "i prefer to negotiate, and create an updated version
//   with one button/verb that belongs to me."), activate (armable) and delete, each one quick version with that
//   status." / "The textbox of the rule, edited by him, saved as his draft (rule.draft; rule.get reads it back) until
//   the version button." / "No older versions shown" / "The chat area, styled like deskDetails': chat.add and
//   item.chat under rule/N; "this box does NOT have triggers like cap and split, because the text is edited by the
//   user."" / "Where: a new shell app, shell/ruleDetails, beside shell/deskDetails."
// The contract the builder follows (claude-windows's picks where the box names no shape):
//   - shell/ruleDetails/ruleDetails.js and ruleDetails.json (type dialog), opened as callDialog('shell/ruleDetails',
//     {key}); open(params) reads params.key. The desk is asked as deskDetails asks it: api.verb('jobs.api',
//     {ask: {desk: {<verb>: args}}}).
//   - Ids as deskDetails' with rd- for dd-: #rd-body holds the clicks; #rd-text the rule's textbox; #rd-version,
//     #rd-activate, #rd-delete the buttons; #rd-say and #rd-say-send the chat input and its Send.
//   - The header is api.ui.elements.createAppHeader() (goal/G6.1), and it carries the key and the label.
//   - The textbox shows his draft when there is one, else the rule's text; a change event on it saves rule.draft
//     {key, text}.
//   - Version sends rule.version {key, text: the textbox as it stands, status: the rule's status as it is}.
//   - Activate is armed: the first press sends nothing, the second sends rule.version with status active.
//   - Delete ends in one rule.version with status deleted (whether it is armed too is his to say: a Q check).

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');
const kernel = require('../run/js/kernel.js');

const OWED = 'OWED by goal/G6.4: ';
const DIR = path.join(__dirname, '..', 'run', 'shell', 'ruleDetails');
const APP = path.join(DIR, 'ruleDetails.js');
const MANIFEST = path.join(DIR, 'ruleDetails.json');

function settle() { return new Promise(function (r) { setImmediate(r); }); }
async function settled() { for (let i = 0; i < 8; i++) await settle(); }

function fakeElement(id) {
  let html = '';
  const el = {
    id: id, value: '', textContent: '', hidden: false, disabled: false, style: {}, listeners: {}, placeholder: '',
    addEventListener: function (type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
    fire: function (type, event) { (el.listeners[type] || []).forEach(function (fn) { fn(event || {}); }); },
    querySelectorAll: function () { return []; }, querySelector: function () { return null; },
    getAttribute: function () { return null; }, setAttribute: function () {}, focus: function () {},
    appendChild: function () {}, removeChild: function () {}, replaceChild: function () {},
  };
  Object.defineProperty(el, 'innerHTML', { get: function () { return html; }, set: function (v) { html = String(v); }, enumerable: true });
  return el;
}

const LONG = 'RULE-TEXT ' + 'x'.repeat(1890);
function rule(draft) {
  return { key: 'rule/3', label: 'LABEL-TEXT', type: 'ui', status: 'proposed', text: draft ? 'RULE-TEXT' : LONG, draft: draft || '', at: '2026-10-06T00:00:00.000Z', by: 'claude-windows' };
}

function dialog(draft) {
  const byId = {};
  const doc = { getElementById: function (id) { return byId[id] || (byId[id] = fakeElement(id)); } };
  let app = null;
  new Function('spirit', 'document', 'window', fs.readFileSync(APP, 'utf8'))(
    { shell: { activateApp: function (x) { app = x; } }, core: kernel.core }, doc, { addEventListener: function () {} });
  const calls = [];
  let headers = 0;
  const header = fakeElement('');
  app.mount(fakeElement('rd'), {
    escapeHtml: kernel.core.util.escapeHtml,
    ui: { elements: { createAppHeader: function () { headers += 1; return header; } } },
    verb: function (name, body) {
      const ask = name === 'jobs.api' && body && body.ask && body.ask.desk;
      const v = ask && Object.keys(ask)[0];
      if (!v) return Promise.resolve({ status: 200, body: {} });
      calls.push({ verb: v, args: ask[v] });
      if (v === 'rule.get') return Promise.resolve({ status: 200, body: rule(draft) });
      if (v === 'item.chat') return Promise.resolve({ status: 200, body: { chat: [{ by: 'wsl-claude', at: '2026-10-06T00:00:01.000Z', text: 'CHAT-LINE', taken: '' }], chatMore: false } });
      if (v === 'rule.history') {
        return Promise.resolve({ status: 200, body: { items: [{ key: '1', label: JSON.stringify({ at: '', by: 'andy', type: 'ui', label: 'LABEL-TEXT', status: 'proposed', text: 'OLD-TEXT' }) }], more: false } });
      }
      return Promise.resolve({ status: 200, body: { key: 'rule/3', change: 1 } });
    },
    onPublished: function () { return function () {}; }, onPacket: function () { return function () {}; },
    setScreenTitle: function () {}, setDialogResult: function () {}, closeDialog: function () {},
    peerPost: function () { return Promise.resolve({ ok: true }); }, armUntilElsewhere: function () {},
    fs: { loadFile: function () { return null; }, saveFile: function () { return Promise.resolve(); } },
  });
  const opened = app.open({ key: 'rule/3' });
  // An event bubbles: the element's own listeners, then #rd-body's.
  const fire = function (type, id) {
    const el = doc.getElementById(id);
    const target = { id: id, value: el.value, getAttribute: function () { return null; }, closest: function () { return null; }, parentNode: null };
    const event = { target: target, key: '', preventDefault: function () {}, stopPropagation: function () {} };
    el.fire(type, event);
    if (id !== 'rd-body') doc.getElementById('rd-body').fire(type, event);
  };
  const screen = function () {
    return Object.keys(byId).map(function (k) { return byId[k].innerHTML + ' ' + byId[k].textContent + ' ' + byId[k].value; }).join(' ') +
      ' ' + header.innerHTML + ' ' + header.textContent;
  };
  return { doc: doc, calls: calls, headers: function () { return headers; }, fire: fire, screen: screen, opened: opened,
    sent: function (verb) { return calls.filter(function (c) { return c.verb === verb; }); } };
}
function showsText(d, text) {
  const el = d.doc.getElementById('rd-text');
  return el.value.indexOf(text) !== -1 || el.innerHTML.indexOf(text) !== -1 || /<textarea[^>]*id="rd-text"[^>]*>([\s\S]*?)<\/textarea>/.test(d.screen()) && RegExp.$1.indexOf(text) !== -1;
}

test.startTest('goal/G6.4: ruleDetails, the rule\'s dialog');

(async function () {
  test.subHeading('1. a dialog app of its own, beside deskDetails');
  if (!fs.existsSync(APP)) {
    test.fail(OWED + 'no spirit/run/shell/ruleDetails/ruleDetails.js');
    return;
  }
  let manifest = null;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { manifest = null; }
  if (manifest && manifest.type === 'dialog') test.check('ruleDetails.json says type dialog');
  else test.fail(OWED + 'ruleDetails.json is missing or not a dialog: ' + JSON.stringify(manifest));

  test.subHeading('2. the header area: key, label and his buttons');
  const a = dialog('DRAFT-TEXT');
  await a.opened;
  await settled();
  const s = a.screen();
  if (a.headers() === 1 && /rule\/3/.test(s) && /LABEL-TEXT/.test(s)) test.check('the header comes from createAppHeader(), and the key and the label show');
  else test.fail(OWED + 'createAppHeader called ' + a.headers() + ' times, key shown ' + /rule\/3/.test(s) + ', label shown ' + /LABEL-TEXT/.test(s));
  const btn = function (id) { return new RegExp('<button[^>]*id="' + id + '"').test(a.screen()); };
  if (btn('rd-version') && btn('rd-activate') && btn('rd-delete')) test.check('the Version, Activate and Delete buttons are there');
  else test.fail(OWED + 'buttons: version ' + btn('rd-version') + ', activate ' + btn('rd-activate') + ', delete ' + btn('rd-delete'));

  test.subHeading('3. the textbox is his draft');
  if (a.sent('rule.get').some(function (c) { return c.args.key === 'rule/3'; }) && showsText(a, 'DRAFT-TEXT')) test.check('the textbox shows his draft over the rule\'s text');
  else test.fail(OWED + 'rule.get asked ' + a.sent('rule.get').length + ' times, the textbox shows the draft ' + showsText(a, 'DRAFT-TEXT'));
  a.doc.getElementById('rd-text').value = 'EDITED';
  a.fire('change', 'rd-text');
  await settled();
  const drafts = a.sent('rule.draft');
  if (drafts.length >= 1 && drafts[drafts.length - 1].args.key === 'rule/3' && drafts[drafts.length - 1].args.text === 'EDITED') test.check('a change to the textbox saves rule.draft {key, text}');
  else test.fail(OWED + 'after a change, rule.draft sent ' + JSON.stringify(drafts.map(function (c) { return c.args; })));

  test.subHeading('4. Version: one press, the textbox as it stands, the status as it is');
  a.fire('click', 'rd-version');
  await settled();
  const v = a.sent('rule.version');
  if (v.length === 1 && v[0].args.key === 'rule/3' && v[0].args.text === 'EDITED' && v[0].args.status === 'proposed') test.check('Version sends rule.version {key, text, status: proposed}');
  else test.fail(OWED + 'Version sent ' + JSON.stringify(v.map(function (c) { return c.args; })));

  test.subHeading('5. Activate is armed; Delete versions it deleted');
  const b = dialog('DRAFT-TEXT');
  await b.opened;
  await settled();
  b.fire('click', 'rd-activate');
  await settled();
  const armed = b.sent('rule.version').length === 0;
  b.fire('click', 'rd-activate');
  await settled();
  const act = b.sent('rule.version');
  if (armed && act.length === 1 && act[0].args.status === 'active' && act[0].args.key === 'rule/3') test.check('the first Activate sends nothing, the second sends rule.version with status active');
  else test.fail(OWED + 'Activate: nothing after the first press ' + armed + ', then ' + JSON.stringify(act.map(function (c) { return c.args; })));
  const c = dialog('DRAFT-TEXT');
  await c.opened;
  await settled();
  c.fire('click', 'rd-delete');
  await settled();
  if (c.sent('rule.version').length === 0) { c.fire('click', 'rd-delete'); await settled(); }
  const del = c.sent('rule.version');
  if (del.length === 1 && del[0].args.status === 'deleted' && del[0].args.key === 'rule/3') test.check('Delete ends in one rule.version with status deleted');
  else test.fail(OWED + 'Delete sent ' + JSON.stringify(del.map(function (x) { return x.args; })));

  test.subHeading('6. no older versions, no cap and no split');
  const d = dialog('');
  await d.opened;
  await settled();
  if (d.sent('rule.history').length === 0 && !/OLD-TEXT/.test(d.screen())) test.check('no older version is asked for or shown');
  else test.fail(OWED + 'rule.history asked ' + d.sent('rule.history').length + ' times');
  if (showsText(d, 'RULE-TEXT') && !/solid\s+(red|orange)/.test(d.screen())) test.check('with no draft the textbox shows the rule\'s text, and a long text draws no cap border');
  else test.fail(OWED + 'textbox shows the rule text ' + showsText(d, 'RULE-TEXT') + ', cap border ' + /solid\s+(red|orange)/.test(d.screen()));

  test.subHeading('7. the rule\'s chat');
  if (d.sent('item.chat').some(function (x) { return x.args.id === 'rule/3'; }) && /CHAT-LINE/.test(d.screen())) test.check('item.chat under rule/3 is read and its lines show');
  else test.fail(OWED + 'item.chat asked ' + JSON.stringify(d.sent('item.chat').map(function (x) { return x.args; })) + ', line shown ' + /CHAT-LINE/.test(d.screen()));
  d.doc.getElementById('rd-say').value = 'hello';
  d.fire('click', 'rd-say-send');
  await settled();
  const said = d.sent('chat.add');
  if (said.length === 1 && said[0].args.id === 'rule/3' && said[0].args.text === 'hello') test.check('Send adds chat.add {id: rule/3, text}');
  else test.fail(OWED + 'Send sent ' + JSON.stringify(said.map(function (x) { return x.args; })));
})().catch(function (e) { test.fail('the suite died: ' + (e && e.stack || e)); }).then(function () {
  test.reportSuccessFailureCount();
  process.exit(0);
});
