# deskLoop re-arms with --read and takes before it posts

goal/G43.23, item 11. Its test is `./deskLoopReadTake.js`: the loop run in the test's process with `child_process.spawn` standing in for the ear, the model and every ask, as `./deskLoop.js` does.

The box: *"deskLoop arms the ear without --read and posts without a take."*

## Requirements

- After a wake, whose last line is `next: node deskAgentEar.js <port> --read <key>` (`deskAgentEar.js`, goal/G41.11), the loop listens again as `deskAgentEar.js <port> --read <key>`, always with the key last handed.
- Before each `chat.add` it posts, it takes the line: `line.take {id}` for the same item, through `deskAgentEar.js <port>`.
- The world: the loop listened three times and handed over and posted both lines, so a run that posted nothing is red.
