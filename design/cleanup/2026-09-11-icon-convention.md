# Icon convention — tighten repo-wide

**Outstanding. Opened 2026-09-11 against `c9f3104`. Not scheduled.**

The non-breaking half is done (see below). This records the half that touches
call sites everywhere and should be its own sitting.

## What was already done

Found while specifying the device panel
([design/relay/DEVICE-PANEL.md](../relay/DEVICE-PANEL.md)):

**`ICON.STOP` was declared twice** — `'⏹️'` and then `'🟠'`. An object literal
keeps the last value, so the stop symbol was unreachable and every caller
writing `ICON.STOP` was getting an orange circle without any way to see it at
the call site. `WAITING` was declared twice as well, harmlessly, with the same
glyph both times.

Fixed additively, so no rendering changed anywhere:

- the circles are now named for what they look like — `RED_CIRCLE`,
  `ORANGE_CIRCLE`, `YELLOW_CIRCLE`, `GREEN_CIRCLE`, `BLUE_CIRCLE`,
  `PURPLE_CIRCLE`, `BROWN_CIRCLE`, `BLACK_CIRCLE`, `WHITE_CIRCLE` — and
  declared **before** the semantic keys, so the colour is the canonical name in
  the icon chooser, which reads declaration order
- `ON` / `OFF` / `START` / `STOP` remain, as aliases of four of those
- the shadowed `'⏹️'` became `STOP_BUTTON`, which is also what the emoji is
  called
- the duplicate `WAITING` line is gone

Every existing key resolves to the glyph it always did.

## The principle

**Name an icon for what it looks like, not for what one caller means by it.**

A meaning-name earns its keep when the picture behind it can change centrally —
a theme, a redrawn set. These are emoji: there is nothing to re-theme, so the
indirection buys nothing and costs drift. `ICON.STOP` is the proof; it had
quietly become an orange circle and no call site could tell.

This is **not** an argument against aliases. `iconIndex.js` exists because
aliases are deliberate — ❌ answers to `NO`, `ERROR` and `DELETE` — and its
index is glyph-first for that reason. *Several keys, one glyph* is a choice.
*One key, two glyphs* is an accident.

## What is outstanding

**1. Decide which semantic names survive.** Some read better than a colour ever
will (`ICON.OK`, `ICON.WARNING`, `ICON.ERROR`) and clearly stay. Others — `ON`,
`OFF`, `START`, `STOP` — now say less than the colour they resolve to. Decide
per name, not wholesale.

**2. `jobs.js` shows 🟠 for `cancelled` and `stopped`,** because `ICON.STOP`
silently resolved to the orange circle. That may well be wrong — a stopped job
arguably wants `⏹️` — but changing it changes what a screen shows, so it is a
decision, not a repair. Two call sites.

**3. Point the remaining callers at what they mean.** The whole blast radius,
measured:

| use | where |
|---|---|
| `ICON.STOP` ×2 | `app/jobs/jobs.js` — `cancelled`, `stopped` |
| `ICON.WAITING` ×3 | `app/relayChat/relayChat.js`, `test/contacts.js`, `test/contactsDetails.js` |
| `ICON.ON` ×1 | `app/aiManager/aiManager.js` |

No app manifest names any of these as its icon, so nothing in discovery moves.

**4. Guard the accident that started this.** Nothing catches a duplicate key in
the ICON literal — `iconIndex.js` guards glyph collisions between apps, which is
a different thing. A test that reads `kernel.js` as text and refuses a repeated
key would have caught `STOP` on the day it landed.

**5. Decide whether a colour may mean an ACTION in one place and a STATE
in another.** This keeps recurring and there is no rule to point at, so it
gets re-argued every time:

| | |
|---|---|
| 🔴 as an action | Natter's device panel — *press the red button to stop* |
| 🔴 as a state | Contacts' presence column — *this peer is absent* ([PRESENCE.md](../relay/PRESENCE.md) §4) |
| 🔵 as an action | the same panel — *press to start* |
| 🟢 as a state | the same column — *present* |

Settled case by case so far, and the same way each time: a glyph inside a
**button** is read as a thing to press, a glyph in a **cell** as a thing
that is true. That has been enough. It is written down here because the
next person to meet it should find a rule rather than rediscover the
reasoning.

Not the same hazard as ★, which was a genuine collision: ★ meant a status
in both places it appeared, so two meanings fought. Worth stating the
distinction, because "one mark, one meaning" read too literally would ban
something that is not actually confusing.

Item 4 is the one worth doing regardless of the rest.
