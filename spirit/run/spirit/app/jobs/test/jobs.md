# spirit/app/jobs/jobs.js, the app

Its test is `./jobs.js`. The box (goal/G43.29, v3): *"spirit/app/jobs/ holds the Job Monitor, now in shell/jobs/"*. Andy: *"fill in the box, same icons, shell:mount only."*, *"a wrapper for separate spirit/element/ files"*, *"both apps will be intrinsic"*.

## Requirements

- `jobs.json`: its icon 📋, its name Job Monitor; intrinsic; shell mount true, tile true; node mount false, nothing run. Its folder holds `jobs.js`, no `api.js` and no `data.js`.
- `jobs.js` brings `spirit/element/jobs.js` and draws nothing itself: no innerHTML, no old shell helper (activateApp, callDialog, factRow).
- It registers `spirit.element.spirit.app.jobs.jobs.create(container, { open })`, which draws its element and answers `{ destroy }`; destroy empties its container.
- Its tile is there, intrinsic and on, and opens it.
- The page finds the jobs cache at `spirit/jobs/data.js`, never `spirit/app/jobs/data.js`.
- Q1: a job row pressed in the tile's layer opens its detail as a layer over Jobs, in the app selector's stack; its ✕ goes one step back, to Jobs.
