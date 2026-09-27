# Processes — what a node runs besides itself

The written spec of the node's process subsystem. Before 2026-09-28 it existed
only as code (`spirit/run/js/jobs.js`, and `spirit.core.jobs` in
`spirit/run/js/kernel.js`). It was written for public-app-server/G19.1. Andy,
2026-09-28, in Team: *"the process spec needs updating, including
implementations of those updates"*, and *"the app-Servers must runn in the
process-subsystem"*.

## Three kinds of job

Every job is a row in the node's job table. The jobs app and the `jobs.*`
verbs show it, and its log is readable while it runs. The table lives in
memory only.

| kind | what it is | lifetime | started by |
|---|---|---|---|
| `permanent` | code inside the node itself (the file watcher, server stats) | the node's | the node, at boot |
| `process` | a script the node spawns, e.g. `process/js/imageStats/…` | runs and ends: `completed` on exit 0, else `failed` | the `jobs.create` verb |
| `server` | an app's server, a separate process | **as long as the node's**: started again when it exits, the wait doubling from 1 s to 60 s | the node, at boot, from app manifests |

Statuses: `pending`, `running`, then one of `completed`, `failed`, `cancelled`,
`stopped`. A server between restarts is `pending`, never a status of its own:
every status is live or final, so any job can be cancelled and then deleted.

## The contract a spawned process gets

`process` and `server` jobs get the same contract:

- **`SPIRIT_JOB_ID`**: its own row in the job table.
- **`SPIRIT_CALLBACK_URL`**: its node's door, `http://localhost:<port>/api/spirit`.
- **The spirit object.** It does `require('js/kernel.js')` and gets what a page
  gets at its lowest layer:
  - `spirit.core.fs.*`, which reads the node's run folder directly;
  - `spirit.core.jobs.report/log/complete/fail`, which reports to its own row;
  - **`spirit.core.ask(verb, args)`**, which asks the node any verb a page can,
    with the page's answer shape `{ status, text, body }`. In a page, `ask`
    posts to `/api/spirit` on the page's own host. In a process, the same call
    goes to `SPIRIT_CALLBACK_URL`.

  Andy: *"the server is a normal loopback client of the node interface, it can
  reach anything a local browser can"*, and *"the server is in fact given the
  same lowest layer node-client interface that is the shell has at its lowest
  layer"*.
- **A process holds no key.** It cannot sign. It asks its node to act, and
  what leaves the node is signed by the node (decision 0011's position for a
  browser, applied to a process).

A `server` also gets:

- **An IPC channel.** It exits when its node dies, however the node dies, so no
  orphan keeps its pipe.
- **Its output in its job's log**, line by line (stdout and stderr), so the
  jobs app shows what it does.
- **`SPIRIT_APP`** (its app's name) and **`SPIRIT_PIPE`** (the named pipe or
  socket file the node reaches it on). The node names the pipe; the app never
  chooses one.
- **A heap cap**, `--max-old-space-size`, the way the node's own unit caps its
  memory.
- **The shutdown verb.** Andy: *"a server process must implement a shutdown
  verb"*. The node sends `{ verb: 'shutdown' }` over the IPC channel, never
  over the pipe visitors come down. The server runs what it registered with
  `spirit.core.server.onShutdown(fn)` (at most 4 s) and exits. The node
  waits 5 s, and kills only a server that has not gone by then.
- **Shut down with its node.** Andy: *"on node-shutdown servers must sent a
  shutdown request to all server processes"*. On SIGTERM or SIGINT the node
  sends every server the verb (`jobs.stopServers`), waits up to 3 s, then
  exits. Each server's job ends `stopped`.
- **Requests and replies to the monitor.** Andy: *"server apps must send
  incoming requests to the monitor"*, and *"server processes must send their
  replies to the monitor when retuning the reply to the node"*. One line per
  exchange on stdout (method, path, status, content type, size, time; never
  the body, wsl-claude), which the node reads into
  the server's job log. The face server does it; an app's own server must
  do the same.
  - **An error's text always goes in** (Andy: *"and the error text should be
    in the monitor if the reply is an error"*): for a status of 400 or more,
    the reply's first 300 characters follow the line.
  - **The payload only in debug mode** (Andy: *"the payload need to be only
    in the monitor in debug mode"*), and **per server, never node-wide**
    (*"the process might need its own debug more, (essentially --verbose)"*,
    *"prolly shouldn't be node-wide, that might cause a flood"*). A manifest's
    `"verbose": true` sets `SPIRIT_DEBUG=1` for that server alone, and the
    reply's first 2 KB follow the line. The launcher sets the variable for
    every server, so a node-wide value never leaks in.

## Which apps run a server

The app's own manifest says so, and the node reads its own manifests at boot:

- **`"server": "<file>.js"`** runs the app's own code, a file in its own
  folder, as its server job. The name is one plain file name; anything that
  could climb out of the folder is ignored. This is a faceless spirit app,
  answering the HTTP-equivalent requests its node hands it down its pipe.
  Example: grantFace.
- **`"serves": true`** runs the stock face server (`js/server.js --app <name>
  --pipe <path>`, i.e. `faceServer.js`). It hands out the app's page and files
  and runs no app code. Example: faceProof.

**A puppet runs none.** A node with `relay-state/puppet.json` serves its owner,
and app servers live on the owner's box.

Stopping one is `jobs.cancel` (the jobs app's Cancel, which now offers it
for servers too). It sends the shutdown verb, and the server stays stopped
until the node starts again.

## What the core knows

The launcher (`spirit/run/js/appServers.js`) knows apps by name, their pipes
and their jobs, and nothing else. Which app answers a visitor, and why, is the
apps' own business. Andy: *"the core only knows about puppets"*. A suite
checks that the launcher's code carries no face vocabulary.

## Open

- **G19.2**: a packet addressed to a serving app goes down its pipe, and
  the answer returns signed by the node. Until then, only the node's own
  `api.toLocalApp` reaches a server's pipe.
- Resource boundaries beyond the heap cap (CPU, disk) are not enforced.
