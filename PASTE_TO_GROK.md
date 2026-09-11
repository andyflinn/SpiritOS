# PASTE_TO_GROK.md

**What this file is.** The current call for review, put in the repo so it can be
read at a link instead of pasted — the paste was being cut off mid-document.
It is **overwritten each time**, so it always holds the latest call and nothing
else. Git history holds the previous ones.

Read at:
<https://github.com/andyflinn/SpiritOS/blob/master/PASTE_TO_GROK.md>

---

## Read these for the full reasoning

The document below states conclusions. Everything it stands on is in the tree,
and the design documents carry the argument rather than just the outcome.

**Design**

- [design/relay/DEVICE-PANEL.md](https://github.com/andyflinn/SpiritOS/blob/master/design/relay/DEVICE-PANEL.md)
  — the panel, and **§7 is the one to read**: the rule that settles the window,
  the poll and the slot, now carrying the rendezvous rule.
- [design/relay/PEER-DEVICES.md](https://github.com/andyflinn/SpiritOS/blob/master/design/relay/PEER-DEVICES.md)
  — every identity attaching its own browsers. Designed, not built.
- [design/relay/EVENT-STREAM.md](https://github.com/andyflinn/SpiritOS/blob/master/design/relay/EVENT-STREAM.md)
  — the arc that retires the rendezvous entirely.
- [design/decisions/0006-fast-and-true-not-guaranteed.md](https://github.com/andyflinn/SpiritOS/blob/master/design/decisions/0006-fast-and-true-not-guaranteed.md)
  — a relay delivers or refuses and stores nothing.
- [design/README.md](https://github.com/andyflinn/SpiritOS/blob/master/design/README.md)
  — the index.

**Code under discussion**

- [spirit/run/js/deviceHandshake.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/js/deviceHandshake.js)
  — the hold, the single slot, the rate limit.
- [spirit/run/js/hub.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/js/hub.js)
  — `DEVICE_TICK_MS`, `startDeviceTimer`, `resumeListening`.
- [spirit/run/device.html](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/device.html)
  — the enrolling browser: retry, budget, countdown.
- [spirit/run/app/natter/natter.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/run/app/natter/natter.js)
  — the panel.
- [spirit/test/deviceRendezvous.js](https://github.com/andyflinn/SpiritOS/blob/master/spirit/test/deviceRendezvous.js)
  — the phase sweep. Reading this is faster than reading the argument.

**Commits, newest last**

- [`c6f85c0`](https://github.com/andyflinn/SpiritOS/commit/c6f85c0) — the door
  stays open: resume at boot, and only the panel watches
- [`aed0f69`](https://github.com/andyflinn/SpiritOS/commit/aed0f69) — enrolment
  is certain, and the panel is one button
- [`b778bdb`](https://github.com/andyflinn/SpiritOS/commit/b778bdb) — specs
  catch up
- [`9fd68c6`](https://github.com/andyflinn/SpiritOS/commit/9fd68c6) — the index

---

# Call for review — device enrolment: the rendezvous, and the panel

Since device cycles 1–5, three commits landed on `master`. Two are behaviour,
one is specs catching up. Everything below is green on the harness (49 files)
and verified live against spirit-3 except where noted.

## 1. What was wrong, and it was self-inflicted

`c6f85c0` moved the node's device poll from **2s to 60s** (default-on listening
and a 2s timer do not belong in the same design). Nothing else changed. That
silently broke enrolment, because the relay holds one offer for **25s**:

```
node pass ────●───────────────────────────────●  (60s apart)
press             └── hold ──┘ expires         ↑ nothing left to collect
                  0s        25s               50s
```

Whether an enrolment worked became a function of the phase between two clocks
nobody can see. Andy found it by feel: *"works reliably when I click 10 seconds
before the node polls, fails reliably 10 seconds after."* At 25s against 2s the
mismatch was invisible; at 25s against 60s it was a coin toss.

## 2. The rule, and the fix

> **One hold outlasts one pass, plus a margin** — Andy's rule, "ten percent
> longer than the poll interval". The margin is for drift and a slow pass, not
> for luck.

`deviceHandshake.js` `DEFAULT_WAIT_MS`: **25000 → 66000**. An offer still open
when the node looks cannot be missed, whatever moment the button was pressed.
Certain, not likely.

The browser (`device.html`) also knocks again within a 180s budget, and that is
deliberately **cover, not the guarantee** — a minute-long request is the kind a
hotel portal or a phone changing masts will cut. Naming which is which is the
point; a retry quietly carrying a guarantee is how this breaks again.

`spirit/test/deviceRendezvous.js` sweeps every phase offset at the real ratios
and asserts **one** knock suffices from each. Restoring 25s fails it and names
the losing offsets.

## 3. What I want reviewed

**3.1 The 66s held request — relay-side, and the reason for this call.**
This is `relay.js`'s module and lengthens how long the box holds an HTTP
request. My reading: concurrency is unchanged (there is one pending slot either
way, so at most one held request), Node's `requestTimeout` bounds the request
not the response, and Caddy's `reverse_proxy` sets no response deadline. Please
check that against how spirit-3 is actually fronted. The counter-risk runs the
other way: a 66s hold meets more intermediaries willing to cut it, which is what
the retry covers.

**3.2 A constant that spans two machines.** `DEFAULT_WAIT_MS` lives on the relay;
`DEVICE_TICK_MS` lives on a personal node. They are coupled by arithmetic and by
nothing else. Today a test reads both and holds them together, and `device.html`
states "about 60s" from a third copy. That works while one team owns all three.
It does not survive a node on older code polling on a different interval.
Options, none chosen: the node sends its period with the poll and the relay
sizes the hold to it; or the relay advertises its hold and the node sizes its
tick; or it stays arithmetic plus a test. **Preference?**

**3.3 The slot and the rate limit are per PROCESS, not per identity.**
`createQueue()` is called once in `createRelay`, so one pending slot and one
`perMin: 10` window serve every identity on the relay. Correct today — the owner
is the only enroller. It is a blocker for PEER-DEVICES.md, where two peers
enrolling at once means one refuses the other, and where one peer's retries
spend everyone's allowance. The doc already says the slot should be per
identity; flagging that the code is not, and that the rate limit needs the same
treatment.

**3.4 `device-pending` still has no rate limit.** A wrong name is refused before
any crypto, but a right name with a bad signature costs three Ed25519 verifies
per request — the one unlimited crypto path on the box. Known, unowned.

**3.5 A reversal in working code.** Under one control, a failed clipboard write
now **still opens the window**. The old code refused to, on the grounds that a
window waiting for a password nobody holds is a lie. With one button that leaves
no way to start at all, which is the failure the panel exists to prevent. Spec
§2 anticipated it; calling it out because it reverses shipped behaviour.

**3.6 Default-on listening, and the security trade.** `listening` now persists,
is honoured at boot, and defaults on, so a restart while its owner is away does
not shut the door. The old claim *"a stolen password is inert unless the window
is open"* becomes *"a stolen password can enrol whenever the node is up."* What
holds: 128 hex characters, never on a relay, the relay cannot check it, and any
use displaces the owner's device so it is noticed. Andy accepted the trade
against a journey home. Second opinion welcome.

## 4. Not asking about

The panel's visual design — one control, blue start / red stop, pulse on the
icon, a four-state prose bubble — is settled in `design/relay/DEVICE-PANEL.md`
and built. UI polish continues in-file.

## 5. Known open, not in scope here

- **The copy affordance.** Binding the copy to *start* leaves it homeless now
  that listening defaults on: after a restart the panel shows the stop control
  and there is no way to reach the password. Stop-then-start is the workaround.
- `sessionStorage` durability for the device key; fan-out across relays.
- The event stream retires this whole rule — a connection already open has no
  phase to get wrong. See `design/relay/EVENT-STREAM.md`.
