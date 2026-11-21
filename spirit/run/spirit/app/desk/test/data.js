'use strict';

// spirit/run/spirit/app/desk/test/data.js
// One file for every test of its script (Andy: "there is ONE FUCKING test file in the test folder per script file, and every fucking
// test that applies to that file must be inserted in the that one file"; spirit/test/TEST_SYSTEM.md): each part below is its own
// section at the end: noTeamChat.
// The tests of spirit/app/desk/data.js, and of no other module (spec: ./data.md;
// goal/G41.11, goal/G41.24). The translator
// runs as it does: in a window of its own beside the real spirit.data (spirit/data.js), which it writes into;
// the desk's rows are handed in as appServer's listener hands them, jobs of module spirit/app/desk.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'spirit', 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');


function world() {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const D = win.spirit.data;
  let n = 0;
  const X = ((win.spirit.data || {}).desk || {}).data;
  // THE ROWS UNDER THE NODE THAT SERVED THEM (goal/G41.28; Andy, the box: "The RAM-CACHE-is organized BY SERVER-NODE-ID at
  // it's lowest level."): a row comes as appServer hands it, with its sender's key (take(job, key)); every read is
  // spirit.data.desk.data's, which alone names the desk's branches.
  return { win: win, D: D, X: X,
    // A row as the stream hands it: a job of module spirit/app/desk whose app is the desk's publish, from SENDER.
    job: function (app, module) { D.takeJob({ id: 'j' + (++n), module: module || 'spirit.app.desk', data: {}, app: app }, SENDER); },
    item: function (id) { return X ? X.item(id) : undefined; },
    part: function (id) { return X ? X.part(id) : undefined; },
    current: function () { return X ? X.current() : ''; },
    change: function () { return X ? X.change() : 0; },
    ids: function () { return X ? Object.keys(X.items()) : []; } };
}
// The sender's public key, base64 with a + and a / in it, as a node's key is.
const SENDER = 'Ab+c/DeF0123456789abcdefghijklmnopqrstuvwxy=';
const it = function (id, goal, more) { return Object.assign({ id: id, goal: goal, title: id }, more || {}); };
const whole = function (f) { return { verb: 'goal.whole', item: f }; };


// The one file holds what the desk knows of its rows at the receiving end: the translator, and the cache rules (keep,
// shed, answer), which it requires from family/cacheRules.js in node and exports (goal/G41.24, goal/G41.28). That no other file or doc names another way is spirit/test/spirit-branches.js's, for the whole repo.
// What the tests below make, each in order, read by the tests after it.
let inNode, CACHE, DESK_API, w, wb, wt, threw, wn, ws, chat, checks, wm;

// goal/G41.24: where it lives
test.run('spirit/app/desk/data.js is there', 0.2, function () {
  return (fs.existsSync(FILE)) ? true : false;
}, test.limit.quick);
test.run('in node, required by an appServer that subscribes, it answers a cache with keep, shed and answer', 0.2, function () {
  inNode = (function () { try { return require(FILE); } catch (e) { return {}; } }());
  CACHE = inNode && inNode.cache;
  return (!!CACHE && ['keep', 'shed', 'answer'].every(function (f) { return typeof CACHE[f] === 'function'; })) ? true : false;
}, test.limit.quick);
test.run('the desk family\'s api.js holds its verbs alone, with no cache', 0.2, function () {
  DESK_API = (function () { try { return require(path.join(RUN, 'spirit', 'app', 'desk', 'api.js')); } catch (e) { return {}; } }());
  return (!('cache' in DESK_API)) ? true : false;
}, test.limit.quick);

// Its translator is tested below, run as the page and the subscribing appServer run it; without the file there is none.
test.run('with spirit.data it answers the desk family\'s data with published and took', 0.2, function () {
  if (!fs.existsSync(FILE)) return false;
  // it registers on spirit.data
  w = world();
  return (!!w.X && typeof w.X.published === 'function' && typeof w.X.took === 'function') ? true : false;
}, test.limit.quick);

