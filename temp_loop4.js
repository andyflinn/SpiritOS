// spirit/run/process/js/desk/loop.js
'use strict';

const kernel = require('./spirit/run/js/kernel.js');
const path = require('path');
const fs = require('fs');
const http = require('http');

const CONFIG_PATH = 'loop.json';
const PORT = '11111';
const WAIT_MS = 250;

function createOpenAIProcessor() {
  let openAIPending = false;
  let messageQueue = [];
  
  function say(text) { console.log('[openai] ' + text); }
  
  function loadConfig() {
    try {
      const configPath = path.resolve(CONFIG_PATH);
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config.OpenAI) { say("[openai] No OpenAI section in config"); process.exit(1); }
          if (!config.OpenAI.API_KEY) { say("[openai] Missing API_KEY in config"); process.exit(1); }
            process.env.OPENAI_API_KEY = config.OpenAI.API_KEY; say("[openai] Loaded API_KEY from config");
            say('[openai] Loaded API_KEY from config');
          }
          if (config.OpenAI.URL) {
            process.env.OPENAI_URL = config.OpenAI.URL;
            OPENAI_CONFIG = config.OpenAI;
            say('[openai] Loaded URL: ' + config.OpenAI.URL);
          }
        }
      }
    } catch (e) {
      say('[openai] Config error: ' + e.message);
    }
  }
  
  let OPENAI_CONFIG = null;
  loadConfig();
  
  function askOpenAI(userMessage, callback) {
    say('[openai] askOpenAI() called - pending=' + openAIPending + ', config exists: ' + (OPENAI_CONFIG ? 'yes' : 'no'));
    
    if (openAIPending) {
      messageQueue.push({ message: userMessage, callback: callback });
      say('[openai] Message queued - waiting for previous response');
      return;
    }
    
    openAIPending = true;
    say('[openai] Setting pending=true');
    
    if (!OPENAI_CONFIG) {
      say('[openai] NO CONFIG - using fallback');
      callback('I can help with that!');
      return;
    }
    
    const url = OPENAI_CONFIG.URL + '/chat/completions';
    const data = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Reply concisely and clearly.' },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    const options = {
      hostname: '127.0.0.1',
      port: 8888,
      path: url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (process.env.OPENAI_API_KEY || OPENAI_CONFIG.API_KEY),
        'Content-Length': Buffer.byteLength(data)
      }
    };
    
    const req = http.request(options, function (res) {
      let body = '';
      res.on('data', function (chunk) { body += chunk; });
      res.on('end', function () {
        say('[openai] Response received');
        try {
          const result = JSON.parse(body);
          if (result.choices && result.choices.length > 0) {
            say('[openai] Got choice, calling callback');
            callback(result.choices[0].message.content);
            openAIPending = false;  // Release lock IMMEDIATELY
            drainQueue();
          } else {
            say('[openai] No choices');
            callback('Sorry, I could not process your request.');
            openAIPending = false;
            drainQueue();
          }
        } catch (e) {
          say('[openai] Parse error: ' + e.message);
          callback('Error processing your request.');
          openAIPending = false;
          drainQueue();
        }
      });
    });
    
    req.on('error', function (e) {
      say('[openai] Request error: ' + e.message);
      callback('Could not reach AI service.');
      openAIPending = false;
      drainQueue();
    });
    
    req.write(data);
    req.end();
  }
  
  function drainQueue() {
    if (messageQueue.length === 0) {
      say('[openai] Queue empty');
      return;
    }
    say('[openai] Draining queue with ' + messageQueue.length + ' messages');
    while (messageQueue.length > 0 && !openAIPending) {
      const next = messageQueue.shift();
      askOpenAI(next.message, next.callback);
    }
  }
  
  return { askOpenAI };
}

const openaiProcessor = createOpenAIProcessor();
function say(text) { console.log('[loop] ' + text); }

