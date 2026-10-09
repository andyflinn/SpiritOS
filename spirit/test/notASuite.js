'use strict';

// spirit/test/notASuite.js
// THE FILES BESIDE THE SUITES THAT ARE NOT SUITES — one list, two readers.
//
// It lived inside runAll.js until goal/G8.12, when deskVerify began running the harness itself (the desk says a goal
// has emptied, deskVerify runs every suite). Two readers of the same folder with two ideas of what a suite is would
// have run testSupport.js, deskFake.js and runAll.js itself as suites - a whole harness nested inside the run, which
// claude-windows caught verifying 4c7fcb76. So the list is here, and both read it.
//
// A suite is a file that REPORTS: it calls startTest(. Anything else beside them is a module somebody put there, and
// running it proves nothing. A name belongs on this list only with the reason it is not a suite.
module.exports = [
  'testSupport.js', 'scenario.js', 'world.js', 'runAll.js',
  // The child testSupport runs to post its last records before a suite exits (goal/G8.1): a helper, not a suite.
  'verifyPost.js',
  'labWorld.js', 'labPopulate.js', 'labMaster.js', 'setupRelayFakes.js',
  'relayProbe.js', 'startTestAndy.js', 'startTestBert.js', 'startTestRelay.js',
  // A helper, not a suite: reads a relay's roll off its disc for the suites
  // that inspect it (cycle 3).
  'rollOf.js',
  // The board's ranking graph. Pure, asserts nothing; boardRankSuite.js is
  // the suite that holds it to account.
  'boardRank.js',
  // Whether the lead posts the board to Andy's node, decided pure;
  // boardPostSuite.js is the suite.
  'boardPost.js',
  // Two nodes and a relay with an empty contact book, shared by cardFetch.js
  // and cardRotation.js. Builds a world; asserts nothing.
  'cardWorld.js',
  // Andy's rulings on dependencies between to-dos: data, read by the board.
  'edges.js',
  // NOT A SUITE AND DELIBERATELY SO: the rows an agent writes by hand when
  // it stops and waits for Andy. It reports nothing and asserts nothing —
  // the board reads it. Listed here rather than given a startTest, because
  // a block is a DECLARATION about the world and not a claim about the
  // code (see its own header for why the board's "blocked is a join, not a
  // flag" rule cannot serve this one).
  'blocking.js',
  // A DECLARATION, NOT A SUITE: which capacity figures depend on the box
  // and which cannot. It asserts nothing — capacityFresh reads it. Its
  // own header says why it is not inside measureCapacity.js: that file
  // MEASURES WHEN REQUIRED, so asking it for the kinds starts a
  // measurement.
  'capacityKinds.js',
  // A COMPUTATION, NOT A SUITE: the most a member row can cost, from
  // fieldRules (goal/G4.19, issue 7). capacityFresh and capacityRule read it.
  'memberRowWorst.js',
  // NOT A SUITE: a claimed relay with the owner watching, extracted from
  // relayMonitor.js when cycle 10's R12 needed the same world. It
  // asserts nothing and builds one.
  'monitorWorld.js',
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
  // A helper, not a suite: a desk server in memory, for the suites that
  // mount Desk once it keeps nothing in its own folder (desk/G1.4).
  'deskFake.js',
  // A helper, not a suite: desk/G2.2's launcher checks, run by jobCallback.js through its stand-in door.
  'launcherChecks.js',
  // A helper, not a suite: desk/G2.3's publishing checks, run by jobCallback.js through its stand-in door.
  'publishChecks.js',
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
];;
