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

## 7. Open — to be settled next

**The visibility rule fights the roaming premise.** The panel is meant to stop
listening when it is "exited and/or becomes invisible", *and* to stay listening
while its owner walks around with a phone. Those cannot both hold — a screen
lock or a tab switch ends the second one.

And a concrete flaw either way: the desktop flow is *press start → open the
relay page in a new tab*, which makes the shell tab hidden **at the exact moment
listening is needed**. If hidden ⇒ stop, the first paste always fails.

Also unresolved:

- Whether an unattended open window is an acceptable posture. It is a
  deliberate change from "open for thirty seconds", and the machine must stay
  awake for it to mean anything — a sleeping host freezes the 2 s timer.
- The link target: `Relay-URL/<key>/device/` is the **peer** form from
  PEER-DEVICES.md and does not exist. Today it is `/device`.
- `target="_new"` is not a standard keyword; `_blank` with `rel="noopener"` is.
- If this moves into `natterDetails` as a dialog: the shell does not tick
  dialogs, so the 2 s poll must be the dialog's own timer. The upside is that
  dialog-close is exactly one exit, which is where "stop listening" belongs.
