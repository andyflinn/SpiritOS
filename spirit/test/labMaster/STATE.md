# The lab suites are in the harness

**Every suite that spawns real processes runs in `node spirit/test/runAll.js`.**
This directory holds the lab itself: `labMaster.js`, its panel
(`labMastPanel.html`), `ensureMaster.js`, `labPaths.js`, and this note.

The lab suites are in `spirit/test/`: [`labLifecycle.js`](../labLifecycle.js),
[`labRefusals.js`](../labRefusals.js), [`labPersistence.js`](../labPersistence.js),
[`labRelaySurface.js`](../labRelaySurface.js),
[`labServableStatic.js`](../labServableStatic.js) and
[`liveFrontDoor.js`](../liveFrontDoor.js), among others.

## Running the lab by hand

```
node spirit/test/labMaster/labMaster.js        the panel on :65420
```

(`labPopulate.js`, which built a whole world in one command, went as a
stale test in goal/G43.23; nothing replaces it.)

The suites do not need you to do that first —
[`ensureMaster.js`](ensureMaster.js) starts labMaster if it is not
already up, and leaves it alone if it is, because you may be using
yours. With `LAB_MASTER_PORT` set (45420 by example) a run starts a
harness labMaster of its own, with its own folders and no work row
([`labPaths.js`](labPaths.js)).

See [design/cleanup/2026-09-11-labmaster.md](../../../design/cleanup/2026-09-11-labmaster.md).

---

## Where a lab node lives, and where a fixture does

| | root | built from | wiped between runs |
|---|---|---|---|
| **a lab node** (this panel) | `lab/<name>` beside the checkout (`labPaths.LAB_ROOT`) | a **git clone**, updated `git fetch origin` and `git reset --hard origin/master` | never |
| **a test fixture** (`labWorld`, `setupRelayFakes`, `labPersistence`) | `<os tmpdir>/spiritos-relay-fakes/<id>` (`labPaths.FIXTURE_ROOT`) | a copy of the **working tree** (`git ls-files`) | deliberately |

> **Andy:** *"i want all my nodes on labMaster page to only be updated via
> github, jazz's binding to spirit-3 keeps getting trashed."*

**Why they must not share a root.** A fixture wants a throwaway tree and
must test the code being written; a lab node holds a key, a seat on a
public relay and a conversation, and should run what is *published*. They
answer different questions.

**Nothing restores a node's state, because nothing takes it.** A node's
state (`relay-state/`, `spirit/state/` and the like) is gitignored, so
`reset --hard` cannot reach it.

**An unpushed commit does not reach the lab.** That is the point of
updating from GitHub: `git log origin/master..HEAD` is the list of what
the lab cannot see. The `Commit` column on the panel is there to make it
visible.

---

## The lab's ports are reserved from Windows, and have to be

**Windows hands out 49152-65535 as dynamic source ports for outbound
connections, and the lab lives at 65400-65432 — entirely inside that
range.** Any program on the machine can be handed a lab port at any
moment, and the node that wants it then cannot bind. It looks exactly
like a broken suite and is not one.

The fix is one line, in an **elevated** shell, and it persists across
reboots:

```powershell
netsh int ipv4 add excludedportrange protocol=tcp startport=65400 numberofports=33
```

33 ports: 65400-65432, which is the lab's range (30 ports from the base
65400, `labPaths.js`; `LAB_PORT_BASE` moves it), labMaster (65420) and
the work node (65432). It removes 0.20% of the ephemeral pool, and an
**explicit** bind to a port in the range still succeeds — which is why
the nodes keep working and nothing else notices. A run with
`LAB_PORT_BASE` set needs its own range excluded the same way.

Two things worth knowing:

- **netsh refuses while any port in the range is in use.** Stop the lab
  first. It does not say which port is the problem, so check before
  running it.
- **Stop nodes by LISTENING PORT, not by matching the command line.**
  labMaster is launched with a relative path (`spirit/test/labMaster/…`),
  so a filter on `SpiritOS` matches every node but that one — which is
  the one holding 65420.

```powershell
Get-NetTCPConnection | Where-Object {
  $_.LocalPort -ge 65400 -and $_.LocalPort -le 65432 -and $_.State -eq 'Listen'
} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Undo: the same command with `delete` in place of `add`.

**A fresh machine needs this before the lab suites can be trusted.** Until
it is done, any lab suite can go red for a reason that has nothing to do
with the code, and the failure is indistinguishable from a real one.
