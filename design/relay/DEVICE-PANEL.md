# The "Add one of my own devices" panel

**Status: SUPERSEDED on 2026-09-12. Sections 1–7 describe a panel that no
longer exists; §8 is what stands. They are kept whole rather than edited,
because what they were solving is the reason §8 is as short as it is.**

Everything from §2 to §7 is about a WINDOW and a POLL — a switch that
opened a door, a timer that looked once a minute, four bubble states
reporting on that timer, and an arithmetic rule holding two constants on
two machines in step. None of that exists. The relay now hands an offer to
the node on the connection it is already holding, and the node answers in
one round trip.

Read §1 and §8. The rest is the record of a problem that was dissolved
rather than solved, and it is worth keeping for that: nearly every hard
decision in it was a consequence of the poll, not of the feature.

The panel a bound personal node shows in Natter — soon `natterDetails` — for a
relay it is bound to. Device cycles 1–5 built the machinery
(`2dbffbb`…`756013b`); this is about the surface, which is the part that was
called horrid.

See [PEER-DEVICES.md](PEER-DEVICES.md) for the wider design this eventually
serves.

---

## 1. What the panel is for

One job: attach another browser this person owns to this personal node, through
this relay. The relay is only the meeting point — the node decides, and the node
is what accepts the enrolment.

## 2. The state machine

**Not listening → listening → not listening**, on one control.

Starting also **copies the password to the clipboard**, because taking the
password is the same intention as opening the door. One press, one meaning.

*(This inverts what is built today, where Copy is the control and listening is
its side effect. The framing here is the honest one: the primary act is opening
the window, and the copy rides along. One consequence to carry over — today a
failed clipboard write refuses to start, on the grounds that a window waiting
for a password nobody holds is a lie. Under this framing, start is the point:
it should start, and report that the copy failed.)*

## 3. Shape

Two `div`s.

### Top — the control and its state, one line, wrapping

1. **A start/stop icon.** Not a text label. `Listening off` is ambiguous — it
   could be the current state or the available action — and an icon that reads
   as *play* or *stop* cannot be misread. Tooltips: *"Click to start
   listening"* / *"Click to stop listening"*.
2. **A sentence.** Not listening: *"Press the blue button to start listening."*
   Listening: *"Now listening, press the red button to stop."* Slight
   animation while listening — **on the icon, not the sentence**; a pulsing
   line of text is harder to read, a pulsing dot is a heartbeat.

Both items the height of a normal control, so the row sits in the form rhythm.

### Bottom — an information bubble, document-toned

**Not listening**

> When you start listening by pressing the blue start button, a secret password
> will be copied to your clipboard, which you can paste into the password field
> at **Relay-URL** to finish a device connection.

**Listening**

