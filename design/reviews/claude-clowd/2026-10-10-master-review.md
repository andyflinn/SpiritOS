SpiritOS master review, Sep 18 to Oct 10
Oct 10, 2026 · @Andreas Thut
Read-only review of andyflinn/SpiritOS master at e8f8ffd7. It covers ac32d117 and e537880b (Sept 18) and the 441 non-auto October commits. Line numbers are at e8f8ffd7.
Top findings
Three findings are high: Levant's fetch tool can drive the node's own door, and the census commit's seat is erased on first connect and never given up. A local API key is also committed. Everything below was checked against the code and its callers; the seat erasure and the verifier reply shape were also confirmed by running code.
Severity
Area
Where
Commit
Finding
High
Levant
process/js/deskAgent/tools.js:140, js/server.js:585-649
4f79adff
The model's net_fetch can POST to 127.0.0.1:<port>/api/spirit and run any node verb (fs.delete, jobs.create, device.info), then send the answer anywhere.
High
Census
js/relayKeys.js:196-202
ac32d117
accept() rewrites the whole row, so the first stream to a new relay erases the seat the claim just wrote. Every new node reads "You (unknown)".
High
Census
js/relayKeys.js:138-146, js/ownerBadge.js:323
ac32d117
A seat is never given up: unseat has no caller and any pin counts as a seat, so an evicted node stays claimed forever and can't re-claim.
Medium
Hygiene
process/js/deskAgent/connection.json:4
a2786053
An sk-unsloth- API key is committed to a public repo. The file is never read by the code.
Medium-high
Desk
process/js/deskVerify/deskVerify.js:647-649
4c7fcb76
The now verb declares queued: [''] but returns objects, so its reply is refused and the Verifier tab vanishes whenever work is queued.
Medium
Desk
deskVerify.js:496-517
4c7fcb76
A full run passes the goal even when reds are inside the goal or the run was stopped, so Done appears anyway.
Medium
Desk
process/js/desk/desk.js:576, 740, 770
4c7fcb76
A reopened goal keeps emptied and checked, so Done returns without a new full run.
Medium
Desk
deskVerify.js:406-425
4c7fcb76
A deskVerify restart during a full run blocks the goal's Done for good; verify.again refuses goals.
Medium
Desk
deskVerify.js:148, 158, 201
b5ea0779, fec1be3e
Stop and the time limit kill only the suite, not the servers it started, so the next suite collides on lab ports.
Medium
Desk
desk.js:483, 653
e4818ee9
Check numbers are count + 1 and item.files.add deletes checks, so numbers repeat and a grant can land on the wrong check.
Medium
Desk
process/js/deskClient/deskClient.js:234-246
9b7a02c8
A synchronous git pull --rebase (60 s) inside next blocks deskClient, and rebase --abort can abort the agent's own rebase.
Medium
Desk
publishData.js:180-181
3ce4152f
publishData runs a plain git commit, so the agent's other staged work is committed and pushed as "publish:".
Medium
Levant
js/server.js:633-637
4f79adff
net.fetch buffers the whole response; a large URL picked by the model can exhaust memory or crash the node.
Medium
Levant
deskAgent.js:289
4f79adff
The chat-completion call has no timeout; a hung studio leaves working true and Levant silent until restart.
Medium
Levant
deskAgent.js:371
3f00fda5, 65a6d4f3
Two of three model-refresh calls have no timeout; a hang keeps the list "cached" and Load is never offered again.
Medium
Levant
deskAgent.js:235, 297-309
4f79adff, 0d4f6bb9
Tool results aren't counted against the prompt room, so a full chat plus a fetch overflows the context.
Medium
Levant
js/client/shell.js:1983, 2206
eca62251
Any contact can push published objects into the master's apps; a change:1e12 freezes the desk view, and a fake chat line can name another peer.
Medium
Levant
shell/deskAgentRemote/deskAgentRemote.js:293-303
eca62251
A fast load refusal can arrive before the answer, leaving the hourglass stuck and Load blocked.
Medium
Census
js/hub.js:1091
ac32d117
A re-claim answered 409 (own key) records no seat, so a node that lost relayKeys.json can never recover.
Medium
Census
ownerBadge.js:349, 354
ac32d117
The seat label is frozen at claim time, so a rename from Info shows "out of step" forever.
Medium
Face
spirit/test/appApi.js:108
013dc827
The suite still calls client.startAll(), which was removed; it is red now.
Medium
Face
bash/FACE.md:79
013dc827
The face setup doc places face-domain.json where appFaceApp no longer reads it and misses the process grants; followed as written, every visitor gets 404.
Medium
Face
process/js/appFaceApp/appFaceApp.js:98-104
013dc827
The face process loads identity.json, private key included, against the rule that a server never opens it.
Medium
Hygiene
process/js/fileServer/fileServer.js:106-110
22e02026
chunk calls Buffer.alloc(length) on a grantee's length with no cap.
Medium
Hygiene
process/js/pushOrigin/pushOrigin.js:48-54
G5.1
A failed git stash pop is ignored, so edits stay stashed while the push reports ok.
Medium
Hygiene
repo root temp_loop*.js (7 files)
3d0ab23d
Scratch copies of a deleted prototype; five fail node --check and nothing references them.
Census and contacts.js commits
The seat that replaced the census is erased on first connect and never removed, and e537880b's "nothing named whoBook is left" was not true then and is not now. Since f2a3b233 "census" is "roll" and censusNarrow.js is spirit/test/rollNarrow.js. Paths are under spirit/run/ unless noted.
Bugs (detail for the table rows)
• Seat erased (high). hub.js:1108 writes the seat, then presence.start reaches answerRelay.js:275, which finds no pin (first-contact claims never pin) and calls relayKeys.accept, which replaces the row with {publicKey, firstSeen, acceptedAt}. A scratch script confirmed seatLabel returns '' afterwards. test/presenceProof.js:69 runs exactly this sequence but never checks the label.
• Seat never given up (high). Natter's unbind branch (natter.js:760-815) can't fire, natterDetails.js:582-583 hides the claim form, and presence keeps dialing a relay that refuses it.
• 409 re-claim (medium). Fix direction: seat when the 409 is the node's own key, using the relay's peer.publicLabel rather than body.name. The comment "a boot can still backfill" at hub.js:1109 is false.
• Frozen label (medium). info.js:285 renames but nothing re-seats; natter.js:330-341 still claims renames are adopted on every probe.
• Low: shell/natterDetails/natterDetails.js:440 reads c.peers, which probe no longer sets, so it always shows "Peers (unknown)". The member count did have a reader.
• Nit: seat() and unseat() return undefined on success where accept() returns true (relayKeys.js:121,164). js/apiAuth.js:18 and three tests bind the module as contacts, against the contactBook rule.
• Checked and fine: URL normalisation matches across seat, pin, probe and claim; seat is written synchronously before presence.start.
Leftover references
• whoBook / who.json (low): DICTIONARY.md:55,77 still defines whoBook as relay-state/who.json; AGENT.md:46,60,83; CLAUDE.md:21,129 and CLINE.md:21,129 ("whoBook never uploads"); js/relay.js:1783 was written after the rename. Nits in .gitignore:127, UI_DESIGN_STYLE.md:402, spirit/test/labMaster/BONES.md:16,48, test/peerPostWiring.js:54.
• Security comments that lean on the deleted route (low-medium). These say a key is safe to expose because it is "already public at /api/relay/who": js/deviceAuth.js:39-41, device.html:170-171, natterDetails.js:1452, hub.js:2036-2037, relay.js:2620, 4444, 5051. Each needs re-arguing now the route is gone.
• Comments describing removed behaviour (low): server.js:2043-2045 (probe fetches /api/relay/who), server.js:2136-2139 (peer.acquire asks the relay), hub.js:612-616 and 831-834 (the roll captions strangers, contradicting "strangers arrive UNNAMED"), hub.js:1801-1817, hub.js:2103-2147 (orphaned handleRoster block), ownerBadge.js:200-218, 255-275, natter.js:713-718, 746-749, info.js:76-82, 177, relay.js:1080, 3293, 3688, DICTIONARY.md:87.
Dead code
• relay.who(keys) at relay.js:914: the backend of the deleted route, now called only by two tests.
• hub.handleMatches at hub.js:561-595: no callers at all.
• hub.handleWho and its helper withRelay: no route since e5b059d4, still exported.
• relayKeys.unseat: no caller.
Does rollNarrow.js guard what it claims?
Only partly. It passes 8/8 at master, but:
• The comment stripper at rollNarrow.js:64 also cuts everything after https://, so fetch('https://'+host+'/api/relay/who') goes undetected, as does '/api/relay/'+'who'.
• It skips process/ because those scripts "never speak to a relay", yet process/js/desk/onboard.js:85 and offboard.js:71 do.
• It doesn't check relay.who or the removed verbs, and its seat checks are substring matches that stay green while the seat is erased.
Desk
The goal-level verification added in 4c7fcb76 (G8.12) has four ways to give or withhold Done wrongly, and two git helpers touch the agent's own checkout. Paths are under spirit/run/process/js/ unless noted.
Detail for the table rows
• Verifier tab vanishes. Running appServer.matches on the declared and real reply shapes returns false, so the reply is refused as handler-failed. shell/desk/desk.js:1065 then sets deskVerifier = null. Even if it passed, queued.map(deskEsc) would draw "[object Object]".
• Done despite reds. fullRun grants only reds outside the goal's file lists, then calls verify.pass unconditionally. The comment says a red on the item's own files "is never tolerated". A run stopped by hand (line 481) also passes.
• Reopened goal. desk.js:740 clears done, closed and claims only. Fix: clear emptied and the goal's checked on reopen or on a new item.
• Restart mid-run. The watcher treats records seen on its first walk as history (deskVerify.js:414-425), and goal.emptied is written once.
• Orphaned servers. runAll already spawns detached and kills the process group (spirit/test/runAll.js:174-197); deskVerify should do the same.
• Repeated check numbers. check.set takes the first match (desk.js:491), so a grant press or commitCheck can hit the wrong check.
• deskClient pull. spawnSync blocks past the 10 s hold and the node's 12 s door, so deskAgentEar exits "did not answer". The pull can also fire twice after a restart.
• publishData. Fix: git commit -- <rel> or --only. With commitCheck hooks the commit is refused and agents/<agent>/ stays staged.
Low
• goalShare noise. 277 auto-commits this month. desk.js:1288 writes a writtenAt timestamp, so the "same" short-cut at goalShare.js:64 never fires. Concurrent jobs race on fetch and push. The mechanism is safe for the checkout: it uses a temporary index and pushes by hash.
• commitCheck confirm (desk/commitCheck.js:265-271) misses a commit when another push lands within 250 ms, because merge-base can't see an unfetched tip. Stale pending entries are matched by subject only.
• Stop flag. stopped is reset only in claimCheck (deskVerify.js:291), so the next full run stops after one suite. The Stop button is off during full runs, because running.id is ''.
• deskDetails box (shell/deskDetails/deskDetails.js:417-424, 542-556): the blur uses the current item id, so a take or write can hit the newly opened item.
• Levant's tools declare required: [] (deskAgent/tools.js:116), but desk verbs refuse any missing key.
• Item file paths aren't normalised, so spirit/test/../../x.js passes the regex and deskVerify runs it (deskVerify.js:225, 244).
• localEar leftovers: desk/reply.js is a UTF-16 scratch file that throws on load, spirit/run/localEar.json points at the deleted localEar.js, and spirit/run/create-localEar.js regenerates it.
Dead code
The deskVerify verbs loop.once, suites, goal.check, claim.check, chore.once, idle, mode and records.search are called only by tests. chore.once returns {did: []} on both branches, and the G8.6 short loop is never started.
Levant and the Unsloth remote (G14)
Giving the model net.fetch (4f79adff) also gave it the node's own loopback door, and the studio calls lack timeouts in three places. Paths are under spirit/run/ unless noted.
The fetch tool reaches the node (high)
net.fetch's gate (js/proxyList.js:227-244) is a deny list: it refuses only hosts the owner closed, so 127.0.0.1, private ranges and 169.254.169.254 are open. A request the node makes to itself passes all three door checks: it comes from loopback, Node sets a valid Host (js/server.js:686), and it carries no Origin or Sec-Fetch-Site (server.js:723-729). So a prompt injected through a fetched page or a desk line can have the model POST {verb:"device.info"} to /api/spirit, which returns the door password (server.js:801-808), then fetch an attacker URL with it. e5671029 adds the desk write verbs on top.
Fix direction: refuse loopback, link-local and private destinations after DNS resolution on the agent path, allow only GET there, and never let the model supply ${ENV:…} placeholders.
Detail for the other table rows
• Unbounded buffering. Past about 512 MB, toString throws ERR_STRING_TOO_LONG inside the 'end' listener, which is uncaught and stops the node. Cap bytes on the agent path.
• Chat call timeout. The Remote gives up after 120 s on its side, but deskAgent's working stays true, so every later desk line waits forever.
• Model refresh. /api/models/cached-gguf and /api/inference/status have no timeout; only /v1/models is capped. The first ask with no models.json still runs past 12 s, the case 65a6d4f3 meant to fix.
• Context overflow. Each tool result may take a quarter of the room on top of a chat that already fills it, for up to three rounds.
• Published objects. chatter (shell/chatter/chatter.js:347), desk (shell/desk/desk.js:516), deskDetails and ruleDetails ignore the sender. Fix: check the sender is a known puppet in deliverStreamed.
• Stuck hourglass. When the answer arrives, run deskAgentRemoteLoadOver before setting the load flag. This is the case Andy asked for: "your UI must release the hour-glass status".
Low
• Switching target keeps the old transcript, pending answer and busy flag (deskAgentRemote.js:451-460).
• A published state object re-enables the switch mid-flip, so a second click sends a second connect (deskAgentRemote.js:262).
• Concurrent model calls overwrite lastChat.tool (deskAgent.js:526).
• A fetched JSON page with its own error field is reported as "the node refused" (tools.js:146).
• model.load with no id writes "undefined" into configuration.json (deskAgent.js:695).
Nits and dead code
Stale comments at deskAgentRemote.js:30-32 (removed polls) and :340 ("hosting node only"). deskAgentRemoteChatAskFor is a pointless alias, deskAgentRemoteContainer is never read, and deskAgentRemoteLoadTimer is now a boolean. describeAll re-runs all introspection on every ask, streamedLast in js/client/shell.js:1982 grows without bound, and max_tokens: 0 is sent when answerTokens is unset.
Checked and sound: dd5503ef's shim headers, puppetStream's one-at-a-time sending, net.fetch not following redirects, and fileServer hash ids staying inside the store.
Face process move and error codes (G13.2)
The move of the face machinery out of the node left one red suite, a setup doc that no longer works, and a process that reads the private key. A script resolved every relative require() in the tree: no live require of a deleted module remains.
Detail for the table rows
• appApi.js. 013dc827 removed appClient.startAll, and spirit/test/appApi.js:108 was not rewritten with the other suites.
• FACE.md. appFaceApp now reads only relay-state/process/appFaceApp/face-domain.json, and the node's fs.save refuses to write under relay-state. The doc also never says to list process/js/appFaceApp and appFaceAppServer on the owner's node or to grant appFaceApp to the face node's key; appFaceApp declares dependencies: [], so nothing prompts it. bash/FACE.md:9,23, bash/face-tls:3,35 and bash/systemd/spirit-face.service:13-15 still name puppetPost.
• Private key. ownerKey() calls auth.loadIdentity(ROOT), which loads relay-state/identity.json with its private key, against the rule at spirit/run/js/jobs.js:458-463 and desk/G2.4. On a nameless node it returns null, so a self-owned node posts to itself.
  Since goal/G22.5 (2026-10-13) a node's identity exists from its first boot, before it listens; this no longer holds.
