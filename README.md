# SpiritOS

SpiritOS, at its most basic level, is a personal node.js, plain HTTP server, designed for a personal computers without public IP address. 

It enables it's local clients on the same machine to invoke HTTP POST style calls to other personal nodes, anywhere in the world.

The routing of these request is facilitated by a very slim node.js based router (or relay) that must have a public IP address.

## Promises

- both, the local node and public relays, are identified by public key.
- the only data that a relay (router) ever stores persistently (in its filing system) is its own identity (key pair) and a ledger of personal nodes, identified by public key, who are granted access to its routing services.
- SpiritOS comes with a transport protocol, facilitated by a javascript peerPost() api, that logs a transaction on both sides, the node that invokes a peerPost() and the node that replies to it. The structure of the logs allow both peers involved in a transaction to reconcile transactions by unique id (hash) and UTC timestamp.
- local nodes also come with an APIs
- All communications between personal nodes and public relays run through secure HTTPS.

## Aditional features of personal nodes

Personal nodes provide additional support for the following

### File system.

A personal node must always be started in [repository]/spirit/run/, which must be the the current directory of its own processes. Here are the promises for the fs:

- it confines the directories accessible for clients be confined to [repository]/spirit/run/.
- it protects all system files and directories vital to the running of the node from being overwritten through api calls.
- it provides a structured way to manage meta information for non-json files.

### Jobs/process system.

A personal node has api calls to launch and observe background processes and jobs.

## Proof and Demonstration of Promises

This repository comes with a suite of test scripts that verify the promises made above, plus a shell (local web app) hosting intrinsic system/node management apps and sample user apps. These demonstrates these claims in usable practice.

Lab relays and lab peers belong here too. They are harness tools, not product code — loopback stand-ins for the real thing, used to build a world you can look at. The commands for running any of this by hand are in [README/HARNESS/HUMAN_TOOLS.md](README/HARNESS/HUMAN_TOOLS.md).

## What a box holds

Measured, not estimated. The method, the derivations and the command to
re-measure are in [README/CAPACITY.md](README/CAPACITY.md).

### Two boxes, at the smallest size that is honest

|  | **a relay** | **a personal node** |
|---|---|---|
| **RAM** | **128 MB** | **128 MB** |
| **Disc** | **1 GB** | **1 GB** |
| **at rest** | 60 MB resident | 72 MB resident |
| **holds at once** | **~930** connected on Windows, **~1,500** on Linux | its own relay connections |
| **holds on disc** | **5.5 million** members enrolled, or 3.8 million partners | **2.4 million** exchanges logged for ever |
| **the rest of the disc** | — | **98% is yours** — media, writing, apps |

**128 MB because that is where the arithmetic stops being a fiction.**
Bare `node` with nothing loaded is **49 MB** resident, before a line of
SpiritOS runs — so the floor is the runtime's and not ours. What is
actually ours is small: **~11 MB on a relay, ~23 MB on a node.**

**A relay scales from there in a straight line — but the slope is not the
same on every platform**, which two boxes had to be measured to find out:

| a held connection costs | Windows 11 | Ubuntu 24.04 (WSL2) |
|---|---|---|
| in the relay process | **61–63 KB** | **40–43 KB** |
| in the kernel | *not measurable* — the counter swings 2.3× between runs | *not measurable* — below the counter's resolution |

| RAM | connected at once, Windows | … Ubuntu |
|---|---|---|
| 64 MB | 70 | ~100 |
| 100 MB | ~700 | ~950 |
| **128 MB** | **~930** | **~1,500** |
| 256 MB | ~2,700 | ~4,300 |
| 512 MB | ~6,200 | ~9,900 |

**A third fewer bytes a connection on Linux than on Windows** — far past
anything measurement noise explains, and confirmed on both boxes by a
second run. The relays that matter run on Linux, so the generous column is
the real one; the point is that **there is no single number**, and the
relay's own ceiling constant has to come from the platform it is on.

**The kernel's share is real and cannot be measured** with the counters
either platform offers — so the tables above are the process only, and an
owner should give a relay **at most half the box**. A margin is the honest
substitute for a number you cannot get.

### What decides each number

- **A relay is bounded by RAM.** Its roll is not the limit: a member row
  is **197 bytes**, and a gigabyte holds 5.5 million of them. **A relay
  can know five million people and hold a thousand conversations**, and
  the gap between those two numbers is the design.
- **A peer you can reach costs 579 bytes** on a node — 159 for the name,
  420 for the route. Both platforms agree to the byte, because that is the
  schema speaking rather than the operating system.
- **A node is bounded by nothing you would notice.** The program is 2 MB,
  its bookkeeping ~40 KB, and its peer cache is capped at **20 MB by
  default — 2% of a gigabyte**. What grows is your traffic log (438 bytes
  an exchange, permanent by decision) and your media.
- **The browser is not a cost.** The shell is one tab in a browser you
  already have open, and the node uses about what that tab does.

## how to get started.
```
git clone https://github.com/andyflinn/SpiritOS.git
cd SpiritOS
npm start
```

Then open `http://localhost:65432`. No `npm install` — the server uses Node built-ins only. A personal node binds loopback. `npm start` is `cd spirit/run && node js/server.js` (that `cd` is required).

Public relay: from `spirit/run/`, `node js/server.js --relay`.


