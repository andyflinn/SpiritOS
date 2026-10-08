// spirit/run/process/js/desk/loop.js
'use strict';

const kernel = require('./spirit/run/js/kernel.js');
const path = require('path');
const fs = require('fs');
const http = require('http');

const CONFIG_PATH = path.join(__dirname, '..', '..', 'loop.json');
const PORT = '11111';
const WAIT_MS = 250; // Wait time between polls (like deskEar)

let intervalId = null;
let waitingNext = false;

// Load config from loop.json
function loadConfig() {
  try {
    const configPath = path.resolve(CONFIG_PATH);
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      
      if (config.SpiritOS && config.SpiritOS.PORT) {
        PORT = config.SpiritOS.PORT;
        say('[loop] Loaded PORT: ' + PORT);
      }
      
      if (config.OpenAI) {
        if (config.OpenAI.API_KEY) {
          process.env.OPENAI_API_KEY = config.OpenAI.API_KEY;
          say('[loop] Loaded OpenAI API_KEY from config');
        }
        if (config.OpenAI.URL) {
          process.env.OPENAI_URL = config.OpenAI.URL;
          say('[loop] Loaded OpenAI URL: ' + config.OpenAI.URL);
          OPENAI_CONFIG = config.OpenAI;
        }
      }
    }
  } catch (e) {
    say('[loop] Config load error: ' + e.message);
  }
}

let OPENAI_CONFIG = null;

loadConfig();

function say(text) { console.log('[loop] ' + text); }

function addChat(itemId, text) {
  const one = {};
  one.deskClient = {
    desk: {
      verb: 'chat.add',
      json: JSON.stringify({ id: itemId, text: text })
    }
  };
  
  return kernel.core.ask('jobs.api', { ask: one }, 'http://127.0.0.1:' + PORT)
    .then(function (r) { 
      say('sent to ' + itemId + ': ' + (JSON.parse(r.text) || {})); 
    })
    .catch(function (e) { 
      say('error sending to ' + itemId + ': ' + e.message); 
    });
}

function sendReply(text) {
  return addChat('desk/G0.0', text);
}

// Persistent wait for nudged messages - this is the KEY FIX
function waitNext() {
  if (waitingNext) return; // Already waiting
  
  waitingNext = true;
  say('[loop] *** WAITING FOR NUDGES ***');
  
  const one = {};
  one.deskClient = { next: {} };
  
  kernel.core.ask('jobs.api', { ask: one }, 'http://127.0.0.1:' + PORT)
    .then(function (r) {
      waitingNext = false;
      
      const result = r.body || {};
      
      if (Array.isArray(result.lines)) {
        say('\n=== NUDGED MESSAGES (' + result.lines.length + ') ===');
        result.lines.forEach(function (line, i) {
          say('[' + (i+1) + '] ' + (line.text || '(no text)'));
        });
        say('====================\n');
        
        // Process each message
        result.lines.forEach(function (line) {
          if (line.text && (line.text.includes('[goal/G0]') || line.text.includes('respond please'))) {
            sendReply('[loop.js] Acknowledged: ' + line.text);
            
            // Send to OpenAI for response
            processWithOpenAI([
              { role: 'system', content: 'You are a helpful assistant. Reply concisely.' },
              { role: 'user', content: line.text }
            ], function (response) {
              if (response) {
                say('[loop] OpenAI response: ' + response);
                addChat('goal/G0.0', '[loop.js] ' + response);
              }
            });
          }
        });
      } else {
        say('[loop] No nudged messages, waiting...\n');
      }
      
      // Keep waiting - this is the key! Don't exit, just wait again after a short pause
      setTimeout(waitNext, WAIT_MS);
    })
    .catch(function (e) {
      waitingNext = false;
      say('[loop] Error: ' + e.message + '\n');
      setTimeout(waitNext, WAIT_MS);
    });
}

// Send message to OpenAI using http module
function processWithOpenAI(messages, callback) {
  if (!OPENAI_CONFIG) {
    say('[loop] No OpenAI config');
    callback(null);
    return;
  }
  
  const url = OPENAI_CONFIG.URL + '/chat/completions';
  
  http.post(url, 
    JSON.stringify({
      model: 'gpt-4o',
      messages: messages,
      temperature: 0.7
    }),
    {
      headers: {
        'Authorization': 'Bearer ' + OPENAI_CONFIG.API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify({
          model: 'gpt-4o',
          messages: messages,
          temperature: 0.7
        }))
      }
    },
    function (res) {
      let data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          const result = JSON.parse(data);
          callback(result.choices[0].message.content);
        } catch (e) {
          say('[loop] OpenAI parse error: ' + e.message);
          callback(null);
        }
      });
    }
  );
}