// a goal pushed whole: its rows kept, it is current
test.run('goal.whole keeps the item\'s facts and makes its goal the current one', 0.2, function () {
  if (!w) return false;
  w.job(whole(it('goal/G9.1', 'goal/G9')));
  return (w.item('goal/G9.1') && w.item('goal/G9.1').title === 'goal/G9.1' && w.current() === 'goal/G9') ? true : false;
}, test.limit.quick);
test.run('an item as a JSON string is read, and a goal, whose goal field is empty, is its own goal', 0.2, function () {
  if (!w) return false;
  w.job({ verb: 'goal.whole', item: JSON.stringify(it('goal/G9', '')) });
  return (w.item('goal/G9') && w.current() === 'goal/G9') ? true : false;
}, test.limit.quick);
test.run('facts with no id, broken JSON or a non-object keep nothing', 0.2, function () {
  if (!w) return false;
  w.job({ verb: 'goal.whole', item: { title: 'no id' } }); w.job({ verb: 'goal.whole', item: '{broken' }); w.job(null); w.job('text');
  return (w.ids().length === 2) ? true : false;
}, test.limit.quick);
test.run('a row that is not goal.whole is kept and drops nothing', 0.2, function () {
  if (!w) return false;
  w.job({ verb: 'item.row', item: it('goal/G7.1', 'goal/G7') });
  return (w.current() === 'goal/G9' && w.item('goal/G9.1') && w.item('goal/G7.1')) ? true : false;
}, test.limit.quick);

