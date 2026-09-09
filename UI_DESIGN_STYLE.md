# UI_DESIGN_STYLE.md — how the spirit shell looks and why

Working notes, not a spec. A rule lands here **after** it has been decided on a real screen; the open questions at the bottom are the ones the tree currently contradicts itself about. If you are about to invent a size, a gap or a control, look here first — and if you invent a new one anyway, write down what it is for.

`AGENT.md` owns the product rules. This file owns the look. Where they overlap (chrome that is not useful), `AGENT.md` wins and this file points at it.

---

## 1. Show only what can do something

Stated in `AGENT.md`; repeated here because it is the rule that decides more layouts than any other. **Prefer not building it over hiding it.** A control whose every value would be refused, a form for a capability this node does not have, a field asking a question already answered — each is a thing to read, decide about and dismiss, and together they are what makes a screen read as a debug console instead of an app.

Where it already applies:

| screen | absent, not disabled |
|---|---|
| Relay Chat, unbound | the To bar, the list, the thread, the composer, the invite slot |
| Relay Chat, no contacts | the thread and the composer — nothing selectable to write to |
| Relay Chat, owns no mailbox | the whole invite panel; not built, not hidden |
| Viewers, unhandled extension | the Open with control, and it collapses its margin too |
| Apps panel, intrinsic app | no name or icon field — a note instead |

State changes bring the chrome back on its own. Nothing is lost, only unasked.

## 2. Two sizes, and fine print lives at the bottom

**Reading size is the titlebar size** (`#app-title`, 16px). Anything that earns a place in the flow is set at it — the file info rows in both launchers, the Apps detail rows, the Groups panel, all through `.file-info-row`.

**Fine print is 12px at 0.75 opacity**, and it belongs at the **foot of a page**, not shrunk in the middle of one. If a line is worth shrinking it is worth moving down. The Relay Chat footer (`#rc-footer`: node label and key ending) is the reference case.

Match the size, **never the weight**: `#app-title` keeps its 600, or the block beneath starts competing with the thing it describes.

## 3. One rhythm, down a page and across a row

**12px** is the spacing scale. It separates sibling blocks down a page (`.code-view`, `.media-view`, `#open-with`, the two folded panels in Relay Chat) *and* the controls across a row (`.start-job-form`, `#rc-claim-fields`). Two gaps that are nearly the same read as a mistake rather than a distinction — this used to be 8px on rows and 12px everywhere else.

