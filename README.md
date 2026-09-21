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

Measured, not estimated. The derivations, the method and the command to
re-measure are in [README/CAPACITY.md](README/CAPACITY.md).

### Minimum to run

| | |
|---|---|
| **Node.js** | **22.13 or later** — no other dependency, and no `npm install` |
| **Install** | **3.7 MB**, 110 files |
| **RAM** | **72 MB** for a personal node, **60 MB** for a relay, at rest |

Node.js itself is 49 MB of that.

### And then

| | |
|---|---|
| **A relay with 100 MB RAM and 1 GB disc** | **~700 members connected at once**, out of a roll that could hold **5.5 million** |
| **Partners on the same relay** | **~3.8 million** rows on disc; RAM is spent only while one is connected |
| **A node with 1 MB or 10 MB RAM** | **not possible** — bare Node.js is 49 MB, so the smallest honest box is 128 MB |
| **A node with 10 MB disc** | **~47,000** remembered peers |
| **A node with 1 GB disc** | **~2.4 million exchanges** logged for ever — and the 20 MB peer cache is 2% of the drive |

- **A held connection costs ~58 KB.** That is what turns 41 MB of
  headroom into ~700 people.
- **A row on disc costs about 200 bytes** — a member, a partner or a
  remembered peer. Disc is not what runs out.
- **A node's disc is yours, not the system's.** On a working node the
  program is ~2 MB, the node's own bookkeeping ~340 KB, the peer cache
  capped at 20 MB — and the media folder 91 MB.
- **The browser is not a cost.** The shell is one tab in a browser you
  already have open, and a node uses about what that tab does.

**So a relay can know a million people and hold seven hundred
conversations, and the gap between those two numbers is the design.**

## how to get started.
```
git clone https://github.com/andyflinn/SpiritOS.git
cd SpiritOS
npm start
```

Then open `http://localhost:65432`. No `npm install` — the server uses Node built-ins only. A personal node binds loopback. `npm start` is `cd spirit/run && node js/server.js` (that `cd` is required).

Public relay: from `spirit/run/`, `node js/server.js --relay`.


