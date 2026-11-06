# A search dropdown's list floats

goal/G43.18. Its test is `./searchPopup.js`: real clicks and keys in a real Chrome on a scratch node's face page, three search dropdowns of 40 rows, each in a 48 px box that cuts off what overflows it (as a row of a panel does), a block drawn over the space below the first two, and the third low in the window.

Andy: *"is it possible to have a "popup" element, which floats it's contents above all windows, but only one in the whole browser window can be active? only bound by the window size but not neccessarily filling it? all dropdown panels should be part of that"*, then *"and the actual dropdown control stays where it is? just the popped list would "float"? then do that for the lists in the search-dropdown please."*

## Requirements

- Pressed, a dropdown's field stays where it was, in its box.
- Its list reaches past its box, over the block drawn on top, and is what is seen there.
- The list lies inside the window and does not fill it; low in the window too.
- Only one open: pressing a second dropdown closes the first's list. Escape closes it, and so does a press outside.
