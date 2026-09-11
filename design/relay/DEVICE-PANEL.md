# The "Add one of my own devices" panel

**Status: in design. Verified against `c9f3104` (2026-09-11).**

The panel a bound personal node shows in Natter — soon `natterDetails` — for a
relay it is bound to. Device cycles 1–5 built the machinery
(`2dbffbb`…`756013b`); this is about the surface, which is the part still called
horrid.

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

## 4. Decided

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

**`listening` persists, is honoured at boot, and defaults on.** The flag is
already in `device.json`; the node simply does not act on it at startup. A
restart while its owner is away must not shut the door, and a door that is shut
unless the need was predicted fails the rule above by construction. The switch
stays, so it can be closed deliberately.

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

- **The copy affordance.** Binding the copy to *start* leaves it homeless once
  listening defaults on — there is rarely a start to press. Deferred
  deliberately: the UI is going to be worked over, and this is a complaint worth
  raising when it actually bites rather than designing around now.
- The link target is `/device` until the keyed form of PEER-DEVICES.md exists.
- `target="_new"` is not a standard keyword; `_blank` with `rel="noopener"` is.
- If this becomes a dialog in `natterDetails`, dialog-close is exactly one exit,
  which is where the shell-scoped stop belongs.
- **`device-pending` has no rate limit.** A wrong name is refused before any
  crypto, but a right name with a bad signature costs three verifies per
  request — the one unlimited crypto path on the box. Small, and not this
  panel's to fix.
