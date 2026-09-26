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
  // NOT A SUITE AND DELIBERATELY SO: the rows an agent writes by hand when
  // it stops and waits for Andy. It reports nothing and asserts nothing —
  // the board reads it. Listed here rather than given a startTest, because
  // a block is a DECLARATION about the world and not a claim about the
  // code (see its own header for why the board's "blocked is a join, not a
  // flag" rule cannot serve this one).
  'blocking.js',
  // A TOOL, not a suite: rewrites the front page's generated capacity
  // block from the Ubuntu measurement (Andy, 2026-09-23 — "the front page
  // README.md should have a marked block that will be auto-updated with
  // the ubuntu-relay capacity only"). It writes a file and makes no
  // pass/fail claim; `capacityFresh.js` is the suite that holds it honest.
  'publishCapacity.js',
  // A helper, not a suite (cycle 10, R5): sealing a post to a relay and
  // opening the answer, in one place so twenty suites cannot each grow
  // their own opinion about what a sealed reply looks like.
  'openReply.js',
  // A helper, not a suite: the first claim with the owner invite (cycle 3,
  // Part B), in process.
  'ownerClaim.js',
  // A BUILDER, not a suite (cycle 2): the four worlds an app server can
  // find itself in — a relay nobody claimed, a relay with every seat
  // taken, an owner node that is not running, a second relay with a
  // different key. It makes no pass/fail claim; `appServerBoundary.js` is
  // the suite that asserts against the worlds it builds.
  //
  // NAMED HERE RATHER THAN LEFT TO BE NOTICED, because this file family
  // has form: two suites rotted for months because the runner could not
  // see them, which is why this list carries a reason per entry instead
  // of only a name.
  'appServerWorlds.js',
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
      const s = /⏭:(\d+)/.exec(out);
      done({
        file: file,
        ms: Date.now() - started,
        ok: said && g ? Number(g[1]) : 0,
        // DECLARED AND NOT BUILT (test.awaiting). Not a failure and not a
        // pass: the lines are lifted out of the output so the summary can
        // say what is waiting and for which requirement.
        waiting: said && w ? Number(w[1]) : 0,
        waitingLines: (out.match(/AWAITING [^\n]*/g) || []),
        // STOOD DOWN (test.standsDown). The suite ran, diagnosed its own
        // environment and declined — not a pass, not a failure, and the
        // reason is lifted out so a green board never quietly means less
        // than it did yesterday.
        stood: said && s ? Number(s[1]) : 0,
        stoodLines: (out.match(/STOOD DOWN[^\n]*/g) || []),
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
  // ── A DESIGN SITTING DOES NOT PRODUCE A CYCLE FILE (wsl-claude) ──
  //
  // CLAUDE.md: a design sitting lands its durable result under
  // design/<area>/, not design/cycles/ — and its requirements are as
  // real as any of a cycle. Reading only design/cycles meant every
  // declaration citing one was reported as naming nothing, with the same
  // tempting escape the C-headings had: move the document to the wrong
  // folder so the tool can see it.
  //
  // So the whole of design/ is walked and the key stays what it was: the
  // name of the file. A requirement is found where its document lives
  // rather than where a reader happened to look first.
  const root = path.join(__dirname, '..', '..', 'design');
  const files = [];
  (function walk(dir) {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    entries.sort(function (a, b) { return a.name < b.name ? -1 : 1; }).forEach(function (e) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) files.push(p);
    });
  }(root));
  if (!files.length) return out;
  files.forEach(function (full) {
    const name = path.basename(full);
    let text = '';
    try { text = fs.readFileSync(full, 'utf8'); }
    catch (e) { return; }
    const cycle = name.replace(/\.md$/, '');
    // ── A CONDITION IS A HEADING OF THE SAME KIND (wsl-claude) ──────
    //
    // A cycle document holds REQUIREMENTS it promised and CONDITIONS it
    // discovered and did not: within one cycle a C-heading is as real as
    // an R-heading, lives in the same file, and a suite may legitimately
    // wait on one. Reading only R-numbers meant a declaration citing a
    // condition was reported as naming nothing, and the escape was to
    // relabel it as a requirement — which would claim the cycle promised
    // something it did not.
    //
    // The deeper hole it closes: C1 and C2 sit in cycle 11 today and
    // nothing anywhere would notice if they were forgotten. A
    // requirement cannot leave the board; a condition could never get
    // onto it.
    const blocks = text.split(/^### ([RCG]\d+)\b/m);
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
      // THE GUARD WAS DEAD. It read `!out[key].status`, and the line below
      // stores `status || '?'`, so the field was never falsy and the block
      // carrying a Status line could never win — first in won every tie,
      // which is the opposite of what the comment above promises. A
      // requirement whose first block is the amendment was therefore
      // recorded with no status at all, and a requirement with no status
      // cannot be reported as OPEN. Compare against the '?' that is
      // actually stored.
      const better = !out[key] || (status && out[key].status === '?');
      // `file` is kept because the board now groups uncounted requirements
      // by the document that declares them; `cycle` is the bare name and
      // cannot be clicked.
      if (better) out[key] = { title: title, status: status || '?', cycle: cycle, file: full };
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
  // CASE IS NOT MEANING (wsl-claude): design/cycles files are
  // lower-case and a design sitting's document may not be, so an
  // exact-case tag match reports a correct citation as naming
  // nothing — which is the third costume of the same narrowness.
  const lower = tag.toLowerCase();
  const hits = Object.keys(titles).filter(function (k) {
    return k.endsWith('/' + id) && k.toLowerCase().indexOf(lower) !== -1;
  });
  return hits.length === 1 ? titles[hits[0]] : null;
}

// ── THE TWO SECTIONS ANDY READS, RENDERED ONCE ───────────────────────
//
//   Andy, 2026-09-26: "i see nothing on the board that needs me."
//
// He was reading BOARD.md. The sections had been built into SCOREBOARD.md,
// which is a different file and not the one he keeps open — rule 14 names
// BOARD.md as that one. So the work was correct and invisible, which is the
// same outcome as not doing it.
//
// His standing rule is that there must never be a second place to look, so
// these render from one function into both files rather than being written
// twice and drifting. What is red goes FIRST: a decision he owes can wait a
// day, something that used to hold and does not cannot.
function redSection(failing) {
  const out = [];
  if (!failing || !failing.length) return out;
  out.push('## What is red');
  out.push('');
  out.push('**Something that used to pass now fails.** These are broken, not ' +
    'unfinished — the owed list further down is work nobody has written yet.');
  out.push('');
  failing.forEach(function (f) {
    out.push('**❌ `' + f.file + '`** — ' +
      (f.died ? 'the test stopped without saying why (exit ' + f.code + ')'
        : f.no === 1 ? 'one check no longer passes'
        : f.no + ' checks no longer pass') + '.');
    if (f.lines && f.lines.length) {
      out.push('');
      // THE LOG LINE IS NOT A SENTENCE. Andy, 2026-09-26: "it's not in
      // english." What was printed here was the console's own raw output —
      // `***   FAILURE #1.1:` in front, a red cross behind, and a JSON blob
      // cut off mid-string. The reason is the only part that means anything
      // to a reader, so that is the only part kept.
      f.lines.forEach(function (l) {
        const why = String(l)
          .replace(/^\**\s*/, '')
          .replace(/^FAILURE\s+#[\d.]+:\s*/, '')
          .replace(/\s*❌\s*$/, '')
          .trim();
        out.push('  - ' + (why.length > 160 ? why.slice(0, 157) + '…' : why));
      });
    }
    out.push('');
  });
  out.push('---');
  out.push('');
  return out;
}

// GROUPED BY DOCUMENT, NEVER ENUMERATED, except for a document this cycle
// cites. Attention is the constraint: a page listing 26 rows fails the same
// way a silent one does.
// AN AGENT IS STOPPED AND WAITING ON HIM. Read from `blocking.js`, which is
// the only declaration on this page an agent writes by hand — see that file
// for why a join cannot serve here: a block is an EVENT, and nothing in the
// tree changes when one happens.
//
// A missing file is not an error. It means nobody is blocked, which is the
// normal state and must not be reported as trouble.
function openBlocks() {
  try {
    const rows = require('./blocking.js');
    return Array.isArray(rows) ? rows : [];
  } catch (e) { return []; }
}

function ageWordsFromDay(day) {
  const t = Date.parse(String(day) + 'T00:00:00Z');
  if (!t) return '';
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return 'today';
  return days === 1 ? 'yesterday' : days + ' days ago';
}

function needsYouSection(titles, declaredIds, blockedRows) {
  const out = [];
  const uncounted = uncountedOpen(titles, declaredIds);
  const blocked = blockedRows || [];
  const stopped = openBlocks();
  if (!blocked.length && !uncounted.length && !stopped.length) return out;
  out.push('## What needs you');
  out.push('');

  // FIRST, AND SEPARATELY FROM THE BACKLOG. Andy, 2026-09-26: "as soon as i
  // block, the board needs to show it." A requirement that has sat open for
  // two weeks and an agent that stopped an hour ago are not the same kind of
  // thing, and putting them in one list buries the one that is costing time
  // now. The age is printed because a row nobody cleared has to read as
  // stale rather than as urgent.
  if (stopped.length) {
    out.push('### Someone is stopped, waiting for you');
    out.push('');
    out.push(stopped.length === 1
      ? '**One agent cannot go on until you answer.**'
      : '**' + stopped.length + ' things are stopped until you answer.**');
    out.push('');
    stopped.forEach(function (b) {
      const age = ageWordsFromDay(b.asked);
      out.push('**⛔ ' + String(b.decision || '(no decision named)') + '**');
      out.push('');
      out.push('- *Asked ' + (age || String(b.asked)) + ' by ' + (b.who || 'an agent') + '.*');
      if (b.costs) out.push('- **What it is holding up:** ' + b.costs);
      if (b.why) out.push('- **Why it is yours:** ' + b.why);
      out.push('');
    });
    out.push('');
  }

  blocked.forEach(function (r) {
    out.push('**⛔ ' + r.title + '** — blocked on ' + r.blocked + '.');
    out.push('');
  });
  if (uncounted.length) {
    const live = liveDocuments();
    const byDoc = Object.create(null);
    uncounted.forEach(function (k) {
      // The repo root from here, not `REPO` — that one is local to
      // writeScoreboard, and this renderer serves more than one caller.
      const f = path.relative(path.join(__dirname, '..', '..'), String(titles[k].file || '?'))
        .split(path.sep).join('/');
      (byDoc[f] = byDoc[f] || []).push(k);
    });
    // PLAIN ENGLISH, BECAUSE HE ASKED FOR IT. Andy, 2026-09-26: "try english
    // next time." The first version said "26 requirement(s) say OPEN in a
    // document and no declaration counts them", which is accurate and tells
    // him nothing about what to DO. A page he has to translate costs the
    // attention it was built to save.
    out.push('### Older questions, no hurry');
    out.push('');
    out.push('**' + Object.keys(byDoc).length + ' document(s) still hold a decision ' +
      'only you can make.** Each one says a requirement is open, and no test is ' +
      'watching it — so if the work was dropped, nothing will notice.');
    out.push('');
    out.push('For each: **is it still wanted, has a later cycle replaced it, or is it ' +
      'abandoned?** Say which and it either gets a test or gets closed.');
    out.push('');
    Object.keys(byDoc).sort().forEach(function (f) {
      const ids = byDoc[f].map(function (k) { return k.slice(k.lastIndexOf('/') + 1); }).sort();
      // TITLES, NOT IDS. Andy's standing rule: "report requirements to Andy by
      // title; the id is the agents' join key". The first version listed
      // a row of bare numbers, which tells him nothing he can decide
      // on without opening the file — the exact cost the page exists to save.
      const named = byDoc[f].map(function (k) { return titles[k].title; });
      if (live[f]) {
        // A DOCUMENT THIS CYCLE CITES IS LIVE WORK, not an old question, and
        // the sentence has to say so or he triages it with the rest.
        named.forEach(function (t) {
          out.push('- **' + t + '** — live work in `' + f + '`, and no test is watching it.');
        });
      } else {
        out.push('- In `' + f + '`, ' + (named.length === 1 ? 'one thing is' : named.length + ' things are') +
          ' still marked open with no test watching:');
        named.forEach(function (t) { out.push('    - ' + t); });
      }
    });
    out.push('');
  }
  out.push('---');
  out.push('');
  return out;
}

// OPEN IN A DOCUMENT AND COUNTED BY NOTHING. One computation, because the
// headline and the section have to agree: the summary line used to count only
// `needing` and so printed "nothing waiting on you" directly above a list of
// 26 things waiting on him.
//
// It resolves a declared id the way requirementFor does — case-insensitively,
// on the tail after the last slash plus a substring match on the tag — so a
// declaration counts its requirement whatever the document's filename case.
// Anything left saying OPEN is owed by somebody and on no board at all.
function uncountedOpen(titles, declaredIds) {
  const counted = Object.create(null);
  (declaredIds || []).forEach(function (ref) {
    const cut = String(ref).lastIndexOf('/');
    if (cut === -1) return;
    const tag = String(ref).slice(0, cut).toLowerCase();
    const id = String(ref).slice(cut + 1).toLowerCase();
    const hits = Object.keys(titles).filter(function (k) {
      return k.toLowerCase().endsWith('/' + id) && k.toLowerCase().indexOf(tag) !== -1;
    });
    if (hits.length === 1) counted[hits[0]] = true;
  });
  return Object.keys(titles).filter(function (k) {
    return titles[k].status === 'OPEN' && !counted[k];
  }).sort();
}

// WHICH DOCUMENTS ARE THIS CYCLE'S. The live `*Pending.js` files cite the
// documents their requirements come from, so the citations ARE the answer —
// no list to maintain and nothing to forget to update when a cycle closes.
// A design with no pending file is not this cycle, which is the point.
function liveDocuments() {
  const out = Object.create(null);
  let names = [];
  try { names = fs.readdirSync(__dirname); } catch (e) { return out; }
  names.filter(function (f) { return /Pending\.js$/.test(f); }).forEach(function (f) {
    let text = '';
    try { text = fs.readFileSync(path.join(__dirname, f), 'utf8'); }
    catch (e) { return; }
    (text.match(/design\/[A-Za-z0-9/._-]*\.md/g) || []).forEach(function (d) {
      out[d] = true;
    });
  });
  return out;
}

// ── BOARD.md — THE ONE ANDY KEEPS OPEN (rule 14) ─────────────────────
//
//   Andy, 2026-09-24: "is the board a document i can keep in a window
//   and gets updated automatically as the cycles progress?" — and, on
//   whose job it is: "lead maintains the board-display?"
//
// Written from `byReq`, which is the SAME structure the console board
// above is printed from. One source, so the file and the terminal cannot
// disagree — a second reader over the same declarations would be a
// second opinion about the work, which is the failure this whole board
// exists to prevent.
//
// ── IT HOLDS THE ROWS AND NOT THE TALLY, ON PURPOSE ─────────────────
//
// The green count moves every time a suite gains an assertion. The
// declarations move only when WORK moves. So the file is a pure function
// of what is declared: two runs over an unchanged tree produce an
// identical file, and every change he sees in that window is real
// progress rather than noise. That is the whole reason it can be left
// open.
//
// It is also identical on both platforms for the same reason —
// declarations are read from the tree, not measured on a box — so
// neither agent's run fights the other's in git.
//
// ── THE DISPLAY MAY NEVER INTERPRET (rule 14) ───────────────────────
//
// Every line below is the declarer's own: the requirement's title from
// its document, the unit, the note, the %-there and the cost note as
// written. Nothing here summarises, ranks or rewords. A display that
// summarises becomes a second opinion, and this is the one artefact he
// reads without re-deriving it.
//
// ── AND ITS ONE HONEST LIMIT, SAID IN THE FILE ITSELF ───────────────
//
// It is written by a full harness run, so a tree whose declarations
// changed without one is a tree this file does not describe. Detecting
// that would need a second parser over the same declarations, which is
// the drift above. So the file says how it was made and what would make
// it wrong, rather than pretending to a freshness it cannot check.
// ── THE SCOREBOARD — WHAT HE OPENS, NOT WHAT WE OPEN (rule 14) ───────
//
//   Andy, 2026-09-25, approving the sample: "good nough for now, if that
//   can be kept running during jobs, i ll be grateful." And the order,
//   given explicitly: "1, summary 2. what needs me. then the rest."
//
// WRITTEN BY THE RUN, for his sentence above: a separate tool is a thing
// somebody has to remember, and a stale scoreboard is worse than none.
// Same emitter as BOARD.md, same `byReq`, SEPARATE OUTPUT AND SEPARATE
// PROMISE.
//
// ── WHY IT IS NOT BOARD.md, AND WHY THERE IS ONE PER BOX ────────────
//
// BOARD.md promises above that it holds the rows and not the tally, so
// that "two runs over an unchanged tree produce an identical file" and
// "neither agent's run fights the other's in git". THIS FILE BREAKS BOTH
// DELIBERATELY: it carries the tally, which moves every run, and the
// provenance of the box that measured it.
//
// So it is per box, named from `.spiritbox`. Two agents ran the same
// tree today and got 3120 and 3092 — both correct, the difference being
// six lab suites that stand down on one box. ONE SHARED FILE WOULD HAVE
// DESTROYED EXACTLY THAT INFORMATION, silently, and he would have seen
// whichever of us ran last.
//
// ── THE RUN LOG IS THE WORKING-OUT AND DOES NOT TRAVEL (0020) ───────
//
// One row per run in `spirit/test/scoreboard-runs.log` — caught by the
// existing `*.log` ignore, so no shared file had to be edited to make
// room for it. BOARD.md is overwritten, so state survives and MOVEMENT
// is thrown away; a row per run is the whole of what "what moved" needs.
//
// ── AND THE PERCENTAGES ARE GUESSES AND THE PAGE SAYS SO ────────────
//
// testSupport calls them "printed as guesses... not to be believed
// afterwards". A progress bar makes a guess look measured, which is the
// wrong direction in a week spent replacing remembered facts with
// derived ones. The bar is drawn because he asked for the shape; the
// sentence under it is what keeps it honest.
let lastBoard = { byReq: Object.create(null), titles: Object.create(null) };

// `preRows` and `stale` are the fast path: --board replays the last full
// run's rows rather than running 154 suites to learn what it already
// recorded. See the --board branch in main().
function writeScoreboard(byReq, titles, tally, preRows, stale, replay) {
  const NL = String.fromCharCode(10);
  const REPO = path.join(DIR, '..', '..');
  const box = (function () {
    try { return require('./tools/box.js').resolve().agent || ''; } catch (e) { return ''; }
  }()) || 'this-box';
  const RUNS = path.join(DIR, 'scoreboard-runs.log');

  function git(args) {
    try {
      return require('child_process').execFileSync('git', args, {
        cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch (e) { return ''; }
  }

  const head = git(['rev-parse', '--short', 'HEAD']) || '(no commit)';
  // THE STAMP IS THE COMMIT THAT PRODUCED THE NUMBERS, NOT THE ONE WE ARE
  // STANDING ON. Andy, 2026-09-26, on how this page refreshes:
  // "event-driven" — so it is re-rendered whenever an agent changes
  // something, and the measured half is replayed from the last full run.
  // Stamping it with HEAD would credit a tally to a commit that never
  // produced it, which is the same lie as a subset board wearing a full
  // board's numbers. The first version did exactly that: it replayed the
  // run at 9c22cce and printed `run bf7b48a`.
  const commit = (replay && stale) ? stale : head;
  const isStale = replay && stale && stale !== head;
  const ids = Object.keys(byReq).sort();

  // AGE FROM THE TREE, NOT FROM A FIELD ANYBODY MAINTAINS. The first
  // commit that introduced the id into its declaring suite is when the
  // requirement started being owed.
  function owedSince(id) {
    const files = Object.keys(byReq[id].suites);
    let oldest = 0;
    files.forEach(function (f) {
      const out = git(['log', '--format=%at', '-S', id, '--', path.join('spirit', 'test', f)]);
      const lines = out ? out.split(NL).filter(Boolean) : [];
      const first = lines.length ? Number(lines[lines.length - 1]) : 0;
      if (first && (!oldest || first < oldest)) oldest = first;
    });
    return oldest;
  }
  function ageWords(at) {
    if (!at) return '?';
    const days = Math.floor((Date.now() / 1000 - at) / 86400);
    if (days <= 0) return 'today';
    return days === 1 ? '1 day' : days + ' days';
  }

  // BLOCKED IS A JOIN, NOT A FLAG. Nobody sets it: the requirement's own
  // document says what it waits on, and a flag somebody had to remember
  // to set would be the remembered fact this whole page is against.
  function blockedNote(known) {
    if (!known) return '';
    const said = String(known.status || '') + ' ' + String(known.title || '');
    const m = /blocked on ([^.,;]+)/i.exec(said);
    if (m) return m[1].trim();
    return /\bblocked\b/i.test(said) ? 'something not named' : '';
  }

  const rows = preRows || ids.map(function (id) {
    const known = requirementFor(titles, id);
    const units = byReq[id].units;
    const there = units.reduce(function (n, u) {
      return u.there === null ? n : Math.max(n, u.there);
    }, 0);
    const anyThere = units.some(function (u) { return u.there !== null; });
    return {
      id: id,
      title: known ? known.title : id + ' — no document names this requirement',
      there: anyThere ? there : null,
      blocked: blockedNote(known),
      at: owedSince(id),
    };
  });

  // ── WHAT MOVED: the previous row, or an honest absence ──────────────
  let prev = null;
  const history = [];
  try {
    fs.readFileSync(RUNS, 'utf8').trim().split(NL).filter(Boolean).forEach(function (l) {
      try { history.push(JSON.parse(l)); } catch (e) { /* a bad line is not a run */ }
    });
    if (history.length) prev = history[history.length - 1];
  } catch (e) { prev = null; }

  // WHEN HE LAST UNBLOCKED IT. The most recent run that still listed a
  // requirement as blocked is the last moment it was waiting on him, so
  // anything owed since then has been sitting on attention already paid.
  // Derived from the log: nobody sets it and nobody can forget to clear it.
  const lastBlockedAt = Object.create(null);
  history.forEach(function (r) {
    (r.blocked || []).forEach(function (id) {
      if (!lastBlockedAt[id] || r.at > lastBlockedAt[id]) lastBlockedAt[id] = r.at;
    });
  });

  const nowIds = rows.map(function (r) { return r.id; });
  const wasIds = (prev && prev.ids) || [];
  const built = wasIds.filter(function (i) { return nowIds.indexOf(i) === -1; });
  const added = nowIds.filter(function (i) { return wasIds.indexOf(i) === -1; });
  const greenMoved = prev ? tally.green - prev.green : 0;
  const redMoved = prev ? tally.red - prev.red : 0;

  const out = [];
  out.push('# Scoreboard — ' + box);
  out.push('');
  out.push('**Generated by `node spirit/test/runAll.js` on `' + box + '`. Do not edit by hand.**');
  out.push('');

  out.push('## Summary');
  out.push('');
  const needing = rows.filter(function (r) { return r.blocked; });
  // THE HEADLINE COUNTED ONLY `needing`, so it said "nothing waiting on you"
  // directly above a list of 26 things waiting on him. Whatever the section
  // below prints, this line has to agree with it.
  // ENGLISH, NOT A TALLY. "5 red, 12 owed, and 26 thing(s) waiting on you"
  // is four jargon terms and a parenthesised plural. The numbers stay in the
  // code block below for whoever wants them; this line is a sentence.
  const open = uncountedOpen(titles, nowIds);
  const openDocs = Object.create(null);
  open.forEach(function (k) { openDocs[String(titles[k].file || '?')] = true; });
  const docCount = Object.keys(openDocs).length;
  const says = [];
  says.push(tally.unhappy
    ? (tally.unhappy === 1 ? 'One test is broken' : tally.unhappy + ' tests are broken')
    : 'Nothing is broken');
  says.push(rows.length === 1
    ? 'one requirement is declared and not built yet'
    : rows.length + ' requirements are declared and not built yet');
  // THE STOPPED ONES ARE NAMED FIRST AND SEPARATELY, because they are the
  // only number on this line that is costing time right now.
  const stoppedNow = openBlocks().length;
  const mineCount = needing.length + docCount;
  if (stoppedNow) {
    says.push(stoppedNow === 1
      ? 'and ONE THING IS STOPPED waiting for you'
      : 'and ' + stoppedNow + ' THINGS ARE STOPPED waiting for you');
    if (mineCount) {
      says.push('with ' + mineCount + ' older question(s) behind ' +
        (mineCount === 1 ? 'it' : 'them'));
    }
  } else {
    says.push(mineCount
      ? (mineCount === 1 ? 'and one older question needs a decision from you'
        : 'and ' + mineCount + ' older questions need a decision from you')
      : 'and nothing is waiting on you');
  }
  out.push('**' + says.join(', ') + '.**');
  out.push('');
  out.push('```');
  out.push(tally.suites + ' suites   ' + tally.green + ' green   ' + tally.red + ' red   ' +
    tally.unhappy + ' unhappy   ' + rows.length + ' owed      run ' + commit +
    (isStale ? '   STALE: measured at ' + commit + ', tree is now ' + head : ''));
  out.push('```');
  out.push('');

  out.push('---');
  out.push('');

  // BOTH SECTIONS COME FROM ONE RENDERER. They were written inline here and
  // the helpers above held a second copy; a prose fix then landed on the copy
  // that does not run. One function, two callers, no drift.
  const red = redSection(tally.failing || []);
  const mine = needsYouSection(titles, nowIds, needing);
  red.forEach(function (l) { out.push(l); });
  mine.forEach(function (l) { out.push(l); });
  if (!red.length && !mine.length) {
    // SILENCE SAYS WHAT IT CHECKED. On its own, an absent section is
    // indistinguishable from a check that looked in the wrong place — which
    // is exactly what had happened here.
    out.push('## What needs you');
    out.push('');
    out.push('**Nothing.** Nothing is broken, no requirement names you as its ' +
      'blocker, and every OPEN one in `design/` has a test watching it.');
    out.push('');
    out.push('---');
    out.push('');
  }

  out.push('## What moved');
  out.push('');
  if (!prev) {
    out.push('*First run on this box — there is nothing to compare it with yet.*');
  } else if (!built.length && !added.length && !greenMoved && !redMoved) {
    // A REAL PARAGRAPH, NOT AN EMPTY SECTION. Most runs move nothing and
    // silence reads as broken.
    out.push('**Nothing moved.** Same requirements owed, same tally, since the run at `' +
      (prev.commit || '?') + '`.');
  } else {
    if (greenMoved) out.push('- ' + (greenMoved > 0 ? '+' : '') + greenMoved + ' green');
    if (redMoved) out.push('- ' + (redMoved > 0 ? '+' : '') + redMoved + ' red');
    built.forEach(function (i) { out.push('- ✅ **built or withdrawn:** ' + i); });
    added.forEach(function (i) { out.push('- ⏳ **newly owed:** ' + i); });
  }
  out.push('');

  out.push('---');
  out.push('');
  out.push('## Owed longest');
  out.push('');
  out.push('| | requirement | owed | there | |');
  out.push('|---|---|---|---|---|');
  rows.slice().sort(function (a, b) { return (a.at || 1e12) - (b.at || 1e12); })
    .forEach(function (r) {
      const n = r.there === null ? null : Math.max(0, Math.min(10, Math.round(r.there / 10)));
      const bar = n === null ? '`?`'
        : '`' + '▓'.repeat(n) + '░'.repeat(10 - n) + '` ' + r.there + '%';
      // HIS ATTENTION, SPENT AND THEN LEFT. If a run once listed this as
      // blocked and none does now, he unblocked it — and how long it has
      // sat since is the thing worth showing him.
      const freed = (!r.blocked && lastBlockedAt[r.id])
        ? 'unblocked by you ' + ageWords(lastBlockedAt[r.id]) + ' ago' : '';
      out.push('| ⏳ | **' + r.title + '** | ' + ageWords(r.at) + ' | ' + bar + ' | ' +
        (r.blocked ? '⛔' : freed) + ' |');
    });
  out.push('');
  out.push('*Percentages are the guesses the declarations carry — `testSupport`:');
  out.push('"printed as guesses… to be argued with during a design sitting, not to');
  out.push('be believed afterwards." Everything else is measured.*');
  out.push('');

  const text = out.join(NL);
  const CR = String.fromCharCode(13);
  const LF = function (t) { return String(t).split(CR + NL).join(NL); };

  // ── ONE STABLE FILENAME FOR HIM, AND IT IS THE LEAD BOX THAT WRITES IT
  //
  //   Andy, 2026-09-25: "the score board i read will be on the lead-box."
  //
  // If the file he opens were SCOREBOARD-<lead>.md then changing lead
  // changes the name of the window he keeps open — a second place to
  // look, arriving by the back door, which is the one thing the
  // attention principle says never to add. So the lead box also writes
  // SCOREBOARD.md and that name never moves.
  //
  // LEAD IS A FACT A BOX HOLDS, not a thing an agent asserts about
  // itself: `lead = yes` in `.spiritbox`, which is gitignored and is
  // already where a box states what only it can know. An agent that
  // BELIEVED it was lead would overwrite his window; a box that SAYS so
  // was told to.
  //
  // AND IF TWO BOXES SAY IT, THE FAILURE IS LOUD RATHER THAN SILENT: the
  // header names the box and the run, so SCOREBOARD.md flips visibly
  // between them instead of quietly holding whichever ran last. That is
  // the honest handling of a stated fact that cannot be derived — lead
  // is assigned in conversation and is nowhere in the tree.
  const targets = [path.join(REPO, 'SCOREBOARD-' + box + '.md')];
  const saysLead = (function () {
    try {
      const said = (require('./tools/box.js').resolve().said) || {};
      return /^(yes|true|1)$/i.test(String(said.lead || '').trim());
    } catch (e) { return false; }
  }());
  if (saysLead) targets.push(path.join(REPO, 'SCOREBOARD.md'));

  targets.forEach(function (target) {
    let before = null;
    try { before = fs.readFileSync(target, 'utf8'); } catch (e) { before = null; }
    if (before === null || LF(before) !== text) {
      try { fs.writeFileSync(target, text); } catch (e) { /* said below */ }
    }
  });

  // THE ROW IS APPENDED WHATEVER HAPPENED, because "nothing moved" is a
  // measurement too and a gap in the log would read as a run that did
  // not happen.
  // A RENDER IS NOT A RUN. The first version of --board appended a row
  // like any other write, so re-rendering the page invented a run that
  // never happened — and the next "what moved" would have compared
  // against it and reported nothing, correctly, about the wrong thing.
  // Caught by reading the log after proving the page, which is the only
  // reason it did not ship.
  if (replay) return;
  try {
    fs.appendFileSync(RUNS, JSON.stringify({
      at: Math.floor(Date.now() / 1000), commit: commit, box: box,
      suites: tally.suites, green: tally.green, red: tally.red,
      unhappy: tally.unhappy, ids: nowIds,
      // WHICH ONES WERE WAITING ON HIM, so "he unblocked this and it then
      // sat" is derivable rather than remembered. Andy: "we should work of
      // those requirements first that were clocked by needing my input."
      // His attention is the scarce thing; a requirement he has already
      // paid attention to unblock must not then sit unnoticed.
      blocked: rows.filter(function (r) { return r.blocked; }).map(function (r) { return r.id; }),
      // THE ROWS THEMSELVES, so --board can replay a full run instead of
      // re-running it. The owed list comes from `test.awaiting` calls,
      // which exist only at runtime — storing what ARRIVED is the same
      // arrival-not-resemblance argument as everywhere else, and it means
      // there is no second parser over the *Pending.js files to drift.
      rows: rows,
    }) + NL);
  } catch (e) { /* a log that cannot be written must not fail a run */ }
  if (stale) console.log('--- board re-rendered from the run at ' + stale + ', no suites run');
  console.log('--- SCOREBOARD-' + box + '.md' + (saysLead ? ' and SCOREBOARD.md' : '') +
    ' rewritten (' + rows.length + ' owed)');
}

function writeBoard(byReq, titles) {
  const NL = String.fromCharCode(10);
  const ids = Object.keys(byReq).sort();
  const out = [];

  out.push('# The board — declared, not built yet');
  out.push('');
  out.push('**Generated by `node spirit/test/runAll.js`. Do not edit by hand.**');
  out.push('');
  out.push('This file holds the requirements that are DECLARED and NOT BUILT, in');
  out.push('the words of whoever declared them. It carries no green tally, so it');
  out.push('changes only when work moves — two runs over an unchanged tree produce');
  out.push('an identical file, and it is the same on both platforms.');
  out.push('');
  out.push('**What it cannot tell you:** it is written by a full harness run, so a');
  out.push('tree whose declarations changed without one is a tree this file does');
  out.push('not describe. Run the harness if in doubt.');
  out.push('');
  out.push('---');
  out.push('');

  if (!ids.length) {
    out.push('**Nothing is declared and unbuilt.** Either every declared');
    out.push('requirement has been built and its declaration replaced by a real');
    out.push('assertion, or nothing has been declared.');
    out.push('');
  }

  let units = 0;
  ids.forEach(function (id) {
    const known = requirementFor(titles, id);
    out.push('## ' + id + ' — ' +
      (known ? known.title
             : 'NOT DECLARED IN A DOCUMENT — a suite waits on a requirement no document names'));
    out.push('');
    if (known) out.push('`' + known.cycle + '` · status **' + known.status + '**');
    else out.push('**No document names this requirement.** That is drift, and it is');
    if (!known) out.push('shown rather than hidden.');
    out.push('');
    byReq[id].units.forEach(function (u) {
      units += 1;
      const guess = (u.there === null && !u.cost) ? ''
        : ' — **~' + (u.there === null ? '?' : u.there) + '% there**' +
          (u.cost ? ', guess: ' + u.cost : '');
      out.push('- **missing:** ' + u.unit + guess);
      if (u.note) out.push('  ' + NL + '  ' + u.note);
    });
    out.push('');
    out.push('*Declared in ' + Object.keys(byReq[id].suites).map(function (f) {
      return '`' + f + '`';
    }).join(', ') + '*');
    out.push('');
  });

  if (ids.length) {
    out.push('---');
    out.push('');
    out.push('**' + units + ' assertion(s) across ' + ids.length + ' requirement(s).**');
    out.push('');
  }

  // LF always, and compared before writing, so a run that changes nothing
  // leaves the file's mtime alone and an editor holding it open does not
  // flicker. Git checks this out CRLF on Windows, so the comparison is
  // made on LF both sides — the same trap publishCapacity.js documents,
  // where a fresh clone reported an identical block as out of date on
  // every one of sixty-six lines.
  const text = out.join(NL);
  const CR = String.fromCharCode(13);
  const LF = function (t) { return String(t).split(CR + NL).join(NL); };
  const target = path.join(DIR, '..', '..', 'BOARD.md');
  let before = null;
  try { before = fs.readFileSync(target, 'utf8'); } catch (e) { before = null; }
  if (before !== null && LF(before) === text) return;
  try {
    fs.writeFileSync(target, text);
    console.log('\n--- BOARD.md rewritten (' + units + ' across ' + ids.length + ')');
  } catch (e) {
    console.log('\n--- BOARD.md could not be written: ' + e.message);
  }
}

// ── --board: THE PAGE IN A SECOND, WITHOUT RUNNING ANYTHING ─────────
//
//   Andy, 2026-09-26: "update it frequently, after every single issue
//   addressed" and "think about how you can supply the scoreboard
//   quicker." A full run is 104 seconds, so a board that only exists
//   after one is a board nobody refreshes.
//
// THE PAGE HAS TWO HALVES WITH DIFFERENT COSTS. What needs him —
// blocking.js and every Status in design/ — is on disc and is re-read
// live, so it is CURRENT. The tally, what is red, and the owed
// declarations are knowable only from a real run, so they are replayed
// from the last full row in the runs log and STAMPED WITH ITS COMMIT.
//
// It says STALE when that commit is not HEAD, and that is the whole
// honesty of it: a stale board is visible in the commit line, where a
// subset board was not. Same argument as the filtered-run guard.
function boardOnly() {
  const RUNS = path.join(DIR, 'scoreboard-runs.log');
  let last = null;
  try {
    const lines = fs.readFileSync(RUNS, 'utf8').trim().split(String.fromCharCode(10)).filter(Boolean);
    for (let i = lines.length - 1; i >= 0 && !last; i -= 1) {
      let row = null;
      try { row = JSON.parse(lines[i]); } catch (e) { row = null; }
      // Only a row that carries its rows can be replayed; older rows
      // predate that field and are skipped rather than half-rendered.
      if (row && Array.isArray(row.rows)) last = row;
    }
  } catch (e) { last = null; }

  if (!last) {
    console.log('--- no full run to re-render from. Run the harness once without a filter first.');
    process.exit(1);
  }

  let head = '';
  try {
    head = require('child_process').execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: path.join(DIR, '..', '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (e) { head = ''; }

  // THE STALENESS IS THE COMMIT, NOT THE CLOCK. A board an hour old on an
  // unchanged tree is current; one a minute old on a changed tree is not.
  const stale = (head && last.commit && head !== last.commit) ? last.commit : null;

  writeScoreboard(Object.create(null), requirementTitles(), {
    suites: last.suites, green: last.green, red: last.red, unhappy: last.unhappy,
    redLines: last.redLines || [],
  }, last.rows, stale || last.commit, true);
  process.exit(0);
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
      // Stood down, on the suite's own row for the same reason as the
      // yellow: a run that is not all green should be readable at a
      // glance as what it is, and "this did not execute here" is a
      // different sentence from both "it broke" and "nobody wrote it".
      (r.stood > 0 ? String(r.stood).padStart(2) + ' ⏭  ' : '      ') +
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
        // ── A ROW THIS CANNOT PARSE IS STILL SHOWN ────────────────────
        //
        // The tag was matched with `\(([^)]*)\)`, which stops at the
        // FIRST close paren — so a cost note containing one, like
        // "setCard refuses an older card (contacts.js)", failed the whole
        // line, and `if (!mm) return` DROPPED THE REQUIREMENT FROM THE
        // BOARD. Measured 2026-09-23: cycle 10's R13 vanished while the tally still
        // counted it, so the header read "3 assertions across 2
        // requirements" and the missing one was the one being worked on.
        //
        // A board that silently loses a row is worse than no board: Andy
        // reads it to answer "is this in the code and verified yet", and
        // a dropped row answers that question wrongly and confidently.
        //
        // So: the tag is matched NON-GREEDILY up to the first "): ",
        // which lets a cost carry parentheses — and anything still
        // unparseable falls through to a rough row rather than silence.
        let mm = /^AWAITING (\S+)\s*\[([^\]]*)\]\s*\((there:.*?)\):\s*(.*)$/.exec(line);
        if (!mm) mm = /^AWAITING (\S+)\s*\[([^\]]*)\]:\s*(.*)$/.exec(line);
        if (!mm) {
          // Shape unknown. Show the id and the whole line rather than
          // losing the requirement.
          const bare = /^AWAITING (\S+)/.exec(line);
          if (!bare) return;
          (byReq[bare[1].trim()] = byReq[bare[1].trim()] || { units: [], suites: {} })
            .units.push({
              unit: 'UNPARSED — ' + line.replace(/^AWAITING \S+\s*/, '').replace(/\s*⏳\s*$/, ''),
              note: '', there: null, cost: '',
            });
          byReq[bare[1].trim()].suites[r.file] = true;
          return;
        }
        // The short form has no tag, so the note is group 3, not 4.
        if (mm.length === 4) mm = [mm[0], mm[1], mm[2], '', mm[3]];
        const id = mm[1].trim();
        const tag = mm[3] || '';
        const there = /there:(\d+)/.exec(tag);
        const cost = /cost:([^]*)$/.exec(tag);
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
    lastBoard = { byReq: byReq, titles: titles };
    // A FILTERED RUN MUST NOT WRITE THIS ONE EITHER, and the first
    // version of the guard below missed it. `runAll.js payloadCeiling`
    // emptied BOARD.md of all twelve requirements and left it saying
    // nothing is declared and unbuilt — because one suite declared none.
    // Found by committing the half-fix and watching the other half of
    // the same defect turn up as an unstaged change three lines later.
    if (!filter) writeBoard(byReq, titles);
  } else {
    lastBoard = { byReq: Object.create(null), titles: requirementTitles() };
    if (!filter) writeBoard(lastBoard.byReq, lastBoard.titles);
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
  // ── WHAT STOOD DOWN, AND WHY, BEFORE THE TALLY ─────────────────────
  //
  // A stand-down is the one outcome that makes the board mean LESS
  // without anything looking wrong, so its reasons are printed rather
  // than summarised into a number. Each sentence was written by the
  // suite that declined and names the condition and the remedy; a reader
  // who cannot act on it should not have been given a stand-down.
  const stoodTotal = results.reduce(function (n, r) { return n + (r.stood || 0); }, 0);
  if (stoodTotal) {
    console.log('\n--- stood down: these suites ran, diagnosed the MACHINE rather than the ' +
      'tree, and declined. Not red and not awaiting — the board below is that much smaller ' +
      'than it looks, and clearing the condition is what makes them run.');
    results.forEach(function (r) {
      (r.stoodLines || []).forEach(function (line) {
        console.log('\n    ' + r.file);
        console.log('      ' + line.replace(/^\s*\*+\s*/, '').replace(/\s*⏭\s*$/, '').trim());
      });
    });
  }

  const waitingTotal = results.reduce(function (n, r) { return n + (r.waiting || 0); }, 0);
  console.log('\n' + files.length + ' suites, ' + green + ' green, ' + red + ' red, ' +
    unhappy.length + ' unhappy' +
    (waitingTotal ? ', ' + YELLOW + waitingTotal + ' awaiting' + RESET : '') +
    (stoodTotal ? ', ' + stoodTotal + ' stood down' : '') +
    (skipped.length ? ', ' + skipped.length + ' not run' : '') + '\n');
  // ── A FILTERED RUN MUST NOT WRITE THE BOARD. NOT A PARTIAL ONE ─────
  //
  // Measured by spiritos-37 on 2026-09-26: `runAll.js payloadCeiling`
  // printed "1 suites, 6 green, 0 red" and then rewrote SCOREBOARD.md to
  // say **Nothing is broken, 0 requirements declared and not built**.
  // The true state was 154 suites, 12 red, 12 owed.
  //
  // A SUBSET CANNOT KNOW THE TALLY, and a board that is sometimes a
  // subset is worse than one that is sometimes stale: STALE IS VISIBLE
  // IN THE COMMIT LINE AND A SUBSET LIE IS NOT. Andy has just been told
  // to expect frequent updates from partial runs — "run the part of the
  // harness, that verifies you made a positive change" — so this is the
  // precondition for that rule rather than a tidy-up.
  //
  // No warning banner, no partial write. A steering wheel that is
  // sometimes wrong is worse than one that is sometimes old.
  if (filter) {
    console.log('--- board NOT written: this was a filtered run (' + filter + '), and a subset ' +
      'cannot know the tally. Run without a filter, or `--board` to re-render from the last full run.');
    process.exit(unhappy.length ? 1 : 0);
  }

  writeScoreboard(lastBoard.byReq, lastBoard.titles, {
    suites: files.length, green: green, red: red, unhappy: unhappy.length,
    // THE BOARD GETS THE FAILURES THEMSELVES, not only how many. Andy,
    // 2026-09-26: "i dont' see any red on the board." It printed `5 red` in
    // the tally and named nothing, because the failing lines went to the
    // console and the console scrolls away. Same lines, same order, three
    // of them per suite — enough to know what broke without making the page
    // a log.
    failing: unhappy.map(function (r) {
      const lines = r.out.split(String.fromCharCode(10)).filter(function (l) {
        return /FAILURE|Error:|at .*\.js:\d+/.test(l);
      });
      return {
        file: r.file,
        no: r.no,
        code: r.code,
        died: r.no < 0,
        lines: (lines.length ? lines : r.out.split(String.fromCharCode(10)).slice(-6))
          .slice(0, 3).map(function (l) { return l.replace(/\s+$/, '').trim(); }),
      };
    }),
  });

  process.exit(unhappy.length ? 1 : 0);
}

if (args.indexOf('--board') !== -1) boardOnly();
else main();
