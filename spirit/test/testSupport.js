'use strict';

const STARS = '**************************************************************************';
const LINE_LENGTH = STARS.length;
const INDENT_LENGTH = 3;
const MAX_TITLE_LENGTH = LINE_LENGTH - INDENT_LENGTH*4;
const spirit = require('../run/js/kernel.js');
const ICON = spirit.core.const.ICON;

let PAD_STARS = ''; for (let i = 0; i < INDENT_LENGTH; i++) { PAD_STARS += '*'; }
let PAD_SPACES = ''; for (let i = 0; i < INDENT_LENGTH; i++) { PAD_SPACES += ' '; }

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