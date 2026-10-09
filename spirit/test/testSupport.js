'use strict';

const STARS = '**************************************************************************';
const LINE_LENGTH = STARS.length;
const INDENT_LENGTH = 3;
const MAX_TITLE_LENGTH = LINE_LENGTH - INDENT_LENGTH*4;
const spirit = require('../run/js/kernel.js');
const ICON = spirit.core.const.ICON;

let PAD_STARS = ''; for (let i = 0; i < INDENT_LENGTH; i++) { PAD_STARS += '*'; }
let PAD_SPACES = ''; for (let i = 0; i < INDENT_LENGTH; i++) { PAD_SPACES += ' '; }

// ── EVERY ASSERTION TELLS deskVerify, WHEN IT WAS ASKED TO (goal/G8.1) ────
//
// Andy, 2026-10-06: "the standard/shared test-call-count interface just needs to send a a record to deskVerify", and
// "the called suite sends one test-record at the time, no fucking bundling or other complicated stuff, we don't worry
// about the bit of extra time it takes." So one post per assertion, never grouped, and never waited on: check and fail
// are synchronous and return nothing, so holding a run on a round trip would change every call site.
//
// ONLY WHEN DESKVERIFY STARTED THE RUN: `--verify-port <port>` names its node. A suite run by hand posts nothing and
// costs exactly what it costs today, which is what keeps `node spirit/test/<suite>.js` the thing it has always been.
// The suite's own file name is the other half of a test's key; the record carries no detail and no runtime values.
const VERIFY_PORT = (function () {
  const at = process.argv.indexOf('--verify-port');
  const p = at !== -1 ? Number(process.argv[at + 1]) : 0;
  return Number.isInteger(p) && p > 0 ? p : 0;
})();
const SUITE = require('path').basename(String(process.argv[1] || ''));
// WHAT HAS NOT COME BACK YET, so a suite that exits right after its report does not take its last records with it.
const pending = new Set();
function record(title, outcome) {
  if (!VERIFY_PORT || !title) return;
  const rec = { suite: SUITE, title: String(title), outcome: outcome };
  pending.add(rec);
  fetch('http://127.0.0.1:' + VERIFY_PORT + '/api/spirit', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: { deskVerify: { record: rec } } }),
  }).then(function () { pending.delete(rec); }, function () { pending.delete(rec); });
}
// A suite's last words are its report, and then it exits. Whatever is still in the air is posted by a child this
// waits for (verifyPost.js), once per suite: a duplicate writes nothing, since deskVerify keeps only first sightings
// and flips. Called by reportSuccessFailureCount below, so no suite has to think about it.
function settleRecords() {
  if (!VERIFY_PORT || !pending.size) return;
  const left = Array.from(pending);
  pending.clear();
  try {
    require('child_process').spawnSync(process.execPath,
      [require('path').join(__dirname, 'verifyPost.js'), String(VERIFY_PORT), JSON.stringify(left)],
      { stdio: 'ignore', timeout: 10000 });
  } catch (e) { /* the records are a record, not the suite's verdict */ }
}

