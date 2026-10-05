'use strict';

// goal/G5.5: the desk server's rules, so the UI of andy/FACE.md never comes back to the faceless side; and the core
// paragraph field type. Red on today's tree; wsl-claude wrote it from G5.5's box and does not build it.
//   Andy, 2026-10-05 (G5.5's box holds every line verbatim): "only changes/upgrades in the faceless parts, so that the
//   UI doesn't have to come back to the faceless parts. and is the desk server logic that i mean"; "rules remain
//   static and apply to all items."; "paragraph field type in fieldRules.js, same characters allowed as label," /
//   "2048 for now." / "the field belongs to textarea kind of fields, which newlines and formatting preserved...."; "might
//   be a good idea to have a history of legal standards, it's a form of proof, too."; "why not?" (agents add rules);
//   "i prefer to negotiate, and create an updated version with one button/verb that belongs to me."; "yes to all of
//   it" (activate and delete as quick versions, the draft kept on the server); grant G2 on js/fieldRules.js; his Go.
//
// THE SHAPES (the box's; the names marked * are wsl-claude's picks, the builder may argue them in Desk first):
//   A  fieldRules.js: PARAGRAPH_MAX_BYTES* 2048, paragraphProblem(text)* ('' when fine, else why) and
//      normalizeParagraph(text)*: NFC, line breaks, tabs and spaces kept, CRLF stored as LF, every other control or
//      invisible character refused as the label refuses it.
//   B  the desk server, rules in a table of their own in desk.db:
//      1 rule.add {type, label, text}: rule/N, proposed; an agent may add one. Type and status from their lists, the
//        label by the label rule, the text a paragraph: anything else refused.
//      2 rule.draft {key, text}: Andy alone; rule.get shows it; it writes no history.
//      3 rule.version {key, text, status}: Andy alone; one new version, the older one in rule.history.
//      4 rules.search {text, types, statuses}: label and text matched, the newest row per rule, answering key, label,
//        type and status (never the text).
//      5 a rule's chat: chat.add and item.chat under rule/N.
//      6 rules outlive a server restart and a new goal (no goal's replay touches them).
// Answer shapes the box leaves open (a body or a body.rule; history as history, items or rows) are read leniently.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/js/appClient.js');

const OWED = 'OWED by goal/G5.5: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const fieldRules = require('../run/js/fieldRules.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskRulesTestCWAAAAAAAAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskRulesTestOwnerAAAAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 260); }
function parse(x) { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch (e) { return x; } }
function ruleOf(body) { const b = parse(body) || {}; return parse(b.rule) || b; }
function listOf(body, names) {
  const b = parse(body) || {};
  const l = names.map(function (n) { return b[n]; }).filter(Array.isArray)[0] || [];
  return l.map(function (r) { r = parse(r); return r && r.label && typeof r.label === 'string' && r.label.charAt(0) === '{' ? Object.assign({ key: r.key }, parse(r.label)) : r; });
}

test.startTest('goal/G5.5: the desk server\'s rules, and the paragraph field type');

