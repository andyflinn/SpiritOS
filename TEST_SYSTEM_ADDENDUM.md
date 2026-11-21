Read all three READMEs and test states on master d7e64d67. Having three machines side by side pays off right away:

Same commit, different reds. ubuntu and windows both report at f1fd9378a, but almost none of their reds overlap: ubuntu has 79 in testicle/element.js, windows 13 in job.js (“activated again, it starts again”), wsl 127 in spirit-sibling-general.js (“refused at the door with a 4xx”). A red on only one platform is either a platform bug or a flake, and these pages are the first place that shows it.
The red counts aren’t comparable yet. The machines hold 22,337, 20,271 and 26,839 tests, so they have run different amounts of the tree. Windows’ “35 red” may partly be tests it never ran. One extra line, “suites run here / suites in the tree”, would make the three summaries comparable.
Ranking by count. ubuntu’s “leading module” is one suite with 79 reds, most likely a single cause (the face isn’t mounting). Ranking by suites red, or by your severity, would keep one broken mount from leading the board.
Windows loopback is 15.2 ms vs 0.8 ms on ubuntu. That’s my inference, not measured: it looks like localhost trying ::1 before 127.0.0.1, a common Windows delay. Worth a check.
Small text slips: “1 reds”, “live streams for 2,398 simultaneously” is missing its noun, and a nodeInfo test title says “relays with with”.


==========================================================

a nodeInfo test title says “relays with with”.
7m ago

noted and temprarily stashed for agent-digestion. ha! and the summaries have become rather telling. i like that. An interesting problm: My spidy-senses now are raised when a testicle detail flips back and forth frequently, like two test contradict each other and their fixes flipe the tests back and forth. Now we measure suite duration and try to run faster suites first, so that we can work off the red more rapidly.

now

Your table can already tell those two cases apart. On master each flip makes a new row that carries both hashes it ran against, judged (the script’s) and suiteHash (the suite’s) (testicle/server/server.js:113-117). So a test’s history answers two questions:

Flips with no hash change (same script and suite hash on both sides) are a flake: nothing changed and the verdict did.
Flips where a hash changed each time are a fix moving the test, which is your contradiction suspicion. A pair is likely contradicting when A goes green and B goes red at the same new hash, then the reverse on the next change, two or three times running.

The first is a count over history per test. The second is a join of two tests’ flip rows on the hash they changed at. Neither needs a new field; both could become a “flapping” line in the platform summaries.

On fast-first, one thing to watch: a slow suite that’s red and severe can sit behind every fast one indefinitely. Ordering by severity first, then duration within the same severity, keeps the speed-up without that risk.

