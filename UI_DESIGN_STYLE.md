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

## 3. One rhythm down a page

Sibling blocks in a viewer are evenly spaced — **12px** today (`.code-view`, `.media-view`, `#open-with`).

A block that can be empty **collapses its own margin** (`#open-with:empty`). Otherwise absence produces a *bigger* gap than presence, and the emptiest screens get the loosest layout.

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

---

## Open questions — the tree disagrees with itself

- **Is 13px still a size?** It is the de-facto body size (`.stat-tile .rows`, `.jobs-table`, `.code-view`, `.process-entry`, `.annotation-raw summary`) but §2 says reading size is 16. Either 13 is a third tier with a job, or those are all waiting to grow.
- **`.job-manifest-note`** is fine print at 12px sitting *mid-page* in the text launcher, which §2 forbids. It moves to the foot or it stops being a note.
- **Files' own detail panel** shows Name/Path/MIME through `.label`/`.rows` at 12 and 13px — the same information as `.file-info-row`, in a different shape. Deliberately left out of the last change; unresolved.
- **22px figures** (`.stat-tile .value`) are a third size that probably earns its place — a number read as a figure is not prose. Worth stating as a rule or removing.
- **`<details>` markers**: Invite and Add someone by handle now both show the default triangle, after the invite line stopped being shrunk. Whether folded panels show a marker at all is unstated.