function processMessageLine(line, itemId) {
  try {
    const chatMatch = line.match(/chat\.add\s*\{[^}]*"id"\s*:\s*"([^"]+)"[^}]*"text"\s*:\s*"([^"]+)"/);
    
    if (chatMatch) {
      const messageText = chatMatch[2];
      say('[loop] Found chat.add from ' + itemId);
      say('[loop] Message: ' + messageText);
      
      openaiProcessor.askOpenAI(messageText, function (aiResponse) {
        try {
          say('[loop] AI response: ' + aiResponse.substring(0, 50));
          const replyText = '[loop.js] ' + aiResponse;
          say('[loop] Sending reply to ' + itemId + ': ' + replyText);
          addChat(itemId, replyText);
          say('[loop] Reply sent successfully');
        } catch (e) {
          say('[loop] ERROR sending reply: ' + e.message);
        }
      });
      return;
    }
    
    const jobMatch = line.match(/^JOB\s+(\S+)/);
    if (jobMatch) {
      const itemId2 = jobMatch[1];
      say('[loop] Found job for item: ' + itemId2);
      fetchAndReply(itemId2);
      return;
    }
    
    say('[loop] Unknown line type: ' + line);
  } catch (e) {
    say('[loop] ERROR processing message: ' + e.message);
    say('[loop] Line: ' + line);
  }
}

function fetchAndReply(itemId) {
  const one = {};
  one.deskClient = { desk: { verb: 'item.chat', json: JSON.stringify({ id: itemId }) } };
  
  kernel.core.ask('jobs.api', { ask: one }, 'http://127.0.0.1:' + PORT)
    .then(function (r) {
      const result = r.body || {};
      if (result.chat && Array.isArray(result.chat)) {
        const latest = result.chat[result.chat.length - 1];
        if (latest && latest.text) {
          say('[loop] Message from ' + itemId + ': ' + latest.text.substring(0, 30));
          openaiProcessor.askOpenAI(latest.text, function (aiResponse) {
            try {
              say('[loop] AI response: ' + aiResponse.substring(0, 50));
              const replyText = '[loop.js] ' + aiResponse;
              say('[loop] Sending reply to ' + itemId + ': ' + replyText);
              addChat(itemId, replyText);
              say('[loop] Reply sent successfully');
            } catch (e) {
              say('[loop] ERROR sending reply: ' + e.message);
            }
          });
        }
      }
    })
    .catch(function (e) {
      say('[loop] Error fetching chat: ' + e.message);
    });
}

function waitNext() {
  const one = {};
  one.deskClient = { next: {} };
  
  kernel.core.ask('jobs.api', { ask: one }, 'http://127.0.0.1:' + PORT)
    .then(function (r) {
      const result = r.body || {};
      if (Array.isArray(result.lines)) {
        say('\n=== NEW MESSAGES (' + result.lines.length + ') ===');
        
        result.lines.forEach(function (line, i) {
          say('[' + (i+1) + '] ' + line);
        });
        say('====================\n');
        
        result.lines.forEach(function (line) {
          if (line && line.length > 0) {
            const chatMatch = line.match(/chat\.add\s*\{[^}]*"id"\s*:\s*"([^"]+)"/);
            const itemId = chatMatch ? chatMatch[1] : null;
            
            if (!itemId) {
              const jobMatch = line.match(/^JOB\s+(\S+)/);
              itemId = jobMatch ? jobMatch[1] : null;
            }
            
            if (itemId) {
              say('[loop] Processing message for item: ' + itemId);
              processMessageLine(line, itemId);
            } else {
              say('[loop] Cannot determine item ID for: ' + line);
            }
          }
        });
      }
      setTimeout(waitNext, WAIT_MS);
    })
    .catch(function (e) { 
      say('[loop] Poll error: ' + e.message);
      setTimeout(waitNext, WAIT_MS); 
    });
}

function addChat(itemId, text) {
  const one = {};
  one.deskClient = { desk: { verb: 'chat.add', json: JSON.stringify({ id: itemId, text: text }) } };
  return kernel.core.ask('jobs.api', { ask: one }, 'http://127.0.0.1:' + PORT)
    .then(function (r) {
      try {
        const result = JSON.parse(r.text);
        say('[loop] addChat success: ' + JSON.stringify(result));
        return result;
      } catch (e) {
        say('[loop] addChat parse error: ' + e.message);
        return { ok: true, text: r.text };
      }
    })
    .catch(function (e) {
      say('[loop] addChat error: ' + e.message);
      throw e;
    });
}

say('[loop.js] *** AGENT RUNNING - Listening for nudges via deskClient.next ***\n');
say('[loop.js] OpenAI endpoint: http://127.0.0.1:8888/v1/chat/completions\n');
say('[loop.js] Serial processing enabled (one request at a time)\n');
waitNext();

process.on('SIGINT', function () { 
  say('\n[loop.js] Stopping...');
  process.exit(0); 
});

