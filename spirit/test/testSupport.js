'use strict';

const STARS = '**************************************************************************';
const LINE_LENGTH = STARS.length;
const INDENT_LENGTH = 3;
const MAX_TITLE_LENGTH = LINE_LENGTH - INDENT_LENGTH*4;
const spirit = require('../run/js/kernel.js');
const ICON = spirit.core.const.ICON;

let PAD_STARS = ''; for (let i = 0; i < INDENT_LENGTH; i++) { PAD_STARS += '*'; }
let PAD_SPACES = ''; for (let i = 0; i < INDENT_LENGTH; i++) { PAD_SPACES += ' '; }

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
        
        this.titleLine(result);
        this.lineFeed();
    },

    check: function(str){
        this.successCount++;
        this.comment('SUCCESS #' + this.counter + '.' + this.successCount + ': ' + str + ' ' + ICON.SUCCESS);
    },

    fail: function(str){
        this.failureCount++;
        this.comment('FAILURE #' + this.counter + '.' + this.failureCount + ': ' + str + ' ' + ICON.ERROR);
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
        this.comment('AWAITING ' + req + ' [' + unit + ']' + tag + ': ' +
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