'use strict';

// spirit/run/spirit/app/desk/test/data.js
// The tests of spirit/app/desk/data.js, and of no other module (spec: ./data.md;
// goal/G41.11, goal/G41.24). The translator
// runs as it does: in a window of its own beside the real spirit.data (spirit/data.js), which it writes into;
// the desk's rows are handed in as appServer's streamListener hands them, jobs of module spirit/app/desk.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'data.js');
const SPIRIT_DATA = path.join(RUN, 'spirit', 'data.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

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

test.startTest('data.js: the desk\'s translator into spirit.data, and its cache rules');

// The one file holds what the desk knows of its rows at the receiving end: the translator, and the cache rules (keep,
// shed, answer), which it requires from family/cacheRules.js in node and exports (goal/G41.24, goal/G41.28). That no other file or doc names another way is spirit/test/data-caches.js's, for the whole repo.
test.subHeading('goal/G41.24: where it lives');
ok(fs.existsSync(FILE), 'spirit/app/desk/data.js is there', 'no ' + FILE);
const inNode = (function () { try { return require(FILE); } catch (e) { return { threw: String(e && e.message) }; } }());
const CACHE = inNode && inNode.cache;
ok(!!CACHE && ['keep', 'shed', 'answer'].every(function (f) { return typeof CACHE[f] === 'function'; }),
  'in node, as an appServer that subscribes requires it, it answers cache { keep, shed, answer }', 'required: ' + short(inNode && Object.keys(inNode)));
const DESK_API = (function () { try { return require(path.join(RUN, 'spirit', 'app', 'desk', 'api.js')); } catch (e) { return {}; } }());
ok(!('cache' in DESK_API), 'and the desk family\'s api.js holds its verbs alone, no cache', 'api.js exports ' + short(Object.keys(DESK_API)));
// Its translator is tested below, run as the page and the subscribing appServer run it; without the file there is none.
if (!fs.existsSync(FILE)) { test.fail('the translator\'s checks wait on the file'); test.reportSuccessFailureCount(); process.exit(0); }

test.subHeading('it registers on spirit.data');
const w = world();
ok(!!w.X && typeof w.X.published === 'function' && typeof w.X.took === 'function', 'with spirit.data it answers ((spirit.data || {}).desk || {}).data { published, took }', short(w.X && Object.keys(w.X)));

test.subHeading('a goal pushed whole: its rows kept, it is current');
w.job(whole(it('goal/G9.1', 'goal/G9')));
ok(w.item('goal/G9.1') && w.item('goal/G9.1').title === 'goal/G9.1' && w.current() === 'goal/G9', 'goal.whole keeps the item\'s facts and makes its goal the current one', short({ row: w.item('goal/G9.1'), current: w.current() }));
w.job({ verb: 'goal.whole', item: JSON.stringify(it('goal/G9', '')) });
ok(w.item('goal/G9') && w.current() === 'goal/G9', 'an item as a JSON string is read; a goal (goal \'\') is its own goal', short(w.item('goal/G9')));
w.job({ verb: 'goal.whole', item: { title: 'no id' } }); w.job({ verb: 'goal.whole', item: '{broken' }); w.job(null); w.job('text');
ok(w.ids().length === 2, 'facts with no id, broken JSON, a non-object: nothing kept', short(w.ids()));
w.job({ verb: 'item.row', item: it('goal/G7.1', 'goal/G7') });
ok(w.current() === 'goal/G9' && w.item('goal/G9.1') && w.item('goal/G7.1'), 'a row that is not goal.whole is kept and drops nothing', 'current ' + w.current());

test.subHeading('another goal pushed whole: it is current, and nothing kept of others goes (goal/G41.12)');
// Andy, goal/G41.12, box v15: "The cache keeps everything the server sends, every goal, no filtering on the client
// side"; goal/G41.24, his decision: "the three bundle checks go, and the other three assert my G41.12 words."
w.X.took('item.box', { id: 'goal/G9.1' }, { box: 'the box', version: 3 });
w.job(whole(it('goal/G8.1', 'goal/G8')));
ok(w.current() === 'goal/G8' && !!w.item('goal/G9.1') && !!w.item('goal/G9') && !!w.part('goal/G9.1') && w.part('goal/G9.1').box === 'the box' && !!w.item('goal/G7.1'), 'it is current, and goal/G9\'s rows and parts stay, and so does another goal\'s row: every goal is kept',
  short(w.ids()));
ok(!!w.item('goal/G8.1'), 'the new goal\'s row is kept', short(w.ids()));
w.job({ verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
w.job(whole(it('goal/G6', '')));
ok(w.current() === 'goal/G6' && w.item('goal/G6.1') && w.item('goal/G6'), 'a row of the new goal that came before it was pushed stays', short(w.ids()));
w.job(whole(it('goal/G6.2', 'goal/G6')));
ok(w.item('goal/G6.1') && w.item('goal/G6.2'), 'a goal.whole of the current goal drops nothing', short(w.ids()));
w.job({ item: it('goal/G6.2', 'goal/G6'), removed: true });
ok(!w.item('goal/G6.2') && !w.part('goal/G6.2'), 'a removed row deletes its facts and its parts', short(w.item('goal/G6.2')));

test.subHeading('the change number: the newest heard, never lowered');
w.job({ change: 5, verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
w.job({ change: 3, verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
ok(w.change() === 5, 'the change heard is raised to 5 and not lowered by 3', 'change ' + w.change());
w.job({ change: '9', verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
ok(w.change() === 5, 'a change that is not a number is not taken', 'change ' + w.change());

test.subHeading('a bundle is appServer\'s: the translator takes one row at a time (goal/G41.12)');
// The three bundle checks are gone (goal/G41.24, Andy: "the three bundle checks go"; "i think the translator has no
// business knowing anything about \"bundling\""): appServer opens a bundle and hands its rows in one by one.
const wb = world();
wb.job({ verb: 'goal.whole', item: it('goal/G9.3', 'goal/G9') });
ok(wb.item('goal/G9.3'), 'a single row is taken as it comes', short(wb.ids()));

test.subHeading('took: a part read for an item of the current goal is kept');
const wt = world();
wt.job(whole(it('goal/G9.1', 'goal/G9')));
wt.job({ verb: 'item.row', item: it('goal/G5.1', 'goal/G5') });
wt.X.took('item.box', { id: 'goal/G9.1' }, { box: 'B', version: '4' });
ok(wt.part('goal/G9.1').box === 'B' && wt.part('goal/G9.1').version === 4, 'item.box: { box, version } as a number', short(wt.part('goal/G9.1')));
wt.X.took('item.chat', { id: 'goal/G9.1' }, { chat: [{ by: 'a', at: '1', text: 't' }], chatMore: true });
ok(wt.part('goal/G9.1').chat.length === 1 && wt.part('goal/G9.1').chatMore === true && wt.part('goal/G9.1').box === 'B', 'item.chat: { chat, chatMore }, beside what was kept', short(wt.part('goal/G9.1')));
wt.X.took('item.checks', { id: 'goal/G9.1' }, { checks: [{ number: '1', state: 'open' }] });
wt.X.took('item.files', { id: 'goal/G9.1' }, { files: [{ path: 'b.js', by: 'cw', core: false, grant: '' }], filesMore: true });
ok(wt.part('goal/G9.1').checks.length === 1 && wt.part('goal/G9.1').files.length === 1 && wt.part('goal/G9.1').filesMore === true, 'item.checks and item.files are kept too', short(wt.part('goal/G9.1')));
wt.X.took('item.box', { id: 'goal/G5.1' }, { box: 'no' });
wt.X.took('item.box', { id: 'goal/G4.4' }, { box: 'no' });
ok(!wt.part('goal/G5.1') && !wt.part('goal/G4.4'), 'an item of another goal, or one with no row, keeps nothing', short([wt.part('goal/G5.1'), wt.part('goal/G4.4')]));
wt.X.took('item.chat', { id: 'goal/G9.1', before: 'x' }, { chat: [] });
wt.X.took('item.files', { id: 'goal/G9.1', under: 'spirit/' }, { files: [] });
ok(wt.part('goal/G9.1').chat.length === 1 && wt.part('goal/G9.1').files.length === 1, 'an older page of chat, or files under a folder, is no part: not kept', short(wt.part('goal/G9.1')));
let threw = null;
try { wt.X.took('item.box', {}, { box: 'x' }); wt.X.took('item.box', { id: 'goal/G9.1' }, null); wt.X.took('item.box', { id: 'goal/G9.1' }, { box: 5 }); wt.X.took('item.what', { id: 'goal/G9.1' }, { a: 1 }); } catch (e) { threw = e; }
ok(!threw && wt.part('goal/G9.1').box === 'B', 'no id, no answer, a box not a string, another verb: nothing kept, nothing thrown', short(wt.part('goal/G9.1').box));
const wn = world();
wn.job({ verb: 'item.row', item: it('goal/G9.1', 'goal/G9') });
wn.X.took('item.box', { id: 'goal/G9.1' }, { box: 'B' });
ok(!wn.part('goal/G9.1'), 'before any goal was pushed nothing is kept', short(wn.part('goal/G9.1')));

test.subHeading('side rows keep current a part once read, and only then');
const ws = world();
ws.job(whole(it('goal/G9.1', 'goal/G9')));
ws.job(whole(it('goal/G9.2', 'goal/G9')));
ws.job({ table: 'box', id: 'goal/G9.1', row: { text: 'never read' } });
// goal/G41.12: "The cache keeps everything the server sends": a box the stream brings is kept, read or not.
ok(!!ws.part('goal/G9.1') && ws.part('goal/G9.1').box === 'never read', 'a box the stream brings is kept though the item was never read', short(ws.part('goal/G9.1')));
ws.job({ table: 'chat', id: 'goal/G9.2', row: { by: 'a', at: '1', text: 'unread line' } });
ok(!!ws.part('goal/G9.2') && Array.isArray(ws.part('goal/G9.2').chat) && ws.part('goal/G9.2').chat.some(function (l) { return l && l.text === 'unread line'; }), 'and so is a chat line', short(ws.part('goal/G9.2')));
ws.X.took('item.checks', { id: 'goal/G9.1' }, { checks: [] });
ws.job({ table: 'box', id: 'goal/G9.1', row: { text: 'x', version: 2 } });
ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'a', at: '1', text: 't' } });
ws.job({ table: 'files', id: 'goal/G9.1', row: { path: 'a.js', by: 'cw' } });
ok(ws.part('goal/G9.1').box === 'x' && ws.part('goal/G9.1').version === 2 && Array.isArray(ws.part('goal/G9.1').chat) && ws.part('goal/G9.1').chat.some(function (l) { return l && l.text === 't'; }), 'the box and the chat line the stream brings are kept beside the checks read', short(ws.part('goal/G9.1')));
ws.X.took('item.box', { id: 'goal/G9.1' }, { box: 'old', version: 1 });
ws.job({ table: 'box', id: 'goal/G9.1', row: { text: 'new', version: 2 } });
ok(ws.part('goal/G9.1').box === 'new' && ws.part('goal/G9.1').version === 2, 'a box row replaces the box read, with its version', short(ws.part('goal/G9.1')));

test.subHeading('side rows: chat lines join, a take replaces');
ws.X.took('item.chat', { id: 'goal/G9.1' }, { chat: [{ by: 'a', at: '1', text: 't', taken: false }] });
ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'b', at: '2', text: 'u' } });
ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'a', at: '1', text: 't', taken: true } });
ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'c', at: '3', text: 'v' }, removed: true });
ws.job({ table: 'chat', id: 'goal/G9.1' });
const chat = ws.part('goal/G9.1').chat;
ok(chat.length === 2 && chat[0].taken === true && chat[1].text === 'u', 'a new line joins; the same line (by, at, text) replaces; a removed or row-less one changes nothing', short(chat));

