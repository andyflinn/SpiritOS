'use strict';

// spirit/test/agentReadme.js
// goal/G33.5: the documentation the agents' verifiers generate. The box (v11), Andy's words among it: every agent's
// README.md in the measurement tree has its name for title, then "Machine Description", "a full account of the actual
// system the measurements were taken on, including OS/platform, total RAM and RAM used at the time ..., the release and
// identity of the installed node.js, the number of node servers running on that system"; then "Summary", in bullets:
// "the number of members that can be served with a 512MB allotment of RAM", "the number of streams that implies with 3
// live streams per member, naming what the streams are for", "how many peers can be remembered with also 512 MB allotted
// disk-space"; then "Measurements", the table of the detailed files. The repo README "should start with the section
// 'How to get started', immediately followed by" the section "What one small server holds": the members served with
// 512 MB of RAM and that allotment beside it, from the reference agent claude-ubuntu with the date of its set, and a link
// to the agents tree; no other figure; no figure until a set measured the new way exists. Andy chose (box v11) that the
// relay exports its admission rule, so the figure is the relay's own rule applied to the measured relay at rest.
//
// WHAT IS ASSERTED, on fixtures (no measurement is run here; never lab* or measureCapacity):
//   1. js/relay.js exports allowanceFor, SEAT_STREAMS and STREAMS_PER_MB.
//   2. The agent README from a fixture set: title, then Machine Description (platform, total RAM, RAM used, node.js
//      release and identity, SpiritOS node processes), Summary (three bullets in that order, the members figure being
//      the relay's rule at 512 MB on the set's relayAtRestRss, the streams named, the peers per 512 MB of disk from
//      perReachablePeerBytes), then Measurements (the table linking the detail files); and the summary.json it writes.
//   3. The repo README's section: placed right after "How to get started", which follows the title; with no new-format
//      set it carries no figure, only its title and the link; with one, the members figure beside 512 MB, claude-ubuntu
//      and its date, and no other number; the old capacity section is gone; the rest of the page is untouched.

const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G33.5: ';
const RUN = path.join(__dirname, '..', 'run');

test.startTest('goal/G33.5: the agents\' generated documentation and the repo README\'s one figure');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-agentreadme-'));

// A fixture set as measurePlatform and publishData leave it.
const CAP = {
  measuredAt: '2026-10-24T00:10:17.201Z', commit: 'cb790a62', platform: 'linux', release: '7.0.0-38-generic',
  node: 'v22.23.3', cpus: 6, totalRamBytes: 7626915840, relayAtRestRss: 57 * 1048576, perReachablePeerBytes: 585,
};
const MACHINE = {
  platform: 'linux', os: 'Linux 7.0.0-38-generic', arch: 'x64', totalRamBytes: 7626915840, usedRamBytes: 3221225472,
  node: { release: 'node', version: 'v22.23.3', lts: 'Jod', path: '/usr/bin/node' }, spiritNodes: 2, at: '2026-10-24T08:00:00.000Z',
};