// ── SUITES CLEAN UP THE HOMES THEY CREATE (cycle R17) ────────────────
//
// **160,116 leaked directories were found in %TEMP% on 2026-09-20.** The
// disc contention made three consecutive harness runs progressively redder
// while every suite passed alone — which reads exactly like a regression
// and was not one. That is the expensive kind of bug: it lies about where
// it lives.
//
// THIRTY-EIGHT SUITES CALL `fs.mkdtempSync` AND NONE REMOVES ANYTHING.
// Fixing each one is thirty-eight edits and a rule the thirty-ninth suite
// has to remember, and this tree has an opinion about that shape: "a rule
// that cannot be broken needs nobody to police it" (0012, on the one-hop
// rule). So the creation itself is wrapped, once, here — every suite
// already requires this file, and a suite written next month is covered
// without being told.
//
// WHAT IS REMOVED IS ONLY WHAT THIS PROCESS MADE. Not a sweep of %TEMP% by
// pattern, which would be this harness deleting whatever else happened to
// match: the list is the actual return values of the actual calls.
//
// AND A SUITE CANNOT ALWAYS FINISH THE JOB ITSELF, which is the part that
// had to be measured rather than assumed. The first version of this hook
// worked — proved on a probe — and a full run still left about a hundred
// and twenty behind. Every survivor held the same file:
//
//     spirit-world-lab-XXXXXX/relay-state/relay.db
//
// A world that starts a real relay opens SQLite, and at `process.on('exit')`
// that handle is still open: on Windows a locked file defeats `rmSync`, and
// `force` does not help — it suppresses "not found", not "in use".
//
// SO THE PARENT FINISHES WHAT THE CHILD COULD NOT. Each suite appends the
// homes it made to the file named by SPIRIT_TMP_LOG, and `runAll.js` sweeps
// that list when every child is dead and every handle with them. Exact, not
// a pattern sweep of %TEMP%: the list is the real return values of the real
// calls, so this harness never deletes something it did not create.
//
// A suite run on its own has no SPIRIT_TMP_LOG and simply does what it can,
// which is nearly all of it. A suite killed outright leaves its home
// behind, and nothing at exit can change that.
(function reclaimTempHomes() {
  const fs = require('fs');
  const os = require('os');
  const made = [];
  const real = fs.mkdtempSync;
  fs.mkdtempSync = function (prefix, options) {
    const dir = real.call(fs, prefix, options);
    try {
      if (typeof dir === 'string' && dir.indexOf(os.tmpdir()) === 0) made.push(dir);
    } catch (e) { /* tracking is the bonus, not the job */ }
    return dir;
  };
  process.on('exit', function () {
    const left = [];
    for (let i = 0; i < made.length; i += 1) {
      try {
        fs.rmSync(made[i], { recursive: true, force: true });
        if (fs.existsSync(made[i])) left.push(made[i]);
      } catch (e) { left.push(made[i]); }
    }
    // Handed up, never retried here: the handle that blocked it belongs to
    // this process and will not be released until after this line.
    if (!left.length || !process.env.SPIRIT_TMP_LOG) return;
    try { fs.appendFileSync(process.env.SPIRIT_TMP_LOG, left.join('\n') + '\n'); }
    catch (e) { /* the sweep is a courtesy; failing it must not fail a suite */ }
  });
}());

// ── A SUITE HAS A HOME OF ITS OWN (desk/G1.7) ────────────────────────
//
// Since desk/G1.7 every node boots a backup server writing into
// <home>/.SpiritOS/backups/. A full run left six test nodes in Andy's real
// C:\Users\Andre\.SpiritOS, and four in wsl-claude's. Andy: "test suites
// need their own copy of node"; the home they write to is part of it.
//
// SO HOME IS A TEMP FOLDER HERE, once, for every suite and every node it
// boots (children inherit the environment). Made by the wrapped mkdtempSync
// above, so it is removed like any other temp home. The real home is kept
// as SPIRIT_REAL_HOME for the one suite that needs it (vaultGuardBattery,
// ~/.claude), and git keeps its real global config, so a suite's git still
// knows who commits.
(function ownHome() {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  if (!process.env.SPIRIT_REAL_HOME) process.env.SPIRIT_REAL_HOME = os.homedir();
  const realGit = path.join(process.env.SPIRIT_REAL_HOME, '.gitconfig');
  if (!process.env.GIT_CONFIG_GLOBAL && fs.existsSync(realGit)) process.env.GIT_CONFIG_GLOBAL = realGit;
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'spirit-home-'));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
}());

