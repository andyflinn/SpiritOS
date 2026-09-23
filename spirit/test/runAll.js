'use strict';

// spirit/test/runAll.js
// Every suite, one command, one number at the end.
//
// There was no runner. Fifty-two files each had to be named by hand, so
// in practice a change got the four suites somebody remembered and the
// other forty-eight found out weeks later — which is the slow half of
// the development cycle Andy asked to shorten:
//
//   "i, visually can only run 1/1000 of the number of test you can run
//    automatically, but we both can use the same scenario"
//
// The suites are DISCOVERED, not listed. A list is a second place to
// forget something: a new suite nobody added would simply never run, and
// would look exactly like a suite that passes.
//
//   node spirit/test/runAll.js            everything
//   node spirit/test/runAll.js device     only suites whose name matches
//   node spirit/test/runAll.js --serial   one at a time, for a clean log
//
// Suites run several at a time by default because most of them are pure
// in-process work and the wall clock is dominated by the few that open a
// socket. Each is its own process already, so nothing is shared and
// nothing needed changing to allow it.

const fs = require('fs');
// ── YELLOW IS NOT RED (Andy, 2026-09-23) ───────────────────────────
//
//   "or youse a color for a specific group like yellow, so you guys
//   don't get a heart-attack anytime it's not all green"
//
// Declared-and-not-built must not read as broken, to him or to an agent.
// Red is a thing that regressed; yellow is a thing nobody has written
// yet. Turned off when the output is not a terminal, so a piped run or a
// log file stays plain text.
// AND THE LINE BETWEEN THE TWO IS SHARP (Andy): "so if a stub is already
// there and fails, it goes red, if nothing is there yet it goes yellow".
// test.awaiting asks ONE question — is the unit there — so the colour
// follows from the answer and nobody classifies anything by hand.
const TTY = !!process.stdout.isTTY;
const YELLOW = TTY ? '\u001b[33m' : '';
const RESET = TTY ? '\u001b[0m' : '';
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DIR = __dirname;

// Not suites. Libraries, builders, and the three startTest* files, which
// SPAWN A SERVER AND SIT THERE — they are how a person opens a node by
// hand, and a harness that ran them would simply hang.
const NOT_A_SUITE = [
  'testSupport.js', 'scenario.js', 'world.js', 'runAll.js',
  'labWorld.js', 'labPopulate.js', 'labMaster.js', 'setupRelayFakes.js',
  'relayProbe.js', 'startTestAndy.js', 'startTestBert.js', 'startTestRelay.js',
  // A helper, not a suite: reads a relay's roll off its disc for the suites
  // that inspect it (cycle 3).
  'rollOf.js',
  // A helper, not a suite (cycle 10, R5): sealing a post to a relay and
  // opening the answer, in one place so twenty suites cannot each grow
  // their own opinion about what a sealed reply looks like.
  'openReply.js',
  // A helper, not a suite: the first claim with the owner invite (cycle 3,
  // Part B), in process.
  'ownerClaim.js',
  // A helper, not a suite: copies the NON-IGNORED spirit/run into a
  // fixture, for the suites that spawn a real server. Replaced a blind
  // fs.cpSync that took the whole 143 MB tree — media, the brains vault
  // and relay-state's private key with it (2026-09-20).
  'plantRun.js',
  // A TOOL, NOT A SUITE. It spawns two servers, enrols 800 members, holds
  // 800 sockets and writes 11,000 rows — a minute of wall clock, and it
  // makes no pass/fail claim: it prints what a box holds
  // (README/CAPACITY.md). The same split labPopulate has, for the same
  // reason. Run it when the platform or the code moves.
  'measureCapacity.js',
  // The orchestrator for the two above — runs the harness and the capacity
  // tool in sequence so one box contributes its whole story under one date
  // and one commit. A harness that ran itself would be a loop.
  'measurePlatform.js',
  // Fails on purpose: it is the worked example of what a failing check
  // looks like, and it would be the one permanent red in every run.
  'testTemplate.js',
  // TALKS TO ANOTHER CONTINENT. Every other suite runs in process in
  // milliseconds and could run a thousand times; this one opens sockets
  // to a live relay and changes state on a box other people use. Run by
  // hand: `node spirit/test/liveRelay.js`.
  'liveRelay.js',
  // ASSERTED BY A PERSON LOOKING AT A SCREEN. It moves the world one step
  // at a time, slowly enough to be followed, and asks Andy what he sees —
  // so a harness that ran it would sit at a prompt for ever. Listed here
  // rather than left out by accident: it does not call startTest, and the
  // discovery rule below would skip it silently, which is precisely how
  // deviceAuth.js and iconIndex.js went unrun.
  'presenceShow.js',
  // A FIXTURE, NOT A SUITE. It enrols a relay full of people named after
  // consecutive lines of a play, so a ranker is asked the kind of question
  // somebody will actually ask it. Required by suites; reports nothing of
  // its own.
  'playPopulate.js',
];

