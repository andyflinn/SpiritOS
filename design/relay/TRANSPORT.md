# The transport, and what it has been shown to do

**Status: built and proven live. Verified against `d087375` (2026-09-12).**

Andy, on accepting the device page onto it:

> we now have a proven design of a near-instant omnidirectional and
> authentic p2p transport protocol.

This note records what that sentence is standing on: what the protocol
is, what carries on it today, what was measured, and — the part a claim
like that needs most — **what has not been shown.**

The design is in [ROUTER.md](ROUTER.md) and the byte-level shape in
[ROUTER-PACKETS.md](ROUTER-PACKETS.md). Nothing here repeats them.

---

## One mechanism

A party signs a request, the relay hashes what verified, registers the
route, and pushes it down the stream the target is already holding. The
target derives the hash from the bytes it holds — never from the wire —
files it, composes an answer, and posts it back signed over that hash.
The relay matches and delivers.

That is the whole thing. There is no second transport, and the point of
this note is that there is no longer a second transport **for anything**.

## Omnidirectional

Four directions now ride it, and only the first was designed for:

| from | to | carried by |
|---|---|---|
| peer | peer | `peerPost.post` → `routePost` |
| relay | node | `relay.post` — the relay signing as itself |
| node | relay | the reply, composed by `answerRelay` |
| browser | node | the relay's post, made on a held POST's behalf |

The third and fourth are what the device arc added. A browser with no
identity yet cannot be a party, so it does not become one: it holds an
ordinary POST open and the relay is the party on its behalf.

**The relay is a party, not a special case.** It has had a keypair since
the first `--relay` boot, on the grounds that *a party with no key is a
party nothing can file*. Making it post as itself cost no new mechanism —
`post()` on a relay is deliberately the same shape as `post()` on a node,
because it is the same act.

## Authentic

Every request carries a signature and every answer is signed over the
hash, so the relay can neither forge nor alter either. **The hash
correlates; the signature authorises** — never the same check.

The device offer is the one case with no end-to-end signature available,
and it is instructive rather than an exception. The thing asking is a
browser enrolling the identity it does not yet have. There is nothing for
it to sign with, so the relay signs — and the receiving node verifies
that signature against the `mailboxPublicKey` **of the relay the request
arrived on**, fetched from that relay's own census.

That check is load-bearing. Without it any peer could post a device offer
and drive somebody's enrolment. With it, a peer posting an identical
offer carrying a genuinely correct password gets a bare receipt and
changes nothing — measured against spirit-3, not only in a fake.

TLS was not enough here and the reason generalises: **the origin of that
request is a browser, and the relay is forwarding it. A hop is not an
origin.**

## Near-instant, with the numbers

| | measured | where |
|---|---|---|
| peer → peer round trip | **24ms** median | loopback, lab relay |
| peer → peer round trip | **125ms** median (108 / 125 / 328) | through spirit-3 |
| device enrolment, whole | **142ms**, **307ms** | lab, two-relay install |
| device enrolment, whole | **365ms** | through spirit-3 |
| what it replaced | **0–60s**, mean 30s | the node's 60s poll |

The enrolment figures are larger than the ping because they contain the
ping *plus* the node installing the device key on every relay that
identity is on — one of them across the internet — **before** it answers.
That ordering is deliberate: the browser is told yes only once the key is
somewhere that will honour it.

The distribution matters more than the median for something a person
waits on, and `328ms` is the real world showing up in a three-sample set.
Even so, the worst observed is two orders of magnitude better than the
mean it replaced.

**And the spread is the bigger win.** The old behaviour was somewhere
between instant and a minute with no way to tell which, which is why the
original report was about *reliability* rather than speed: *"works
reliably when I click 10 seconds before the node polls, fails reliably 10
seconds after."*

## What it retired

The 66-second hold at the relay, and the rule that had to exist because
of it — one hold must outlast one poll plus a margin. Holding a
connection open at the relay is the thing the router exists to avoid, and
the device handshake was the last place still doing it. The hold survives
as a backstop reached only when nobody is home.

That whole arrangement was never a decision. Device cycle 2 landed
2026-09-10 and presence on the 11th: when the handshake was built there
was no stream to push down. **A fossil is indistinguishable from a
decision until you check the dates** — it had a rule attached, a constant
tuned against another constant, tests defending it, and a comment
explaining its reasoning. All real. None of it the actual reason.

## What has NOT been shown

- **Scale.** One exchange at a time, from one laptop, over one route. No
  concurrency, no many-peers-at-once, no measurement of what a relay
  costs when a hundred streams are open. Deliberately out of scope
  (PRESENCE.md §8), and still is.
- **Confidentiality.** The relay reads everything. Untamperable is not
  private, and nothing here should be quoted as though it were.
- **The old road is still there.** A node holding no stream still falls
  back to the poll; `send`/`inbox` and the relay's message ring still
  exist beside all of this. The transport is proven; the *retirement* of
  what it replaces has not happened.
- **Failure under loss.** Everything measured ran on links that worked.
  A dropped stream mid-exchange resolves as a 504 by design, but that
  path has been reasoned about rather than exercised.

---

## Where it is

`peerPost.js` (node), `relay.js` — `post`, `routePost`, `routeReply`
(relay), `answerRelay.js` (what a node answers when its relay asks),
`router.js` (the pending table), `presence.js` (who is holding a stream).

Proven by `spirit/test/liveRelay.js`, which runs by hand against a real
relay because none of the above can be shown in process.