Low
• spiritErrors.define throws on duplicates, but both callers wrap it in if (!byCode(...)), so a future clash is silently adopted (spirit/run/js/spiritErrors.js:89-95).
• The auto-assigned id is never read and depends on declaration order (spiritErrors.js:82, 95).
• String(name) turns undefined into the code 'undefined' (spiritErrors.js:91, ec71aa17). No caller does this yet.
• appFaceAppServer.js:25-27, 42 declares "no such route" but sends a different sentence.
• The owner-side refusal at appFaceApp.js:143 has no error field.
• faceRoute.js's answerRoute, routeIsSigned and routeSignatureHolds are now used only by a test, and the r.mine branches in appFaceApp are dead.
• jobs.js:319-328 keeps the options.module path that only startAll used; appServer.js keeps an unused fallback passthrough; server.js still passes rootDir, which appClient ignores.
• spirit/test/puppetsPending.js:195-203 credits a pass to puppetOwner.js, which was deleted.
The merges and the "oops" / "fuck" / "change" commits
Neither merge (7964922a, 65d72451) has conflict leftovers or lost hunks. For about six minutes after 7964922a, bc28b883 and 8fa0df86 had replaced code names with numbers, so every error-code lookup failed; 84164a6b and ec71aa17 fixed it, and master is correct. a2786053, 3c01e496 and 1ed9965e touch only deskAgent config and .claude/settings.json; a2786053 is the one that committed the key.
Repo hygiene and dead code
The one credential committed this month is the Unsloth key; the rest is scratch files and orphans.
• Committed key (medium). spirit/run/process/js/deskAgent/connection.json:4 holds an sk-unsloth- key for 127.0.0.1:8888, added in a2786053 to a public repo. The process reads connection.json and configuration.json from its state folder, so the tracked copies are dead. Rotate the key, untrack both, and add them to .gitignore, which covers loop.json but not these.
• Scratch files at the root (medium). temp_loop.js to temp_loop6.js and temp_loop_clean.js (3d0ab23d) are copies of a deleted loop.js; temp_loop_clean.js differs from temp_loop.js by one blank line, and five fail node --check. temp-desk-reply.js (570923eb) is UTF-16, which git treats as binary.
• pushOrigin (medium). spirit/run/process/js/pushOrigin/pushOrigin.js:48-54 ignores the exit status of git stash pop, pops the top stash rather than its own, and on a detached HEAD pushes HEAD:HEAD. The header says no retries, but MAX_PUSH_TRIES = 3 loops.
• fileServer chunk (medium). Cap length at CHUNK (6000), which the client already uses.
• .gitignore:239-241 (b5269532) holds three pasted console.log(...) lines as ignore rules.
• .claude/settings.json:4 (a2786053) commits a path for one machine, //d/lab/claude-windows/....
• CLINE.md (831d81ef) is a byte-for-byte copy of CLAUDE.md, heading included.
• spirit/test/appServerWorlds.js lost its only consumer in 013dc827, and notASuite.js:69 still lists the deleted suite, so runAll never flags it. notASuite.js:17 lists labMaster.js, which lives in a subfolder runAll never scans.
• 18 exported names have no caller, in hub, invites, nodeCard, nodeStore, postQueue, presenceNode, relayAuth, relayStore and trafficLog. All date from September; every new October module has callers.
• Checked and clean: vendored chokidar 5.0.0 and readdirp 5.1.1 are allowed by .gitignore:30-33 on purpose. runAll's 286-line cut moved the helper list to notASuite.js and dropped no suite. The agents/* data has no secrets, only local paths such as /home/andy/....
Harness at master
node spirit/test/runAll.js at e8f8ffd7 on a clean Linux box (Node 22.22) gave 362 suites, 5035 green, 33 red, 22 unhappy, 6 awaiting and 1 stood down, exit 1. About half the red suites point at the tree; the rest fail to boot a node or onboard and were not diagnosed, so they may be this box.
Red because of the tree (the failure text names code at master):
Suite
What it says
appApi.js
client.startAll is not a function (013dc827, see the face section)
appClientName.js
appServers still named in server.js, appFaceApp.js, appFaceProcess.js, contactLabel.js
keyTail.js
a key is cut outside kernel.js at shell/deskAgentRemote/deskAgentRemote.js:135
runStandsAlone.js
deskVerify.js and deskVerify.json hard-code the path spirit/test
appDependencies.js
deskAgent won't start without a hand-written configuration.json in its state folder
harnessAppSuites.js
runAll --list doesn't find app or process suites (owed by G4.23)
nodeKnowsNoApps.js
its control failed, so the assertion proves nothing
trafficLog.js
an unparseable payload is mangled
jobsRemoveWhenDone.js
jobs.create answered 0 (owed by G4.34)
backupServer.js
its own folder started a run (desk/G1.7)
deskServer.js
the api listing no longer matches what the suite expects (desk/G1.3)
notASuite.js
never reported, exit 0
Not diagnosed, may be this box: agentOnboard, deskLoop, deskRedWriterBuild and publishData fail at onboard ("did not answer relay.search: fetch failed"). debugSwitch and sharedLimit report "the node did not boot"; debugSwitch did the same when re-run alone. fileSlots, labLifecycle and labServableStatic time out waiting for a fixture. fsWatcherCommands still had 1 red when re-run alone.
The full harness output is saved with this session's scratch files and can be attached on request.