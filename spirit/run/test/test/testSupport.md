# The pretend node reads a family's api.js where the family keeps it

goal/G43.23, item 12. Its test is `./testSupport.js`: `nodeApi` of `spirit/test/testSupport.js`, the pretend node's answer to `api {family}`, asked for every family of the tree, read only.

The box: *"the pretend node in testSupport reads a family's api.js from the old place."*

## Requirements

- Every server family is answered 200 with the text of its api.js at the one family path, `process/js/<family>/family/api.js` (`spirit.familyPath`).
- Every node family is answered 200 with the text of `spirit/run/spirit/<family>/api.js`.
