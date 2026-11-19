Your tree is mostly on the right side of the line. Counted on 526f1dc:

264 own tests. 50 load their script directly in node; the rest drive it through a page or a node, which this count can’t see.
20 of those 50 read an upper-case constant out of their script.
18 of the 20 write the value out first, then use the constant. For example limits.js:28 ([16384, 22528, 246, 512, 185]), postQueue.js:30 and relayRequest.js:138 (=== 30000). If the script changes, that one written-out test goes red, so the later uses don’t need to be independent.
1 harmless: seenPeers.js passes the rank names (P.HOST, P.ARRIVED) in as inputs, never as answers.
1 real case: spirit/test/router.js compares against R.DEFAULT_TTL_MS five times (:29, :74, :104, :110) and never writes it out. The script sets it to 5000 (router.js:118). Set it to 0 and those tests follow along.

So the boundary you want for TEST_SYSTEM.md already exists as a habit: a value a test reads from its script is first written out in that test. That makes it checkable by machine (every X.NAME used must also appear as X.NAME === <literal>), and today only router.js would fail. This only counts upper-case constants. Reused helpers and tables, and page-side tests, weren’t measured.