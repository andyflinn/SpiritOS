# spirit-sibling-browser.js, the browser tests on one page

goal/G47.1, box v144, *"this cycle, first: the browser tests on one page"*. Its test is `./spirit-sibling-browser.js`: the general test run as testicle runs it, handed six real elements and one planted script that never ends (a file of its own for the run, removed after), watched from outside: the processes it starts, its time, and what reaches the testicle of the node this checkout reports to.

## Requirements

- The run ends by itself, within four minutes, the hung script among its scripts.
- The whole run starts one node (box: *"run on one node and one Chrome for the whole run"*).
- The whole run starts one Chrome.
- Every element after the hung script is judged: its results stand in testicle from this run (box: *"only a hung page is reloaded"*).
- The hung script is judged red.
- The first element's result stands in testicle while the run still goes (box: *"every result reaches testicle the moment the page knows it"*).
- The run takes at least 80% less than the time measured before, 3.7 s a script on Linux, 10 s on Windows (box: *"the target: at least 80% less test time"*).
- No fixed sleep in `spirit/test/spirit-sibling-browser.js` (box: *"no fixed sleeps in the checks: each wait ends the moment the page has settled"*).

The processes are counted on Linux only.
