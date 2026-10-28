'use strict';

// spirit/run/shell/shared/js/test/deskData.js
// The tests of shell/shared/js/deskData.js, and of no other module (spec: ./deskData.md; goal/G41.11). The translator
// runs as it does: in a window of its own beside the real spirit.data (shell/js/spiritData.js), which it writes into;
// the desk's rows are handed in as appServer's streamListener hands them, jobs of module process/js/desk.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const RUN = path.resolve(__dirname, '../../../..');
const test = require(path.join(RUN, 'test', 'testReport.js'));
const FILE = path.join(__dirname, '..', 'deskData.js');
const SPIRIT_DATA = path.join(RUN, 'shell', 'js', 'spiritData.js');

function ok(cond, good, bad) { if (cond) test.check(good); else test.fail(bad); }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300); }

function world(withData) {
  const win = { JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Map: Map, Math: Math, unescape: unescape, encodeURIComponent: encodeURIComponent };
  win.window = win;
  win.spirit = {};
  vm.createContext(win);
  if (withData) vm.runInContext(fs.readFileSync(SPIRIT_DATA, 'utf8'), win, { filename: SPIRIT_DATA });
  vm.runInContext(fs.readFileSync(FILE, 'utf8'), win, { filename: FILE });
  const D = win.spirit.data;
  let n = 0;
  return { win: win, D: D, X: win.spirit.deskData,
    // A row as the stream hands it: a job of module process/js/desk whose app is the desk's publish.
    job: function (app, module) { D.take({ id: 'j' + (++n), module: module || 'process/js/desk', data: {}, app: app }); },
    item: function (id) { return D.get('deskItems/' + id); },
    part: function (id) { return D.get('deskItem/' + id); } };
}
const it = function (id, goal, more) { return Object.assign({ id: id, goal: goal, title: id }, more || {}); };
const whole = function (f) { return { verb: 'goal.whole', item: f }; };

test.startTest('deskData.js: the desk\'s translator into spirit.data');

test.subHeading('it registers on spirit.data, and only when there is one');
const w0 = world(false);
ok(!w0.win.spirit.deskData, 'without spirit.data it does nothing: no spirit.deskData', 'deskData: ' + short(w0.win.spirit.deskData));
const w = world(true);
ok(!!w.X && typeof w.X.published === 'function' && typeof w.X.took === 'function', 'with spirit.data it answers spirit.deskData { published, took }', short(w.X && Object.keys(w.X)));

test.subHeading('a goal pushed whole: its rows kept, it is current');
w.job(whole(it('goal/G9.1', 'goal/G9')));
ok(w.item('goal/G9.1') && w.item('goal/G9.1').title === 'goal/G9.1' && w.D.get('desk/current') === 'goal/G9', 'goal.whole keeps deskItems/<id> and makes its goal desk/current', short({ row: w.item('goal/G9.1'), current: w.D.get('desk/current') }));
w.job({ verb: 'goal.whole', item: JSON.stringify(it('goal/G9', '')) });
ok(w.item('goal/G9') && w.D.get('desk/current') === 'goal/G9', 'an item as a JSON string is read; a goal (goal \'\') is its own goal', short(w.item('goal/G9')));
w.job({ verb: 'goal.whole', item: { title: 'no id' } }); w.job({ verb: 'goal.whole', item: '{broken' }); w.job(null); w.job('text');
ok(Object.keys(w.D.branch('deskItems')).length === 2, 'facts with no id, broken JSON, a non-object: nothing kept', short(Object.keys(w.D.branch('deskItems'))));
w.job(whole(it('goal/G0', '')));
w.job({ verb: 'item.row', item: it('goal/G0.3', 'goal/G0') });
ok(w.D.get('desk/current') === 'goal/G9' && w.item('goal/G0') && w.item('goal/G0.3'), 'the group chat\'s rows are kept, and never make it current', 'current ' + w.D.get('desk/current'));
w.job({ verb: 'item.row', item: it('goal/G7.1', 'goal/G7') });
ok(w.D.get('desk/current') === 'goal/G9' && w.item('goal/G9.1') && w.item('goal/G7.1'), 'a row that is not goal.whole is kept and drops nothing', 'current ' + w.D.get('desk/current'));

// goal/G41.12, box v15: "The cache keeps everything the server sends, every goal, no filtering on the client side".
test.subHeading('another goal pushed whole: it is current, and every goal kept stays');
w.X.took('item.box', { id: 'goal/G9.1' }, { box: 'the box', version: 3 });
w.job(whole(it('goal/G8.1', 'goal/G8')));
ok(w.D.get('desk/current') === 'goal/G8' && w.item('goal/G9.1') && w.item('goal/G9') && w.part('goal/G9.1') && w.part('goal/G9.1').box === 'the box' && w.item('goal/G7.1'), 'goal/G9\'s rows and parts stay, and so does another goal\'s row',
  short({ items: Object.keys(w.D.branch('deskItems')), part: w.part('goal/G9.1') }));