test.subHeading('side rows: the checks panel holds the open and the decided');
ws.X.took('item.checks', { id: 'goal/G9.1' }, { checks: [{ number: '1', state: 'open' }, { number: '2', state: 'open' }] });
ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '3', state: 'open' } });
ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '1', state: 'decided' } });
ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '2', state: 'answered' } });
let checks = ws.part('goal/G9.1').checks;
ok(JSON.stringify(checks.map(function (c) { return c.number + ':' + c.state; })) === '["1:decided","3:open"]', 'a new check joins, a decided one replaces in place, an answered one goes', short(checks));
ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '3', state: 'cleared' } });
ws.job({ table: 'checks', id: 'goal/G9.1', removed: true, at: '1' });
checks = ws.part('goal/G9.1').checks;
ok(checks.length === 0, 'a cleared one goes, and a removed one by its number (at)', short(checks));

test.subHeading('side rows: files, one agent\'s path each, core first, and the late mark (goal/G41.11)');
const wf = world();
wf.job(whole(it('goal/G9.1', 'goal/G9')));
wf.X.took('item.files', { id: 'goal/G9.1' }, { files: [], filesMore: false });
wf.job({ table: 'files', id: 'goal/G9.1', row: { path: 'x.js', by: 'cw', core: false, grant: '', late: true } });
ok(JSON.stringify(wf.part('goal/G9.1').files) === JSON.stringify([{ path: 'x.js', by: 'cw', core: false, grant: '', late: true }]), 'a file added late keeps its mark: late: true', short(wf.part('goal/G9.1').files));
wf.job({ table: 'files', id: 'goal/G9.1', row: { path: 'b.js', by: 'cw', core: 'yes', grant: 'g1', late: 'yes', extra: 1 } });
wf.job({ table: 'files', id: 'goal/G9.1', row: { path: 'a.js', by: 'wsl', core: true, grant: '' } });
let files = wf.part('goal/G9.1').files;
const b = files.filter(function (f) { return f.path === 'b.js'; })[0];
ok(b && !('late' in b) && b.core === false && b.grant === 'g1' && !('extra' in b), 'a row without late: true gets no late key; core only when true; nothing else carried', short(b));
ok(JSON.stringify(files.map(function (f) { return f.path; })) === '["a.js","b.js","x.js"]' && wf.part('goal/G9.1').filesMore === false, 'core files first, then by path; filesMore false', short(files));
wf.job({ table: 'files', id: 'goal/G9.1', row: { path: 'x.js', by: 'cw', core: false, grant: 'g2' } });
files = wf.part('goal/G9.1').files;
const x = files.filter(function (f) { return f.path === 'x.js'; });
ok(x.length === 1 && x[0].grant === 'g2' && !('late' in x[0]), 'the same agent\'s path again replaces its entry', short(x));
wf.job({ table: 'files', id: 'goal/G9.1', row: { path: 'x.js', by: 'wsl', core: false } });
ok(wf.part('goal/G9.1').files.filter(function (f) { return f.path === 'x.js'; }).length === 2, 'another agent\'s same path is its own entry', short(wf.part('goal/G9.1').files));
wf.job({ table: 'files', id: 'goal/G9.1', removed: true, at: 'cw|x.js' });
files = wf.part('goal/G9.1').files;
ok(files.length === 3 && !files.some(function (f) { return f.by === 'cw' && f.path === 'x.js'; }), 'a removed file goes by holder|path, the other agent\'s stays', short(files));

test.subHeading('only the desk\'s jobs are read');
const wm = world();
wm.job(whole(it('goal/G9.1', 'goal/G9')), 'spirit.app.files');
wm.D.takeJob({ id: 'z', module: 'spirit.app.desk', data: {}, app: 'not an object' }, SENDER);
ok(!wm.item('goal/G9.1') && !wm.current(), 'a job of another module, or an app that is no object, keeps nothing', short(wm.ids()));
wm.X.published(whole(it('goal/G9.1', 'goal/G9')));
ok(wm.item('goal/G9.1') && wm.current() === 'goal/G9', 'published takes a row handed to it directly', short(wm.item('goal/G9.1')));

test.reportSuccessFailureCount();
