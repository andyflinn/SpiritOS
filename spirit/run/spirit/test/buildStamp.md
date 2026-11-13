# spirit/buildStamp.js — its own test

Which commit is this process actually running. Git first, because a deployed relay is a checkout; `build.json` second,
for the copies labMaster makes, which are trees and not repositories; `"unknown"` said plainly otherwise. And what a
copy built from `git ls-files` would leave behind: the standing rule "git add the new run module before the harness",
made checkable. Owed since the rule *"every production script has its own test"* (goal/G47.1, box v72). Each test makes
its own scratch repository or bare tree in the temp folder.

- `resolve` in a checkout: the short sha HEAD is at, its commit time, `source: 'git'`, clean; a tracked file edited and
  not committed is `dirty`. A checkout holding a `build.json` too still answers from git.
- `fromGit`: null where there is no repository.
- `STAMP_FILE` is `build.json`. `write` puts the stamp there and a bare tree resolves from it (`source: 'file'`,
  commit, dirty, at, untracked); with no stamp it writes `unknown`; a folder that cannot be written answers false and
  does not throw. `fromFile`: null for no file, a broken one, one with no commit.
- No repository and no file: `commit: 'unknown'`, `source: 'none'`.
- `missingFromCopy`: a new file under `spirit/` is named; once `git add`ed it is not (no commit needed); a new file
  under `spirit/test` or outside `spirit/` is not counted; outside a repository, an empty list and no throw.

The checks that need a tree in no repository say so in red if the temp folder is itself inside one.

## What its test must try to break

The file believed before git; an edited checkout reported clean; the untracked count dropped from a copy's stamp; test
files counted as missing; a throw out of `write` or `missingFromCopy`.