// another goal pushed whole: it is current, and nothing kept of others goes (goal/G41.12)
// Andy, goal/G41.12, box v15: "The cache keeps everything the server sends, every goal, no filtering on the client
// side"; goal/G41.24, his decision: "the three bundle checks go, and the other three assert my G41.12 words."
test.run('a second goal pushed whole becomes current, and the first goal\'s items, parts and boxes stay in the cache', 0.2, function () {
  if (!w) return false;
  w.X.took('item.box', { id: 'goal/G9.1' }, { box: 'the box', version: 3 });
  w.job(whole(it('goal/G8.1', 'goal/G8')));
  return (w.current() === 'goal/G8' && !!w.item('goal/G9.1') && !!w.item('goal/G9') && !!w.part('goal/G9.1') && w.part('goal/G9.1').box === 'the box' && !!w.item('goal/G7.1')) ? true : false;
}, test.limit.quick);
test.run('the new goal\'s row is kept', 0.2, function () {
  if (!w) return false;
  return (!!w.item('goal/G8.1')) ? true : false;
}, test.limit.quick);
test.run('a row of the new goal that came before it was pushed stays', 0.2, function () {
  if (!w) return false;
  w.job({ verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
  w.job(whole(it('goal/G6', '')));
  return (w.current() === 'goal/G6' && w.item('goal/G6.1') && w.item('goal/G6')) ? true : false;
}, test.limit.quick);
test.run('a goal.whole of the current goal drops nothing', 0.2, function () {
  if (!w) return false;
  w.job(whole(it('goal/G6.2', 'goal/G6')));
  return (w.item('goal/G6.1') && w.item('goal/G6.2')) ? true : false;
}, test.limit.quick);
test.run('a removed row deletes its facts and its parts', 0.2, function () {
  if (!w) return false;
  w.job({ item: it('goal/G6.2', 'goal/G6'), removed: true });
  return (!w.item('goal/G6.2') && !w.part('goal/G6.2')) ? true : false;
}, test.limit.quick);

// the change number: the newest heard, never lowered
test.run('the change heard is raised to 5 and not lowered by 3', 0.2, function () {
  if (!w) return false;
  w.job({ change: 5, verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
  w.job({ change: 3, verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
  return (w.change() === 5) ? true : false;
}, test.limit.quick);
test.run('a change that is not a number is not taken', 0.2, function () {
  if (!w) return false;
  w.job({ change: '9', verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
  return (w.change() === 5) ? true : false;
}, test.limit.quick);

// a bundle is appServer's: the translator takes one row at a time (goal/G41.12)
// The three bundle checks are gone (goal/G41.24, Andy: "the three bundle checks go"; "i think the translator has no
// business knowing anything about \"bundling\""): appServer opens a bundle and hands its rows in one by one.
test.run('a single row is taken as it comes', 0.2, function () {
  wb = world();
  wb.job({ verb: 'goal.whole', item: it('goal/G9.3', 'goal/G9') });
  return (wb.item('goal/G9.3')) ? true : false;
}, test.limit.quick);

// took: a part read for an item of the current goal is kept
test.run('item.box is kept as the box and its version, as a number', 0.2, function () {
  wt = world();
  wt.job(whole(it('goal/G9.1', 'goal/G9')));
  wt.job({ verb: 'item.row', item: it('goal/G5.1', 'goal/G5') });
  wt.X.took('item.box', { id: 'goal/G9.1' }, { box: 'B', version: '4' });
  return (wt.part('goal/G9.1').box === 'B' && wt.part('goal/G9.1').version === 4) ? true : false;
}, test.limit.quick);
test.run('item.chat is kept as chat and chatMore, beside what was kept', 0.2, function () {
  if (!wt) return false;
  wt.X.took('item.chat', { id: 'goal/G9.1' }, { chat: [{ by: 'a', at: '1', text: 't' }], chatMore: true });
  return (wt.part('goal/G9.1').chat.length === 1 && wt.part('goal/G9.1').chatMore === true && wt.part('goal/G9.1').box === 'B') ? true : false;
}, test.limit.quick);
test.run('an item of another goal, or one with no row, keeps nothing', 0.2, function () {
  if (!wt) return false;
  wt.X.took('item.box', { id: 'goal/G5.1' }, { box: 'no' });
  wt.X.took('item.box', { id: 'goal/G4.4' }, { box: 'no' });
  return (!wt.part('goal/G5.1') && !wt.part('goal/G4.4')) ? true : false;
}, test.limit.quick);
test.run('with no id, no answer, a box that is not a string, or another verb, nothing is kept and nothing is thrown', 0.2, function () {
  if (!wt) return false;
  threw = null;
  try { wt.X.took('item.box', {}, { box: 'x' }); wt.X.took('item.box', { id: 'goal/G9.1' }, null); wt.X.took('item.box', { id: 'goal/G9.1' }, { box: 5 }); wt.X.took('item.what', { id: 'goal/G9.1' }, { a: 1 }); } catch (e) { threw = e; }
  return (!threw && wt.part('goal/G9.1').box === 'B') ? true : false;
}, test.limit.quick);
test.run('before any goal was pushed nothing is kept', 0.2, function () {
  wn = world();
  wn.job({ verb: 'item.row', item: it('goal/G9.1', 'goal/G9') });
  wn.X.took('item.box', { id: 'goal/G9.1' }, { box: 'B' });
  return (!wn.part('goal/G9.1')) ? true : false;
}, test.limit.quick);

// side rows keep current a part once read, and only then
test.run('a box the stream brings is kept though the item was never read', 0.2, function () {
  ws = world();
  ws.job(whole(it('goal/G9.1', 'goal/G9')));
  ws.job(whole(it('goal/G9.2', 'goal/G9')));
  ws.job({ table: 'box', id: 'goal/G9.1', row: { text: 'never read' } });
  // goal/G41.12: "The cache keeps everything the server sends": a box the stream brings is kept, read or not.
  return (!!ws.part('goal/G9.1') && ws.part('goal/G9.1').box === 'never read') ? true : false;
}, test.limit.quick);
test.run('a chat line the stream brings is kept too, though the item was never read', 0.2, function () {
  if (!ws) return false;
  ws.job({ table: 'chat', id: 'goal/G9.2', row: { by: 'a', at: '1', text: 'unread line' } });
  return (!!ws.part('goal/G9.2') && Array.isArray(ws.part('goal/G9.2').chat) && ws.part('goal/G9.2').chat.some(function (l) { return l && l.text === 'unread line'; })) ? true : false;
}, test.limit.quick);
test.run('the box and the chat line the stream brings are kept beside the chat read', 0.2, function () {
  if (!ws) return false;
  ws.X.took('item.chat', { id: 'goal/G9.1' }, { chat: [] });
  ws.job({ table: 'box', id: 'goal/G9.1', row: { text: 'x', version: 2 } });
  ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'a', at: '1', text: 't' } });
  return (ws.part('goal/G9.1').box === 'x' && ws.part('goal/G9.1').version === 2 && Array.isArray(ws.part('goal/G9.1').chat) && ws.part('goal/G9.1').chat.some(function (l) { return l && l.text === 't'; })) ? true : false;
}, test.limit.quick);
test.run('a box row replaces the box read, with its version', 0.2, function () {
  if (!ws) return false;
  ws.X.took('item.box', { id: 'goal/G9.1' }, { box: 'old', version: 1 });
  ws.job({ table: 'box', id: 'goal/G9.1', row: { text: 'new', version: 2 } });
  return (ws.part('goal/G9.1').box === 'new' && ws.part('goal/G9.1').version === 2) ? true : false;
}, test.limit.quick);

// side rows: chat lines join, a take replaces
test.run('a new chat line joins, the same line by its by, at and text replaces, and a removed or row-less one changes nothing', 0.2, function () {
  if (!ws) return false;
  ws.X.took('item.chat', { id: 'goal/G9.1' }, { chat: [{ by: 'a', at: '1', text: 't', taken: false }] });
  ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'b', at: '2', text: 'u' } });
  ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'a', at: '1', text: 't', taken: true } });
  ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'c', at: '3', text: 'v' }, removed: true });
  ws.job({ table: 'chat', id: 'goal/G9.1' });
  chat = ws.part('goal/G9.1').chat;
  return (chat.length === 2 && chat[0].taken === true && chat[1].text === 'u') ? true : false;
}, test.limit.quick);