A row of controls is `.start-job-form`: gapped, wrapping, `align-items: flex-end` so a caption-over-input pair lines its input up with the button beside it, and a block of space beneath it before whatever it feeds. A form does not lay itself out; if a screen needs a row, it uses that class (Natter's Add line, the Jobs start form, the Relay Chat composer and To bar, the AI chat form).

**Space belongs to the block that follows it.** A block carries the gap *above* itself, never below — then a block that is not on the page contributes nothing, and there is no trailing margin left hanging where it used to be. That is what makes the spacing automatic in a stack that grows and shrinks: `.stat-tile + .stat-tile` and its siblings space every pair, and neither block has to know what comes next.

It also retires two hacks that existed only because space was carried downward: `#open-with:empty`, which had to cancel a margin on a block that renders as nothing, and the 12px that sat on the panel *above* Relay Chat's invite slot because the slot is empty for a node that owns no mailbox. The same idea applies across a row: a control takes the gap to its left, so a control that is not drawn takes no space with it.

A block that can still be empty **collapses to nothing** (`#rc-peer-strip:empty { display: none }`), which is the row version of the same rule.

### The two halves, stated so they can be checked

**Down a page: a fold carries its own leading space, always.** Every `<details>` panel brings the 12px above it and never relies on the block before it to leave room. Folds are the case that keeps breaking — they appear and disappear with state, so the one above may not be there — and it is why Natter's mint bubble arrived with no gap.

**Across a row: leading space goes on the left, except for the first element on the line.** Which is what `gap` on the flex container already does, and `gap` is the mechanism — not `margin-left` with a `:first-child` exception. That literal reading breaks twice: `.start-job-form` wraps (§10), so the first element on the *second* visual line is not `:first-child` and would be indented; and `display: none` does not change `:first-child`, so hiding the first control would indent the whole row, which §1 does constantly. Use `margin-left` only where there is no flex row to put a gap on.

**Every sitting that touches an app checks both**, along with whatever else has been decided since. A rule nobody re-reads is how the mint bubble lost its space in the first place — the statement was already here.

Two standing exceptions, both decided:

- **Stats is not an accordion app.** It is a living, ticking, output-only panel and reads as one; spacing rules written for folds that come and go do not get applied to it.
- **A settings panel keeps its `> details + details` rule while it holds one question.** `#rc-settings-panel` has a single item today and the rule matches no pair — it is not orphaned, it is waiting. A second configuration item is expected (a sound on incoming, for one), and this is the shape that makes it cost nothing. Same for the other settings panels.

### Opening one fold closes its siblings

**One panel open at a time.** This is already the house rule for every row expander — Apps, Groups, Jobs, Natter's relay rows and Contacts' own rows all say *"opening one closes any other"* — and folds now say it too. It is the same argument as the spacing above: a portrait screen has one screenful, and a fold left open behind you is chrome you are not using (§1).

**Use `<details name="…">`.** The browser does it: same `name` on siblings and it closes the others itself. No JS, no state, no listener per app. On anything too old to know the attribute the folds stay independent, which is exactly today's behaviour — the fallback is the status quo, so it cannot break a screen.

**Names are the app's id prefix, not its app id.** App ids are folder-derived and have moved before (`app-manager` → `app/apps`; `APP_ID_RENAMES` carries the overrides). A fold group named from one would silently regroup on the next folder move, and nothing asserts which folds are a group. The `rc-` / `contacts-` / `natter-` prefixes are hand-written, stable, and already name every element in their app:

| app | fold group |
|---|---|
| Relay Chat | `rc-settings`, and `rc-settings-question` for the folds inside it |
| Contacts | `contacts-panels` |
| Natter | `natter-panels` |
| Apps | `app-manager-panels` |
| Groups | `group-manager-panels` |

**One group per level.** A nested fold needs its own name or opening the child closes the parent it lives in.

Two things this rule does not do:

- **A tree is not an accordion.** `app/files/files.js` builds a `<details>` per folder. Exclusive folders would mean never having two open, and every step down would collapse the path you came by. The tree is already delicate about open state — it tracks `isOpen` by hand, because a rebuilt `<details>` is a closed one.
- **The shell does not stamp `name` automatically.** It knows whose container it is mounting, so it is tempting — but the tree's folder folds live in that same container, and "direct children only" stops being true the day someone wraps their panels in a div. One attribute, written where the fold is written.

## 4. One row type, one voice

The same kind of information looks the same wherever it appears. `.file-info-row` is label-plus-value on one line, and it serves the launchers, Apps and Groups alike; changing it changes all three on purpose.

Before adding a class, check whether one of these already says it:

| class | what it is for |
|---|---|
| `.stat-tile` / `.stat-tile.wide` | a panel: rounded, padded, faintly lighter than the page |
| `.stat-tile .value` / `.label` | a figure (22px) and its caption (12px) |
| `.file-info-row` + `.file-info-label` | label and value on one line, reading size |
| `.start-job-form` | a row of inputs with a button on the end |
| `.field-label` | a caption wrapping its own input |
| `.job-log-panel` / `.job-log-entry` / `.job-log-time` | a scrolling log |
| `.job-log-empty` | "nothing here yet", italic and dimmed |
| `.job-manifest-note` | fine print (see the open question below) |
| `.cancel-btn` | a secondary button; also every filter button in Relay Chat |
| `<details class="stat-tile wide">` | a rare job folded away — Invite, Add someone by handle |

## 5. A label people scan must hold still

A number that changes on its own does not belong in text somebody reads to find something. The unread count lives in Relay Chat's own heading; the browser tab says **`spirit - <node> - <screen>`** and nothing else, because a wall of tabs is scanned to answer "which node is this".

The same reason keeps the key ending out of the title and in the footer: somebody is reading it aloud down a phone.

## 6. Human-facing machine values

A key is 48 characters and all Ed25519 keys share the prefix `MCowBQYDK2VwAyEA` — so a fragment shown to a person is taken from the **end**, six characters, and the same six in the same words on both screens ("ends …mjowM=" beside "key ends mjowM="). Never show a prefix, never abbreviate in the middle.

## 7. Test the relationship, not the number

CSS regressions are invisible until somebody looks. Where a rule is a *relationship* — an info row is the size of the titlebar; Open with sits the same distance below the bubble as the preview does below it — assert that, not the pixel value. Changing both deliberately then stays green; changing one does not. See `spirit/test/natterIntrinsic.js`.

## 8. Reach for what the server already answered

The shell does not invent restrictions the server does not impose (`AGENT.md`, and the memory of the Open-with folder rule that refused a perfectly readable file). If chrome needs a verdict — is this writable? — publish the verdict from the enforcing function rather than mirroring its constants in the browser.

## 9. One shape for every control

Buttons, inputs, selects and text areas an app puts on the page share one rule set (`#app-content input, select, button, textarea:not(.code-view)`): **rounded box, 10px radius — the same roundness as the `.stat-tile` they sit in — dark fill, 1px translucent border, reading-size text, 44px minimum height.** Buttons drop the border and take the accent fill.

Two of those numbers are doing double duty, which is why they are not free to drift:

- **16px** is the reading size of §2 *and* the threshold under which iOS zooms the whole page when a field takes focus — leaving a portrait phone scrolled sideways in a layout nobody asked for.
- **44px** is the smallest comfortable touch target on a phone.

A form does not style its own controls. `#process-search`, `.field-label`, `#job-manifest-form` and the Relay Chat rows each carried a private copy of the same six declarations, at 6px padding and 6px radius, drifting one edit at a time; now they declare only what is particular to them (a width, a margin, `flex: 1`).

The titlebar keeps small buttons (`.cancel-btn` outside `#app-content`, e.g. the viewer's bail-out): chrome you press once is not a field you fill in.

`select` also gets `color-scheme: dark` and opaque `option` colours globally, because a native dropdown paints its popup with the control's own colours — a translucent background reads fine closed and is unreadable open.

## 10. Aiming at a small portrait screen

Not finished, but it is the target, and it decides the numbers above. What already holds: controls are thumb-sized, `.start-job-form` wraps so an input takes the width and its button drops beneath it (two full-width targets instead of one squeezed pair), `.rc-wide` takes the page width rather than the width of its longest option, and the desktop shrinks its icons under 480px.

---

## Open questions — the tree disagrees with itself

- **Is 13px still a size?** It is the de-facto body size (`.stat-tile .rows`, `.jobs-table`, `.code-view`, `.process-entry`, `.annotation-raw summary`) but §2 says reading size is 16. Either 13 is a third tier with a job, or those are all waiting to grow.
- **`.job-manifest-note`** is fine print at 12px sitting *mid-page* in the text launcher, which §2 forbids. It moves to the foot or it stops being a note.
- **Files' own detail panel** shows Name/Path/MIME through `.label`/`.rows` at 12 and 13px — the same information as `.file-info-row`, in a different shape. Deliberately left out of the last change; unresolved.
- **22px figures** (`.stat-tile .value`) are a third size that probably earns its place — a number read as a figure is not prose. Worth stating as a rule or removing.
- **Wide content on a narrow screen.** `.jobs-table` and `.job-last-log` (fixed 300px) will overflow a portrait phone rather than scrolling inside their own container, and the thread, the Files tree and the code view have not been looked at on one at all. §10 is a target, not a claim.
- **`<details>` markers**: Invite and Add someone by handle now both show the default triangle, after the invite line stopped being shrunk. Whether folded panels show a marker at all is unstated.
