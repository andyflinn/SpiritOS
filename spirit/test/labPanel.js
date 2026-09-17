'use strict';

// spirit/test/labPanel.js
// THE LAB PANEL HAD NO TEST, AND IT SHOWED.
//
//   Andy: "can i only have 3 buttons per peer 1) either start or stop
//   2) update... and a delete button with are-you-sure."
//   Andy, one commit later: "whoops! my avatars have 5 buttons now
//   (start, stop, stop, update, delete)."
//
// The toggle was added to the builder and the two hardcoded buttons were
// left in the cell beside it. Nothing could have caught that: every lab
// suite drives the HTTP surface, and not one of them had ever rendered a
// row.
//
// So this loads the page's own script, gives it the smallest browser it
// will accept, and asks what a row actually draws. The panel spawns
// processes and deletes directories that hold keys — it is the last
// screen in this tree that should be judged by reading it.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const PANEL = path.join(__dirname, 'labMaster', 'labMastPanel.html');

// ── THE SMALLEST BROWSER THE PANEL WILL RUN IN ───────────────────────
//
// It wants a few elements by id, a place to hang listeners, a fetch, and
// a timer. Nothing is faked away that the page depends on for its
// MARKUP — `render` is called for real and its output is the subject.
function tinyBrowser() {
  const elements = Object.create(null);
  const listeners = [];

  function element(id) {
    const el = {
      id: id,
      value: '',
      textContent: '',
      innerHTML: '',
      disabled: false,
      addEventListener: function (kind, fn) { listeners.push({ on: id, kind: kind, fn: fn }); },
    };
    return el;
  }

  const doc = {
    getElementById: function (id) {
      return elements[id] || (elements[id] = element(id));
    },
    addEventListener: function (kind, fn, capture) {
      listeners.push({ on: 'document', kind: kind, fn: fn, capture: !!capture });
    },
  };

  return { doc: doc, elements: elements, listeners: listeners };
}

function loadPanel() {
  const html = fs.readFileSync(PANEL, 'utf8');
  const script = html.split('<script>')[1].split('</script>')[0];
  const browser = tinyBrowser();

  // `render` is the subject, so it is lifted out rather than left inside
  // the closure: the page never exposes it, and a test that had to click
  // its way to a repaint would be testing the click handler instead.
  const factory = new Function(
    'document', 'fetch', 'setInterval', 'window',
    script + '\n; return { render: render, refresh: refresh };'
  );

  const api = factory(
    browser.doc,
    function () { return Promise.resolve({ ok: true, text: function () { return Promise.resolve('{}'); } }); },
    function () { return 0; },
    {}
  );

  return { browser: browser, render: api.render };
}

function rowFor(html, name) {
  return (html.split('<tr>').filter(function (r) { return r.indexOf('>' + name) !== -1; })[0]) || '';
}

function buttonsIn(rowHtml) {
  return (rowHtml.match(/<button[^>]*data-act="([a-z]+)"/g) || []).map(function (b) {
    return /data-act="([a-z]+)"/.exec(b)[1];
  });
}

test.startTest('The lab panel draws what it says it draws');

const panel = loadPanel();

// ── 1. THREE BUTTONS, AND WHICH THREE ────────────────────────────────

test.subHeading('A node somebody made has three buttons, never five');

panel.render([
  { id: 'work', name: 'work', type: 'avatar', port: 65432, permanent: true, running: true, home: '/repo', commit: '' },
  { id: 'jazz', name: 'jazz', type: 'avatar', port: 65400, permanent: false, running: true, home: '/lab/jazz', commit: 'abc1234' },
  { id: 'rock', name: 'rock', type: 'avatar', port: 65405, permanent: false, running: false, home: '/lab/rock', commit: 'abc1234' },
]);

const drawn = panel.browser.elements.tbody.innerHTML;

const jazz = buttonsIn(rowFor(drawn, 'jazz'));
if (jazz.length === 3) {
  test.check('three, and exactly three: ' + jazz.join(', '));
} else {
  test.fail(jazz.length + ' buttons: ' + jazz.join(', '));
}

// ── START OR STOP, NEVER BOTH ────────────────────────────────────────
//
// A stopped node has one useful thing to do to it and a running node has
// another. Offering both makes half the buttons on the screen no-ops at
// any moment — and it is how five happened.
if (jazz.indexOf('stop') !== -1 && jazz.indexOf('start') === -1) {
  test.check('a running node offers Stop and not Start');
} else {
  test.fail('running row: ' + jazz.join(', '));
}

const rock = buttonsIn(rowFor(drawn, 'rock'));
if (rock.indexOf('start') !== -1 && rock.indexOf('stop') === -1) {
  test.check('and a stopped one offers Start and not Stop');
} else {
  test.fail('stopped row: ' + rock.join(', '));
}

