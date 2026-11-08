# spirit/introSpector.js: an api branch serves its own verbs, and no FS group

goal/G43.20. introSpector.js gave every api branch the FS group (G41.28). Andy, on taking it away now that an api id is
the path of its folder: *"IN THIS ONE, OR WE'LL NEVER GET FUCKING DONE."*, *"WSL, NOTE AND ASSERT THIS IN YOUR TESTS, IN
THE PROPER PLACE, DILIGENTLY WITHOUT FUCKING CHEATING."*, and of its annotation verbs, *"ANNOTATIONS WILL BE NODE ONLY."*

A real node on a scratch copy of the tracked files, desk switched on (its branch read once its server answers it); its
api tree read as a page reads it, and raw calls at its door. Never a live node.

## Requirements

- Each branch serves exactly the verbs its own `api.js` declares (`spirit/<name>/api.js` or `spirit/app/<name>/api.js`):
  nothing more (the FS group introSpector.js added, G41.28, is no verb of any api.js), nothing less. Beyond an api.js
  only what was decided: appServer's `DEBUG` on every server (desk/G2.5: *"DEBUG auto-verb supplied by appServer is
  approved."*), and desk's `item.rules.add` and `item.rules.remove`, his alone and left out of its api.js on purpose
  (goal/G40.12).
- Nothing asserts that a removed verb is gone.