// ── THE LAB SUITES ARE IN THE HARNESS NOW (2026-09-15) ───────────────
//
// `liveFrontDoor.js` was excluded here, and five more sat in
// spirit/test/labMaster/ which this file does not read at all. Between
// them they went months without going red anywhere while six of the
// seven rotted — the accounting is in labMaster/STATE.md.
//
// What it cost to find out: liveFrontDoor was reading a log file the
// product had stopped writing, so seven of its checks were asserting
// things about an empty array, and `relayAbuse` was defending a label
// rule that had been deliberately removed. Neither is the kind of thing
// a person notices by reading. Both are the kind a harness notices in
// one run.
//
// THE PRICE, AND IT IS PAID ON PURPOSE. These spawn real relays and real
// nodes on real ports: seconds each, against milliseconds for everything
// else, and the harness goes from about 25s to about a minute and a
// half. That is the trade Andy took — "more pain now, cleaner
// environment later" — on the argument that an opt-in tier is the same
// silent trap wearing a flag.
//
// They are written to coexist: distinct relay/node ports per file
// (65410-65419 and 65425-65428) and distinct labMaster row names, so
// they run in the ordinary lanes rather than needing a lane of their
// own. labMaster itself is started by THIS RUNNER before any lane, and
// stopped after the last suite — left alone if it was already up,
// because somebody may be using theirs. (This said "started by whichever
// of them gets there first" until 2026-09-19: that suite then stopped it
// on its way out while other lanes were still using it — see main().)

// Last, always. It reads the other suites off disk to check that every
// visual scenario still points at one that exists, so it should be
// answering for the tree as the run leaves it.
const LAST = 'visualScenarios.js';

const args = process.argv.slice(2);
const serial = args.indexOf('--serial') !== -1;
const filter = args.filter(function (a) { return a.charAt(0) !== '-'; })[0] || '';
const LANES = serial ? 1 : 6;

// ── WHAT THE DISCOVERY RULE SKIPPED, SAID OUT LOUD ───────────────────
//
// The rule below is right — a suite is a file that reports — but it
// FAILED SILENTLY, and that is a different thing from being wrong. A file
// missing `startTest(` was skipped with no line of output, so it looked
// exactly like a file that had passed.
//
// What that cost, found on 2026-09-17: `deviceAuth.js` reported through a
// hand-rolled `ok()` and had never once been discovered. It spent four
// days asserting `deviceByName`, `keysForName` and `checkOwner` — all
// three deliberately deleted — and threw on the first of them, so seven
// further checks had not run either. `iconIndex.js`, 31 green, was in the
// same position for want of one line.
//
// So anything skipped is NAMED. A file that genuinely is not a suite goes
// in NOT_A_SUITE, where it is a decision somebody wrote down; anything
// else shows up here until somebody deals with it.
const skipped = [];