test.subHeading('A. fieldRules: the paragraph');
{
  const has = typeof fieldRules.paragraphProblem === 'function' && typeof fieldRules.normalizeParagraph === 'function';
  if (has && fieldRules.PARAGRAPH_MAX_BYTES === 2048) test.check('fieldRules exports paragraphProblem, normalizeParagraph and PARAGRAPH_MAX_BYTES 2048');
  else test.fail(OWED + 'fieldRules has no paragraph type (PARAGRAPH_MAX_BYTES ' + short(fieldRules.PARAGRAPH_MAX_BYTES) + ')');
  if (has) {
    const kept = 'first line\n\tindented  twice  spaced\nlast';
    if (fieldRules.normalizeParagraph(kept) === kept && fieldRules.paragraphProblem(kept) === '') test.check('line breaks, tabs and double spaces are kept as typed');
    else test.fail(OWED + 'a paragraph with breaks and tabs became ' + short(fieldRules.normalizeParagraph(kept)) + ', problem ' + short(fieldRules.paragraphProblem(kept)));
    if (fieldRules.normalizeParagraph('a\r\nb') === 'a\nb' && fieldRules.normalizeParagraph('é') === 'é') test.check('CRLF is stored as LF, and the text is NFC');
    else test.fail(OWED + 'CRLF and NFC gave ' + short([fieldRules.normalizeParagraph('a\r\nb'), fieldRules.normalizeParagraph('é')]));
    if (fieldRules.paragraphProblem('ring \u0007 bell') && fieldRules.paragraphProblem('flip ‮ it')) test.check('other control and invisible characters are refused, as for a label');
    else test.fail(OWED + 'a bell or a bidi override passed as a paragraph');
    if (fieldRules.paragraphProblem('x'.repeat(2048)) === '' && fieldRules.paragraphProblem('x'.repeat(2049))) test.check('2048 bytes pass, 2049 are refused');
    else test.fail(OWED + 'the 2048-byte bound reads ' + short([fieldRules.paragraphProblem('x'.repeat(2048)), fieldRules.paragraphProblem('x'.repeat(2049))]));
  }
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-deskrules-'));
const state = path.join(scratch, 'state');
fs.mkdirSync(state, { recursive: true });
const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
const client = appClient.createAppClient({ rootDir: scratch });
client.register('desk', pipe);
const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
let kid = null;
async function start() {
  kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) return true; } catch (e) { /* not yet */ } }
  return false;
}
function stop() { return new Promise(function (r) { if (!kid) return r(); kid.once('exit', r); kid.kill(); setTimeout(r, 3000); }); }

