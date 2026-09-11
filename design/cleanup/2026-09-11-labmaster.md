# labMaster — a control plane for a little network on one laptop

*2026-09-11. Verified against the tree at the commit this landed on.*

labMaster runs fake SpiritOS nodes on your machine so there is something to look
at. It is the visual half of the pair described in
[A scenario is a scenario](2026-09-11-scenarios-and-suites.md): the fast suites
build hundreds of worlds in milliseconds as objects, and this builds **one**
world as real processes on real ports, because some things can only be found by
looking.

It is deliberately not a framework. It is a table of nodes, a few buttons, and
the discipline to make each node genuinely clean.

```
node spirit/test/labMaster/labMaster.js      panel at http://127.0.0.1:65420
```

---

## What a node is

A row in a table and a directory under `%TEMP%/spiritos-relay-fakes/<id>/`.

Each node is a **complete copy of the tracked tree** — `git ls-files -- spirit
":!spirit/test"` — not a symlink and not a shared checkout. That is the whole
reason it can be trusted: a fake node runs the code in your working copy, and
two fake nodes cannot see each other's state by accident.

Two types:

| type | started as | what it is |
|---|---|---|
| `avatar` | `node js/server.js --port N` | a personal node — a shell, a hub, an address book |
| `relay` | `node js/server.js --port N --relay` | a mailbox others claim rows on |

One row is special. **`work` is your real checkout** at
`spirit/run` on port 65432 — not a copy. It is marked `permanent`, which means
labMaster will not delete it, will not recycle it, and will not wipe its home.
It may be started and stopped like anything else.

### Ports

`65400–65429`, except `65420` which is labMaster itself, and `65432` which is
the work node. Requests outside that range are refused rather than clamped.

---

## The panel

`http://127.0.0.1:65420` — a table with a row per node.

- **Create** — name, type, port. The name is slugged into an id.
- **Start / Stop** — spawn or kill. Neither touches the home, so a stopped and
  started node comes back on **the code it already had**.
- **Refresh** — stop, copy the tracked tree **over the top**, start. New code,
  same node: its key, its relay rows, its device slot and its session all
  survive.
- **Recycle** — stop, **erase the home**, rebuild from the tracked tree, start.
  New code and a **new identity**.
- **Recycle all** — the same for every non-permanent row.
- **Delete** — stop, erase the directory, drop the row.
- **Relays column** — which relays each node is actually holding open.

That last column exists because of a specific afternoon: the table showed id,
name, type, port and running, and none of those answers *is my little network
actually talking to anything?* Andy looked at the panel, saw no column for it,
and reasonably concluded nothing was connected — when in fact every node was. It
is read from each node's own `relay-presence` job over loopback, and a node
running older code simply reports nothing. **A convenience, never a source of
truth** about anything but itself.

> **Refresh and Recycle are not synonyms, and the difference is a whole lab
> world.**
>
> Recycle wipes deliberately: `relay-state/`, `device.json`, `session.json` and
> `minted.json` are none of them tracked, so without the wipe a "new" relay
> could boot owned by a previous run's key (below). The cost is that a recycled
> peer has no key and is therefore **on no relay any more**, and a recycled
> relay has no `allow.json` and so has no owner and an empty roster. The rows
> for the old keys stay on every *other* relay, held by nobody.
>
> That used to be the only way to get new code into a lab node — Start rebuilds
> only when `js/server.js` is missing, so stopping and starting ran the old
> code. Between "destroy it" and "leave it alone" there was nothing, and the
> thing wanted most of the time was neither. **Refresh is that middle**, and it
> is safe for the same reason `setupRelayFakes` gives for its own behaviour:
> only tracked paths are written, and a node's own state is not among them.
>
> After a Recycle, re-run `labPopulate` — the world is gone, and nothing on the
> panel says so.

### The HTTP surface

Everything the panel does, `curl` can do:

```
GET  /api/nodes                 the table
POST /api/nodes                 { name, type, port }  -> 201
GET  /api/links                 which relays each node holds open
POST /api/nodes/<id>            { name } — rename
POST /api/nodes/<id>/start
POST /api/nodes/<id>/stop
POST /api/nodes/<id>/refresh    new code, same identity
POST /api/nodes/<id>/recycle    new code, new identity
POST /api/nodes/<id>/delete
```

`127.0.0.1` only, no auth. It spawns processes and deletes directories on your
machine; it has no business listening anywhere else.

---

## Four things it learned the hard way

Each of these is a comment in the file. They are here because they are the
reasons the tool can be believed.