function discover() {
  const found = fs.readdirSync(DIR).filter(function (f) {
    if (!/\.js$/.test(f)) return false;
    if (NOT_A_SUITE.indexOf(f) !== -1) return false;
    if (f === LAST) return false;
    if (filter && f.toLowerCase().indexOf(filter.toLowerCase()) === -1) return false;
    // A suite is a file that reports. Anything else in here is a module
    // somebody put beside them, and running it proves nothing.
    if (/startTest\s*\(/.test(fs.readFileSync(path.join(DIR, f), 'utf8'))) return true;
    skipped.push(f);
    return false;
  }).sort();

  if (!filter || LAST.toLowerCase().indexOf(filter.toLowerCase()) !== -1) found.push(LAST);
  return found;
}

// ── THE SWEEP THE CHILDREN CANNOT DO THEMSELVES (cycle R17) ──────────
//
// 160,116 directories were found in %TEMP% on 2026-09-20, and the disc
// contention made three consecutive runs progressively redder while each
// suite passed alone — a bug that lies about where it lives.
//
// Most of it is closed inside each suite (testSupport). What is left is the
// worlds that start a real relay: SQLite is still open when the child's own
// exit handler runs, and a locked file on Windows defeats `rmSync` —
// `force` suppresses "not found", not "in use". Those paths are appended
// here and removed below, once every child is gone.
//
// A FILE RATHER THAN A PIPE, because the writer is a dying process with one
// synchronous moment left, and `appendFileSync` is what reliably works in
// it.
const TMP_LOG = path.join(os.tmpdir(), 'spirit-tmp-log-' + process.pid + '.txt');

function sweepReportedHomes() {
  let listed = [];
  try { listed = fs.readFileSync(TMP_LOG, 'utf8').split(/\r?\n/); }
  catch (e) { return 0; }
  let gone = 0;
  listed.forEach(function (line) {
    const dir = line.trim();
    // ONLY WHAT A CHILD ACTUALLY REPORTED, and only under the temp
    // directory. This never walks %TEMP% looking for things that match a
    // pattern: a harness that deletes by shape eventually deletes somebody
    // else's work.
    if (!dir || dir.indexOf(os.tmpdir()) !== 0) return;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      if (!fs.existsSync(dir)) gone += 1;
    } catch (e) { /* still held, or already gone; neither is worth a word */ }
  });
  try { fs.rmSync(TMP_LOG, { force: true }); } catch (e) { /* as above */ }
  return gone;
}

function runOne(file) {
  return new Promise(function (done) {
    const started = Date.now();
    const child = spawn(process.execPath, [path.join(DIR, file)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // WHERE A CHILD REPORTS WHAT IT COULD NOT REMOVE (cycle R17). See
      // testSupport's reclaimTempHomes: a suite that started a real relay
      // still holds the SQLite handle at its own exit, so the removal has
      // to happen out here, after it is dead.
      env: Object.assign({}, process.env, { SPIRIT_TMP_LOG: TMP_LOG }),
    });
    let out = '';
    child.stdout.on('data', function (d) { out += d; });
    child.stderr.on('data', function (d) { out += d; });

    // A suite that hangs is a suite that fails. Left alone one of these
    // waits out a 66-second rendezvous hold and then the next one does
    // too, and the run looks broken rather than red.
    const killer = setTimeout(function () { child.kill(); }, 180000);

    child.on('close', function (code) {
      clearTimeout(killer);
      // REPORTED IS NOT THE SAME AS PASSED. A suite may legitimately have
      // no greens at all — `cycle10Pending.js` is nothing but awaiting
      // declarations — and an earlier regex that required ✅ read that as
      // "never reported", which is the worst verdict there is. So the
      // line is found first, and the three counts are read off it
      // independently.
      const said = /Test completed\./.test(out);
      const g = /✅:(\d+)/.exec(out);
      const b = /❌:(\d+)/.exec(out);
      const w = /⏳:(\d+)/.exec(out);
      done({
        file: file,
        ms: Date.now() - started,
        ok: said && g ? Number(g[1]) : 0,
        // DECLARED AND NOT BUILT (test.awaiting). Not a failure and not a
        // pass: the lines are lifted out of the output so the summary can
        // say what is waiting and for which requirement.
        waiting: said && w ? Number(w[1]) : 0,
        waitingLines: (out.match(/AWAITING [^\n]*/g) || []),
        // -1 for "never reported", which is not zero failures. A suite
        // that crashed before its last line has to read as worse than
        // one that ran and passed, not the same.
        no: said ? (b ? Number(b[1]) : 0) : -1,
        code: code,
        out: out,
      });
    });
  });
}

