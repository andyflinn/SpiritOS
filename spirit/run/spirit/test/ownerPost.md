# spirit/ownerPost.js — its own test

`peerOwnerPost()`, the owner door's sending end (puppets/G4; Andy: *"peerOwnerPost()" — "it's more true."*): one command
to one of the owner's puppets, signed by the node (*"the node handles all the signing. the shell doesn't worry about
that."*), and the puppet's answer handed back. Owed since the rule *"every production script has its own test"*
(goal/G47.1, box v72). Its identity, signing, packing, route, post, timers and clock are planted; a timer is kept, and
fired by the test.

- `send`: signs `{verb, body}` with the owner's identity key over `commandMessage(owner, puppet, id, cmd)`; packs a
  system packet, addressed to no app, carrying `cmd` and `sig`; posts it through the route to that puppet; hands back
  the puppet's answer as it came (a refusal too), with the command's hash, the wait cleared.
- The answer is taken only if it names a command still waiting, comes from that command's puppet (not a sibling), is
  the first (a reply answers once), and arrives in time: `DEFAULT_WAIT_MS` 20 s, or the wait given; after it a named
  504 `no-reply-from-puppet`, and a late reply is dropped, never handed to the next command.
- An answer that beats its own question's bookkeeping is held and taken; an early one from a sibling, or one held past
  its time, is not.
- `onArrival`: an app's packet, one naming no command, or nothing, passes by untouched.
- Refused on the way there: no puppet or no verb is 400; a command that cannot be packed is `command-not-packed` with
  the factory's own words; no route or an unreachable one is 503 `peer not reachable`; a post refused keeps its own
  answer, and no wait is set.

## What its test must try to break

A sibling's answer taken for the puppet's; a second answer handed to the next command; a late reply kept; an answer
lost because it came before the wait was registered; an app packet read by the node.