// Poll for silent new messages (every 5 seconds)
function pollSilent() {
  say('[loop] Checking for silent new messages...');
  
  const one = {};
  one.deskClient = {
    desk: {
      verb: 'item.chat',
      json: JSON.stringify({ id: 'goal/G0.0' })
    }
  };
  
  kernel.core.ask('jobs.api', { ask: one }, 'http://127.0.0.1:' + PORT)
    .then(function (r) {
      const result = r.body || {};
      
      if (Array.isArray(result.chat)) {
        const unread = result.chat.filter(function (line) { 
          return !line.taken || line.taken === false; 
        });
        
        if (unread.length > 0) {
          say('\n=== SILENT NEW MESSAGES IN GOAL/G0 (' + unread.length + ') ===');
          unread.forEach(function (line, i) {
            say('[' + (i+1) + '] [' + line.by + '] ' + line.text);
          });
          say('===============================\n');
          
          unread.forEach(function (line) {
            sendReply('[loop.js] Read: ' + line.text);
            
            processWithOpenAI([
              { role: 'system', content: 'You are a helpful assistant. Reply concisely.' },
              { role: 'user', content: line.text }
            ], function (response) {
              if (response) {
                say('[loop] OpenAI response: ' + response);
                addChat('goal/G0.0', '[loop.js] ' + response);
              }
            });
          });
        } else {
          say('[loop] No new silent messages\n');
        }
      }
    })
    .catch(function (e) {
      say('[loop] Error polling silent: ' + e.message + '\n');
    });
}

// Get visible items and their chats at startup
function getVisibleItems() {
  const one = {};
  one.deskClient = {
    desk: {
      verb: 'items.search',
      json: JSON.stringify({ text: '', currentGoalOnly: false, goalsOnly: true, includeClosed: false })
    }
  };
  
  kernel.core.ask('jobs.api', { ask: one }, 'http://127.0.0.1:' + PORT)
    .then(function (r) {
      const result = r.body || {};
      
      if (Array.isArray(result.items)) {
        say('\n=== VISIBLE ITEMS (' + result.items.length + ') ===');
        result.items.forEach(function (item, i) {
          try {
            const itemData = JSON.parse(item.label);
            say('[' + (i+1) + '] ' + item.key + ': ' + (itemData.label || '(no label)'));
            
            const chatOne = {};
            chatOne.deskClient = {
              desk: {
                verb: 'item.chat',
                json: JSON.stringify({ id: item.key })
              }
            };
            
            kernel.core.ask('jobs.api', { ask: chatOne }, 'http://127.0.0.1:' + PORT)
              .then(function (r) {
                const chatResult = r.body || {};
                if (Array.isArray(chatResult.chat)) {
                  say('\n    Chat for ' + item.key + ' (' + chatResult.chat.length + ' messages):');
                  chatResult.chat.forEach(function (line, j) {
                    say('    [' + (j+1) + '] [' + line.by + '] ' + line.text);
                  });
                  say('    ================================\n');
                }
              })
              .catch(function (e) {
                say('[loop] Error fetching chat for ' + item.key + ': ' + e.message);
              });
          } catch (e) {
            say('[' + (i+1) + '] ' + item.key + ': ' + item.label);
          }
        });
        say('==============================\n');
      } else {
        say('\n=== No visible items\n');
      }
    })
    .catch(function (e) {
      say('[loop] Error fetching items: ' + e.message);
    });
}

// Start up
say('[loop.js] Starting comprehensive desk check...\n');

// First, do a one-time comprehensive check
getVisibleItems();

// Then start the persistent wait loop for nudged messages
waitNext();

// And set up silent polling every 5 seconds
intervalId = setInterval(function () {
  say('[loop] ' + new Date().toISOString() + ' - Silent poll...');
  pollSilent();
}, 5000);

say('[loop.js] *** LOOP STARTED - Waiting for nudges and polling silently ***\n');

process.on('SIGINT', function () {
  say('\n[loop.js] Stopping...');
  if (intervalId) clearInterval(intervalId);
  process.exit(0);
});
