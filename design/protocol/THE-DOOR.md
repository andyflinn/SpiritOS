# The door — what a program may ask this node to do

**A SpiritOS node is a local HTTP port.** Anything that can make a POST
can send signed, sealed messages to another person's machine: a Python
script, a Bash one-liner, a C# desktop app, a spreadsheet macro. There is
no SDK, no language commitment and no library to adopt.

> **Andy:** *"so the developer, no matter what language, gets a local port
> via which he can do secure p2p posting"* — and *"their apps will be
> users of 65432 like the shell is."*

That is the product. The shell that ships with it is a client of this
door like anything else you write, and this page is the contract.

**Measured at `daf60a6`, not described from memory.** Every figure below
was read out of the running tree.

---

## One door, one shape

```
POST http://127.0.0.1:65432/api/spirit
Content-Type: application/json

{ "verb": "<name>", ...arguments }
```

**The verb is in the body, never in the path.** One route, so a new verb
needs no new door and an app learns one shape for ever. A verb this node
does not know answers `400` with `{"error":"no such verb: <name>"}`.

**It is loopback only.** The port is not reachable from the network; the
relay is what crosses the internet, and it never sees anything but
ciphertext (see *What the relay cannot do*, below).

---

## Two worked examples, neither of them JavaScript

The any-language claim above is the whole pitch, so it is not left as
prose. Both of these were **run against a live node on 2026-09-24** and
both posted a sealed message that arrived:

- **[`examples/hello.sh`](examples/hello.sh)** — POSIX shell and `curl`.
  No dependencies at all.
- **[`examples/hello.py`](examples/hello.py)** — Python 3, standard
  library only. No `pip`, no package.

```
sh hello.sh                      ask this node about itself
sh hello.sh <public-key> "hi"    and send somebody a sealed message
```

Neither is a client library and neither should become one. Forty lines is
the point: the day one of these needs a package, the claim this page
makes has quietly been given up.

**The keys never come near either script.** The node holds the signing
key and the cipher key; a caller says what it wants to say and to whom.
The word "sealed" in these examples costs the developer nothing, which is
the only way a default survives contact with people in a hurry.

---

## What can be asked

**45 verbs, in 10 families.** This list is generated from `server.js` and is exhaustive at the commit above.

**Each verb carries its authority.** Andy, 2026-09-27: *"that's a boundary
crossed that requires peer review AND my approval"* — and, on his own yes:
*"my Yes's may be dumb, too, and revoked later on."* So every line ends with
one of three: his dated words approving the verb; `before the rule
(2026-09-27)`, which only verbs in the table on that date may carry and which
means nobody has looked yet, not that he said yes; or `revoked, <date>:` with
his words, which keeps the harness red until the verb is gone.
`test/doorContract.js` enforces it.

**`contact.*`** — who this node knows, and what it calls them
- `contact.accept` — before the rule (2026-09-27)
- `contact.block` — before the rule (2026-09-27)
- `contact.forget` — before the rule (2026-09-27)
- `contact.get` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `contact.label` — before the rule (2026-09-27)
- `contact.search` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `contact.senders` — before the rule (2026-09-27)
- `contact.setSenders` — before the rule (2026-09-27)
- `contact.unblock` — before the rule (2026-09-27)

**`device.*`** — a second machine of your own
- `device.info` — before the rule (2026-09-27)
- `device.rotate` — before the rule (2026-09-27)

**`fs.*`** — files, inside this node's own tree
- `fs.annotate` — before the rule (2026-09-27)
- `fs.annotations` — before the rule (2026-09-27)
- `fs.delete` — before the rule (2026-09-27)
- `fs.save` — before the rule (2026-09-27)
- `fs.search` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `fs.stat` — before the rule (2026-09-27)

**`jobs.*`** — background work
- `jobs.cancel` — before the rule (2026-09-27)
- `jobs.create` — before the rule (2026-09-27)
- `jobs.delete` — before the rule (2026-09-27)
- `jobs.get` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `jobs.search` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `jobs.update` — before the rule (2026-09-27)

**`net.*`** — one fetch, through the proxy gate
- `net.fetch` — before the rule (2026-09-27)

**`owner.*`** — commanding one of this node's puppets
- `owner.boxGet` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `owner.boxSearch` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `owner.command` — Andy, 2026-09-27: "go." (keep the three verbs added without approval, Desk under puppets/G10)

**`node.*`** — this node's own identity as strangers see it
- `node.card` — before the rule (2026-09-27)
- `node.rotateCipher` — Andy, 2026-09-27: "go." (keep the three verbs added without approval, Desk under puppets/G10)
- `node.setDescription` — before the rule (2026-09-27)
- `node.setName` — before the rule (2026-09-27)

**`peer.*`** — talking to other people
- `peer.acquire` — before the rule (2026-09-27)
- `peer.post` — Andy, 2026-09-27: "go." on its optional `patienceMs` ("capped at 10 minutes, memory only, so a busy agent gets retried"), Desk under puppets/G2
- `peer.search` — before the rule (2026-09-27)

