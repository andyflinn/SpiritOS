# spirit/test/coreFiles-dependency.js

A general rule over every core file of the run (goal/G41.30; Andy: *"it looks like we better make sure that those files
that core files depend on, are core-files, too."*).

## Requirements

- **What a core file loads is core.** A core file is grant-locked (`spirit/coreFiles.js`); a file it loads that is not
  could be rewritten by any page, and the core file would run what was written. For every tracked core `.js` and
  `.html` file outside a test folder, read from its code with comments left out:
  - a page's script and style tags (`src`, `href`), not an outside address;
  - a script's `require` of a file beside it;
  - `spirit.require` of a literal path.
  Each such file that exists must be core, or the test is red naming it and the core files that load it.
- **run://shell/ is gone** (goal/G43.30; Andy: *"can we delete run://shell/"*), shell/shared/ with it: the rule that it held
  no core file (goal/G41.30) has nothing left to hold, and the test finds no tracked file under it.
- It must have judged something: over 50 core files read and over 50 loaded files asked.

## What its test must try to break

- A file a core page or script loads left writable.