const test = {
    ICON: ICON,
    STARS: STARS,
    LINE_LENGTH: LINE_LENGTH,
    INDENT_LENGTH: INDENT_LENGTH,
    MAX_TITLE_LENGTH: MAX_TITLE_LENGTH,
    PAD_STARS: PAD_STARS,
    PAD_SPACES: PAD_SPACES,
    counter:0,
    successCount:0,
    failureCount:0,
    
    titleLine: function(title) {
        if (title.length > MAX_TITLE_LENGTH) {
            title = title.substring(0, MAX_TITLE_LENGTH - 3) + '...';
        }
        
        let titlePadded = this.PAD_SPACES + title + this.PAD_SPACES;
        let titleStartPos = (LINE_LENGTH - titlePadded.length)/2;
        let titleLine = '';
        for (let i = 0; i < titleStartPos; i++) { titleLine += '*'; }
        titleLine += titlePadded;
        for (let i = titleLine.length; i < LINE_LENGTH; i++) { titleLine += '*'; }

        console.log(titleLine);
    },
      
    startTest: function(title) {
        this.counter++; this.successCount = this.failureCount = 0; 
        console.log('\n' + STARS);
        this.titleLine('#' + this.counter + ' ' + title);
        console.log(STARS + '\n');
    },
    
    subHeading: function(title) {
        console.log('\n' + PAD_STARS);
        this.titleLine(title);
        console.log(PAD_STARS + '\n');
    },

    comment: function(comment) {
        console.log(PAD_STARS + PAD_SPACES + comment);
    },

    lineFeed: function() {
        console.log('\n');
    },

    reportSuccessFailureCount: function(successCount=0, failureCount=0) {
        this.lineFeed();

        if (successCount==0 && failureCount==0){
            successCount = this.successCount;
            failureCount = this.failureCount;
        }

        let result = "Test completed.  ";

        if (successCount > 0) result += ICON.SUCCESS + ":" + successCount;
        if (successCount > 0 && failureCount > 0) result += "  ";
        if (failureCount > 0) result += ICON.ERROR + ":" + failureCount;
        // ON THE LAST LINE, because that is the line the runner parses. A
        // count the runner cannot see is a count nobody reads.
        if (this.awaitingCount > 0) result += "  ⏳:" + this.awaitingCount;
        if (this.stoodDownCount > 0) result += "  ⏭:" + this.stoodDownCount;

        this.titleLine(result);
        this.lineFeed();

        // ── AND THE EXIT CODE SAYS THE SAME THING AS THE LINE ABOVE ────
        //
        // Until 2026-09-23 it did not. Every suite in this repo exited 0
        // whether it passed or failed, so the verdict existed only in the
        // printed output and `runAll.js` was the one reader that parsed
        // it. Anything gating on the exit code — a shell chain, a hook,
        // the automated closing step Andy wants — saw success always.
        //
        // MEASURED: `node spirit/test/cycleCitations.js && git commit`
        // was run repeatedly that day while the gate was RED, and the
        // commit went through every time. The gate reported correctly and
        // the exit code was a separate channel with nothing joining them
        // — the same shape as every other finding of that day.
        //
        // `exitCode`, not `process.exit()`: a suite may still have output
        // to flush and cleanup to run, and exiting here would cut it off
        // mid-report. The value is set and the process ends when it ends.
        //
        // runAll is unaffected. It reads the completion line to decide
        // what happened and keeps `code` beside it; a suite that reports
        // AND exits 1 is still read as having reported, because `said` is
        // what distinguishes a failure from a crash.
        if (failureCount > 0) process.exitCode = 1;
        // THE LAST RECORDS LAND (goal/G8.1): a suite reports and exits at once, so the posts still in the air are
        // waited for here, where every suite already passes through. A suite nobody gave a verify port has nothing
        // to wait for and this costs it nothing.
        settleRecords();
    },

    // ── STOOD DOWN: THE CONDITION IS THE ENVIRONMENT, NOT THE TREE ───
    //
    // A suite that knows exactly why it cannot run, and fails anyway, is
    // reporting a fault in the tree that is not there. wsl-claude, after
    // running a fresh clone on Linux (2026-09-24): *"A suite that knows
    // precisely why it cannot run, and fails anyway, is reporting a fault
    // in the tree that is not there... it is the same discipline as the
    // awaiting block: a thing nobody has written is not a thing that
    // broke."*
    //
    // ── AND A FALSE RED DOES NOT STAY WHERE IT STARTED ───────────────
    //
    // This was built for six lab suites that refuse when a labMaster from
    // another checkout is up — but the measurement that justified it was
    // a SEVENTH suite. Windows, fresh clone, 2026-09-24: the six failed
    // in ~400ms each instead of holding their runner slots for their
    // normal duration, which reshuffled what ran concurrently and blew
    // `relayConfigWire.js`'s 15-second budget. Four more red, in a suite
    // with no connection to the cause, green when run alone.
    //
    // So a false red is not merely noise a reader learns to discount. It
    // changes the shape of the run and manufactures a second false red
    // somewhere unrelated, where nobody will connect the two.
    //
    // ── WHAT IT IS NOT ───────────────────────────────────────────────
    //
    // Not a way to quiet an inconvenient failure. The bar is that the
    // suite has ALREADY DIAGNOSED the condition and can name it, that the
    // condition is about the machine rather than the code, and that a
    // developer reading the reason knows what to change. `why` is that
    // sentence, and it is required — a stand-down with no reason is a
    // skip, which is the thing this is not.
    //
    // Unlike `awaiting` there is no inverse that turns this red when the
    // condition clears: a clear condition simply means the suite RUNS,
    // which is its own proof. The counter exists so the run says out loud
    // that something did not execute, rather than a green board quietly
    // meaning less than it did yesterday.
    standsDown: function (why) {
        this.stoodDownCount = (this.stoodDownCount || 0) + 1;
        this.comment('STOOD DOWN: ' + String(why || '').replace(/\s+/g, ' ').trim() + ' ⏭');
    },

    // THE TITLE IS THE KEY, THE DETAIL IS BESIDE IT (goal/G8.1). Andy, 2026-10-06, asked how a test is identified:
    // "the individual tests in the harness have titles, don't they? so suite name/ID plus the title/label of the test
    // should identify tests uniquely?", and "every test just has to output a detailed record."
    // A failing assertion used to carry its runtime values inside the one sentence it printed, so the red and the
    // green of one assertion shared no key and no history of flips was possible. So both take an optional second
    // argument: the title alone identifies the test, the detail is printed after it and never recorded.
    check: function(str, detail){
        this.successCount++;
        this.comment('SUCCESS #' + this.counter + '.' + this.successCount + ': ' + str + (detail ? ' — ' + detail : '') + ' ' + ICON.SUCCESS);
        record(str, 'green');
    },

    fail: function(str, detail){
        this.failureCount++;
        this.comment('FAILURE #' + this.counter + '.' + this.failureCount + ': ' + str + (detail ? ' — ' + detail : '') + ' ' + ICON.ERROR);
        record(str, 'red');
    },

    // ── DECLARED, AND NOT BUILT YET ──────────────────────────────────
    //
    //   Andy, 2026-09-23: "in fact if it ists red, not green, it gives me
    //   instant feedback on 'not-done-yet'" — and on what the run is for:
    //   "so harness runs can be summarized with reasoning."
    //
    // A requirement can be written as an assertion before the code exists.
    // Left as an ordinary `fail` it would be indistinguishable from a
    // regression, and the harness would never be green again — so "green
    // means stop" would stop meaning anything. Declared here instead, it
    // is a THIRD state: the run stays green, and the count of what is
    // declared-and-not-built is a number he can watch fall.
    //
    // AND IT GOES RED THE MOMENT IT PASSES, which is the half that keeps
    // it honest. Without that inverse the board rots into a list of things
    // finished months ago that nobody relabelled — the same failure as a
    // DEFERRED requirement nobody re-opened. When the code lands, this
    // turns into a failure that says so, and the only way to clear it is
    // to make it a `check`.
    //
    // ── IT ASKS WHETHER THE UNIT IS THERE, NOT WHETHER IT WORKS ──────
    //
    //   Andy: "a test goes and checks if the unit is available for
    //   testing, and fails for that simple reason. and easily
    //   categorized failure."
    //
    // That is the shape, and it is not the obvious one. A test written
    // before the code CANNOT meaningfully assert behaviour — there is no
    // behaviour — so what it asserts is **availability**: the function is
    // not exported, the column is not on the row, the verb answers
    // nothing. One question, a plain answer, and a failure that classifies
    // itself instead of needing to be read.
    //
    // `unit` is what is missing, in the words somebody would grep for.
    // The runner groups by it, so the summary can say which requirement
    // is waiting and on what, without a reason being written twice.
    //
    // AND IT GOES RED THE MOMENT THE UNIT APPEARS, which is the half that
    // keeps it honest. Without that inverse the board rots into a list of
    // things finished months ago that nobody relabelled — the same
    // failure as a DEFERRED requirement nobody re-opened. When the unit
    // lands, this becomes a failure telling whoever built it to write the
    // real assertion.
    // ── AND EACH ONE CARRIES A PRICE AND A POSITION ──────────────────
    //
    //   Andy: "during the brains storm, the 'failing' test suite can
    //   allready be run, yellows (hour-glasses) have a price-note and
    //   %-already there guess."
    //
    // A list of what is missing is not a plan. `est` makes the yellow
    // block one: `{ there: 40, cost: 'a sitting' }` — how much of this
    // already exists, and what the rest is worth. Both are GUESSES and
    // are printed as guesses; the point is to be argued with during a
    // design sitting, not to be believed afterwards.
    //
    // `there` is a percentage because that is the shape he asked for.
    // `cost` is words rather than hours — "a sitting", "an afternoon",
    // "one line" — because an agent's hours mean nothing to him and the
    // unit he plans in is a sitting.
    awaiting: function (req, unit, available, note, est) {
        if (available) {
            this.failureCount++;
            this.comment('FAILURE #' + this.counter + '.' + this.failureCount +
                ': ' + req + ' — `' + unit + '` EXISTS NOW. It was declared as awaiting; ' +
                'write the assertion it was standing in for' +
                (note ? ' (' + note + ')' : '') + ' ' + ICON.ERROR);
            return;
        }
        this.awaitingCount = (this.awaitingCount || 0) + 1;
        const there = est && typeof est.there === 'number' ? est.there : null;
        const cost = est && est.cost ? String(est.cost) : '';
        // Machine-readable, because the runner groups these and totals the
        // guesses. A format nobody can parse is a note, not a measurement.
        const tag = (there === null && !cost) ? ''
            : ' (' + (there === null ? '' : 'there:' + there) +
              (there !== null && cost ? ' ' : '') + (cost ? 'cost:' + cost : '') + ')';
        // WHAT IT WAITS ON, as its own marker right after the id — never
        // inside the tag, whose free-text cost has already once made a
        // requirement vanish from the board (runAll.js, the parser). The
        // board ranks by it: Andy, 2026-09-27, "lets start with a ranking
        // and see if that makes the board adapt to progress...". Ids only,
        // `area/number` as awaiting's own first argument is.
        const given = est && Array.isArray(est.after) ? est.after : [];
        const after = given.filter(function (a) { return typeof a === 'string' && /^[^\s{},]+\/[^\s{},]+$/.test(a); });
        // A MALFORMED ONE IS RED, NOT DROPPED. Dropping it would rank the
        // board as if the dependency did not exist, and nobody would see why.
        if (after.length !== given.length) {
            this.failureCount++;
            this.comment('FAILURE #' + this.counter + '.' + this.failureCount + ': ' + req +
                ' declares `after` entries that are not ids of the form area/number: ' +
                JSON.stringify(given.filter(function (a) { return after.indexOf(a) === -1; })) +
                ' ' + ICON.ERROR);
        }
        const afterTag = after.length ? ' {after:' + after.join(',') + '}' : '';
        this.comment('AWAITING ' + req + afterTag + ' [' + unit + ']' + tag + ': ' +
            (note || 'the unit is not there to be tested') + ' ⏳');
    },

    showReturnString: function(str){
        let maxlen
        if (str.length > (MAX_TITLE_LENGTH-10)) {
            str = str.substring(0, MAX_TITLE_LENGTH-10) + '...';
        }

        this.comment('the result of this operation looks as follows:');
        this.comment('"' + str + '"');
        this.lineFeed();
    },

    // THE BROWSER'S ONE MOUTH, for a fixture that stands the shell up
    // without a page. `spirit.core.ask` is defined in kernel.js's BROWSER
    // half, which a test requiring kernel.js from node never gets — so
    // every shell fixture has to supply it, and this is the one copy of it.
    //
    // Over the fixture's own `fetch`, deliberately: these suites intercept
    // there to answer as a node would, and a shim that bypassed that would
    // assert against a different door than the one shell.js goes through.
    // AGENT.md, Comms.
    // A FACTORY, taking the fixture's own fetch. Not the global: these
    // suites hand shell.js a fake `fetch` as a Function() argument and
    // intercept there, so an `ask` closing over the real global would ask
    // the network and assert against a door nobody uses.
    // THE PAGE KERNEL'S relays.status, for a suite that fakes the kernel
    // (puppets/G2). The real one (kernel.js) asks relay.search and then
    // relay.get per relay and puts the answers back into the old shape;
    // that assembly is proven in relaySearch.js. A screen's suite is about
    // the screen, so this answers the same shape from the suite's own
    // fixture, which still speaks the old verb name inside the fake.
    browserRelays: function (ask) {
        return {
            status: function (name) { return ask('relay.status', { name: name || '' }); },
        };
    },
    browserAsk: function (fetchImpl) {
        return function (verb, args) {
            const payload = { verb: String(verb) };
            if (args) Object.keys(args).forEach(function (k) { payload[k] = args[k]; });
            return fetchImpl('/api/spirit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }).then(function (r) {
                return r.text().then(function (t) {
                    let body = null;
                    try { body = JSON.parse(t); } catch (e) { body = null; }
                    return { status: r.status, text: t, body: body };
                });
            });
        };
    },

};

module.exports = test;