> Navigate to this website to finish a device connection:
> [Relay-URL](#)
>
> **Be sure to (a) bookmark this site and (b) let your browser's password
> manager memorise the password, so it reaches your other devices of the same
> browser brand.**

## 4. Decided — and built

All of it shipped in `aed0f69`, with one consequence the draft did not carry:
under a single control, a failed clipboard write must **still start**. The old
code refused to open the window when the copy failed, on the grounds that a
window waiting for a password nobody holds is a lie. With one button that
leaves no way to start at all — which is the failure this panel exists to
prevent — so it starts and reports the copy failed. §2 anticipated this; it is
recorded here because it reverses working code.

- One control, start/stop, with the copy as part of starting.
- Icon, not a state label.
- Two `div`s: control row, then an information bubble that changes with state.
- The bubble is document-toned prose, not form chrome.
- Colours: **blue to start, red to stop** (see §5).
- Animation on the icon.

## 5. Icons — done, non-breakingly

**Decided and applied:** the ICON table has appearance-named keys —
`RED_CIRCLE`, `ORANGE_CIRCLE`, `BLUE_CIRCLE` and the rest of the family — and
this panel uses **`ICON.BLUE_CIRCLE` to start, `ICON.RED_CIRCLE` to stop**.
Note that `ICON.STOP` is the *orange* circle, so the panel does not use it and
the copy's "red button" stays true.

Existing keys were left in place as aliases, so nothing rendered differently.
The repo-wide tightening that follows from this — which semantic names survive,
where the remaining callers should point, and a test that would have caught the
duplicate key — is recorded separately as
[design/cleanup/2026-09-11-icon-convention.md](../cleanup/2026-09-11-icon-convention.md)
and is **not** part of building this panel.

The reasoning, kept here because it is what decided the panel's colours:

Two reasons this is right rather than merely tidy:

**Meaning-names buy nothing here, and they drift.** A semantic name earns its
keep when the underlying asset can change centrally — themes, a redrawn icon
set. These are emoji: there is nothing to re-theme, so the indirection has no
payoff and one real cost. `ICON.STOP` has already drifted: the table sets it
**twice**, `'⏹️'` and then `'🟠'`, and last-wins makes the stop symbol dead
code. Anyone writing `ICON.STOP` today gets an orange circle. `WAITING` is
duplicated the same way.

**This is not the aliasing the table does on purpose.** `iconIndex.js` says
aliases are deliberate — ❌ answers to `NO`, `ERROR` and `DELETE` — and its
index is glyph-first for exactly that reason. That is *several keys, one
glyph*, which is a choice. A duplicate key is *one key, two glyphs*, which is an
accident that cannot be seen at the call site.

**The blast radius is small.** Across the whole tree these keys are used five
times:

| use | where |
|---|---|
| `ICON.STOP` ×2 | `app/jobs/jobs.js` — `cancelled`, `stopped` |
| `ICON.WAITING` ×3 | `app/relayChat/relayChat.js`, two tests |
| `ICON.ON` ×1 | `app/aiManager/aiManager.js` |

The colour keys are declared **before** the semantic ones, because the icon
chooser reads declaration order to decide a glyph's canonical name — so 🔵 now
offers itself as *Blue circle* first and *Start* second.

## 6. What already exists and should be used

The node learns of a successful enrolment within about two seconds —
`deviceTick` returns `installed`, `hub.js` keeps it as `lastEvent {did, atMs}`,
and `/api/hub/device` serves it to the panel, which already polls at 2 s.

The spec above has no **success** state, and that is the payoff of its own
premise going unspent: the panel can say *"a device was added just now"* and
answer "did it work?" without the person switching tabs. The same channel
already reports two failures worth showing — `refused` (the mailbox would not
have us; usually a version mismatch) and `unreachable`.

**Add a third bubble state: just succeeded.** It is also the right place for
the bookmark advice, which lands better once the thing has worked.

**Built as four**, because the failures needed telling apart in words rather
than in a status line: *added*, *trouble* (`refused` / `unreachable` /
`rejected`, each with what to do about it), *listening*, *off*. A success stays
the headline for five minutes — longer than a node pass, so stepping over to the
other device and back cannot miss it.

## 7. The rule that settles the rest

> **No routine failure should require being physically at home.**

The frustration this exists to prevent: being locked out of one's own node while
away, with the only remedy a journey. Three things force that today, and only
one of them is the listening window — the key lives in `sessionStorage` so a
closed tab loses it; there is one slot so a hotel tablet displaces the phone;
and the window is off by default and can only be opened locally.

Leaving the window open is a workaround for all three, and a poor one: it only
helps if the need was predicted before leaving.

### Resolved

**Visibility is a shell fact, not a browser fact.** `api.isVisible()` — is this
the active app — never `document.visibilityState`, OS focus, or tab visibility.
That also disposes of a flaw for free: opening the relay page in another browser
tab does not change the shell's state, so nothing goes quiet at the moment
listening is needed.

**What it governs is the PANEL, not the door** — correcting an earlier draft of
this section, which said listening itself stops when the panel leaves the shell.
That cannot stand beside the paragraph below: a door that shuts the moment
somebody clicks another app is a door that is only ever open while being
watched, which is the failure this whole section exists to prevent. The two
were written a conversation apart and never reconciled.

**Andy settled it on 2026-09-11: "no journey home wins."** The rule at the top
of this section outranks the tidiness of stopping a timer, so the door stays a
deliberate act in both directions.

So, as built:

| | stops when the panel leaves the shell | closed by |
|---|---|---|
| the panel's own poll of `/api/hub/device` | **yes** | leaving Natter, or collapsing the row |
| **the door** (`listening`) | **no** | the button, and nothing else |

The panel's poll is loopback and costs the relay nothing, but panes are hidden
and never destroyed — so without the check it runs for the life of the page.
`render()` is the way back in: the shell calls it on every visit, and on the job
tick while the app is active, so it fires exactly when Natter is on screen and
never while it is not.

**The hold must outlast the pass.** Added 2026-09-11 after the 60s change shipped
and broke enrolment — a cost the paragraph below did not price.

The relay holds one offer in RAM for `waitMs` while the node looks every
`DEVICE_TICK_MS`. Nothing synchronises those two clocks, so if the hold is
**shorter** than the pass, whether an enrolment works is decided by the phase
between them: press just before a pass and it lands, press just after and the
offer expires before anything comes to collect it. At 25s against 2s that was
invisible. At 25s against 60s it was a coin toss, and Andy found it by feel —
*"works reliably when I click 10 seconds before the node polls, fails reliably
10 seconds after."*

> **The rule (Andy): one hold outlasts one pass, plus a margin — "ten percent
> longer than the poll interval".** The margin is for drift and a slow pass, not
> for luck.

So `DEFAULT_WAIT_MS` is **66s**. An offer still open when the node looks cannot
be missed, whatever moment the button was pressed — certain rather than likely.
The cost is one held request, and there is one pending slot either way, so
nothing about concurrency changes.

The browser also knocks again, within a 180s budget, and that is **cover, not
the guarantee**: a minute-long request is the kind a hotel portal or a phone
changing masts will cut. Naming which is which matters — a retry quietly
carrying a guarantee is how this breaks again.

Both constants live on different machines, so nothing but a check that reads
both can hold them together: `spirit/test/deviceRendezvous.js` sweeps every
phase offset at the real ratios and asserts **one** knock suffices from each.
Restoring 25s fails it, naming the offsets that lose.

**And the first pass must be immediate.** Grok, reviewing the "certain" claim:
`startDeviceTimer` was `setInterval` only, so the first pass came a whole
`DEVICE_TICK_MS` after the button. The hold outlasts a pass, but it cannot
outlast a pass that has not started — so the order a person actually uses (open
the relay page on the phone, *then* start listening at home) had about six
seconds of margin rather than a guarantee. Fixed by firing one pass on start and
then the interval. The sweep could not see it: it models a node already ticking,
which is the honest scope of a phase test. `deviceListen.js` covers it instead,
on the event rather than on a timer.

**What spirit-3 actually does with a 66s hold** (Grok, against the live host):
the Caddyfile is a bare `reverse_proxy 127.0.0.1:65430`, Caddy's transport
default for `response_header_timeout` is *no timeout*, and Node's
`headersTimeout` bounds receiving headers rather than writing a response. So the
relay is not what cuts a long hold. **If a `response_header_timeout` is ever set
on this route it must be set above `DEFAULT_WAIT_MS`**, or it silently restores
the coin toss.

**The coupled constants stay arithmetic.** Considered and declined for now:
negotiating the period on the wire. The event stream retires the pair outright,
a node on older code is one release of skew, and the rendezvous test is the
tripwire. *If* it is ever negotiated: **the relay advertises its hold and the
node sizes its tick**, never the reverse — the box owns the slot, and a public
relay must not let every personal node dictate how long it holds a socket
(Grok). The third copy of the number, in `device.html`, is now named
`ENROLL_PERIOD_HINT_MS` and marked prose: nothing computes with it, and if it
disagrees with `hub.js` it is the sentence that is wrong.

**INTERIM: the node polls every 60s. Not every 2s.**

A 2s timer that never stops is 30 relay requests a minute, forever — which is
exactly the load that must stay microscopic. Default-on and a 2s timer do not
belong in the same design, and the earlier draft of this section had both.

At 60s it is one request a minute: an allowlist check, a name compare, up to
three Ed25519 verifies and a RAM read, about 0.3ms of relay CPU. Enrolment lands
within a minute, which is nothing in a hotel room. The panel may still speed the
poll while it is open, since that is bounded by a person standing there.

The cost that would *not* be negligible is TLS — a 2s poll without connection
reuse is 1 800 handshakes an hour on a 1 GB box. `relayRequest` passes no agent,
so it uses Node's global agent, keep-alive since v19: **worth measuring once
rather than assuming.** At 60s it barely matters either way.

**ARC: the doorbell replaces the poll.** A long-poll was considered and dropped —
it is about a cycle of work that the event stream replaces, and it optimises the
wrong traffic. See [EVENT-STREAM.md](EVENT-STREAM.md): with chat open the node
already calls the relay 30 times a minute, so devices are a rounding error on
the real number. Do the 60s interim now; take the latency to zero when the
stream lands, for every app at once.

**`listening` persists, is honoured at boot, and defaults on.** Shipped law,
not a hedge — Andy settled it and Grok took the same sentence: *no journey home
wins.* A restart while its owner is away must not shut the door, and a door that
is shut unless the need was predicted fails the rule above by construction. The
switch stays, so it can be closed deliberately.

Three things have to stay true or the trade below is a lie, and each is already
held by a test: **the next enrolment displaces the last** and the old tab
notices (cycle 5); **the password is never on a relay**, which is what makes it
uncheckable there; and **the poll's credential is not in the access log** —
cycle 4 moved it from the query string into a header, and
`spirit/test/deviceListen.js` fails if it goes back. One more that is a
non-obvious consequence: **do not start a timer on a node with no password
yet.** `resumeListening` requires the flag *and* a password; default-on without
that is a timer beating against a door that cannot open.

**One roaming device per identity.** Not a limitation — the thing that keeps it
simple: one field, one key, no device list, no pruning screen, and revocation is
just enrolling somewhere else.

### The security trade, stated plainly

The old claim was *"a stolen password is inert unless the window is open."* It
becomes *"a stolen password can enrol whenever the node is up."*

What still holds: it is 128 hex characters; it never leaves the owner's machines
except into their password manager; the relay cannot check it; and any use
displaces the owner's device, so it is noticed. Cycle 4 removed the reason the
window mattered most, by taking the poll's credential out of access logs.

Worth it against a journey home.

### Still open

- **The copy affordance — the next panel sitting, and the shape is decided.**
  Binding the copy to *start* leaves it homeless once listening defaults on, and
  after `c6f85c0` a node that was left open comes back open: the panel shows the
  stop control and there is **no way to reach the password at all**. It was
  deferred on the grounds that it was worth raising when it actually bit; it now
  does, on the first visit after a restart. The answer both reviewers reached
  independently: **a copy control that does not toggle the door.** One control
  still governs listening; copying stops being a side effect of opening and
  becomes something available in either state.

  The reversal that made this necessary is accepted, not merely shipped: a
  single button that refuses to start when the clipboard says no is a door that
  cannot be opened at all on a locked-down browser. Opening without a copy is
  recoverable — the password manager, or stop-then-start. Refusing is not
  (Grok).
- The link target is `/device` until the keyed form of PEER-DEVICES.md exists.
- `target="_new"` is not a standard keyword; `_blank` with `rel="noopener"` is.
- If this becomes a dialog in `natterDetails`, dialog-close is exactly one exit,
  which is where the shell-scoped stop belongs.
- **`device-pending` has no rate limit.** A wrong name is refused before any
  crypto, but a right name with a bad signature costs three verifies per
  request — the one unlimited crypto path on the box. Small, and not this
  panel's to fix. Now owned, in [PEER-DEVICES.md](PEER-DEVICES.md) §8: a line on
  the next device sitting rather than a cycle of its own.

---

## 8. What it is now — one button and a link

**Decided by Andy, 2026-09-12:**

> i want no backstop, no 'listening mode' on the personal node. the
> ability to setup one-device-for-all-peers just IS. I want the absolute
> minimum of UI for this in the personal node. A Copy Button, A Link to an
> URL (where the URL is actually hidden, and controllable in length on the
> display. and a panel below explaining how to use that, with a reminder
> to bookmark the page when there, and to save the password in the
> passord manager. thats all.

Built that day. Three things, and nothing else:

1. **A Copy button.** It puts the password on the clipboard and says
   whether that worked. It is the only control on the panel.
2. **A link**, whose text is the address shortened by one named constant
   (`ND_LINK_CHARS`, currently 52) with the key in the middle elided. The
   `href` and the `title` carry the address whole — a key in a URL is a
   locator and not a credential, so hiding it is about the panel being
   readable and nothing else.
3. **A paragraph below**, saying what to do in the order it is done, and
   carrying both of Andy's reminders: **bookmark that page while you are
   there**, and **let the password manager memorise the password**. Both
   are about the *other* device, which is why they are the ones forgotten
   at the moment they matter.

### What went, and why none of it is missed

| gone | it existed because |
|---|---|
| the start/stop control (§2, §3, §5) | there was a door to open |
| four bubble moods (§6) | a poll had passes to report on |
| the two-second repaint, `api.isVisible()`, `render()` (§7) | one sentence about the poll had to stay true |
| `listening`, persisted and resumed at boot (§7) | a door left shut stranded its owner |
| the 66s-vs-60s rendezvous rule (§7) | two clocks on two machines had to be held in step |
| the browser's 180s retry budget | a node might not have looked yet |

The panel now states no fact that can go stale while somebody reads it,
which is what made every one of those deletable at once.

### The security trade, restated

§7 traded *"a stolen password is inert unless the window is open"* for
*"a stolen password can enrol whenever the node is up."* That trade is now
simply the position, with the window gone.

What holds it up is unchanged and worth saying in one place: it is 128 hex
characters; it never leaves the owner's machines except into their
password manager; the relay cannot check it, because the relay does not
have it; any use displaces the owner's existing device, so an intrusion is
visible rather than silent; and the enrolment route is rate-limited to ten
attempts a minute per identity.

**That last one came back with this change and nearly did not.** The limit
lived in `deviceHandshake.js`, which was deleted whole — and
`/api/relay/device` is a public POST carrying a password guess that now
costs a post to somebody's node as well. It is `DEVICE_PER_MIN` in
`relay.js`, keyed by the identity being enrolled rather than by the
caller, and `spirit/test/deviceEnrol.js` fails if it goes again. Nothing
else in the suite counts attempts, so losing it would have been silent.

### What is still open

- **The key still lives in `sessionStorage`**, so a closed tab on the
  enrolled device loses it and has to enrol again. §7 named this as one of
  the three things that forced a journey home; the other two are now
  answered, and this one is not.
- **One roaming device per identity.** Unchanged, and still not a
  limitation: one field, one key, no device list, and revocation is just
  enrolling somewhere else.
- **Password rotation.** There is no way to mint a new one, which matters
  more now that a password is the whole gate rather than half of it.
