'use strict';

// goal/G4.24, point 2: the List's search also matches an item's chat lines and its box. Red on today's tree;
// wsl-claude wrote it, claude-windows builds it.
//   Andy, 2026-10-04, under goal/G4.23 and goal/G4.24: "damn, my search still doesn't show old, closed items. i can't
//   find it either."; "yes, same principle as the agent search, it searches the lines server-side, but only brings back
//   handle/key and title, i'll have to go to details to fetch the rest."; "i'll keep this one active" (G4.24 open for
//   this point, his Go on record).
//   In the tree: searchItems (desk.js) matches the text against "(it.id + ' ' + it.title)" only; items.find, the
//   agents' search (goal/G3.13), already matches chat lines.
//
// THE SHAPES, NAMED HERE where the box names none (wsl-claude's picks; the builder may argue them in Desk first):
//   1  items.search's text matches an item's id and title, as today, and also any of its chat lines and its box, case
//      ignored, server-side. Its filters stay as they are: currentGoalOnly, goalsOnly, includeClosed.
//   2  Its answer stays the List's rows ({key, label}, the label the item's facts): the key and title he asked for are
//      in it, and the box and chat are never in it, so the dialog fetches them, as he said ("i'll have to go to details
//      to fetch the rest").
//
// LEFT OPEN, not asserted: the order of the rows when lines match (items.find puts the newest matching line first);
// whether the List marks why a row matched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const test = require('./testSupport.js');
const appClient = require('../run/spirit/appClient.js');

const OWED = 'OWED by goal/G4.24: ';
const SERVER = path.join(__dirname, '..', 'run', 'process', 'js', 'desk', 'desk.js');
const CW = { key: 'MCowBQYDK2VwAyEAdeskSearchLinesPeerCWAAAAAAAAAAAAAAAAAA=', label: 'claude-windows' };
const ANDY = { owner: true, key: 'MCowBQYDK2VwAyEAdeskSearchLinesOwnerAAAAAAAAAAAAAAAAAA=', label: 'andy' };

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function short(x) { return String(JSON.stringify(x)).slice(0, 220); }

test.startTest('goal/G4.24 point 2: the List search matches chat lines and the box');

(async function () {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-desksearchlines-'));
  const state = path.join(scratch, 'state');
  fs.mkdirSync(state, { recursive: true });
  const pipe = process.platform === 'win32' ? appClient.pipePathFor(scratch, 'desk', 'win32', 'process') : path.join(scratch, 'door.sock');
  const client = appClient.createAppClient({ rootDir: scratch });
  client.register('desk', pipe);
  const call = function (verb, args, caller) { const q = {}; q[verb] = args; return client.ask({ desk: q }, caller).then(function (r) { return r || {}; }, function () { return {}; }); };
  const search = async function (text, includeClosed) {
    const r = await call('items.search', { text: text, currentGoalOnly: false, goalsOnly: false, includeClosed: includeClosed === true }, ANDY);
    return { status: r.status, items: ((r.body || {}).items || []) };
  };
  const keys = function (r) { return r.items.map(function (x) { return x.key; }); };
  // goal/G29.21: an agent's session creates no goal, so the owner writes the world. goal/G33.7: session.set went; the
  // session is seeded before the desk starts, and the desk takes it in at start.
  test.seedDesk(state, { goal: { id: 'goal/G100', title: 'Search' }, items: [
    { id: 'goal/G100.1', title: 'Alpha', blocks: ['goal/G100'] },
    { id: 'goal/G100.2', title: 'Beta', blocks: ['goal/G100'] },
    { id: 'goal/G100.3', title: 'Gamma', blocks: ['goal/G100'] }] });
  const kid = spawn(process.execPath, [SERVER, '{}', '--pipe', pipe, '--state', state], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  try {
    for (let i = 0; i < 60; i++) { await sleep(150); try { const r = await client.ask('api'); if (r.body && r.body.desk && r.body.desk.ok !== false) break; } catch (e) { /* not yet */ } }
    // Since goal/G18.8 an agent writes only where it holds the item or the take of his line.
    await call('item.take', { id: 'goal/G100.2' }, CW);
    await call('chat.add', { id: 'goal/G100.2', text: 'we tested the fs-watch library here' }, CW);
    await call('box.write', { id: 'goal/G100.3', text: 'NOTES\nchokidar is the library', version: 0 }, CW);

    // goal/G18.5: the text ranks, it no longer filters, so "finds" here means "ranks first".
    test.subHeading('1. the text matches chat lines and the box, as well as id and title');
    const byLine = await search('fs-watch');
    if (keys(byLine)[0] === 'goal/G100.2') test.check('"fs-watch", in a chat line of goal/G100.2 only, ranks goal/G100.2 first');
    else test.fail(OWED + 'items.search "fs-watch" answered ' + short(keys(byLine)));
    const upper = await search('FS-WATCH');
    if (keys(upper)[0] === 'goal/G100.2') test.check('case is ignored');
    else test.fail(OWED + 'items.search "FS-WATCH" answered ' + short(keys(upper)));
    const byBox = await search('chokidar');
    if (keys(byBox)[0] === 'goal/G100.3') test.check('"chokidar", in the box of goal/G100.3 only, ranks goal/G100.3 first');
    else test.fail(OWED + 'items.search "chokidar" answered ' + short(keys(byBox)));
    const byTitle = await search('alpha');
    if (keys(byTitle)[0] === 'goal/G100.1') test.check('a title still matches ("alpha" ranks goal/G100.1 first)');
    else test.fail('items.search "alpha" answered ' + short(keys(byTitle)));

    test.subHeading('2. the rows stay the List\'s rows, and the filters still hold');
    const row = byLine.items.filter(function (x) { return x.key === 'goal/G100.2'; })[0];
    let f = null; try { f = JSON.parse(row.label); } catch (e) { f = null; }
    if (f && f.id === 'goal/G100.2' && f.title === 'Beta' && f.box === undefined && f.chat === undefined) test.check('the row carries key and title in the item\'s facts, never its box or chat');
    else test.fail(OWED + 'the row for goal/G100.2 was ' + short(row));
    await call('press', { id: 'goal/G100', what: 'end-design' }, ANDY);
    await call('press', { id: 'goal/G100.2', what: 'close' }, ANDY);
    const hidden = await search('fs-watch', false);
    const shown = await search('fs-watch', true);
    if (keys(hidden).indexOf('goal/G100.2') === -1 && keys(shown).indexOf('goal/G100.2') !== -1) test.check('closed, goal/G100.2 is found by its line with includeClosed only');
    else test.fail(OWED + 'closed goal/G100.2 by its line: without includeClosed ' + short(keys(hidden)) + ', with ' + short(keys(shown)));
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
