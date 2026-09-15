'use strict';

// spirit/test/protocolSurface.js
// EVERY WAY OF SPEAKING ON THIS WIRE IS IN THE REGISTER.
//
//   Andy: "If the protocol doesn't support it: no code until a decision
//   is reached: fix the protocol, or cheat?"
//
// Decision 0010. The rule is that extending the protocol by hand is a
// decision, not a commit — and this is what stops that being a sentence
// nobody reads.
//
// ── WHAT IT ACTUALLY CHECKS ──────────────────────────────────────────
//
// Two shapes, because in this tree a new way of speaking has exactly two:
//
//   a new <verb>Message() — a new format of signed bytes
//   a new /api/relay/* route — a new public door
//
// Both are greppable, which is the only reason this rule can be
// mechanical at all. It cannot tell whether a door is justified; it can
// make sure nobody opened one without saying so.
//
// ── WHAT IT CANNOT DO ────────────────────────────────────────────────
//
// It cannot judge. A cheat listed in the register passes exactly like the
// protocol does — the register records what each thing IS, and this only
// proves the list is complete in both directions. A door in the tree and
// not in the list is red; a door in the list and not in the tree is red
// too, because a register describing a world that has moved is worse than
// none.

const fs = require('fs');
const path = require('path');
const test = require('./testSupport.js');

const RUN = path.join(__dirname, '..', 'run', 'js');
const DECISION = path.join(__dirname, '..', '..', 'design', 'decisions',
  '0010-fix-the-protocol-or-name-the-cheat.md');

test.startTest('Protocol surface — nothing speaks on this wire unregistered');

function readOr(file, fallback) {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { return fallback; }
}

// ---------------------------------------------------------------------
// What the tree actually has.
// ---------------------------------------------------------------------

// Signed formats. The three files that mint bytes for somebody to sign.
const MESSAGE_FILES = ['relayAuth.js', 'invites.js', 'deviceAuth.js'];
const inTree = { messages: [], routes: [] };

