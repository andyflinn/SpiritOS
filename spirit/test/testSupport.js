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