# spirit/app/agent/agent.js

The Agent in `spirit/app/agent/`, as Andy sees it (goal/G43.13). Its test is `./agent.js`: a real node on a scratch copy of the tracked files, and real clicks in a real Chrome on the appSelector, made as the shell app (`spirit/app/app/element.js`) makes it.

`agent.js` is a few lines: on a page it loads `browserAgent.js`, in a node `nodeAgent.js`. Their own suites are `./browserAgent.md` and `./nodeAgent.md`.

## Requirements

### Its one switch

- `active` in `spirit/state/agent/node.json` is its one switch. Before Activate no server job runs, its verbs are not answered, its row is in the pane and it has no tile.
- Activate on its row starts the server, under the job id `spirit.app.agent`, with its rows in `spirit/state/agent/data/`.
- Deactivate stops the server. Its row stays in the pane and its tile goes.
- A restarted node starts it while it is active, and the rows made before are there.

### What Andy sees

- Its tile opens the app, and closes and opens again.
- The provider, model, persona and job tables each show their row.
- A row the server adds reaches the page's `spirit.data.agent` with no reload: `data.js` takes the id `spirit.app.agent`.
- The server's tool on the right strip shows ⚙, and its panel shows the agent's icon, then its label, then serverDEBUG (goal/G43.15). Pressed, `agent.DEBUG {}` says true, the node keeps `debug` true in `spirit/state/agent/node.json`, no `config.json` of the agent's own is written, and the panel says turn off DEBUG.
- Nothing throws on the page.

### What goes

- The tick box `showDebug` is off the page.
- No sidecar of the agent stands anywhere, and no code or test of the agent names one.
- No code of the agent names `process/js/agent` or `shell/agent`.

## Not judged here

- What the box puts out of this item: bundles, faces and puppets, and a tag.
