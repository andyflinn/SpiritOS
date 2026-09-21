# 0020 — The node's machinery is not a client surface

**Decided 2026-09-21 by Andy. Measured against `973ce17`.**

> **Andy:** *"considering that the queue is opaque to the client (shell,
> processes, harness?) — if the harness can assert the proper functioning
> of the machine, I want shadow-roll and request-scheduling to remain
> invisible to the client… or else we propagate more complexity into shell
> and its harness etc."*

## The decision

**The shadow roll and the request scheduler are the node's own machinery.
No verb, no route, no app surface, no job payload.**

They keep working for every app without any app knowing they exist.

## Why, in his terms

**Every field exposed is a field three more places must carry.** The shell
has to render it, the harness has to assert it, and a later session has to
keep it compatible — so a queue depth on a screen is not one number, it is
a number plus a layout plus a test plus a promise. Machinery that nobody
can see costs one suite. Machinery that everybody can see costs one suite
per viewer, for ever.

**And the harness is not a client.** It requires the module and asserts it
directly, in process. That is why invisibility costs nothing in
confidence: `postQueue.js` is proven through ten of its own sections and
`seenPeers.js` through its own suite, none of which needed a route to
exist.

## The line, so it can be applied rather than argued

**A value may cross. A structure may not.**

| crosses | does not |
|---|---|
| a presence dot, and how old it is | the shadow row it came from |
| a contact's public name | the roll, its size, its bounds |
| a post succeeded, failed, or is still trying | queue depth, position, backoff timers, attempt counts |
| an owner's configured bound, on the owner's own screen | the machinery that obeys it |

The test is whether the node has already **decided** the thing. A decided
value is an answer; a row, a depth or a timer is the working-out, and the
working-out is what drags the shell in with it.

## What it settles now

**Patience is node configuration, not a per-post argument.** `postQueue`
accepts a patience per intent and `hub.js:1784` passes none — so today
every real message gets one attempt and the retry path is unreachable in a
running node. The obvious repair was an argument from the app. **This
decision refuses that one** and keeps the other:

> **Andy, earlier:** *"the node will allow the user to configure timeout —
> max time spent in request-scheduler before returning failure… could be
> days for a text message."*

That is **the owner setting a bound on their own node**, the same shape as
the cache cap (cycle R31), and it is not an app learning about a queue.
One setting the machine applies to everything, rather than a parameter
every caller must now think about.

**The owner is not a client.** R31 puts a cap on the Info screen and R30
puts an age in a tooltip; both are values the node has decided, shown to
the person who owns the node. Neither hands an app a row.

## Checked, not assumed

Both are already invisible at `973ce17`, so this holds a boundary rather
than asking for a cleanup:

- **`seenPeers`** — used only inside `hub.js` and `server.js`. Exported at
  `hub.js:2229` for the node's own wiring and its suite; no route, no verb,
  no app reads it.
- **`postQueue`** — no reference in any route, any verb, or any app. The
  only mention outside its own files is a comment in `contacts.js:628`
  saying the class *"stays in postQueue.js"*.

And `seenPeers.js:82` already argued this about itself — *"there is no
reader here but the node's own acquisition path, and that is a boundary
rather than an omission."* It is a rule now rather than one file's opinion.

## What it does not say

**Not that the machinery is unobservable.** A node's traffic log records
what crossed, and the owner's own screens may show what the node has
decided. What is refused is an interface onto the working-out.

**Not that it can never change.** A later need may earn a surface — but it
will have to earn it against the cost named here, rather than arriving
because a field happened to be available.
