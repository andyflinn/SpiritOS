# The page rules module, the browser tests on one page

goal/G47.1, box v144, *"this cycle, first: the browser tests on one page"*; goal/G49.27, step 2b: the module is `../script.js`, the part "given a file: its code, then its page" of `spirit/test/script-sibling-browser.js`, that file its runner now, and this the runner's test moved here with it. Its test is `./script.js`: the general test run as testicle runs it, handed six real elements and one planted script that never ends (a file of its own for the run, removed after), watched from outside: the processes it starts, its time, and what reaches the testicle of the node this checkout reports to.

## Requirements

- The run ends by itself, within four minutes, the hung script among its scripts.
- The whole run starts one node (box: *"run on one node and one Chrome for the whole run"*).
- The whole run starts one Chrome.
- Every element after the hung script is judged: its results stand in testicle from this run (box: *"only a hung page is reloaded"*).
- The hung script is judged red.
- The first element's result stands in testicle while the run still goes (box: *"every result reaches testicle the moment the page knows it"*).
- The run takes at least 80% less than the time measured before, 3.7 s a script on Linux, 10 s on Windows (box: *"the target: at least 80% less test time"*).
- It hands out `{ appliesTo, resource, own, forbids, checks }`: resource `browser`, own `false`.
- No fixed sleep in `spirit/test/script-sibling-browser.js` or its two rule modules, `spirit/testicle/general/browser/pageRules/script.js` and `placeRules/script.js` (box: *"no fixed sleeps in the checks: each wait ends the moment the page has settled"*).

The processes are counted on Linux only.

## A row of true or false fields alone is probed

goal/G47.1; wsl, of testicle's settings panel: *"the preferences row holds only interactive, true or false, so it writes the same row back and nothing can redraw"*. A planted `spirit/element/zzBrowserFlag.js` (removed after) draws a row that holds one true or false field and nothing else, through a family's view, and redraws only when what it shows changes. Run on it alone, the rule's check "a change written into what it watches redraws it" is green. Red on the rule before, which marked only text fields.

## It does not pollute the window namespace (goal/G47.1)

Andy: *"a test "does NOT pullute the windows namespace" NOW!!!!"*. Three planted elements, alike but for what they leave
on the window: one with a top-level `var`, one with a top-level `const`, both judged red by the check *"it does not
pollute the window namespace"*; the same code with every name inside its one function, judged green.
