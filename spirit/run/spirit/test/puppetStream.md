# spirit/puppetStream.js — its own test

A puppet streams what its servers publish to its master (goal/G14.5): every changed app object of a job-updated, posted
to the owner as a packet named `published`, only while the master is reachable, one post in flight at a time. Owed since
the rule *"every production script has its own test"* (goal/G47.1, box v72). In process: puppet, route, encode and post
are planted, and a post can be held open.

- Posted: `{ module, app }` to the owner at the route's relay, as `published`; every app server's objects, no verb or
  subscription (*"just send all app Server events"*).
- Not posted: the same object again, a job with no app object, anything that is not `spirit.app.<name>`, anything from a
  node that is no puppet.
- Only while reachable (*"only while the master is live and reachable"*): unreachable posts nothing, logs nothing and
  queues nothing, and the next change tries again; a route lost while objects wait drops them. A refusing relay or a
  throwing post is one log line, and that object is not posted again; an object that cannot be packed is one log line
  and the next module still goes.
- Serialized at the source: one post in flight; a burst keeps only a module's newest object; modules keep the order they
  first came in.
- The module answers `createPuppetStream`, its stream `onJob` alone.

## What its test must try to break

The same object posted twice; a second post started while one is out; a burst posted object by object; waiting objects
kept through an unreachable route and posted later; a non-app module or a non-puppet node posting.
