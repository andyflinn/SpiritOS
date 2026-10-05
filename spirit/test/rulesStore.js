'use strict';

// goal/G5.5: a desk-side RULES store, apart from goals and items, with a
// paragraph field type in core fieldRules. Rules are negotiated in their
// own chat and settle into one new version per Andy press; the older
// versions are the rule's proof. No face work here (the FACE.md tab,
// dialog and bubbles are elsewhere); only desk server verbs and the one
// core field type.
//   Andy, 2026-10-05, under goal/G5.5: "rules remain static and apply to
//   all items. ... so rules don't worry about items, items need to worry
//   about rules."; "add the history mechanism to box"; "the current shape
//   might generate 15 history records in one rule-detail-chat. i prefer
//   to negotiate, and create an updated version with one button/verb that
//   belongs to me."; "yes to all of it, then get rid of the red
//   questions."; "core needs a new field type: 'paragraph'"; "paragraph
//   field type in fieldRules.js, same characters allowed as label, Byte
//   limit is 1024," then "2048"; "the field belongs to textarea kind of
//   fields, which newlines and formatting preserved...."; "change in
//   fieldRules.js is granted." claude-ubuntu wrote this red, claude-windows
//   builds it.
//
// SHAPES (ubi's picks from the G5.5 box; argue in Desk first if the build
// disagrees):
//   1  fieldRules.paragraphProblem(text) exists, returns '' for text up to
//      2048 bytes with line breaks and tabs, and a non-empty reason for
//      a text with a non-TAB/LF control character or past 2048 bytes.
//      LF, TAB and spaces are kept as typed; the paragraph has its own
//      normalize, not the label's whitespace-collapsing one.
//   2  rule.add {type, label, text} is a new rule/N proposed, by Andy or
//      an agent alike.
//   3  rule.get {key} answers key, label, type, status, text, draft, at,
//      by for the newest version; draft is '' until rule.draft writes one.
//   4  rule.version {key, text, status} is owner-only (an agent is
//      refused), writes a new row; rule.get now returns the new text; the
//      prior row is in rule.history.
//   5  rule.draft {key, text} is owner-only, writes no history row;
//      rule.get now returns the draft (text unchanged); rule.history
//      length is unchanged.
//   6  rules.search {text, types, statuses} answers {items:[{key,label,
//      type,status}], more} matching text against label or text, with
//      type and status filters.
//   7  chat.add {id: 'rule/N', text} and item.chat {id: 'rule/N'} work
//      under a rule, so negotiations ride the same chat the rest of desk
//      uses.
//
// DRY-RUN NOTE: against today's tree every section is red by shape (no
// paragraph in fieldRules, no rule.* verbs on desk). Dry-run against a
// stand-in paragraphProblem in fieldRules.js: section 1 (5 of 5) green,
// the server-side sections stay owed and need the build to turn green.
// The suite is clean red today (21 owed) and goes green on the build.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');
const fieldRules = require('../run/js/fieldRules.js');

const OWED = 'OWED by goal/G5.5: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEArulesStoreTestCWAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEArulesStoreTestOwnerAAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G5.5: desk rules server (rule.add/version/draft/get/history, rules.search, paragraph field type)');

