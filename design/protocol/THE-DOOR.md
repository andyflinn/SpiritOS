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

## What can be asked

**36 verbs, in 9 families.** This list is generated from `server.js` and is exhaustive at the commit above.

**`contact.*`** — who this node knows, and what it calls them
- `contact.accept`
- `contact.block`
- `contact.forget`
- `contact.label`
- `contact.senders`
- `contact.setSenders`
- `contact.unblock`

**`device.*`** — a second machine of your own
- `device.info`
- `device.rotate`

**`fs.*`** — files, inside this node's own tree
- `fs.annotate`
- `fs.annotations`
- `fs.delete`
- `fs.save`
- `fs.stat`

**`jobs.*`** — background work
- `jobs.cancel`
- `jobs.create`
- `jobs.delete`
- `jobs.list`
- `jobs.update`

**`net.*`** — one fetch, through the proxy gate
- `net.fetch`

**`node.*`** — this node's own identity as strangers see it
- `node.card`
- `node.setDescription`
- `node.setName`

**`peer.*`** — talking to other people
- `peer.acquire`
- `peer.list`
- `peer.post`
- `peer.search`

**`proxy.*`** — reaching the outside world, by the owner's leave
- `proxy.allow`
- `proxy.close`
- `proxy.list`
- `proxy.open`
- `proxy.remove`

**`relay.*`** — this node's relationship with a relay
- `relay.claim`
- `relay.partnerCheck`
- `relay.record`
- `relay.status`

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

**66 conditions are catalogued** in `spirit/run/js/spiritErrors.js`, and
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

- **A worked example that is not JavaScript.** The claim is that any
  language works. Until a Python and a shell example sit beside this,
  that claim is untested prose.
- **Per-verb arguments and answers.** This page names the verbs and the
  rules around them; it does not yet say what each one takes. The shell's
  own calls are the working reference in the meantime.
- **A version.** The door has no stated version, so a program cannot ask
  whether it is talking to a node that knows a verb. A relay states its
  `payloadMax`; a node states nothing.
