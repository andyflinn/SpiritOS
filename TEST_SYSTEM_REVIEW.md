SpiritOS test system review
Nov 18, 2026 · @Andreas Thut
Reviewed at master d9ccc7fe.
Verdict
The test system gives fast feedback on the file you touched, not near-real-time coverage of the product. The machinery is solid: every one of the 260 production modules has its own test and spec, the reporter passes only === true, and most tests run end to end on a real node, relay and Chrome. Four things stand between that and real-time coverage:
1.  A change re-runs only the changed file's own suites. Modules that require it are never re-run, and edits to .json, .md, HTML or CSS trigger nothing. spirit.js is required by 255 modules, yet a change to it runs 4 suites.
2.  By default nothing runs by itself. testicle starts in interactive mode, and its red list counts only test rows, so "no reds" can mean "nothing ran".
3.  Without a live node the reporter fails tests that passed. A rejected report becomes a crash charged to whatever test is running. Three tests that all return true print ✅ ✅ ❌ with no node.
4.  Some reds don't point at their cause. The title rule itself is sound: with the key (script, suite, title) and grep, a red lands on the exact test code and the script it judged. Three things break it today. Two tests loop over items inside one test.run: search-child-browser.js:335 without test.forScript, and job.js:624 over every app server (both accepted as bugs, 2026-11-18). Suite output is thrown away. And crash, hang and false print the same ❌.
On coverage, three security paths have no test that would go red on a regression: the fs family is never grantable, the relay's signature checks, and ../ traversal in the file gates. The job.create path that regressed on 2026-11-10 had no test then and has one now.
Strategy
The queue design is sound: flags work as an idempotent queue, both file hashes are captured when a run starts, a kill keeps results already reported, and general tests take many scripts in one process. What it selects and when it runs is where real-time coverage is lost. Paths are under spirit/run/spirit/.
Severity
Finding
Evidence
High
A change flags only the file's own test and the general tests that judge that file. Dependents are never re-run, so editing appServer.js re-runs nobody else's suite. testModule.js's blast radius has the same gap (only upward, "never a sibling branch").
app/testicle/testicle.js:678-684, test/testModule.js:131-141
High
Changes to .json, .md, HTML and CSS start nothing, yet <name>.json decides how an app mounts and runs. Results are tagged only with the file's own hashes, so a stale green shows as current.
testicle.js:839
High
Interactive is the default, and in interactive mode the runner picks nothing by itself. Only the classifier, presses and edits to the top-10 red scripts run.
testicle.js:176, :283
High
testicle.red reads test rows only. A suite flagged "needs running", or one that crashed at load (marked red with no test row), never shows there or in the top 10.
testicle.js:113, :504-506, :1180
High
Every edit re-classifies first, and classifying boots a scratch node (up to 60 s) and Chrome. With no node or no Chrome, every script fails classifyable at 0.8 and its other suites are blocked until the next change or a restart.
testicle.js:74-75, :267-284, :534; test/scriptClassify.js:81-121
Medium
Pending changes are cleared before they are written. If testModule.js or the write fails, those changes are logged and never retried.
testicle.js:823-827
Medium
One runner, a 120-minute job limit, test.after() cleanups with no limit, and general tests ordered before the edited file's own test. A press or a top-10 edit kills the running job, the classifier included, which then reboots its node and Chrome.
testicle.js:164, :286, :437, :452; test/testReport.js:263
Medium
Severity only rises (MAX(severity, ?)) and any crash is set to 0.7, so a 0.2 test that crashed once ranks as 0.7 for good. About 89% of tests are 0.2, and security refusals such as the puppet signature checks are labelled 0.2.
testicle.js:108, :581; testReport.js:254
Medium
One node and one Chrome serve every suite with no reset between them, so a result can depend on suite order. The profile sweeper deletes Chrome profiles over 1 hour old while a job may run 120 minutes.
test/headLessChrome.js:194-208, :387-396
Medium
Results are not tied to a run: any owner-side caller can post testicle.set or suite.success(true). Peers are refused by default, but a grant of the whole testicle family would let a peer forge greens or keep the runner busy.
testicle.js:1055-1078, :1128; apiDoor.js:126-136
On the one-string rule. The title is the grep key: an agent greps the suite for it and lands on exactly the test code that went red (Andy, 2026-11-18). That works, and it also buys stable keys and a flip history that never churns on message text. What grep cannot return is runtime state: which item in a loop failed, the value seen, and whether the body returned false, crashed or hung. Two reds from the run show it: "each app server's door.sock" in job.js greps to a loop over apps, not the app; "the list scrolls" in search-child-browser greps to a loop over searches, not contact. A third, "a scratch node comes up", greps to code that was not the cause at all (the reporter was). The reporter already knows crash versus false (settle(..., { crash: true })), so reporting that flag costs no string. With suite output discarded (stdio: 'ignore', testicle.js:364), the rest takes a re-run with --test <title> and hand instrumentation.
Coverage
File-level coverage is complete: all 260 production modules have ./test/<name>.js and .md, enforced by spirit-sibling-general.js:910 and :930. The tree holds 7,772 test.run calls. The full plan is 1,345 suite runs, of which 1,082 (80%) are general-test runs. By call count about 57% sit in suites that start a real node, relay or Chrome, 35% call the module in process with stand-ins, and 6% regex the source. By runs, static rule checks weigh far more, since spirit-sibling-general runs once per module.
The general tests are mostly about layout, naming and history. Their correctness checks are few: broken calls refused 4xx at the door, served verbs equal declared verbs, no global leaks, require paths resolve. The -browser tests do check real behaviour in Chrome: no throw, no console error, size, subscriptions released.
Thin where it matters most. Size measures risk better than file count, and the transport and auth modules are the thinnest:
Module
Lines
Own tests
What they check
peerPost.js
2,084
5
none on behaviour
desk/server/server.js
2,984
13
mostly that old things are gone
relayAuth.js
746
6
none on its signature checks
arrivals.js
381
2
both read the source
hub.js
2,278
16
partly behavioural
relay.js
4,457
32
plus 219 end to end through relayServer.js
Security paths from the review gate. Would a regression turn a test red?
Path
Red on regression?
Evidence
Face from a relay that is not faceable refused
Yes, in process and on a real node
test/faceHome.js:220-237, :684-700
contact.faceable never from a face
Yes
test/faceHome.js:243-246, test/apiDoor.js:53-54
contact.faceable never grantable
No test
apiAuth.js:174
fs family never grantable
No test
apiAuth.js:171
Origin check on face POSTs
Yes, both routes
test/relayServer.js:138-165
job.create runs only this node's own appServer.js
No on 2026-11-10; yes now (a8a0e27, red before 948ccde). No literal --eval= case
test/job.js:160-173
Relay status clamp 200-599
Partly: 99, 600 and non-numbers covered; nothing in 100-199, no 200 or 599 boundary
test/relay.js
Agent provider key never follows a changed url
Yes, with a real listening server
app/agent/table/provider/test/server.js:357-367
../ traversal in the file gates
No test; other gates well covered
test/fileSystem.js:36-100
Relay face, receipt, stream and claim signatures
Weak: the forged-signature tests fail only on a hang, a 5xx or a dead relay, so an accepted forgery with 200 passes
test/relayServer.js:363-423
The refusal tests list known attack shapes rather than testing how the check is built. That is how the 2026-11-10 regression passed: no test had a first argument that merely ended in spirit/server/app.js.
Tests that can pass for the wrong reason. No test body has catch { return true }. The weak spots are the forged-signature tests above, "X is gone" checks that pass for good once X is deleted, and two suites whose titles are built from values (test/word.js:127,200, and spirit-sibling-general.js:2108-2129, the title rule's own file).
Approach
The suites run headless from a fresh checkout, Chrome works, and they are stable: 13 suites run twice gave identical reds with wall times within 1 second. The problems are how you start them, what happens without a node, and what a red says.
Running them. npm test points at spirit/test/runAll.js, which no longer exists, so it fails with MODULE_NOT_FOUND (package.json:8). TEST_SYSTEM.md lines 3-4 and 97 still describe that harness. There is no CI. Today a developer either runs each suite by hand from spirit/run, or uses testicle on a live node. testicle is off on a fresh node, stays idle once switched on, runs one testicle.run {script, suite} at a time, and has no "run all" and no exit code to gate a merge on.
No node means false reds. The reporter stores a rejected report promise, and its own unhandledRejection handler then fails whatever test is running (test/testReport.js:132, :203). Every no-node red we saw in fileSystem, apiAuth, faceHome, relayServer, spirit.js (19) and testReport's own test went away when that one rejection was swallowed. Reports that cannot be delivered are otherwise dropped with no notice (testReport.js:147). With a node running, relay.js still lost 3 tests the same way, through a scratch relay tree's own spirit.js.
Test bugs found by running.
• job.js checks each app's door.sock with no wait. On a lab node the socket was missing at 0 ms and present at 1,000 ms for desk, deskClient and testicle.
• 13 job.js tests read commit 2fb29140, which a shallow clone lacks. They also check one item's history, which TEST_SYSTEM.md says does not belong in permanent tests.
• testModule.js lists general tests for scripts outside their class. Run by hand, the browser test on node-only job.js gives 21 reds and the node test on browser-only progressBar.js gives 1. Only testicle filters these, from its database.
• Its upward walk misses a module whose name matches its folder: for app/testicle/words.js it never lists testicle's own test (testModule.js:137-141).
• A suite that throws while loading, after requiring the reporter, prints nothing and exits 0.
Reds that may be real. word.js flags 107 paths that take a word reserved above them (commit 4ebc28f says this waits on your word). search-child-browser has 4 reds, all on the contact search, whose list never overflows (scrollHeight equals clientHeight, 324 px). We could not tell whether the product or the test is at fault.
What a red tells you. A red's key, (script, suite, title), plus a grep for the title, finds the exact test code and the script it ran against. In our sample that fell short three times: "each app server's door.sock" in job.js and "the list scrolls" in search-child-browser loop over items inside one test, so the key does not name the app or the search (accepted as bugs); and "a scratch node comes up" in fileSystem was really the reporter's no-node bug.
Speed. Most general entries take 0.2 to 1.5 seconds. The slowest own suites were testicle.js 583 s, search-child-browser 107 s, job.js 98 s and faceHome.js 93 s. A change to job.js selects 12 entries, about 117 s; a leaf element selects 4, about 6 s.
Recommendations
Ranked by how much coverage each buys for its cost. The first three are small changes.
1.  Stop the reporter failing tests when no node is there. Handle the report promise where it is stored (testReport.js:132), and print one line when reports go nowhere. This removes most false reds outside testicle.
2.  Add the three missing security tests: a grant of an fs path and of contact.faceable refused at auth.grant; ../, absolute and encoded traversal refused by every file gate; a forged signature on each relay route refused with a 4xx, not merely "no 5xx". Raise security refusals to 0.8.
3.  Give a red its cause without a second key. The title stays the only key and the grep target. Report crash, hang or false as a flag the reporter already has, and make the key name the item: a general test that judges several scripts reports each through test.forScript (testReport.js:170-175), so (script, suite, title) names the script; an own test that loops over items gets one written-out test per item. Keep suite stderr in a file instead of stdio: 'ignore', and show a suite that crashed at load in testicle.red.
4.  Select by dependency, not only by place. Build the require graph once (the classifier already loads every script) and flag the own tests of every module that requires the changed file. Treat a change to <name>.json as a change to <name>.js.
5.  Make "nothing ran" visible. Count suites that need running, and suites blocked by a failed classifier, beside the reds. Consider auto as the default, or a quiet-hours auto run, so the board means "green now" rather than "green when last pressed".
6.  Let a failed classifier block less. When the classifier itself cannot start (no node, no Chrome), mark the tool as down and still run the node-only own tests, instead of failing every script at 0.8.
7.  Have one command that runs everything and returns an exit code. Fix or remove npm test, have testModule.js filter by class without testicle's database, and run that in CI on push. testicle stays the live view; CI catches what interactive mode skips.
8.  Fix the test bugs found by running: wait for door.sock in job.js; drop the history checks against 2fb29140; fix the upward walk for a module named like its folder; fail a suite that crashes at load.
9.  Smaller: clear severity on a pass instead of keeping the maximum; reset or isolate the shared node between suites, or record suite order with each result; keep Chrome profiles as long as the job limit; grant peers only testicle.red, never the whole family.
How this was checked
Three reviewers worked in parallel on a read-only checkout of master d9ccc7fe: one read testicle, the reporter and test selection; one mapped coverage and read test bodies; one ran 43 suites (79 runs, about 40 minutes) with no node, and again in a fresh clone with a node started as DESK.md says and testicle switched on. Nothing in the repository was changed. The key lines above (interactive default, selection, discarded output, the reporter's rejection handler, npm test, the missing fs-grant test, the peerPost test count) were re-read before writing. Shares by kind of assertion are estimates from a heuristic plus 50 bodies read by hand.