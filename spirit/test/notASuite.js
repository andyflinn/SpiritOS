'use strict';

// spirit/test/notASuite.js
// THE FILES BESIDE THE SUITES THAT ARE NOT SUITES — one list, two readers.
//
// runAll.js reads it (goal/G8.12), so the runner never takes testSupport.js, deskFake.js or runAll.js itself for a
// suite; hygieneG19_11.js checks every name here is a file beside the suites.
//
// A suite is a file that REPORTS: it calls startTest(. Anything else beside them is a module somebody put there, and
// running it proves nothing. A name belongs on this list only with the reason it is not a suite.
module.exports = [
  // THIS LIST ITSELF (goal/G19.11): its header names the call that marks a suite, so the rule took it for one.
  'notASuite.js',
  'testSupport.js', 'scenario.js', 'world.js', 'runAll.js',
  // The child testSupport runs to post its last records before a suite exits (goal/G8.1): a helper, not a suite.
  'verifyPost.js',
  // NOT A HARNESS SUITE (goal/G27.2): the one-door stack-frame suite is never run by runAll. The Stacks plugin that ran
  // it a door at a time is gone (goal/G43.22); the file is kept beside its list, run by hand.
  'oneDoorStacks.js',
  'labWorld.js', 'setupRelayFakes.js',
  'relayProbe.js', 'startTestAndy.js', 'startTestBert.js', 'startTestRelay.js',
  // A helper, not a suite: reads a relay's roll off its disc for the suites
  // that inspect it.
  'rollOf.js',
  // Two nodes and a relay with an empty contact book, shared by cardFetch.js
  // and cardRotation.js. Builds a world; asserts nothing.
  'cardWorld.js',
  // A DECLARATION, NOT A SUITE: which capacity figures depend on the box
  // and which cannot. It asserts nothing — capacityFresh reads it. Its
  // own header says why it is not inside measureCapacity.js: that file
  // MEASURES WHEN REQUIRED, so asking it for the kinds starts a
  // measurement.
  'capacityKinds.js',
  // A COMPUTATION, NOT A SUITE: the most a member row can cost, from
  // fieldRules (goal/G4.19, issue 7). capacityFresh and capacityRule read it.
  'memberRowWorst.js',
  // NOT A SUITE: a claimed relay with the owner watching, shared by
  // relayMonitor.js and others. It asserts nothing and builds one.
  'monitorWorld.js',
  // A TOOL, not a suite: rewrites the front page's generated capacity
  // block from the Ubuntu measurement (Andy, 2026-09-23 — "the front page
  // README.md should have a marked block that will be auto-updated with
  // the ubuntu-relay capacity only"). It writes a file and makes no
  // pass/fail claim; `capacityFresh.js` is the suite that holds it honest.
  'publishCapacity.js',
  // A helper, not a suite: sealing a post to a relay and
  // opening the answer, in one place so twenty suites cannot each grow
  // their own opinion about what a sealed reply looks like.
  'openReply.js',
  // A helper, not a suite: an owned relay the way the install makes one
  // (goal/G16.8), and the owner's claim on it, in process.
  'ownerClaim.js',
  // A helper, not a suite (goal/G22.6): the relay's one door as a suite
  // knocks on it — the card ask for readiness and the key, a stranger's
  // claim, paced past the relay's address table.
  'relayDoor.js',
  // A helper, not a suite: copies the NON-IGNORED spirit/run into a
  // fixture, for the suites that spawn a real server, so media, the
  // brains vault and relay-state's private key stay out of it.
  'plantRun.js',
  // A helper, not a suite (goal/G22.5): an identity in a scratch root, made by
  // planting relayAuth.js there and letting its first load make it.
  'plantIdentity.js',
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
  // (README/CAPACITY.md). Run it when the platform or the code moves.
  'measureCapacity.js',
  // The orchestrator for the two above — runs the harness and the capacity
  // tool in sequence so one box contributes its whole story under one date
  // and one commit. A harness that ran itself would be a loop.
  'measurePlatform.js',
  // Fails on purpose: it is the worked example of what a failing check
  // looks like, and it would be the one permanent red in every run.
  'testTemplate.js',
  // ASSERTED BY A PERSON LOOKING AT A SCREEN. It moves the world one step
  // at a time, slowly enough to be followed, and asks Andy what he sees —
  // so a harness that ran it would sit at a prompt for ever. Listed here
  // rather than left out by accident: it does not call startTest, and the
  // runner's discovery rule would skip it silently.
  'presenceShow.js',
  // A FIXTURE, NOT A SUITE. It enrols a relay full of people named after
  // consecutive lines of a play, so a ranker is asked the kind of question
  // somebody will actually ask it. Required by suites; reports nothing of
  // its own.
  'playPopulate.js',
];