**A new node must be genuinely new.** `copyTrackedSpirit` writes the tracked
files over whatever is already there — and `relay-state/`, `device.json`,
`session.json` and `minted.json` are none of them tracked, so they survived. A
"new" lab relay could boot **owned by a previous run's key** and be unclaimable
by the suite that had just asked for it. The home is now wiped first. That cost
an afternoon of debugging a relay that remembered something it should not have.

**Delete means the disk too.** Dropping only the table row left the home behind,
so a node created again under the same name inherited the identity, the mailbox
and the device slot of the one that was deleted — the opposite of what "delete"
says.

**`running` was lying.** `pidsOnPort` matched two columns between the port and
`LISTENING`; Windows `netstat` prints one. So it matched nothing, and `running`
said *no* for every node labMaster had not spawned itself — reporting a healthy
network as dead. `running` is now *a child we spawned* **or** *a listener on the
port*.

**`git add` before you build.** A copy is made from the **index**, so an
untracked file under `spirit/` never reaches a fake node, and a node running
without a module you just wrote fails somewhere unrelated. `buildStamp.missingFromCopy`
warns by name. The mirror case bit too: the index lists files that have been
deleted from the working tree, and one of those made every node creation fail
with an ENOENT about a path nobody recognised — those are now skipped and
counted, not fatal.

Every copy is **stamped** with the commit it was taken from, plus a count of
untracked files, so a node can answer `GET /api/version` honestly — including
admitting it may be incomplete.

### The one destructive operation

`wipeHome` deletes a directory, and carries three guards, none of them theatre:
the id must slug to something with no separators and no `..`; the resolved path
must sit strictly **inside** the fakes root; and it must not be the work home.
A tool that deletes directories on a developer's machine earns all three.

---

## Building a whole world at once

Creating five nodes by hand and wiring them together through the shell is the
tedium `labPopulate` exists to end:

```
node spirit/test/labPopulate.js                   build the default scenario
node spirit/test/labPopulate.js presence-colours  build a named one
node spirit/test/labPopulate.js --list            what is available
node spirit/test/labPopulate.js --down            take it all away again
```

It reads a scenario from `spirit/test/visual/*.visual.json` — **the same
vocabulary the fast suites use**, normalised through
[`scenario.js`](../../spirit/test/scenario.js) — and builds a lab relay that
*your* node owns, peers with rows on it, contacts in your address book, and a
message or two so chat is not an empty screen. Roughly two thirds of the peers
also get rows on the live relay, because that is the slow part to redo by hand.

### Two rules it must never break

**Your identity is read, never written.** The key in
`spirit/run/relay-state/identity.json` owns spirit.andyflinn.com. Generating a
new one here would silently cost you that relay, and you would not find out
until the next census. Nothing in `labPopulate` calls `saveIdentity` on the work
node, ever.

**The `lab-` prefix is a safety feature, not a style.** Those identities get
rows on the live relay, and `--down` removes them by **matching the name** —
not from a local list, which a sandbox wipe would take with it, leaving the
fixtures stranded forever on a box you cannot edit from here.

Everything else is reversible: `relays.json` is backed up to
`relays.json.before-lab` before the lab row goes in front, and `--down` restores
it byte for byte, deletes every `lw-*` node, clears the `lab-*` contacts, and
removes the `lab-*` rows from the live relay.

### Beware: labPopulate runs on `require`

It is a script, not a module — `require`ing it to check it parses **builds a
lab world**. Use `node --check` instead.

---

## Capacity, and what it refuses

The lab has three peer ports (`65426–65428`). A scenario asking for more is
**refused with the reason**, before anything is spawned. It used to clamp
silently, so a five-peer scenario built three and reported success — and the
world on the screen was not the scenario anybody had asked for. A lab world is
forty seconds and four processes; the failure that names itself beats the
success that lies.

Raising the cap means adding ports to `PEER_PORTS` in
[`labWorld.js`](../../spirit/test/labWorld.js), inside the 65400–65429 range and
clear of the rows already in your table.

---

## Also here

`spirit/test/labMaster/*.test.js` — eight older relay tests (`relayPing`,
`relayAbuse`, `relayPersist`, `servableStatic` and friends) that run against a
lab relay rather than in process. They are not part of `npm test`, which
discovers suites in `spirit/test/` only. Left where they are.

`BONES.md` in the same directory is a recipe from 2026-09-06 and is **stale** —
it names ports 65410–65414, an `install-public-relay.js` step, and a "until
peers are keyed by public key" caveat that has since landed. This document
supersedes it for how labMaster works; BONES.md is kept only for the identity-vs-perception
thinking it records.