// EVERY REQUIREMENT THE CYCLE DOCUMENTS DECLARE, by id. Read here so the
// summary can explain a waiting assertion without the reason being typed
// a second time — the cycle file is the one place a requirement's title
// and status live, and `cycleRequirements.js` already holds it to that.
//
// A LATER CYCLE WINS a clash of ids: R13 means different things in
// different cycles (which is why citations must name their cycle), and
// what a reader wants here is the one currently being built.
// KEYED BY `<cycle-tag>/R<n>`, NOT BY THE BARE NUMBER. R19 names a
// different requirement in different cycles — which is the whole reason
// `cycleCitations.js` exists — so an awaiting assertion that said only
// "R19" would join to whichever cycle happened to sort last. The tag is
// any distinctive part of the cycle file's name, so `cycle-10/R19`
// resolves against `2026-09-23-sealed-posts-cycle-10.md`.
//
// It also means the declaration in a suite NAMES ITS CYCLE, which is the
// same rule prose is already held to.
function requirementTitles() {
  const out = Object.create(null);
  const dir = path.join(__dirname, '..', '..', 'design', 'cycles');
  let names = [];
  try { names = fs.readdirSync(dir).filter(function (f) { return f.endsWith('.md'); }).sort(); }
  catch (e) { return out; }
  names.forEach(function (name) {
    let text = '';
    try { text = fs.readFileSync(path.join(dir, name), 'utf8'); }
    catch (e) { return; }
    const cycle = name.replace(/\.md$/, '');
    const blocks = text.split(/^### (R\d+)\b/m);
    for (let i = 1; i < blocks.length; i += 2) {
      const id = blocks[i];
      const body = blocks[i + 1] || '';
      const title = (/^[^\n]*/.exec(body) || [''])[0].replace(/^\s*—\s*/, '').trim();
      const status = (/\**Status:\**\s*([A-Z]+)/.exec(body) || [null, ''])[1];
      const key = cycle + '/' + id;
      // A CYCLE NAMES THE SAME ID TWICE ON PURPOSE: `### R6` is the
      // requirement and `### <that same number> amended` is what a review changed about
      // it. Taking the last match gave the amendment's heading as the
      // title and no status at all — so the block carrying a Status line
      // is the requirement, and it wins. First in wins a tie.
      const better = !out[key] || (status && !out[key].status);
      if (better) out[key] = { title: title, status: status || '?', cycle: cycle };
    }
  });
  return out;
}

// `cycle-10/R19` -> the row, by finding the one cycle file whose name
// carries that tag. An ambiguous tag resolves to nothing rather than to a
// guess, and the summary then says the requirement is not declared, which
// is the honest answer.
function requirementFor(titles, ref) {
  const cut = String(ref).lastIndexOf('/');
  if (cut === -1) return null;
  const tag = ref.slice(0, cut);
  const id = ref.slice(cut + 1);
  const hits = Object.keys(titles).filter(function (k) {
    return k.endsWith('/' + id) && k.indexOf(tag) !== -1;
  });
  return hits.length === 1 ? titles[hits[0]] : null;
}

async function main() {
  const files = discover();
  if (!files.length) {
    console.log('no suites match ' + JSON.stringify(filter));
    process.exit(1);
  }

  console.log('\n' + files.length + ' suites' + (filter ? ' matching ' + JSON.stringify(filter) : '') +
    (serial ? ', one at a time' : ', ' + LANES + ' at a time') + '\n');

  const results = [];
  let next = 0;

  // visualScenarios goes last on its own, after everything else has
  // finished, so it reads a settled tree.
  const body = files.filter(function (f) { return f !== LAST; });
  const tail = files.filter(function (f) { return f === LAST; });

  // SUITES THAT SHARE THE FAKE NODE HOMES GO FIRST, ONE AT A TIME.
  //
  // setupRelayFakes() rewrites %TEMP%/spiritos-relay-fakes/{relay,andy,bert}
  // with copyFileSync on every call. Two suites calling it at once means one
  // is overwriting js/relay.js while the other is require()ing it out of the
  // same folder — which throws somewhere that looks nothing like the cause.
  //
  // Found the moment this runner started six at a time: relayGates failed
  // about one run in five, and passed every time it was run alone.
  //
  // Detected from the source rather than listed, for the same reason the
  // suites are discovered rather than listed — a list is a second place to
  // forget something.
  const shared = body.filter(function (f) {
    return /setupRelayFakes/.test(fs.readFileSync(path.join(DIR, f), 'utf8'));
  });

  // ONE labMaster FOR THE WHOLE RUN, owned by the runner. Suites that need
  // one call ensureMaster, and a suite that STARTED it stopped it on its way
  // out — while other lanes were still using it. On the Windows box a
  // labMaster was nearly always already up, so no suite ever owned it; the
  // first fresh Linux box (WSL, 2026-09-19) had none, and lab suites that
  // pass alone went red together. Started here, every suite finds it up and
  // owns nothing; stopped below, nothing is left running after the run.
  // A labMaster somebody already had up is theirs: ensure() reports it and
  // stop() leaves it alone. Detected from the source, like `shared`.
  const needsLab = files.some(function (f) {
    return /ensureMaster|labWorld|labPaths|127.0.0.1:65420/.test(fs.readFileSync(path.join(DIR, f), 'utf8'));
  });
  const lab = require('./labMaster/ensureMaster.js');
  if (needsLab) {
    const up = await lab.ensure();
    if (!up.ok) console.log('labMaster: ' + up.error + ' — the lab suites will say so themselves\n');
  }

  for (const f of shared) results.push(await runOne(f));

  const lanes = [];
  const all = body.filter(function (f) { return shared.indexOf(f) === -1; });
  next = 0;
  for (let i = 0; i < Math.min(LANES, all.length); i++) {
    lanes.push((async function () {
      while (next < all.length) results.push(await runOne(all[next++]));
    })());
  }
  await Promise.all(lanes);
  for (const f of tail) results.push(await runOne(f));
  lab.stop();   // only if this run started it

  // Reported in the order they were discovered, never the order they
  // happened to finish, or the same run reads differently twice.
  const byName = Object.create(null);
  results.forEach(function (r) { byName[r.file] = r; });

  let green = 0, red = 0, unhappy = [];
  files.forEach(function (f) {
    const r = byName[f];
    const broke = r.no !== 0;
    green += r.ok;
    if (r.no > 0) red += r.no;
    if (broke) unhappy.push(r);
    console.log(
      (broke ? 'FAIL  ' : '  ok  ') + f.padEnd(26) +
      String(r.ok).padStart(4) + ' ✅  ' +
      (r.no > 0 ? String(r.no).padStart(2) + ' ❌  ' : r.no < 0 ? ' ? ❌  ' : '       ') +
      // Yellow, on the suite's own row, so a run that is not all green is
      // readable at a glance as "nothing broke, some things are not
      // written yet" rather than as trouble.
      (r.waiting > 0 ? YELLOW + String(r.waiting).padStart(2) + ' ⏳' + RESET + '  ' : '      ') +
      String(r.ms).padStart(6) + 'ms'
    );
  });

  // The failing lines themselves, after the table rather than inside it.
  // A run with one red suite should still show its shape at a glance.
  // SAID BEFORE THE LINES, so the group is read as what it is. Andy:
  // *"and reasoned commets for the red group help."* Red is not the same
  // shape of problem as yellow, and a reader arriving at a wall of
  // FAILURE lines deserves the sentence that tells them which they are
  // looking at.
  if (unhappy.length) {
    console.log('\n--- RED: something that used to hold does not. These are ' +
      'unmet assertions or suites that died — not the awaiting group below, ' +
      'which is work nobody has written yet.');
  }
  unhappy.forEach(function (r) {
    console.log('\n--- ' + r.file + (r.no < 0 ? ' never reported (exit ' + r.code + ')' : ''));
    const lines = r.out.split('\n').filter(function (l) {
      return /FAILURE|Error:|at .*\.js:\d+/.test(l);
    });
    (lines.length ? lines : r.out.split('\n').slice(-12)).slice(0, 12)
      .forEach(function (l) { console.log('    ' + l.replace(/\s+$/, '')); });
  });

  // ── WHAT IS DECLARED AND NOT BUILT, WITH ITS REASON ────────────────
  //
  //   Andy, 2026-09-23: "so harness runs can be summarized with
  //   reasoning."
  //
  // The reason is not written twice. Each `test.awaiting` names its
  // requirement, and the cycle documents already carry that requirement's
  // title and status — so the two are JOINED here. A line nobody typed
  // says which requirement is waiting, what it is called, and which cycle
  // it belongs to.
  //
  // A requirement the cycle files do not know is shown all the same, with
  // the join marked missing: a suite waiting on something no document
  // declares is exactly the drift this is meant to surface.
  const waitingAll = results.filter(function (r) { return r.waiting > 0; });
  if (waitingAll.length) {
    const titles = requirementTitles();
    const byReq = Object.create(null);
    waitingAll.forEach(function (r) {
      r.waitingLines.forEach(function (line) {
        const mm = /^AWAITING (\S+)\s*\[([^\]]*)\](?:\s*\(([^)]*)\))?:\s*(.*)$/.exec(line);
        if (!mm) return;
        const id = mm[1].trim();
        const tag = mm[3] || '';
        const there = /there:(\d+)/.exec(tag);
        const cost = /cost:([^)]*)$/.exec(tag);
        (byReq[id] = byReq[id] || { units: [], suites: {} })
          .units.push({
            unit: mm[2].trim(),
            note: mm[4].replace(/\s*⏳\s*$/, '').trim(),
            there: there ? Number(there[1]) : null,
            cost: cost ? cost[1].trim() : '',
          });
        byReq[id].suites[r.file] = true;
      });
    });
    const totalWaiting = waitingAll.reduce(function (n, r) { return n + r.waiting; }, 0);
    console.log('\n--- declared, not built yet: ' + totalWaiting +
      ' assertion(s) across ' + Object.keys(byReq).length + ' requirement(s)');
    Object.keys(byReq).sort().forEach(function (id) {
      const known = requirementFor(titles, id);
      console.log('');
      console.log('    ' + YELLOW + id + RESET + '  ' +
        (known ? known.title : 'NOT DECLARED IN design/cycles — a suite waits on a requirement no document names'));
      if (known) console.log('          ' + known.cycle + ' · status ' + known.status);
      byReq[id].units.forEach(function (u) {
        // THE GUESS RIDES WITH THE THING IT IS ABOUT, and is marked a
        // guess. Andy asked for a price-note and a "%-already there" on
        // each hourglass so the yellow block reads as a plan rather than
        // a list of complaints.
        const guess = (u.there === null && !u.cost) ? ''
          : '   ~' + (u.there === null ? '?' : u.there) + '% there' +
            (u.cost ? ', guess: ' + u.cost : '');
        console.log('          missing: ' + u.unit + YELLOW + guess + RESET);
        if (u.note) console.log('                   ' + u.note);
      });
      console.log('          declared in ' + Object.keys(byReq[id].suites).join(', '));
    });
  }

  // NOT RUN, AND NOT SILENT. See the note on `skipped`: a file that looks
  // like a suite and is never discovered is indistinguishable from one
  // that passes, and that is how two of them rotted.
  if (skipped.length) {
    console.log('\n--- not run: no startTest(), so the runner cannot see them');
    skipped.forEach(function (f) { console.log('    ' + f); });
    console.log('    (add test.startTest(...), or list it in NOT_A_SUITE with a reason)');
  }

    // Every child is dead by here, so every handle that blocked a removal has
  // gone with it. Silent when there was nothing to do.
  const reclaimed = sweepReportedHomes();
  if (reclaimed) console.log('\n--- reclaimed ' + reclaimed + ' temp homes a suite could not remove itself');

  // ON THE LINE HE ACTUALLY READS. Andy: "and visible to me." A count
  // that only appears in a block above the tally is a count that gets
  // scrolled past — the tally line is the one thing everybody looks at,
  // so what is declared-and-not-built belongs on it, beside the greens.
  const waitingTotal = results.reduce(function (n, r) { return n + (r.waiting || 0); }, 0);
  console.log('\n' + files.length + ' suites, ' + green + ' green, ' + red + ' red, ' +
    unhappy.length + ' unhappy' +
    (waitingTotal ? ', ' + YELLOW + waitingTotal + ' awaiting' + RESET : '') +
    (skipped.length ? ', ' + skipped.length + ' not run' : '') + '\n');
  process.exit(unhappy.length ? 1 : 0);
}

main();
