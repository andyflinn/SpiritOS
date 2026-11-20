# spirit/console.js

The console, core (goal/G48, Andy: *"console is core."*). Its first version is the hello world of goal/G48.1 (Andy: *"we
need a hallo word version first with extremely modest feature requirements. that way we can experiment with the
prototype...."*). It uses spirit word vocabulary, and its js spirit object is in node-client mode, same as app servers or
one-shot jobs. Its test: `./console.js`.

## What it does

- `node spirit/run/spirit/console.js card` prints the node's card using `JSON.stringify(card,0,2)`.
- `node spirit/run/spirit/console.js` puts the console into interactive mode, where
  - `exit` exits the interactive loop and the console script;
  - `card` prints the node's card using `JSON.stringify(card,0,2)`.

## What its test judges

On a scratch node of its own, the console of that node's tree run there: `card` in one go prints exactly the card the node
answers to `node.card`, as `JSON.stringify(card,0,2)`, and ends without an error; with no word it stays running and prints
nothing until a line comes; `card` at it prints the card, the console stays, and `card` again prints it again; `exit`
ends the console without an error.