**`proxy.*`** — reaching the outside world, by the owner's leave
- `proxy.allow` — before the rule (2026-09-27)
- `proxy.close` — before the rule (2026-09-27)
- `proxy.get` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `proxy.open` — before the rule (2026-09-27)
- `proxy.remove` — before the rule (2026-09-27)
- `proxy.search` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)

**`relay.*`** — this node's relationship with a relay
- `relay.claim` — before the rule (2026-09-27)
- `relay.get` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)
- `relay.partnerCheck` — before the rule (2026-09-27)
- `relay.record` — before the rule (2026-09-27)
- `relay.search` — Andy, 2026-09-27: "the verb changes changing list fetches to a search(labe) and geKey(key) pair are approved." (Desk, puppets/G2)

**Inside the node, not on this door.** A booted app (`nodeApps.js`) is
handed an api of its own, and it is the node's interface too, so the same
rule covers it. One call was added there, and none here:
- `api.toLocalApp(name, { method, path, body, type })` — the node's one
  hop to an app server on its own box (`appServers.js`). Andy, 2026-09-27:
  "i explicitly permit the two new/proposed interfaces/api' for
  communication from node to appserver", and "Go. and two verbs approved."
  (Desk, public-app-server/G17)

---

## The limits a caller meets

| | | |
|---|---|---|
| a packet you compose | **16,384 bytes** | `JSON.stringify` of the whole packet |
| the same packet on the wire | **22,528 bytes** | after sealing — base64 grows it by about a third |
| the HTTP body | **23,552 bytes** | the packet, plus room for hints |
| route hints beside a post | **4** | dropped at the first relay |
| a stream event | **135,680 bytes** | |

**Two numbers, because sealing made them two.** You compose against
16,384; what travels is the sealed form, and the relay bounds that at
22,528. A relay states its own ceiling in `GET /api/relay/key` as
`payloadMax`, so a sender can tell *"too big for me"* from *"too big for
that box"*.

## The rates

| | |
|---|---|
| claims accepted by a relay | **10 a minute** |
| posts in flight per sender | **16** |
| **posts in flight per recipient** | **1** |

**That last one is the load-bearing number.** One inbound route per
member means a relay's inbound work is bounded by its membership rather
than by anybody's intent — and it is what makes a relay's capacity a
figure you can compute instead of estimate.

## The errors

**94 conditions are catalogued** in `spirit/run/js/spiritErrors.js`, and
each carries more than a sentence:

| | |
|---|---|
| `status` | the HTTP status |
| `code` | a name that reads on its own — `peer-unreachable`, not `503` |
| `presence` | what it says about whether the person is THERE |
| `retry` | whether trying again can help |
| `fault` | whose problem it is — caller, target, relay, or this node |

**Why `presence` is a field and not a guess:** a busy refusal PROVES
somebody is there; *"peer not reachable"* says they are not; running out
of time says nothing at all. A single rule for "failed" would be wrong
two times out of three.

**An uncatalogued error says nothing about presence.** That is enforced —
a suite scans the tree for error sentences and fails on any the catalogue
does not know.

---

## What the relay cannot do

**It cannot read what you send.** A post is sealed to the recipient's
cipher key before it is signed, and the relay verifies, routes and
receipts without ever holding a word:

```
plaintext
  └─ sealed      X25519 + AES-GCM, sender and recipient as associated data
       └─ signed  the sender's Ed25519 over the SEALED bytes
            └─ hashed   SHA-256 of what travels
```

Every layer outside the seal works on bytes it cannot read. **Put the
hash inside and the relay would need the plaintext to compute it**, which
is the thing this design exists to prevent.

**This is proved, not asserted.** `spirit/test/guarantees.js` sends a real
sealed post through a real relay and then searches every surface that
relay has — the text it routed, its database on disc, the report it sends
its owner — for the words. It also runs the control: the same search DOES
find them when the post is not sealed, so a passing test means something.

**What is NOT hidden**, said plainly: who posted to whom, when, and how
big. That is the envelope, and a relay needs it to route. Message length
is public today.

---

## What this page does not yet have

Said here rather than discovered by a reader who trusted it:

- **The examples are not run by the harness.** They exist, and
  `doorContract.js` holds them to being non-JavaScript and free of any
  dependency — which is the thing about them that would rot first. But
  running them needs a live node with a peer to post to, so what is
  gated is the promise, not the proof. They were last exercised by hand
  on 2026-09-24, against a node and a relay, in both the delivered and
  the refused case.
- **Per-verb arguments and answers.** This page names the verbs and the
  rules around them; it does not yet say what each one takes. The shell's
  own calls are the working reference in the meantime.
- **A version.** The door has no stated version, so a program cannot ask
  whether it is talking to a node that knows a verb. A relay states its
  `payloadMax`; a node states nothing.