(function () {
  test.subHeading('1. the relay exports its admission rule');
  let relay = null;
  try { relay = require(path.join(RUN, 'js', 'relay.js')); } catch (e) { relay = null; }
  if (relay && typeof relay.allowanceFor === 'function' && relay.SEAT_STREAMS === 3 && relay.STREAMS_PER_MB === 16) test.check('js/relay.js exports allowanceFor, SEAT_STREAMS (3) and STREAMS_PER_MB (16)');
  else test.fail(OWED + 'js/relay.js exports ' + (relay ? JSON.stringify(Object.keys(relay)) : 'nothing it loads'));

  test.subHeading('2. an agent\'s README: Machine Description, Summary, Measurements');
  const out = path.join(scratch, 'agents', 'claude-ubuntu');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'capacity.json'), JSON.stringify(CAP));
  ['platform.md', 'harness.txt', 'capacity.md', 'packets.md', 'testState.md'].forEach(function (f) { fs.writeFileSync(path.join(out, f), 'x\n'); });
  let writer = null;
  try { writer = require(path.join(RUN, 'process', 'js', 'deskClient', 'agentReadme.js')); } catch (e) { writer = null; }
  if (!writer || typeof writer.write !== 'function') { test.fail(OWED + 'there is no process/js/deskClient/agentReadme.js with write(out, agent, machine)'); return; }
  try { writer.write(out, 'claude-ubuntu', MACHINE); } catch (e) { test.fail(OWED + 'write threw: ' + e.message); return; }
  const md = fs.readFileSync(path.join(out, 'README.md'), 'utf8');
  const at = function (s) { return md.indexOf(s); };
  const order = [at('# claude-ubuntu'), at('## Machine Description'), at('## Summary'), at('## Measurements')];
  if (order.every(function (x, i) { return x !== -1 && (i === 0 || x > order[i - 1]); }) && at('# claude-ubuntu') === 0) test.check('title, then Machine Description, Summary and Measurements, in that order');
  else test.fail(OWED + 'the sections stand at ' + JSON.stringify(order) + ':\n' + md.slice(0, 400));
  const machine = md.slice(at('## Machine Description'), at('## Summary'));
  const facts = [/linux/i, /7,?274 MB|7\.1 GB|7626915840/, /3,?072 MB|3\.0 GB|3221225472/, /v22\.23\.3/, /\/usr\/bin\/node/, /SpiritOS node processes[^\n]*2|2[^\n]*SpiritOS node processes/];
  const missing = facts.filter(function (re) { return !re.test(machine); });
  if (!missing.length) test.check('Machine Description names the platform, total RAM, RAM used, the node.js release and its path, and the SpiritOS node processes');
  else test.fail(OWED + 'Machine Description misses ' + missing.map(String).join(', ') + ':\n' + machine);
  const relayRule = relay && typeof relay.allowanceFor === 'function' ? Math.floor(relay.allowanceFor(512, CAP.relayAtRestRss / 1048576) / relay.SEAT_STREAMS) : -1;
  const peers = Math.floor(512 * 1048576 / CAP.perReachablePeerBytes);
  const bullets = md.slice(at('## Summary'), at('## Measurements')).split('\n').filter(function (l) { return /^\s*[-*] /.test(l); });
  const num = function (s) { return Number(String(s).replace(/,/g, '')); };
  const first = /([\d,]+) members/.exec(bullets[0] || '');
  const second = /([\d,]+) (live )?streams/.exec(bullets[1] || '');
  const third = /([\d,]+) peers/.exec(bullets[2] || '');
  if (bullets.length === 3 && first && num(first[1]) === relayRule && /512 MB/.test(bullets[0])) test.check('the first bullet: ' + bullets[0].trim());
  else test.fail(OWED + 'the first Summary bullet should be ' + relayRule + ' members at 512 MB of RAM; the bullets are ' + JSON.stringify(bullets));
  if (second && num(second[1]) === relayRule * 3 && /home node/i.test(bullets[1]) && /face/i.test(bullets[1]) && /upload/i.test(bullets[1])) test.check('the second bullet names the streams: ' + (bullets[1] || '').trim());
  else test.fail(OWED + 'the second Summary bullet should be ' + relayRule * 3 + ' streams, naming each: ' + JSON.stringify(bullets[1]));
  if (third && num(third[1]) === peers && /512 MB/.test(bullets[2])) test.check('the third bullet: ' + (bullets[2] || '').trim());
  else test.fail(OWED + 'the third Summary bullet should be ' + peers + ' peers with 512 MB of disk: ' + JSON.stringify(bullets[2]));
  const table = md.slice(at('## Measurements'));
  if (['platform.md', 'harness.txt', 'capacity.md', 'packets.md', 'testState.md'].every(function (f) { return table.indexOf('](' + f + ')') !== -1; })) test.check('Measurements is the table linking the detail files');
  else test.fail(OWED + 'Measurements reads:\n' + table);
  let summary = null;
  try { summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8')); } catch (e) { summary = null; }
  if (summary && summary.members === relayRule && summary.ramMB === 512 && summary.measuredAt === CAP.measuredAt) test.check('summary.json carries the members figure, its 512 MB and the set\'s date');
  else test.fail(OWED + 'summary.json reads ' + JSON.stringify(summary));

  test.subHeading('3. the repo README: How to get started, then What one small server holds');
  let page = null;
  try { page = require(path.join(__dirname, 'publishCapacity.js')); } catch (e) { page = null; }
  if (!page || typeof page.place !== 'function') { test.fail(OWED + 'publishCapacity.js exports no place(readme, summary, agent)'); return; }
  const DRAFT = ['# SpiritOS', '', 'ANDYS-INTRO paragraph.', '', '## how to get started.', '```', 'npm start', '```', '', 'START-TEXT', '',
    '## Promises', '', '- PROMISE-ONE', '', '## The capacity of a relay/router hosted on a VPS', '', 'Measured, not estimated.', '',
    '<!-- capacity:ubuntu-relay:start — generated by spirit/test/publishCapacity.js; do not edit by hand -->', '', '**A VPS with 1 GB of RAM holds live connections for about 2,000 members.**', '',
    '<!-- capacity:ubuntu-relay:end -->', '', '## Aditional features of personal nodes', '', 'FEATURES-TEXT', ''].join('\n');
  const empty = page.place(DRAFT, null, 'claude-ubuntu');
  const sections = empty.split('\n').filter(function (l) { return /^## /.test(l); });
  const sectionOf = function (txt) { const s = txt.indexOf('## What one small server holds'); const e = txt.indexOf('\n## ', s + 3); return txt.slice(s, e === -1 ? txt.length : e); };
  const blank = sectionOf(empty);
  const kept = ['ANDYS-INTRO paragraph.', 'START-TEXT', 'PROMISE-ONE', 'FEATURES-TEXT'].every(function (x) { return empty.indexOf(x) !== -1; });
  if (/^# SpiritOS/.test(empty) && /^## how to get started/i.test(sections[0] || '') && sections[1] === '## What one small server holds' && !/\d/.test(blank.replace(/\(agents\/\)/, '')) && /\]\(agents\/\)/.test(blank) && !/capacity of a relay/.test(empty) && kept) test.check('How to get started first, then What one small server holds with no figure, only its link; the old section is gone, Andy\'s text stays');
  else test.fail(OWED + 'the page reads, sections ' + JSON.stringify(sections) + ', section:\n' + blank + '\nAndy\'s text kept ' + kept);
  const SUM = { members: 2402, ramMB: 512, measuredAt: '2026-10-24T00:10:17.201Z', commit: 'cb790a62' };
  const full = sectionOf(page.place(DRAFT, SUM, 'claude-ubuntu'));
  const numbers = (full.replace(/\(agents\/\)/, '').match(/\d[\d,]*/g) || []).map(function (s) { return s.replace(/,/g, ''); });
  const allowed = ['2402', '512', '2026', '10', '24'];
  if (/2,?402/.test(full) && /512 MB/.test(full) && /claude-ubuntu/.test(full) && /2026-10-24/.test(full) && numbers.every(function (x) { return allowed.indexOf(x) !== -1; })) test.check('with a new-format set: the members figure beside 512 MB, claude-ubuntu and its date, and no other number');
  else test.fail(OWED + 'with a summary the section reads:\n' + full);
}());

try { fs.rmSync(scratch, { recursive: true, force: true }); } catch (e) { /* the OS clears tmp */ }
test.reportSuccessFailureCount();
