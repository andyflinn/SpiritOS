'use strict';

// goal/G9.6: the header area joins the shell's title bar — no title bubble, no padding, no margins,
// no rounded corners, and it never moves on a vertical scroll.
//   Andy, 2026-10-07 (musing "Desk Improvement: User creates goals and items without agents present"):
//   "the header area in both desk and desk detail can do without the title-bubble, because the desk is
//   only about the current goal, and the deskDetail has the title already in the shells title bar, so
//   that the header area can be smoothly joined with the shell's title bar at all times. It should never
//   be moving during vertical scroll operations." and "the header area should not contain rounded
//   corners. and its container should have no margins and no padding."
// The box's shape: UI only, CSS and layout in the desk shell. Red on today's tree; wsl wrote it and does
// not build it.
//
// WHAT IS ASSERTED, and why at the source:
//   1  The title bubble is gone: desk's #desk-goal and deskDetails' #dd-head.
//   2  The header container carries no padding and no margin — neither in the markup nor set by the
//      header function on the element createAppHeader hands it (both set paddingBottom today).
//   3  Nothing inside the header rounds its corners: no inline border-radius, and none of the classes
//      index.html rounds (.stat-tile 10px, .start-job-form.card 10px).
//   4  It stays joined to the title bar: both still build the header with createAppHeader(), which is
//      what sticks it under the bar (goal/G6.1), so a vertical scroll never moves it.
// LEFT OPEN, with the reason: how he opens the goal's own details once the bubble is gone - today the
// bubble is the only click that opens it (desk.js, title "Open the goal"). That is a question on the
// item, not an assertion here.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const OWED = 'OWED by goal/G9.6: ';
const RUN = path.join(__dirname, '..', 'run');
const DESK = path.join(RUN, 'shell', 'desk', 'desk.js');
const DETAILS = path.join(RUN, 'shell', 'deskDetails', 'deskDetails.js');

function read(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } }
function short(x) { return String(typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 240); }
// Code only: a comment recalling the old bubble is no bubble.
function code(s) { return String(s || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1'); }
// The header block as the markup writes it: from the container's id to the markup that follows the block.
// `ends` is that following markup verbatim, so the element after the header is never read as part of it.
function headerBlock(src, id, ends) {
  const at = src.indexOf('id="' + id + '"');
  if (at === -1) return '';
  const to = src.indexOf(ends, at);
  return src.slice(at, to === -1 ? src.length : to);
}

test.startTest('goal/G9.6: the header area, joined to the title bar and flat');

const desk = code(read(DESK));
const dd = code(read(DETAILS));

if (!desk || !dd) {
  test.fail(OWED + 'the shells are owed: desk.js ' + !!desk + ', deskDetails.js ' + !!dd);
} else {
  [['desk', desk, 'desk-goal', 'desk-bars', '<div id="desk-root">'],
    ['deskDetails', dd, 'dd-head', 'dd-bars', '<div class="stat-tile wide" id="dd-box">']].forEach(function (a) {
    const name = a[0]; const src = a[1]; const bubble = a[2]; const bars = a[3]; const after = a[4];

    test.subHeading(name + ': 1. the title bubble is gone');
    if (src.indexOf('id="' + bubble + '"') === -1 && src.indexOf("'" + bubble + "'") === -1) {
      test.check(name + ' draws no #' + bubble);
    } else test.fail(OWED + name + ' still has #' + bubble);

    const block = headerBlock(src, bars, after);
    test.subHeading(name + ': 2. the container has no padding and no margin');
    const padded = /padding[^;"']*:/.test(block) || /margin[^;"']*:/.test(block);
    // The header function sets it on the element createAppHeader returns, which the markup cannot show.
    const set = /\.style\.(padding|margin)[A-Za-z]*\s*=/.test(src);
    if (!padded && !set) test.check(name + ': neither the markup nor the header function pads or margins #' + bars);
    else test.fail(OWED + name + ': ' + short({ inTheMarkup: padded ? block.match(/(padding|margin)[^;"']*:[^;"']*/g) : [], setInCode: set ? (src.match(/\.style\.(padding|margin)[A-Za-z]*\s*=\s*'[^']*'/g) || []) : [] }));

    test.subHeading(name + ': 3. nothing in the header rounds its corners');
    const rounded = [];
    if (/border-radius/.test(block)) rounded.push('an inline border-radius');
    if (/class="[^"]*\bstat-tile\b/.test(block)) rounded.push('class stat-tile (10px in index.html)');
    if (/class="[^"]*\bcard\b/.test(block)) rounded.push('class card (.start-job-form.card, 10px)');
    if (!rounded.length) test.check(name + ': no rounded corners inside #' + bars);
    else test.fail(OWED + name + ' rounds: ' + short(rounded));

    test.subHeading(name + ': 4. it stays joined to the title bar');
    if (/createAppHeader\s*\(/.test(src)) test.check(name + ' builds its header with createAppHeader(), so it sticks under the bar');
    else test.fail(OWED + name + ' no longer builds its header area with createAppHeader()');
  });
}

test.reportSuccessFailureCount();
