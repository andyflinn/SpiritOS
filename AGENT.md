# Working agreements for this repo

Standing instructions for any agent working in SpiritOS. These override
general defaults — where a default says "be cautious, do X", and this file
says otherwise, this file wins.

## Git: master only

- **Work only on `master`.** Do not create branches. Do not open pull
  requests.
- **`git add` + `git commit` on `master`** is the entire workflow.
- **If a branch already exists** — left by an earlier session, or created by
  mistake — merge it into `master` and delete it. Do not leave branches
  lying around for someone else to reconcile.
- **Commit only when asked.** Master-only is about *where* commits go, not
  about committing more freely.

### Why, so nobody "helpfully" reverts this

The common default is *branch before committing to the default branch*, on
the theory that a branch is the safe choice. It isn't safe here, it's
friction: SpiritOS is a single-operator repo with a deliberately linear
history on `master`, no CI gate, no review queue, and nobody else's work to
protect. A branch just leaves the owner with an unmerged ref to clean up
by hand, and an extra step between a finished change and a working tree
that reflects it.

Verify work before committing instead — that is where the real safety is.
`spirit/test/` is the harness; see the README for what covers what.
