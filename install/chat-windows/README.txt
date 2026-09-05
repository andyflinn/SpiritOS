SpiritOS - a sovereign personal operating system
==================================================

This is a plain, zipped copy of SpiritOS. It needs nothing but
Node.js (version 18 or newer) to run - no installer, no "npm
install", nothing else to set up.

HOW TO RUN IT
-------------

1. Make sure Node.js is installed: https://nodejs.org
   (check by running: node --version)

2. This folder contains one subfolder, "run". Open a terminal /
   command prompt INSIDE THAT SUBFOLDER:

       cd run

   This matters - the server refuses to start from anywhere else,
   on purpose.

3. Start the server:

       node js/server.js

4. Open a web browser to:

       http://localhost:65432

   The SpiritOS desktop should load. Leave the terminal window open;
   closing it stops the server.

To use a different port instead of 65432 (for example, to run this
alongside another SpiritOS instance already using 65432):

       node js/server.js --port 65431

(Setting a PORT environment variable first works too, but --port is
simpler.) Run "node js/server.js --help" to see all options.

WHAT THIS IS
------------

A personal desktop, file system, job runner, and local-AI workbench,
all running on your own machine under your own control. Created by
Andy Flinn - andyflinn.com.

OPTIONAL EXTRAS
----------------

A few optional tools under run/process/js/ (AI image captioning,
image stats) have their own small dependencies and need "npm
install" run inside that specific tool's own folder before they'll
work. Nothing else in SpiritOS needs this - everything else just
runs with the plain Node.js command above.