(async function () {
  if (!await start()) { test.fail('the desk server did not start'); return; }
  await call('session.set', { json: JSON.stringify({ goal: { id: 'r/G1', title: 'Rules' }, items: [{ id: 'r/G1.1', title: 'Work', blocks: ['r/G1'] }] }) }, CW);

  test.subHeading('B1. rule.add: proposed, by an agent too, checked at the door');
  const added = await call('rule.add', { type: 'code', label: 'Tests first', text: 'Red on today\'s tree.\nThe writer never builds.' }, CW);
  const k1 = (ruleOf(added.body) || {}).key;
  const g1 = k1 ? ruleOf((await call('rule.get', { key: k1 }, ANDY)).body) : {};
  if (added.status === 200 && /^rule\/\d+$/.test(String(k1)) && g1.status === 'proposed' && g1.type === 'code' && g1.text === 'Red on today\'s tree.\nThe writer never builds.') test.check('an agent\'s rule.add makes ' + k1 + ', proposed, its text with its line break');
  else test.fail(OWED + 'rule.add answered ' + added.status + ' ' + short(added.body) + '; rule.get ' + short(g1));
  const badType = await call('rule.add', { type: 'law', label: 'x', text: 'y' }, CW);
  const badLabel = await call('rule.add', { type: 'ui', label: 'L'.repeat(65), text: 'y' }, CW);
  const badText = await call('rule.add', { type: 'ui', label: 'ok', text: 'y'.repeat(2049) }, CW);
  if (added.status === 200 && badType.status !== 200 && badLabel.status !== 200 && badText.status !== 200) test.check('a type off the list, a 65-byte label and a 2049-byte text are refused');
  else test.fail(OWED + 'refusals: type ' + badType.status + ', label ' + badLabel.status + ', text ' + badText.status);

  test.subHeading('B2. rule.draft: his alone, no history');
  const histBefore = k1 ? listOf((await call('rule.history', { key: k1 }, ANDY)).body, ['history', 'items', 'rows']).length : -1;
  const draft = k1 ? await call('rule.draft', { key: k1, text: 'Red first.\nThe writer never builds it.' }, ANDY) : {};
  const g2 = k1 ? ruleOf((await call('rule.get', { key: k1 }, CW)).body) : {};
  const histAfter = k1 ? listOf((await call('rule.history', { key: k1 }, ANDY)).body, ['history', 'items', 'rows']).length : -2;
  const agentDraft = k1 ? await call('rule.draft', { key: k1, text: 'mine' }, CW) : {};
  if (draft.status === 200 && g2.draft === 'Red first.\nThe writer never builds it.' && g2.text === g1.text && histAfter === histBefore && agentDraft.status !== 200) test.check('his draft is kept and read by an agent, the rule unchanged, no history row; an agent\'s draft refused');
  else test.fail(OWED + 'rule.draft answered ' + draft.status + '; rule.get ' + short(g2) + '; history ' + histBefore + ' then ' + histAfter + '; agent draft ' + agentDraft.status);

  test.subHeading('B3. rule.version: his one button, the old row kept');
  const ver = k1 ? await call('rule.version', { key: k1, text: 'Red first.\nThe writer never builds it.', status: 'active' }, ANDY) : {};
  const g3 = k1 ? ruleOf((await call('rule.get', { key: k1 }, ANDY)).body) : {};
  const hist = k1 ? listOf((await call('rule.history', { key: k1 }, ANDY)).body, ['history', 'items', 'rows']) : [];
  const older = hist.some(function (h) { return h && h.text === 'Red on today\'s tree.\nThe writer never builds.' && h.status === 'proposed'; });
  const agentVer = k1 ? await call('rule.version', { key: k1, text: 'x', status: 'deleted' }, CW) : {};
  if (ver.status === 200 && g3.status === 'active' && g3.text === 'Red first.\nThe writer never builds it.' && older && agentVer.status !== 200) test.check('rule.version makes it active with the new text; the proposed text is in rule.history; an agent\'s version refused');
  else test.fail(OWED + 'rule.version answered ' + ver.status + ' ' + short(ver.body) + '; rule.get ' + short(g3) + '; history ' + short(hist) + '; agent version ' + agentVer.status);

  test.subHeading('B4. rules.search: newest row, filtered, no text');
  await call('rule.add', { type: 'ui', label: 'Bubbles', text: 'One bubble per line.' }, ANDY);
  const found = listOf((await call('rules.search', { text: 'Red first', types: ['code'], statuses: ['active'] }, CW)).body, ['items', 'rules', 'rows']);
  const hit = found.filter(function (r) { return r && r.key === k1; })[0];
  const none = listOf((await call('rules.search', { text: 'Red first', types: ['ui'], statuses: ['active'] }, CW)).body, ['items', 'rules', 'rows']);
  if (hit && hit.label === 'Tests first' && hit.type === 'code' && hit.status === 'active' && !('text' in hit) && found.length === 1 && none.length === 0) test.check('a search by text, type and status finds ' + k1 + ' as key, label, type, status, and the type filter excludes it');
  else test.fail(OWED + 'rules.search found ' + short(found) + '; with type ui ' + short(none));

  test.subHeading('B5. a rule\'s chat');
  const said = k1 ? await call('chat.add', { id: k1, text: 'I would add: the builder argues names first.' }, CW) : {};
  const chat = k1 ? (await call('item.chat', { id: k1 }, ANDY)).body : {};
  if (said.status === 200 && JSON.stringify(chat || {}).indexOf('the builder argues names first') !== -1) test.check('chat.add and item.chat work under ' + k1);
  else test.fail(OWED + 'chat under the rule answered ' + said.status + ' ' + short(said.body) + '; item.chat ' + short(chat));

  test.subHeading('B6. rules outlive a restart and a new goal');
  await stop();
  await start();
  await call('session.set', { json: JSON.stringify({ goal: { id: 'r/G2', title: 'Next' }, items: [] }) }, CW);
  const g6 = k1 ? ruleOf((await call('rule.get', { key: k1 }, ANDY)).body) : {};
  if (g6.status === 'active' && g6.text === 'Red first.\nThe writer never builds it.') test.check(k1 + ' is still active with its text after a restart and a new goal');
  else test.fail(OWED + 'after a restart and a new goal rule.get reads ' + short(g6));
})().catch(function (e) { test.fail('the suite threw: ' + (e && e.stack || e)); }).then(async function () {
  await stop();
  setTimeout(function () {
    try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* scratch */ }
    test.reportSuccessFailureCount();
    process.exit(0);
  }, 300);
});