if (jazz.indexOf('refresh') !== -1 && jazz.indexOf('delete') !== -1) {
  test.check('with Update and Delete beside it');
} else {
  test.fail('missing Update or Delete: ' + jazz.join(', '));
}

// RECYCLE IS OFF THE PANEL — it wiped a home and cloned a fresh one, one
// pixel from Update and reading as a synonym for it. The verb stays on
// the server because labWorld asks for it; the button does not.
if (drawn.indexOf('data-act="recycle"') === -1) {
  test.check('and no Recycle, which was the button behind all of this');
} else {
  test.fail('Recycle is still on a row');
}

// ── AND THE WORK NODE IS NOT A LAB NODE ──────────────────────────────
//
// It is Andy's checkout. Stopping it is one thing; updating or deleting
// it would fetch and hard-reset the tree he is working in.
if (buttonsIn(rowFor(drawn, 'work')).length === 0) {
  test.check('the work node offers none of them — it is the checkout');
} else {
  test.fail('work row: ' + buttonsIn(rowFor(drawn, 'work')).join(', '));
}

// ── 2. THE COLUMN THAT WENT ──────────────────────────────────────────

test.subHeading('And the Running column is the button');

if (drawn.indexOf('<th>Running</th>') === -1 && panel.browser.elements.tbody.innerHTML.indexOf('>yes<') === -1) {
  test.check('no Running column, because a button that says Stop is one');
} else {
  test.fail('Running survived');
}

// WHAT WENT WRONG MUST NOT GO WITH IT. `lastError` shared that cell, and
// a node that refused to start with nothing said looks exactly like one
// nobody has started.
panel.render([
  { id: 'jazz', name: 'jazz', type: 'avatar', port: 65400, permanent: false,
    running: false, home: '/lab/jazz', commit: 'abc1234', lastError: 'EADDRINUSE 65400' },
]);
const failed = panel.browser.elements.tbody.innerHTML;
if (/EADDRINUSE 65400/.test(failed)) {
  test.check('but what went wrong is still said, beside the name');
} else {
  test.fail('the error vanished with the column: ' + failed.slice(0, 200));
}

// ── 3. DELETE ASKS, AND CAN BE TAKEN BACK ────────────────────────────

test.subHeading('Delete asks first, and goes cold when attention moves');

// The page keeps the armed id itself, so the only way in is the click
// handler it registered on the table body.
const onBody = panel.browser.listeners.filter(function (l) {
  return l.on === 'tbody' && l.kind === 'click';
})[0];

if (onBody) {
  test.check('the table body handles its own clicks');
} else {
  test.fail('no click handler on the table');
}

panel.render([
  { id: 'jazz', name: 'jazz', type: 'avatar', port: 65400, permanent: false, running: true, home: '/lab/jazz', commit: 'abc1234' },
]);

if (onBody) {
  onBody.fn({
    target: {
      getAttribute: function (a) {
        return a === 'data-act' ? 'delete' : a === 'data-id' ? 'jazz' : null;
      },
    },
  });

  const armed = panel.browser.elements.tbody.innerHTML;
  if (/Really delete\?/.test(armed)) {
    test.check('one press arms it and the button says so');
  } else {
    test.fail('not armed: ' + armed.slice(0, 300));
  }

  // RED AS WELL AS REWORDED, because somebody scanning eight rows needs
  // to see WHICH one is loaded without reading them.
  if (/class="armed"/.test(armed)) {
    test.check('and is marked, so which row is loaded is visible at a glance');
  } else {
    test.fail('no mark on the armed row');
  }

  // ── AND A CLICK ANYWHERE ELSE TAKES IT BACK ────────────────────────
  //
  // UI_DESIGN_STYLE.md: the danger is not the second press, it is the
  // press after it. Kept by hand here because this page is not a shell
  // app and cannot call api.armUntilElsewhere.
  const captures = panel.browser.listeners.filter(function (l) {
    return l.on === 'document' && l.kind === 'click' && l.capture;
  });
  const bubbles = panel.browser.listeners.filter(function (l) {
    return l.on === 'document' && l.kind === 'click' && !l.capture;
  });

  if (captures.length === 1 && bubbles.length === 1) {
    test.check('two document listeners, so the arming click does not disarm itself');
  } else {
    test.fail(captures.length + ' capture / ' + bubbles.length + ' bubble listeners');
  }

  if (bubbles.length) {
    bubbles[0].fn({});   // a click that is not the one that armed it
    const cold = panel.browser.elements.tbody.innerHTML;
    if (!/Really delete\?/.test(cold) && /data-act="delete"/.test(cold)) {
      test.check('and a click elsewhere puts Delete back to plain Delete');
    } else {
      test.fail('still armed after clicking away: ' + cold.slice(0, 300));
    }
  }
}

test.reportSuccessFailureCount();