MESSAGE_FILES.forEach(function (name) {
  const src = readOr(path.join(RUN, name), '');
  (src.match(/^function ([a-zA-Z]+Message)\(/gm) || []).forEach(function (line) {
    const m = /^function ([a-zA-Z]+Message)\(/.exec(line);
    if (m) inTree.messages.push(m[1]);
  });
});

const server = readOr(path.join(RUN, 'server.js'), '');
(server.match(/'\/api\/relay\/[a-z-]+'/g) || []).forEach(function (q) {
  const r = q.replace(/'/g, '');
  if (inTree.routes.indexOf(r) === -1) inTree.routes.push(r);
});

// ── AND WHAT TRAVELS ON THE ONE THAT IS A WIRE ───────────────────────
//
// THE REGISTER COUNTED DOORS, NOT PACKETS, and fell through that hole
// twice. `GET /api/relay/stream` is one row, and seven different things
// go down it — so an eighth (`owner-event`, 2026-09-15) was added and
// nothing went red, because the door had not changed.
//
// A door is a way of speaking. So is a word said through it.
//
// Read off the two calls that put something on a stream: `presentNow.send`
// names one identity, `presentNow.broadcast` names everybody. Anything
// that reaches a sink goes through one of them, so this is the same kind
// of scan as the route one above — the tree's own answer, not a list
// somebody keeps beside it.
const relaySrc = readOr(path.join(RUN, 'relay.js'), '');
inTree.events = [];
(relaySrc.match(/presentNow\.(?:send|broadcast)\([^;]*?'([a-z-]+)'/g) || []).forEach(function (call) {
  const m = /'([a-z-]+)'\s*$/.exec(call);
  if (m && inTree.events.indexOf(m[1]) === -1) inTree.events.push(m[1]);
});

inTree.messages.sort();
inTree.routes.sort();
inTree.events.sort();

// ---------------------------------------------------------------------
// What the register says.
// ---------------------------------------------------------------------

const doc = readOr(DECISION, '');
const registered = { messages: [], routes: [] };

// Read out of the TABLE ROWS, which is where a human writes them, and out
// of nowhere else. A name in a cell is an entry; the same name in a
// paragraph is a mention.
//
// That distinction only became load-bearing when the first cheat
// collapsed: the worked example has to be able to say which verbs were
// deleted, by name, without those names reading as a claim that they are
// still here. A scanner that read the whole file would have made the
// register unable to describe its own history.
const rows = doc.split('\n').filter(function (line) {
  return /^\s*\|/.test(line) && !/^\s*\|[\s|:-]*$/.test(line);
});

rows.forEach(function (line) {
  (line.match(/`([a-zA-Z]+Message)`/g) || []).forEach(function (q) {
    const n = q.replace(/`/g, '');
    if (registered.messages.indexOf(n) === -1) registered.messages.push(n);
  });
  (line.match(/`(?:GET|POST) (\/api\/relay\/[a-z-]+)`/g) || []).forEach(function (q) {
    const n = /(\/api\/relay\/[a-z-]+)/.exec(q)[1];
    if (registered.routes.indexOf(n) === -1) registered.routes.push(n);
  });
});

// THE EVENT TABLE IS READ BY SECTION, not by scanning every row, because
// a lowercase backticked word is common everywhere else in this document
// — `monitor`, `keys`, `open` — and a scanner that took them all would
// register half the vocabulary of the prose. The heading is the boundary,
// and if somebody renames the heading this goes red for a missing
// section, which is the right failure.
const EVENT_HEADING = '### What travels on the stream';
registered.events = [];
(function () {
  const start = doc.indexOf(EVENT_HEADING);
  if (start === -1) return; // no section: every event reads as unregistered
  const after = doc.indexOf('\n### ', start + EVENT_HEADING.length);
  const section = doc.slice(start, after === -1 ? doc.length : after);
  section.split('\n').forEach(function (line) {
    if (!/^\s*\|/.test(line) || /^\s*\|[\s|:-]*$/.test(line)) return;
    // First cell only. The second is prose and may name anything.
    const first = line.split('|')[1] || '';
    const m = /`([a-z-]+)`/.exec(first);
    if (m && registered.events.indexOf(m[1]) === -1) registered.events.push(m[1]);
  });
})();

registered.messages.sort();
registered.routes.sort();
registered.events.sort();

test.subHeading(inTree.messages.length + ' signed format(s), ' +
  inTree.routes.length + ' public relay route(s)');

// ---------------------------------------------------------------------

function compare(what, tree, listed) {
  const unlisted = tree.filter(function (x) { return listed.indexOf(x) === -1; });
  const stale = listed.filter(function (x) { return tree.indexOf(x) === -1; });

  // A DOOR NOBODY DECLARED. The failure this exists for: a feature that
  // needed a word the protocol did not have, and got one quietly.
  if (!unlisted.length) {
    test.check('every ' + what + ' in the tree is in the register — ' + tree.length + ' of them');
  } else {
    test.fail(unlisted.join(', ') + ' — ' + (unlisted.length > 1 ? 'these are' : 'this is') +
      ' in the tree and not in decision 0010. Extending the protocol by hand is a ' +
      'decision: fix the protocol, name the cheat, or do not do it.');
  }

  // AND THE OTHER DIRECTION, which matters more than it looks: a register
  // describing a world that has moved is worse than no register, because
  // it reads as current.
  if (!stale.length) {
    test.check('and every registered ' + what + ' still exists');
  } else {
    test.fail(stale.join(', ') + ' — registered in 0010 and gone from the tree. ' +
      'Remove it from the register, or find out what deleted it.');
  }
}

compare('signed format', inTree.messages, registered.messages);
compare('relay route', inTree.routes, registered.routes);
compare('stream event', inTree.events, registered.events);

// ---------------------------------------------------------------------
test.subHeading('The register says what each one IS');
// ---------------------------------------------------------------------

// The point is not that things are listed. It is that each is listed
// UNDER something — protocol, bootstrap, died, or cheat — because "we
// wrote it down" is not a decision and the four words are.
//
// "Dying" became "Died" on 2026-09-15, when R8 carried the sentence out.
// The section is kept and checked for although its table is now empty:
// a register that silently loses the category a thing was deleted under
// cannot tell a later reader that the deletion was decided rather than
// drifted into. An empty category is a record; a missing one is a gap.
['## The protocol', '### Bootstrap', '### Died with the ring', '### Cheats, named']
  .forEach(function (heading) {
    if (doc.indexOf(heading) !== -1) {
      test.check('the register keeps its "' + heading.replace(/^#+ /, '') + '" section');
    } else {
      test.fail('0010 has lost its "' + heading + '" section — a register with no ' +
        'categories is a list, and a list decides nothing');
    }
  });

// AND THE SCANNER IS NOT ASLEEP. Every check above passes against one
// that read nothing at all.
(function itCanFail() {
  const known = inTree.messages.indexOf('postMessage') !== -1 &&
    inTree.routes.indexOf('/api/relay/post') !== -1 &&
    doc.indexOf('postMessage') !== -1;
  if (known && doc.length > 1000) {
    test.check('and it is reading both the real tree and the real decision');
  } else {
    test.fail('the scan proves nothing: messages=' + inTree.messages.length +
      ' routes=' + inTree.routes.length + ' doc=' + doc.length);
  }
})();

test.reportSuccessFailureCount();