// side rows: the checks panel holds the open and the decided
test.run('a new check joins, a decided one replaces in place, an answered one goes', 0.2, function () {
  if (!ws) return false;
  ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '1', state: 'open' } });
  ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '2', state: 'open' } });
  ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '3', state: 'open' } });
  ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '1', state: 'decided' } });
  ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '2', state: 'answered' } });
  checks = ws.part('goal/G9.1').checks;
  return (JSON.stringify(checks.map(function (c) { return c.number + ':' + c.state; })) === '["1:decided","3:open"]') ? true : false;
}, test.limit.quick);
test.run('a cleared check goes, and so does a removed one, by its number at', 0.2, function () {
  if (!ws) return false;
  ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '3', state: 'cleared' } });
  ws.job({ table: 'checks', id: 'goal/G9.1', removed: true, at: '1' });
  checks = ws.part('goal/G9.1').checks;
  return (checks.length === 0) ? true : false;
}, test.limit.quick);

// only the desk's jobs are read
test.run('a job of another module, or an app that is no object, keeps nothing', 0.2, function () {
  wm = world();
  wm.job(whole(it('goal/G9.1', 'goal/G9')), 'spirit.app.files');
  wm.D.takeJob({ id: 'z', module: 'spirit.app.desk', data: {}, app: 'not an object' }, SENDER);
  return (!wm.item('goal/G9.1') && !wm.current()) ? true : false;
}, test.limit.quick);
test.run('published takes a row handed to it directly', 0.2, function () {
  if (!wm) return false;
  wm.X.published(whole(it('goal/G9.1', 'goal/G9')));
  return (wm.item('goal/G9.1') && wm.current() === 'goal/G9') ? true : false;
}, test.limit.quick);

// ── THE noTeamChat PART ──────────────────────────────────────────────────────────────────────────────────────────
// The noTeamChat part of ./data.js.
// THE DESK PAGE CACHE TREATS NO TEAM CHAT GOAL APART (goal/G43.22; spec: ./data.md, its noTeamChat section): spirit/app/desk/data.js.
// Andy, the box: "the apps and plugin system goes.", "there will only be goals, items and rules left, plus the verifier stuff
// can stay for now.". Q5: "G0 goes, from ui and server, kept in database.". The tree read as it is, comments left out.
function code(f) { try { return fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, ''); } catch (e) { return ''; } }
const DESK = path.join(RUN, 'spirit', 'app', 'desk');

// noTeamChat: the desk page cache treats no goal/G0 apart (goal/G43.22)
// Andy: "G0 goes, from ui and server"
test.run('the desk page cache treats no goal/G0 apart', 0.2, function () {
  const cache = code(path.join(DESK, 'data.js'));
  return (!!cache && !/goal\/G0['"]/.test(cache)) ? true : false;
}, test.limit.quick);
