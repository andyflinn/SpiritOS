# spirit/introSpector.js: an api branch serves its own verbs, and no FS group

goal/G43.20. introSpector.js gave every api branch the FS group (G41.28). Andy, on taking it away now that an api id is
the path of its folder: *"IN THIS ONE, OR WE'LL NEVER GET FUCKING DONE."*, *"WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN
THE PROPER PLACE, DILIGENTLY WITHOUT FUCKING CHEATING."*, and of its annotation verbs, *"ANNOTATIONS WILL BE NODE ONLY."*

A real node on a scratch copy of the tracked files, desk switched on (its branch read once its server answers it); its
api tree read as a page reads it, and raw calls at its door. Never a live node.

## Requirements

- No api branch serves an `FS.*` verb.
- Each branch serves exactly the verbs its own `api.js` declares (`spirit/<name>/api.js` or `spirit/app/<name>/api.js`).
- No branch serves `annotate`, `annotations`, `FS.annotateFile` or `FS.getAnnotations`; a call of `fs.annotations` is
  refused at the door.

## The attacker (rule/27)

- Every gone verb asked raw at the door, past the spirit object, on five branches (`FS.loadFile`, `FS.saveFile`,
  `FS.deleteFile`, `FS.statFile`, `FS.listFiles`, `FS.path`, `FS.annotateFile`, `FS.getAnnotations`), and in every
  spelling that might reach a handler: no family, a doubled dot, a case changed, `__proto__`, `constructor`,
  `hasOwnProperty`, padding spaces, a verb as a family. Every one is a 4xx.
- The calls carry a write (`content`, `payload`, `text`) naming a probe file: no file of that name, and no sidecar for
  it, appears anywhere in the scratch tree.
