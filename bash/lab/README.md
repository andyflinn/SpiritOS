# bash/lab/ — side-quest inbox

This is not labMaster and not the public mailbox.

`bash/` verbs run **on spirit-3**.  
`bash/lab/` files are **work tickets**. Agents write them. You read them on GitHub and decide.

## Convention

1. One ticket = one markdown file.
2. Live tickets live in `bash/lab/open/`.
3. Finished tickets move to `bash/lab/done/` (do not delete; the trail is the point).
4. File name: `YYYY-MM-DD-short-kebab.md`
5. Copy `TEMPLATE.md`. Do not invent a new shape.
6. A ticket is something **you** can do in one sitting (SSH, one file, one commit). Not a manifesto.
7. Agents may open a ticket. Agents may not mark it done. Only you move it to `done/`.
8. No secrets, tokens, private keys, or `relay-state/` contents in a ticket.
9. If the work is “run this on spirit-3”, the commands must be the existing `./bash/…` verbs plus a short `why`.
10. If the work is code, name the exact path (`spirit/run/js/server.js`) and the done-when test.

## What belongs here

- Host leftovers that block collaborators (clone path vs `User=spirit`).
- Small public-relay bugs you can verify with `./bash/status` / `curl`.
- Follow-ups from a review that you have not scheduled yet.

## What does not

- Kernel design essays (those stay in `design/`).
- labMaster work (laptop only).
- “Please think about the architecture.”
- Saved HTML dumps.

## Agent rule

When you leave a human something to do via GitHub:

```
bash/lab/open/YYYY-MM-DD-<slug>.md
```

Commit that file on `master`. Do not open a branch. Do not also paste the same text into `design/thoughts/` unless they asked for a review document.

## Your rule when you come back

```
ls bash/lab/open
```

Oldest date first. Read, do or reject, move the file to `done/`, commit.
