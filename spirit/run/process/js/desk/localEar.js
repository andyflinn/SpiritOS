 'use strict';
 
 // Local Ear - The AI agent's desk listener
 // spirit/run/process/js/desk/localEar.js
 // THE LOCAL AGENT'S DESK LISTENER — continuous loop on your node (goal/G8)
 //
 //   node localEar.js <port>                            wait: ask Desk until lines come, print them, end
 //   node localEar.js <port> <agent-name>               appear as this agent in Desk UI
 //
 // This script listens to Andy's desk through your local node (port 11111),
 // appearing as an agent in the Desk UI. It waits for messages, prints them,
 // and lets you respond interactively.
 
 const kernel = require('../../../js/kernel.js');
 
 const USAGE = 'usage: node localEar.js <your-node-port> [agent-name]';
 const NODE_WAIT_MS = 20000;
 const PAUSE_MS = 250;
 
 const port = Number(process.argv[2]) || 11111;
 const agentName = process.argv[3] || 'localEar';
 
 let timer = null;
 
 if (!Number.isInteger(port) || port <= 0) {
   console.error(USAGE);
   process.exit(2);
 }
 
 function end(code, text, bad) {
   if (bad) {
     console.error(text);
   } else {
     console.log(text);
   }
   process.exit(code);
 }
 
 // Ask Desk for the next lines
 function askNext() {
   return new Promise((resolve, reject) => {
     const one = {};
     one.next = {};
     
     const late = new Promise((resolve, reject) => {
       setTimeout(() => reject(new Error('no answer from node in ' + (NODE_WAIT_MS / 1000) + ' s')), NODE_WAIT_MS);
     });
     
     kernel.core.ask('jobs.api', { ask: { deskClient: one } }, 'http://127.0.0.1:' + port)
       .then(function (r) { clearTimeout(timer); return r; })
       .catch(function (e) { end(1, 'localEar: node on port ' + port + ' did not answer: ' + ((e && e.message) || e), true); });
   });
 }
 
 function refusedBy(r) {
   return r.status !== 200 || !r.body || r.body.ok === false;
 }
 
 // THE WAIT — continuous loop
 function wait() {
   askNext().then(function (r) {
     if (refusedBy(r) || !Array.isArray(r.body.lines)) {
       end(1, 'localEar: ' + r.text, true);
     }
     if (r.body.lines && r.body.lines.length > 0) {
       console.log('\n=== DESK MESSAGE ===');
       r.body.lines.forEach(line => {
         console.log('[' + line.at + '] ' + (line.by || 'unknown') + ':');
         console.log(line.text);
         console.log('====================\n');
       });
       
       // Ask you what to respond with
       process.stdout.write('\n[localEar] Press Enter to skip, or type a response: ');
       const readline = require('readline').createInterface({
         input: process.stdin,
         output: process.stdout
       });
       
       readline.question('', function (answer) {
         readline.close();
         if (answer.trim() === '') {
           end(0, 'skipped');
         } else {
           sendResponse(answer);
         }
       });
     } else {
       setTimeout(wait, PAUSE_MS);
     }
   });
 }
 
 function sendResponse(text) {
   // Update agent state to working
   kernel.core.ask('jobs.api', { verb: 'desk', desk: { 'agent.state': { word: 'working' } } }, 'http://127.0.0.1:' + port)
     .then(function (r) { console.log('[localEar] Sent "working" state'); })
     .catch(function (e) { console.error('[localEar] Error sending state:', e.message); });
   
   // Add response to chat
   kernel.core.ask('jobs.api', { verb: 'desk', desk: { 'chat.add': { id: '', text: text } } }, 'http://127.0.0.1:' + port)
     .then(function (r) { console.log('[localEar] Response sent to Desk'); })
     .catch(function (e) { console.error('[localEar] Error adding chat:', e.message); });
 }
 
 console.log('localEar: listening to Desk on port ' + port + ' as agent "' + agentName + '"...');
 wait();