ok(w.item('goal/G0') && w.item('goal/G0.3') && w.item('goal/G8.1'), 'the group chat and its items stay; the new goal\'s row is kept', short(Object.keys(w.D.branch('deskItems'))));
w.job({ verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
w.job(whole(it('goal/G6', '')));
ok(w.D.get('desk/current') === 'goal/G6' && w.item('goal/G6.1') && w.item('goal/G6'), 'a row of the new goal that came before it was pushed stays', short(Object.keys(w.D.branch('deskItems'))));
w.job(whole(it('goal/G6.2', 'goal/G6')));
ok(w.item('goal/G6.1') && w.item('goal/G6.2'), 'a goal.whole of the current goal drops nothing', short(Object.keys(w.D.branch('deskItems'))));
w.job({ item: it('goal/G6.2', 'goal/G6'), removed: true });
ok(!w.item('goal/G6.2') && !w.part('goal/G6.2'), 'a removed row deletes its facts and its parts', short(w.item('goal/G6.2')));

test.subHeading('the change number: the newest heard, never lowered');
w.job({ change: 5, verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
w.job({ change: 3, verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
ok(w.D.get('desk/change') === 5, 'desk/change is raised to 5 and not lowered by 3', 'desk/change ' + w.D.get('desk/change'));
w.job({ change: '9', verb: 'item.row', item: it('goal/G6.1', 'goal/G6') });
ok(w.D.get('desk/change') === 5, 'a change that is not a number is not taken', 'desk/change ' + w.D.get('desk/change'));

// goal/G41.12, box v15: the bundling is appServer's alone, which hands a bundle's rows in one by one; the desk's own
// bundles are gone, so the translator unpacks none.
test.subHeading('no bundle of the desk\'s own: appServer hands the rows one by one (goal/G41.12)');
const wb = world(true);
wb.job({ rows: [whole(it('goal/G9.1', 'goal/G9', { title: 'A' })), whole(it('goal/G9.2', 'goal/G9', { title: 'B' }))] });
ok(!wb.item('goal/G9.1') && !wb.item('goal/G9.2') && !wb.D.get('desk/current'), 'a { rows } object is no row: nothing kept, nothing made current', short({ items: Object.keys(wb.D.branch('deskItems')), current: wb.D.get('desk/current') }));
wb.job(whole(it('goal/G9.1', 'goal/G9', { title: 'A' })));
wb.job(whole(it('goal/G9.2', 'goal/G9', { title: 'B' })));
ok(wb.item('goal/G9.1') && wb.item('goal/G9.1').title === 'A' && wb.item('goal/G9.2') && wb.item('goal/G9.2').title === 'B', 'rows handed one by one are each kept (the second goal.whole does not drop the first)',
  short(Object.keys(wb.D.branch('deskItems'))));

test.subHeading('took: a part read for an item of the current goal is kept');
const wt = world(true);
wt.job(whole(it('goal/G9.1', 'goal/G9')));
wt.job(whole(it('goal/G0', '')));
wt.job({ verb: 'item.row', item: it('goal/G5.1', 'goal/G5') });
wt.X.took('item.box', { id: 'goal/G9.1' }, { box: 'B', version: '4' });
ok(wt.part('goal/G9.1').box === 'B' && wt.part('goal/G9.1').version === 4, 'item.box: { box, version } as a number', short(wt.part('goal/G9.1')));
wt.X.took('item.chat', { id: 'goal/G9.1' }, { chat: [{ by: 'a', at: '1', text: 't' }], chatMore: true });
ok(wt.part('goal/G9.1').chat.length === 1 && wt.part('goal/G9.1').chatMore === true && wt.part('goal/G9.1').box === 'B', 'item.chat: { chat, chatMore }, beside what was kept', short(wt.part('goal/G9.1')));
wt.X.took('item.checks', { id: 'goal/G9.1' }, { checks: [{ number: '1', state: 'open' }] });
wt.X.took('item.files', { id: 'goal/G9.1' }, { files: [{ path: 'b.js', by: 'cw', core: false, grant: '' }], filesMore: true });
ok(wt.part('goal/G9.1').checks.length === 1 && wt.part('goal/G9.1').files.length === 1 && wt.part('goal/G9.1').filesMore === true, 'item.checks and item.files are kept too', short(wt.part('goal/G9.1')));
wt.X.took('item.chat', { id: 'goal/G0' }, { chat: [] });
ok(wt.part('goal/G0') && Array.isArray(wt.part('goal/G0').chat), 'the group chat\'s part is kept though it is not the current goal', short(wt.part('goal/G0')));
wt.X.took('item.box', { id: 'goal/G5.1' }, { box: 'no' });
wt.X.took('item.box', { id: 'goal/G4.4' }, { box: 'no' });
ok(!wt.part('goal/G5.1') && !wt.part('goal/G4.4'), 'an item of another goal, or one with no row, keeps nothing', short([wt.part('goal/G5.1'), wt.part('goal/G4.4')]));
wt.X.took('item.chat', { id: 'goal/G9.1', before: 'x' }, { chat: [] });
wt.X.took('item.files', { id: 'goal/G9.1', under: 'spirit/' }, { files: [] });
ok(wt.part('goal/G9.1').chat.length === 1 && wt.part('goal/G9.1').files.length === 1, 'an older page of chat, or files under a folder, is no part: not kept', short(wt.part('goal/G9.1')));
let threw = null;
try { wt.X.took('item.box', {}, { box: 'x' }); wt.X.took('item.box', { id: 'goal/G9.1' }, null); wt.X.took('item.box', { id: 'goal/G9.1' }, { box: 5 }); wt.X.took('item.what', { id: 'goal/G9.1' }, { a: 1 }); } catch (e) { threw = e; }
ok(!threw && wt.part('goal/G9.1').box === 'B', 'no id, no answer, a box not a string, another verb: nothing kept, nothing thrown', short(wt.part('goal/G9.1').box));
const wn = world(true);
wn.job({ verb: 'item.row', item: it('goal/G9.1', 'goal/G9') });
wn.X.took('item.box', { id: 'goal/G9.1' }, { box: 'B' });
ok(!wn.part('goal/G9.1'), 'before any goal was pushed nothing is kept', short(wn.part('goal/G9.1')));

// goal/G41.12, box v15: the cache keeps everything the server sends. A box row is the whole box and a chat line is the
// newest, so both are kept unread; a check or a file alone is no list, so those wait for a read.
test.subHeading('side rows: a box and a chat line are kept unread, a check or a file waits for a read');
const ws = world(true);
ws.job(whole(it('goal/G9.1', 'goal/G9')));
ws.job(whole(it('goal/G9.2', 'goal/G9')));
ws.job({ table: 'box', id: 'goal/G9.2', row: { text: 'never read' } });
ok(ws.part('goal/G9.2') && ws.part('goal/G9.2').box === 'never read' && ws.part('goal/G9.2').version === 0, 'a box row of an item never read is kept, with its version', short(ws.part('goal/G9.2')));
ws.job({ table: 'checks', id: 'goal/G9.1', row: { number: '1', state: 'open' } });
ws.job({ table: 'files', id: 'goal/G9.1', row: { path: 'a.js', by: 'cw' } });
ok(!ws.part('goal/G9.1'), 'a check or a file row of an item never read keeps nothing', short(ws.part('goal/G9.1')));
ws.X.took('item.checks', { id: 'goal/G9.1' }, { checks: [] });
ws.job({ table: 'box', id: 'goal/G9.1', row: { text: 'x', version: 2 } });
ws.job({ table: 'chat', id: 'goal/G9.1', row: { by: 'a', at: '1', text: 't' } });
ws.job({ table: 'files', id: 'goal/G9.1', row: { path: 'a.js', by: 'cw' } });
const p91 = ws.part('goal/G9.1');
ok(p91.box === 'x' && p91.version === 2 && p91.chat.length === 1 && p91.chatMore === true && !('files' in p91), 'beside checks read, a box and a chat line are kept, with chatMore; files are not', short(p91));
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
const wf = world(true);
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
const wm = world(true);
wm.job(whole(it('goal/G9.1', 'goal/G9')), 'process/js/files');
wm.D.take({ id: 'z', module: 'process/js/desk', data: {}, app: 'not an object' });
ok(!wm.item('goal/G9.1') && !wm.D.get('desk/current'), 'a job of another module, or an app that is no object, keeps nothing', short(Object.keys(wm.D.branch('deskItems'))));
wm.X.published(whole(it('goal/G9.1', 'goal/G9')));
ok(wm.item('goal/G9.1') && wm.D.get('desk/current') === 'goal/G9', 'published takes a row handed to it directly', short(wm.item('goal/G9.1')));

test.reportSuccessFailureCount();