(async function () {
  test.subHeading('1. core fieldRules has a paragraph type, 2048 bytes, line breaks and tabs kept');
  if (typeof fieldRules.paragraphProblem === 'function') test.check('fieldRules.paragraphProblem(text) is exported');
  else test.fail(OWED + 'fieldRules.paragraphProblem is ' + typeof fieldRules.paragraphProblem);

  if (typeof fieldRules.paragraphProblem === 'function') {
    const ok1 = fieldRules.paragraphProblem('one line\n\ttwo lines, with a tab');
    if (ok1 === '') test.check('paragraph with LF and TAB is accepted');
    else test.fail(OWED + 'LF/TAB paragraph refused: ' + short(ok1));

    const ok2 = fieldRules.paragraphProblem('a'.repeat(2048));
    if (ok2 === '') test.check('paragraph at exactly 2048 bytes is accepted');
    else test.fail(OWED + '2048-byte paragraph refused: ' + short(ok2));

    const bad1 = fieldRules.paragraphProblem('a'.repeat(2049));
    if (bad1) test.check('paragraph past 2048 bytes is refused');
    else test.fail(OWED + '2049-byte paragraph accepted');

    const bad2 = fieldRules.paragraphProblem('with a bell \x07 in it');
    if (bad2) test.check('paragraph with a non-LF/TAB control character is refused');
    else test.fail(OWED + 'control character accepted');
  } else {
    test.fail(OWED + 'skipping the behaviour tests until paragraphProblem exists');
    test.fail(OWED + 'skipping the 2048 test until paragraphProblem exists');
    test.fail(OWED + 'skipping the over-limit test until paragraphProblem exists');
    test.fail(OWED + 'skipping the control-char test until paragraphProblem exists');
  }

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-rulesstore-'));
  const state = path.join(scratch, 'state'); fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }

    test.subHeading('2. rule.add creates a proposed rule, by Andy or an agent');
    const addA = await call('rule.add', { type: 'desk', label: 'Andy writes rules too', text: 'A rule Andy added himself.' }, ANDY);
    if (addA.status === 200 && addA.body && String(addA.body.key || '').indexOf('rule/') === 0) test.check('rule.add by Andy answers a key under rule/N');
    else test.fail(OWED + 'rule.add by Andy: ' + short(addA.body || addA.text));

    const addB = await call('rule.add', { type: 'code', label: 'Agents may propose rules', text: 'An agent-proposed rule.' }, CW);
    if (addB.status === 200 && addB.body && String(addB.body.key || '').indexOf('rule/') === 0) test.check('rule.add by an agent answers a key under rule/N');
    else test.fail(OWED + 'rule.add by CW: ' + short(addB.body || addB.text));

    const ruleA = String((addA.body || {}).key || 'rule/1');
    const ruleB = String((addB.body || {}).key || 'rule/2');

    test.subHeading('3. rule.get answers the newest row with text and draft');
    const got = await call('rule.get', { key: ruleA }, ANDY);
    const gotRule = (got.body || {}).rule || {};
    if (got.status === 200 && gotRule.key === ruleA && gotRule.status === 'proposed' && gotRule.text && gotRule.label && gotRule.type) test.check('rule.get answers key, label, type, status proposed, text');
    else test.fail(OWED + 'rule.get on a fresh rule: ' + short(gotRule));
    if ('draft' in gotRule && gotRule.draft === '') test.check('rule.get carries draft as an empty string before any rule.draft');
    else test.fail(OWED + 'rule.get draft on a fresh rule: ' + short(gotRule.draft));

    test.subHeading('4. rule.version is Andy-only, writes a new history row');
    const refused = await call('rule.version', { key: ruleA, text: 'An agent-attempted version', status: 'active' }, CW);
    if (refused.status === 200 && refused.body && refused.body.ok === false) test.check('rule.version by an agent is refused');
    else test.fail(OWED + 'rule.version by an agent: ' + short(refused.body || refused.text));

    const v2 = await call('rule.version', { key: ruleA, text: 'The settled text, after some chat', status: 'active' }, ANDY);
    if (v2.status === 200 && v2.body && v2.body.ok !== false) test.check('rule.version by Andy is accepted');
    else test.fail(OWED + 'rule.version by Andy: ' + short(v2.body || v2.text));

    const nowRule = ((await call('rule.get', { key: ruleA }, ANDY)).body || {}).rule || {};
    if (nowRule.text === 'The settled text, after some chat' && nowRule.status === 'active') test.check('rule.get returns the new text and status after rule.version');
    else test.fail(OWED + 'rule.get after rule.version: ' + short(nowRule));

    const hist = ((await call('rule.history', { key: ruleA }, ANDY)).body || {}).versions || [];
    if (Array.isArray(hist) && hist.length >= 1 && hist.filter(function (h) { return h && h.text === 'A rule Andy added himself.'; }).length >= 1) test.check('rule.history carries the prior version row');
    else test.fail(OWED + 'rule.history after one new version: ' + short(hist));

    test.subHeading('5. rule.draft is Andy-only, writes no history row, shows in rule.get');
    const draftRefused = await call('rule.draft', { key: ruleA, text: 'An agent-attempted draft' }, CW);
    if (draftRefused.status === 200 && draftRefused.body && draftRefused.body.ok === false) test.check('rule.draft by an agent is refused');
    else test.fail(OWED + 'rule.draft by an agent: ' + short(draftRefused.body || draftRefused.text));

    const histBefore = ((await call('rule.history', { key: ruleA }, ANDY)).body || {}).versions || [];
    const draft = await call('rule.draft', { key: ruleA, text: 'A draft between versions, kept on the server.' }, ANDY);
    if (draft.status === 200 && draft.body && draft.body.ok !== false) test.check('rule.draft by Andy is accepted');
    else test.fail(OWED + 'rule.draft by Andy: ' + short(draft.body || draft.text));

    const afterDraft = ((await call('rule.get', { key: ruleA }, ANDY)).body || {}).rule || {};
    if (afterDraft.draft === 'A draft between versions, kept on the server.' && afterDraft.text === 'The settled text, after some chat') test.check('rule.get returns the draft; the committed text is unchanged');
    else test.fail(OWED + 'rule.get after rule.draft: ' + short({ draft: afterDraft.draft, text: afterDraft.text }));

    const histAfter = ((await call('rule.history', { key: ruleA }, ANDY)).body || {}).versions || [];
    // Only signal once rule.version wrote at least one row; today it is refused so this reports owed.
    if (histBefore.length >= 1 && histAfter.length === histBefore.length) test.check('rule.draft wrote no history row (history length unchanged after a prior version)');
    else test.fail(OWED + 'rule.draft history unchanged check: ' + short({ before: histBefore.length, after: histAfter.length }));

    test.subHeading('6. rules.search matches label and text, filtered by type and status');
    const srch = await call('rules.search', { text: 'rules', types: [], statuses: [] }, ANDY);
    const items = ((srch.body || {}).items) || [];
    if (Array.isArray(items) && items.filter(function (r) { return r && r.key === ruleA; }).length === 1 && items.filter(function (r) { return r && r.key === ruleB; }).length === 1) test.check('rules.search without filters returns both rules whose label matches');
    else test.fail(OWED + 'rules.search no filter: ' + short(items));

    const srchByStatus = await call('rules.search', { text: '', types: [], statuses: ['proposed'] }, ANDY);
    const prop = ((srchByStatus.body || {}).items) || [];
    if (prop.filter(function (r) { return r.key === ruleB; }).length === 1 && prop.filter(function (r) { return r.key === ruleA; }).length === 0) test.check('rules.search filters status: only the proposed rule returns, not the active one');
    else test.fail(OWED + 'rules.search status filter: ' + short(prop));

    test.subHeading('7. a rule has its own chat (chat.add + item.chat under rule/N)');
    const addedLine = await call('chat.add', { id: ruleA, text: 'an agent lines a thought on the rule' }, CW);
    if (addedLine.status === 200 && addedLine.body && addedLine.body.ok !== false) test.check('chat.add under rule/N is accepted');
    else test.fail(OWED + 'chat.add under rule/N: ' + short(addedLine.body || addedLine.text));

    const chat = ((await call('item.chat', { id: ruleA }, ANDY)).body || {}).chat || [];
    if (chat.length >= 1 && chat.filter(function (l) { return l && l.text === 'an agent lines a thought on the rule'; }).length === 1) test.check('item.chat under rule/N returns the line');
    else test.fail(OWED + 'item.chat under rule/N: ' + short(chat));
  } catch (e) {
    test.fail('the suite threw: ' + (e && e.stack || e));
  } finally {
    try { kid.kill(); } catch (e) { /* gone */ }
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* busy */ }
  }
})().then(function () {
  test.reportSuccessFailureCount();
  setTimeout(function () { process.exit(0); }, 200);
});
