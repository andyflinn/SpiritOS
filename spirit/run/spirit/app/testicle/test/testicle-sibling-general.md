# spirit/app/testicle/test/testicle-sibling-general.js

Testicle's own -general general test (goal/G47.1, box v143: *"its general tests there: spirit/app/testicle/test/testicle-sibling-general.js,
testicle-sibling-node.js and testicle-sibling-browser.js, each with a dumb test or two; in debug mode these are the only general
tests testicle sees"*). A `-sibling-` general test beside `spirit/app/testicle/testicle.js`: it judges `spirit/app/testicle/`
and below (`spirit/test/testModule.js`).

    node spirit/app/testicle/test/testicle-sibling-general.js [<script> ...]

One test a script: *it is a script on disc*. Given scripts, each is judged and its result reported for it (`test.forScript`), so a
run handed two names both; given none, every product script under `spirit/app/testicle/` (not its `test/` or `temp/`).

It is there for testicle's debug mode (`./testicle.md`): in it, the general tests testicle sees are this one and its two
siblings, beside the planted worlds' own. Its own test is `./testicle.js` (*"testicle-sibling-general.js, handed both, names both"*).
